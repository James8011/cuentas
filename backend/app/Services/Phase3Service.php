<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\CapacitySetting;
use App\Models\Debt;
use App\Models\DebtPayment;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\Household;
use App\Models\HouseholdMembership;
use App\Models\Income;
use App\Models\InternalSettlement;
use App\Models\Payment;
use App\Models\PeriodClose;
use App\Models\RecurrenceTemplate;
use App\Models\SavingsGoal;
use App\Models\SavingsMovement;
use App\Models\User;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class Phase3Service
{
    public function __construct(
        private readonly DecimalMoney $money,
        private readonly AuditLogger $audit,
        private readonly FinancialService $financial,
    ) {}

    /** @return list<array{template_id:int, household_id:int, generated_id:int|null, status:string, message:string}> */
    public function generateDueRecurrences(?CarbonImmutable $asOf = null): array
    {
        $asOf ??= CarbonImmutable::today();
        $results = [];

        $templates = RecurrenceTemplate::query()
            ->where('is_active', true)
            ->whereDate('next_occurrence_on', '<=', $asOf->toDateString())
            ->orderBy('id')
            ->get();

        foreach ($templates as $template) {
            $household = Household::query()->find($template->household_id);
            if (! $household) {
                $results[] = [
                    'template_id' => $template->id,
                    'household_id' => (int) $template->household_id,
                    'generated_id' => null,
                    'status' => 'skipped',
                    'message' => 'Hogar no encontrado',
                ];
                continue;
            }

            $actor = $this->systemActorFor($household);
            if (! $actor) {
                $results[] = [
                    'template_id' => $template->id,
                    'household_id' => $household->id,
                    'generated_id' => null,
                    'status' => 'skipped',
                    'message' => 'Sin usuario activo en el hogar',
                ];
                continue;
            }

            try {
                $date = CarbonImmutable::parse($template->next_occurrence_on)->toDateString();
                $key = 'auto-'.$template->id.'-'.$date;
                $generated = $this->financial->generateRecurrence($actor, $household, $template, $date, $key);
                $results[] = [
                    'template_id' => $template->id,
                    'household_id' => $household->id,
                    'generated_id' => (int) $generated->getKey(),
                    'status' => 'generated',
                    'message' => 'Ocurrencia generada',
                ];
            } catch (\Throwable $exception) {
                $results[] = [
                    'template_id' => $template->id,
                    'household_id' => $household->id,
                    'generated_id' => null,
                    'status' => 'error',
                    'message' => $exception->getMessage(),
                ];
            }
        }

        return $results;
    }

    /** @param array<string, mixed> $data */
    public function createDebt(User $actor, Household $household, array $data): Debt
    {
        $owner = $this->assertMembership($household, (int) $data['owner_membership_id']);
        $shares = $data['responsibilities'] ?? [
            ['membership_id' => $owner->id, 'percentage' => '100.0000'],
        ];
        $allocated = $this->money->allocate($data['current_balance'] ?? $data['principal_amount'], $shares);

        return DB::transaction(function () use ($actor, $household, $data, $owner, $shares, $allocated): Debt {
            $balance = $this->money->normalize($data['current_balance'] ?? $data['principal_amount']);
            $debt = Debt::query()->create([
                'household_id' => $household->id,
                'owner_membership_id' => $owner->id,
                'creditor_name' => $data['creditor_name'],
                'name' => $data['name'],
                'principal_amount' => $this->money->normalize($data['principal_amount']),
                'current_balance' => $balance,
                'minimum_payment' => $this->money->normalize($data['minimum_payment'] ?? '0'),
                'interest_rate_annual' => isset($data['interest_rate_annual'])
                    ? $this->money->normalize($data['interest_rate_annual'], 4)
                    : null,
                'rate_type' => $data['rate_type'] ?? 'effective',
                'currency_code' => strtoupper($data['currency_code']),
                'frequency' => $data['frequency'] ?? 'monthly',
                'opened_on' => $data['opened_on'] ?? now()->toDateString(),
                'next_payment_on' => $data['next_payment_on'] ?? null,
                'status' => 'active',
                'notes' => $data['notes'] ?? null,
            ]);
            foreach ($allocated as $row) {
                $debt->responsibilities()->create([
                    'membership_id' => $row['membership_id'],
                    'percentage' => $row['percentage'],
                ]);
            }
            $this->audit->log('debt.created', $household->id, $debt, newValues: [
                'name' => $debt->name,
                'current_balance' => $debt->current_balance,
                'responsibilities' => $shares,
            ], actor: $actor);

            return $debt->load(['owner.user', 'responsibilities.membership.user', 'payments']);
        });
    }

    /** @param array<string, mixed> $data */
    public function registerDebtPayment(User $actor, Household $household, Debt $debt, array $data): DebtPayment
    {
        $this->assertBelongs($debt, $household);
        if ($debt->status !== 'active') {
            throw new DomainException('Solo se pueden pagar deudas activas.');
        }

        return DB::transaction(function () use ($actor, $household, $debt, $data): DebtPayment {
            $existing = DebtPayment::query()
                ->where('household_id', $household->id)
                ->where('idempotency_key', $data['idempotency_key'])
                ->first();
            if ($existing) {
                return $existing->load(['payer.user', 'account']);
            }

            $locked = Debt::query()->lockForUpdate()->findOrFail($debt->id);
            $payer = $this->assertMembership($household, (int) $data['payer_membership_id']);
            $account = $this->account($household, (int) $data['account_id']);
            if ($account->currency_code !== $locked->currency_code) {
                throw new DomainException('La moneda del pago debe coincidir con la deuda.');
            }
            $amount = $this->money->normalize($data['amount']);
            if (bccomp($amount, '0.0000', 4) <= 0) {
                throw new DomainException('El pago debe ser mayor que cero.');
            }
            if (bccomp($amount, $locked->current_balance, 4) === 1) {
                throw new DomainException('El pago supera el saldo de la deuda.');
            }

            $payment = DebtPayment::query()->create([
                'household_id' => $household->id,
                'debt_id' => $locked->id,
                'payer_membership_id' => $payer->id,
                'account_id' => $account->id,
                'amount' => $amount,
                'currency_code' => $locked->currency_code,
                'paid_on' => $data['paid_on'],
                'idempotency_key' => $data['idempotency_key'],
                'notes' => $data['notes'] ?? null,
            ]);

            $newBalance = bcsub($locked->current_balance, $amount, 4);
            $locked->current_balance = $newBalance;
            if (bccomp($newBalance, '0.0000', 4) === 0) {
                $locked->status = 'paid';
            }
            $locked->save();

            $this->audit->log('debt.payment', $household->id, $payment, newValues: [
                'debt_id' => $locked->id,
                'amount' => $amount,
                'balance_after' => $newBalance,
            ], actor: $actor);

            return $payment->load(['payer.user', 'account']);
        }, 3);
    }

    /** @param array<string, mixed> $data */
    public function updateDebt(User $actor, Household $household, Debt $debt, array $data): Debt
    {
        $this->assertBelongs($debt, $household);
        if ($debt->status === 'cancelled') {
            throw new DomainException('No se puede editar una deuda cancelada.');
        }

        $old = $debt->only(['name', 'creditor_name', 'minimum_payment', 'next_payment_on', 'notes', 'status']);
        $debt->update([
            'name' => $data['name'] ?? $debt->name,
            'creditor_name' => $data['creditor_name'] ?? $debt->creditor_name,
            'minimum_payment' => isset($data['minimum_payment'])
                ? $this->money->normalize($data['minimum_payment'])
                : $debt->minimum_payment,
            'interest_rate_annual' => array_key_exists('interest_rate_annual', $data)
                ? (isset($data['interest_rate_annual']) ? $this->money->normalize($data['interest_rate_annual'], 4) : null)
                : $debt->interest_rate_annual,
            'next_payment_on' => array_key_exists('next_payment_on', $data) ? $data['next_payment_on'] : $debt->next_payment_on,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $debt->notes,
            'status' => $data['status'] ?? $debt->status,
        ]);
        $this->audit->log('debt.updated', $household->id, $debt, oldValues: $old, newValues: $debt->only(['name', 'creditor_name', 'minimum_payment', 'next_payment_on', 'notes', 'status']), actor: $actor);

        return $debt->refresh()->load(['owner.user', 'responsibilities.membership.user', 'payments']);
    }

    public function cancelDebt(User $actor, Household $household, Debt $debt): Debt
    {
        $this->assertBelongs($debt, $household);
        if ($debt->status === 'cancelled') {
            return $debt->load(['owner.user', 'responsibilities.membership.user', 'payments']);
        }
        $old = $debt->status;
        $debt->update(['status' => 'cancelled']);
        $this->audit->log('debt.cancelled', $household->id, $debt, oldValues: ['status' => $old], newValues: ['status' => 'cancelled'], actor: $actor);

        return $debt->refresh()->load(['owner.user', 'responsibilities.membership.user', 'payments']);
    }

    /** @param array<string, mixed> $data */
    public function createSavingsGoal(User $actor, Household $household, array $data): SavingsGoal
    {
        $kind = $data['kind'] ?? 'goal';
        $target = $data['target_amount'] ?? null;
        if ($kind === 'emergency') {
            $months = max(1, (int) ($data['emergency_months'] ?? 3));
            $essential = $this->essentialMonthlyAverage($household);
            $target = bcmul($essential, (string) $months, 4);
            $data['emergency_months'] = $months;
        }
        if (! $target) {
            throw new DomainException('Debes indicar un monto objetivo.');
        }

        $goal = SavingsGoal::query()->create([
            'household_id' => $household->id,
            'owner_membership_id' => $data['owner_membership_id'] ?? null,
            'account_id' => $data['account_id'] ?? null,
            'name' => $data['name'],
            'kind' => $kind,
            'scope' => $data['scope'] ?? 'shared',
            'target_amount' => $this->money->normalize($target),
            'current_amount' => '0.0000',
            'currency_code' => strtoupper($data['currency_code']),
            'emergency_months' => $data['emergency_months'] ?? null,
            'target_on' => $data['target_on'] ?? null,
            'status' => 'active',
            'notes' => $data['notes'] ?? null,
        ]);
        $this->audit->log('savings.created', $household->id, $goal, newValues: $goal->only(['name', 'kind', 'target_amount']), actor: $actor);

        return $goal->load(['owner.user', 'account', 'movements']);
    }

    /** @param array<string, mixed> $data */
    public function updateSavingsGoal(User $actor, Household $household, SavingsGoal $goal, array $data): SavingsGoal
    {
        $this->assertBelongs($goal, $household);
        if ($goal->status === 'cancelled') {
            throw new DomainException('No se puede editar un objetivo cancelado.');
        }

        $old = $goal->only(['name', 'target_amount', 'target_on', 'notes', 'status', 'emergency_months']);
        $target = $goal->target_amount;
        if (($data['kind'] ?? $goal->kind) === 'emergency' && isset($data['emergency_months'])) {
            $months = max(1, (int) $data['emergency_months']);
            $target = bcmul($this->essentialMonthlyAverage($household), (string) $months, 4);
            $data['emergency_months'] = $months;
        } elseif (isset($data['target_amount'])) {
            $target = $this->money->normalize($data['target_amount']);
        }

        $goal->update([
            'name' => $data['name'] ?? $goal->name,
            'target_amount' => $target,
            'emergency_months' => array_key_exists('emergency_months', $data) ? $data['emergency_months'] : $goal->emergency_months,
            'target_on' => array_key_exists('target_on', $data) ? $data['target_on'] : $goal->target_on,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $goal->notes,
            'status' => $data['status'] ?? $goal->status,
            'account_id' => array_key_exists('account_id', $data) ? $data['account_id'] : $goal->account_id,
        ]);
        $this->audit->log('savings.updated', $household->id, $goal, oldValues: $old, newValues: $goal->only(['name', 'target_amount', 'status']), actor: $actor);

        return $goal->refresh()->load(['owner.user', 'account', 'movements']);
    }

    public function cancelSavingsGoal(User $actor, Household $household, SavingsGoal $goal): SavingsGoal
    {
        $this->assertBelongs($goal, $household);
        if ($goal->status === 'cancelled') {
            return $goal->load(['owner.user', 'account', 'movements']);
        }
        $old = $goal->status;
        $goal->update(['status' => 'cancelled']);
        $this->audit->log('savings.cancelled', $household->id, $goal, oldValues: ['status' => $old], newValues: ['status' => 'cancelled'], actor: $actor);

        return $goal->refresh()->load(['owner.user', 'account', 'movements']);
    }

    /** @param array<string, mixed> $data */
    public function moveSavings(User $actor, Household $household, SavingsGoal $goal, array $data): SavingsMovement
    {
        $this->assertBelongs($goal, $household);
        if ($goal->status !== 'active') {
            throw new DomainException('El objetivo no está activo.');
        }

        return DB::transaction(function () use ($actor, $household, $goal, $data): SavingsMovement {
            $locked = SavingsGoal::query()->lockForUpdate()->findOrFail($goal->id);
            $amount = $this->money->normalize($data['amount']);
            $type = $data['type'];
            if (! in_array($type, ['contribution', 'withdrawal'], true)) {
                throw new DomainException('Tipo de movimiento inválido.');
            }
            if ($type === 'withdrawal' && bccomp($amount, $locked->current_amount, 4) === 1) {
                throw new DomainException('El retiro supera el saldo del objetivo.');
            }
            $membership = $this->assertMembership($household, (int) $data['membership_id']);
            $accountId = $data['account_id'] ?? $locked->account_id;
            if ($accountId) {
                $this->account($household, (int) $accountId);
            }

            $movement = SavingsMovement::query()->create([
                'household_id' => $household->id,
                'savings_goal_id' => $locked->id,
                'membership_id' => $membership->id,
                'account_id' => $accountId,
                'type' => $type,
                'amount' => $amount,
                'currency_code' => $locked->currency_code,
                'moved_on' => $data['moved_on'] ?? now()->toDateString(),
                'notes' => $data['notes'] ?? null,
            ]);

            $locked->current_amount = $type === 'contribution'
                ? bcadd($locked->current_amount, $amount, 4)
                : bcsub($locked->current_amount, $amount, 4);
            $locked->save();

            $this->audit->log('savings.moved', $household->id, $movement, newValues: [
                'type' => $type,
                'amount' => $amount,
                'balance_after' => $locked->current_amount,
            ], actor: $actor);

            return $movement->load(['membership.user', 'account']);
        }, 3);
    }

    /** @param array<string, mixed> $data */
    public function createBudget(User $actor, Household $household, array $data): Budget
    {
        return DB::transaction(function () use ($actor, $household, $data): Budget {
            $budget = Budget::query()->create([
                'household_id' => $household->id,
                'owner_membership_id' => $data['owner_membership_id'] ?? null,
                'name' => $data['name'],
                'scope' => $data['scope'] ?? 'shared',
                'period' => $data['period'],
                'currency_code' => strtoupper($data['currency_code']),
                'status' => 'open',
            ]);
            foreach ($data['lines'] as $line) {
                $this->category($household, (int) $line['category_id']);
                $budget->lines()->create([
                    'category_id' => (int) $line['category_id'],
                    'planned_amount' => $this->money->normalize($line['planned_amount']),
                ]);
            }
            $this->audit->log('budget.created', $household->id, $budget, newValues: [
                'period' => $budget->period,
                'lines' => count($data['lines']),
            ], actor: $actor);

            return $budget->load(['lines.category', 'owner.user']);
        });
    }

    /** @param array<string, mixed> $data */
    public function updateBudget(User $actor, Household $household, Budget $budget, array $data): Budget
    {
        $this->assertBelongs($budget, $household);
        if ($budget->status === 'closed') {
            throw new DomainException('No se puede editar un presupuesto cerrado.');
        }

        return DB::transaction(function () use ($actor, $household, $budget, $data): Budget {
            $old = $budget->only(['name', 'status']);
            $budget->update([
                'name' => $data['name'] ?? $budget->name,
            ]);
            if (isset($data['lines']) && is_array($data['lines'])) {
                $budget->lines()->delete();
                foreach ($data['lines'] as $line) {
                    $this->category($household, (int) $line['category_id']);
                    $budget->lines()->create([
                        'category_id' => (int) $line['category_id'],
                        'planned_amount' => $this->money->normalize($line['planned_amount']),
                    ]);
                }
            }
            $this->audit->log('budget.updated', $household->id, $budget, oldValues: $old, newValues: ['name' => $budget->name], actor: $actor);

            return $budget->refresh()->load(['lines.category', 'owner.user']);
        });
    }

    public function cancelBudget(User $actor, Household $household, Budget $budget): Budget
    {
        $this->assertBelongs($budget, $household);
        if ($budget->status === 'closed') {
            throw new DomainException('Un presupuesto cerrado no se cancela; ya es histórico.');
        }
        $old = $budget->status;
        $budget->update(['status' => 'cancelled']);
        $this->audit->log('budget.cancelled', $household->id, $budget, oldValues: ['status' => $old], newValues: ['status' => 'cancelled'], actor: $actor);

        return $budget->refresh()->load(['lines.category', 'owner.user']);
    }

    /** @return array<string, mixed> */
    public function budgetTracking(Household $household, Budget $budget): array
    {
        $this->assertBelongs($budget, $household);
        [$start, $end] = $this->periodBounds($budget->period);
        $lines = [];
        foreach ($budget->lines()->with('category')->get() as $line) {
            $committed = Expense::query()
                ->where('household_id', $household->id)
                ->where('category_id', $line->category_id)
                ->whereNotIn('status', ['cancelled', 'planned'])
                ->whereBetween('occurred_on', [$start, $end])
                ->sum('amount');
            $paid = Payment::query()
                ->where('household_id', $household->id)
                ->whereBetween('paid_on', [$start, $end])
                ->whereHas('expense', fn ($q) => $q->where('category_id', $line->category_id))
                ->sum('amount');
            $planned = (string) $line->planned_amount;
            $committed = bcadd((string) $committed, '0', 4);
            $paid = bcadd((string) $paid, '0', 4);
            $lines[] = [
                'category_id' => $line->category_id,
                'category_name' => $line->category?->name,
                'planned_amount' => $planned,
                'committed_amount' => $committed,
                'paid_amount' => $paid,
                'available_amount' => bcsub($planned, $committed, 4),
            ];
        }

        return [
            'budget' => $budget->load(['lines.category', 'owner.user']),
            'lines' => $lines,
        ];
    }

    /** @return array<string, mixed> */
    public function cashFlow(Household $household, string $period): array
    {
        [$start, $end] = $this->periodBounds($period);
        $incomes = Income::query()
            ->where('household_id', $household->id)
            ->where('status', 'received')
            ->whereBetween('effective_on', [$start, $end])
            ->get(['id', 'net_amount', 'effective_on', 'currency_code', 'category_id']);
        $expenses = Expense::query()
            ->where('household_id', $household->id)
            ->whereNotIn('status', ['cancelled', 'planned'])
            ->whereBetween('occurred_on', [$start, $end])
            ->get(['id', 'amount', 'occurred_on', 'currency_code', 'category_id', 'status']);
        $incomeTotal = $incomes->reduce(fn (string $s, $i) => bcadd($s, (string) $i->net_amount, 4), '0.0000');
        $expenseTotal = $expenses->reduce(fn (string $s, $e) => bcadd($s, (string) $e->amount, 4), '0.0000');

        $byDay = [];
        foreach ($incomes as $income) {
            $day = $income->effective_on?->toDateString() ?? $start;
            $byDay[$day]['in'] = bcadd($byDay[$day]['in'] ?? '0.0000', (string) $income->net_amount, 4);
        }
        foreach ($expenses as $expense) {
            $day = $expense->occurred_on?->toDateString() ?? $start;
            $byDay[$day]['out'] = bcadd($byDay[$day]['out'] ?? '0.0000', (string) $expense->amount, 4);
        }
        ksort($byDay);
        $running = '0.0000';
        $timeline = [];
        $warnings = [];
        foreach ($byDay as $day => $row) {
            $in = $row['in'] ?? '0.0000';
            $out = $row['out'] ?? '0.0000';
            $running = bcadd(bcsub($running, $out, 4), $in, 4);
            $timeline[] = [
                'date' => $day,
                'inflow' => $in,
                'outflow' => $out,
                'running_balance' => $running,
            ];
            if (bccomp($running, '0.0000', 4) < 0) {
                $warnings[] = ['date' => $day, 'message' => 'Saldo proyectado negativo'];
            }
        }

        return [
            'period' => $period,
            'income_total' => $incomeTotal,
            'expense_total' => $expenseTotal,
            'net' => bcsub($incomeTotal, $expenseTotal, 4),
            'timeline' => $timeline,
            'warnings' => $warnings,
        ];
    }

    public function closePeriod(User $actor, Household $household, string $period): PeriodClose
    {
        if (PeriodClose::query()->where('household_id', $household->id)->where('period', $period)->exists()) {
            throw new DomainException('El período ya está cerrado.');
        }
        $membership = $this->financial->membership($actor, $household);
        $snapshot = [
            'cash_flow' => $this->cashFlow($household, $period),
            'balances' => $this->financial->internalBalances($household),
            'debts' => Debt::query()->where('household_id', $household->id)->get()->toArray(),
            'savings' => SavingsGoal::query()->where('household_id', $household->id)->get()->toArray(),
            'closed_at' => now()->toIso8601String(),
        ];
        $close = PeriodClose::query()->create([
            'household_id' => $household->id,
            'closed_by_membership_id' => $membership->id,
            'period' => $period,
            'snapshot' => $snapshot,
            'closed_at' => now(),
        ]);
        Budget::query()
            ->where('household_id', $household->id)
            ->where('period', $period)
            ->update(['status' => 'closed']);
        $this->audit->log('period.closed', $household->id, $close, newValues: ['period' => $period], actor: $actor);

        return $close;
    }

    /**
     * @param  list<int>  $membershipIds
     * @return list<array{membership_id:int, percentage:string}>
     */
    public function proportionalShares(Household $household, array $membershipIds, string $mode = 'income'): array
    {
        if ($membershipIds === []) {
            throw new DomainException('Selecciona al menos un integrante.');
        }
        $weights = [];
        foreach ($membershipIds as $membershipId) {
            $this->assertMembership($household, $membershipId);
            $income = Income::query()
                ->where('household_id', $household->id)
                ->where('owner_membership_id', $membershipId)
                ->where('status', 'received')
                ->orderByDesc('effective_on')
                ->value('net_amount');
            $weight = $income ? (string) $income : '0.0000';
            if ($mode === 'capacity') {
                $setting = CapacitySetting::query()
                    ->where('household_id', $household->id)
                    ->where('membership_id', $membershipId)
                    ->first();
                $fixed = $setting ? (string) $setting->fixed_deduction : '0.0000';
                $percent = $setting ? (string) $setting->percent_deduction : '0.0000';
                $afterFixed = bcsub($weight, $fixed, 4);
                if (bccomp($afterFixed, '0', 4) < 0) {
                    $afterFixed = '0.0000';
                }
                $deduction = bcdiv(bcmul($afterFixed, $percent, 8), '100', 4);
                $weight = bcsub($afterFixed, $deduction, 4);
            }
            $weights[$membershipId] = bccomp($weight, '0', 4) > 0 ? $weight : '0.0000';
        }

        $total = array_reduce($weights, fn (string $s, string $w) => bcadd($s, $w, 4), '0.0000');
        if (bccomp($total, '0.0000', 4) === 0) {
            $equal = bcdiv('100.0000', (string) count($membershipIds), 4);
            $shares = [];
            $sum = '0.0000';
            foreach ($membershipIds as $index => $id) {
                $isLast = $index === array_key_last($membershipIds);
                $pct = $isLast ? bcsub('100.0000', $sum, 4) : $equal;
                $sum = bcadd($sum, $pct, 4);
                $shares[] = ['membership_id' => $id, 'percentage' => $pct];
            }

            return $shares;
        }

        $shares = [];
        $sum = '0.0000';
        $last = array_key_last($membershipIds);
        foreach ($membershipIds as $index => $id) {
            $isLast = $index === $last;
            $pct = $isLast
                ? bcsub('100.0000', $sum, 4)
                : bcdiv(bcmul($weights[$id], '100', 8), $total, 4);
            $sum = bcadd($sum, $pct, 4);
            $shares[] = ['membership_id' => $id, 'percentage' => $pct];
        }

        return $shares;
    }

    /** @param array<string, mixed> $data */
    public function settleInternal(User $actor, Household $household, array $data): InternalSettlement
    {
        $from = $this->assertMembership($household, (int) $data['from_membership_id']);
        $to = $this->assertMembership($household, (int) $data['to_membership_id']);
        if ($from->id === $to->id) {
            throw new DomainException('La compensación debe ser entre dos integrantes distintos.');
        }
        $amount = $this->money->normalize($data['amount']);
        if (bccomp($amount, '0', 4) <= 0) {
            throw new DomainException('El monto debe ser mayor que cero.');
        }
        if (! empty($data['account_id'])) {
            $this->account($household, (int) $data['account_id']);
        }

        $settlement = InternalSettlement::query()->create([
            'household_id' => $household->id,
            'from_membership_id' => $from->id,
            'to_membership_id' => $to->id,
            'account_id' => $data['account_id'] ?? null,
            'amount' => $amount,
            'currency_code' => strtoupper($data['currency_code']),
            'settled_on' => $data['settled_on'] ?? now()->toDateString(),
            'notes' => $data['notes'] ?? null,
        ]);
        $this->audit->log('settlement.created', $household->id, $settlement, newValues: [
            'from' => $from->id,
            'to' => $to->id,
            'amount' => $amount,
        ], actor: $actor);

        return $settlement->load(['fromMembership.user', 'toMembership.user', 'account']);
    }

    /** Binary content of an .xlsx monthly report. */
    public function exportMonthlyXlsx(Household $household, string $period): string
    {
        [$start, $end] = $this->periodBounds($period);
        $cash = $this->cashFlow($household, $period);

        $incomes = Income::query()
            ->where('household_id', $household->id)
            ->where(function ($q) use ($start, $end) {
                $q->whereBetween('effective_on', [$start, $end])
                    ->orWhereBetween('expected_on', [$start, $end]);
            })
            ->with(['owner.user', 'category', 'account'])
            ->orderBy('effective_on')
            ->orderBy('expected_on')
            ->get();

        $expenses = Expense::query()
            ->where('household_id', $household->id)
            ->whereBetween('occurred_on', [$start, $end])
            ->with(['category', 'creator.user', 'beneficiary.user'])
            ->orderBy('occurred_on')
            ->get();

        $expensePayments = Payment::query()
            ->where('household_id', $household->id)
            ->whereBetween('paid_on', [$start, $end])
            ->with(['payer.user', 'account', 'expense.category'])
            ->orderBy('paid_on')
            ->get();

        $debts = Debt::query()
            ->where('household_id', $household->id)
            ->with(['owner.user'])
            ->orderByDesc('id')
            ->get();

        $debtPayments = DebtPayment::query()
            ->where('household_id', $household->id)
            ->whereBetween('paid_on', [$start, $end])
            ->with(['debt', 'payer.user', 'account'])
            ->orderBy('paid_on')
            ->get();

        $settlements = InternalSettlement::query()
            ->where('household_id', $household->id)
            ->whereBetween('settled_on', [$start, $end])
            ->with(['fromMembership.user', 'toMembership.user', 'account'])
            ->orderBy('settled_on')
            ->get();

        $savingsMoves = SavingsMovement::query()
            ->where('household_id', $household->id)
            ->whereBetween('moved_on', [$start, $end])
            ->with(['savingsGoal', 'membership.user', 'account'])
            ->orderBy('moved_on')
            ->get();

        $audits = AuditLog::query()
            ->where('household_id', $household->id)
            ->whereBetween('created_at', [$start.' 00:00:00', $end.' 23:59:59'])
            ->with('actor')
            ->orderBy('created_at')
            ->get();

        $movements = [];
        foreach ($incomes as $income) {
            $date = optional($income->effective_on)->toDateString()
                ?? optional($income->expected_on)->toDateString()
                ?? $start;
            $movements[] = [
                'tipo' => 'Ingreso',
                'id' => $income->id,
                'fecha' => $date,
                'estado' => $income->status,
                'monto' => (string) $income->net_amount,
                'moneda' => $income->currency_code,
                'descripcion' => $income->category?->name ?? 'Ingreso',
                'detalle' => trim(implode(' · ', array_filter([
                    $income->owner?->user?->name,
                    $income->kind,
                    $income->scope,
                    $income->notes,
                ]))),
            ];
        }
        foreach ($expenses as $expense) {
            $movements[] = [
                'tipo' => 'Gasto',
                'id' => $expense->id,
                'fecha' => optional($expense->occurred_on)->toDateString() ?? $start,
                'estado' => $expense->status,
                'monto' => (string) $expense->amount,
                'moneda' => $expense->currency_code,
                'descripcion' => $expense->category?->name ?? 'Gasto',
                'detalle' => trim(implode(' · ', array_filter([
                    $expense->scope,
                    $expense->classification,
                    $expense->creator?->user?->name ? 'Creado por '.$expense->creator->user->name : null,
                    $expense->notes,
                ]))),
            ];
        }
        foreach ($expensePayments as $payment) {
            $movements[] = [
                'tipo' => 'Pago de gasto',
                'id' => $payment->id,
                'fecha' => optional($payment->paid_on)->toDateString() ?? $start,
                'estado' => 'paid',
                'monto' => (string) $payment->amount,
                'moneda' => $payment->currency_code,
                'descripcion' => $payment->expense?->category?->name
                    ? 'Pago: '.$payment->expense->category->name
                    : 'Pago de gasto #'.($payment->expense_id ?? ''),
                'detalle' => trim(implode(' · ', array_filter([
                    $payment->payer?->user?->name,
                    $payment->account?->name,
                    $payment->notes,
                ]))),
            ];
        }
        foreach ($debtPayments as $payment) {
            $movements[] = [
                'tipo' => 'Pago de deuda',
                'id' => $payment->id,
                'fecha' => optional($payment->paid_on)->toDateString() ?? $start,
                'estado' => 'paid',
                'monto' => (string) $payment->amount,
                'moneda' => $payment->currency_code,
                'descripcion' => $payment->debt?->name ?? 'Deuda',
                'detalle' => trim(implode(' · ', array_filter([
                    $payment->debt?->creditor_name,
                    $payment->payer?->user?->name,
                    $payment->account?->name,
                    $payment->notes,
                ]))),
            ];
        }
        foreach ($settlements as $settlement) {
            $from = $settlement->fromMembership?->user?->name ?? '—';
            $to = $settlement->toMembership?->user?->name ?? '—';
            $movements[] = [
                'tipo' => 'Compensación',
                'id' => $settlement->id,
                'fecha' => optional($settlement->settled_on)->toDateString() ?? $start,
                'estado' => 'registrada',
                'monto' => (string) $settlement->amount,
                'moneda' => $settlement->currency_code,
                'descripcion' => "{$from} → {$to}",
                'detalle' => $settlement->notes ?? '',
            ];
        }
        foreach ($savingsMoves as $move) {
            $movements[] = [
                'tipo' => $move->type === 'withdrawal' ? 'Retiro ahorro' : 'Aporte ahorro',
                'id' => $move->id,
                'fecha' => optional($move->moved_on)->toDateString() ?? $start,
                'estado' => $move->type,
                'monto' => (string) $move->amount,
                'moneda' => $move->currency_code,
                'descripcion' => $move->savingsGoal?->name ?? 'Ahorro',
                'detalle' => trim(implode(' · ', array_filter([
                    $move->membership?->user?->name,
                    $move->account?->name,
                    $move->notes,
                ]))),
            ];
        }
        usort($movements, fn (array $a, array $b) => [$a['fecha'], $a['tipo'], $a['id']] <=> [$b['fecha'], $b['tipo'], $b['id']]);

        $spreadsheet = new Spreadsheet();
        $spreadsheet->getProperties()
            ->setCreator('Núcleo financiero')
            ->setTitle("Reporte {$period}")
            ->setDescription("Reporte mensual del hogar {$household->name}");

        $resumen = $spreadsheet->getActiveSheet();
        $resumen->setTitle('Resumen');
        $this->writeSheetRows($resumen, [
            ['Hogar', $household->name],
            ['Período', $period],
            ['Desde', $start],
            ['Hasta', $end],
            [],
            ['Concepto', 'Monto'],
            ['Ingresos recibidos', $cash['income_total']],
            ['Gastos del mes', $cash['expense_total']],
            ['Neto', $cash['net']],
            [],
            ['Conteo movimientos', (string) count($movements)],
            ['Ingresos (registros)', (string) $incomes->count()],
            ['Gastos (registros)', (string) $expenses->count()],
            ['Pagos de gastos', (string) $expensePayments->count()],
            ['Pagos de deudas', (string) $debtPayments->count()],
            ['Compensaciones', (string) $settlements->count()],
            ['Movimientos de ahorro', (string) $savingsMoves->count()],
            ['Eventos de auditoría', (string) $audits->count()],
            ['Deudas activas (snapshot)', (string) $debts->where('status', 'active')->count()],
        ]);

        $movimientosSheet = $spreadsheet->createSheet();
        $movimientosSheet->setTitle('Movimientos');
        $this->writeSheetRows($movimientosSheet, [
            ['Tipo', 'ID', 'Fecha', 'Estado', 'Monto', 'Moneda', 'Descripción', 'Detalle'],
            ...array_map(fn (array $m) => [
                $m['tipo'], $m['id'], $m['fecha'], $m['estado'], $m['monto'], $m['moneda'], $m['descripcion'], $m['detalle'],
            ], $movements),
        ]);

        $ingresosSheet = $spreadsheet->createSheet();
        $ingresosSheet->setTitle('Ingresos');
        $this->writeSheetRows($ingresosSheet, [
            ['ID', 'Fecha efectiva', 'Fecha esperada', 'Estado', 'Tipo', 'Ámbito', 'Categoría', 'Titular', 'Cuenta', 'Bruto', 'Neto', 'Moneda', 'Notas'],
            ...$incomes->map(fn (Income $i) => [
                $i->id,
                optional($i->effective_on)->toDateString(),
                optional($i->expected_on)->toDateString(),
                $i->status,
                $i->kind,
                $i->scope,
                $i->category?->name,
                $i->owner?->user?->name,
                $i->account?->name,
                $i->gross_amount,
                $i->net_amount,
                $i->currency_code,
                $i->notes,
            ])->all(),
        ]);

        $gastosSheet = $spreadsheet->createSheet();
        $gastosSheet->setTitle('Gastos');
        $this->writeSheetRows($gastosSheet, [
            ['ID', 'Fecha', 'Estado', 'Ámbito', 'Clasificación', 'Categoría', 'Creado por', 'Beneficiario', 'Monto', 'Moneda', 'Notas'],
            ...$expenses->map(fn (Expense $e) => [
                $e->id,
                optional($e->occurred_on)->toDateString(),
                $e->status,
                $e->scope,
                $e->classification,
                $e->category?->name,
                $e->creator?->user?->name,
                $e->beneficiary?->user?->name,
                $e->amount,
                $e->currency_code,
                $e->notes,
            ])->all(),
        ]);

        $pagosGastoSheet = $spreadsheet->createSheet();
        $pagosGastoSheet->setTitle('Pagos gastos');
        $this->writeSheetRows($pagosGastoSheet, [
            ['ID', 'Fecha', 'Gasto ID', 'Categoría gasto', 'Pagador', 'Cuenta', 'Monto', 'Moneda', 'Notas'],
            ...$expensePayments->map(fn (Payment $p) => [
                $p->id,
                optional($p->paid_on)->toDateString(),
                $p->expense_id,
                $p->expense?->category?->name,
                $p->payer?->user?->name,
                $p->account?->name,
                $p->amount,
                $p->currency_code,
                $p->notes,
            ])->all(),
        ]);

        $deudasSheet = $spreadsheet->createSheet();
        $deudasSheet->setTitle('Deudas');
        $this->writeSheetRows($deudasSheet, [
            ['ID', 'Nombre', 'Acreedor', 'Titular', 'Estado', 'Principal', 'Saldo actual', 'Cuota mínima', 'Moneda', 'Próximo pago', 'Apertura', 'Notas'],
            ...$debts->map(fn (Debt $d) => [
                $d->id,
                $d->name,
                $d->creditor_name,
                $d->owner?->user?->name,
                $d->status,
                $d->principal_amount,
                $d->current_balance,
                $d->minimum_payment,
                $d->currency_code,
                optional($d->next_payment_on)->toDateString(),
                optional($d->opened_on)->toDateString(),
                $d->notes,
            ])->all(),
        ]);

        $pagosDeudaSheet = $spreadsheet->createSheet();
        $pagosDeudaSheet->setTitle('Pagos deudas');
        $this->writeSheetRows($pagosDeudaSheet, [
            ['ID', 'Fecha', 'Deuda', 'Acreedor', 'Pagador', 'Cuenta', 'Monto', 'Moneda', 'Notas'],
            ...$debtPayments->map(fn (DebtPayment $p) => [
                $p->id,
                optional($p->paid_on)->toDateString(),
                $p->debt?->name,
                $p->debt?->creditor_name,
                $p->payer?->user?->name,
                $p->account?->name,
                $p->amount,
                $p->currency_code,
                $p->notes,
            ])->all(),
        ]);

        $compSheet = $spreadsheet->createSheet();
        $compSheet->setTitle('Compensaciones');
        $this->writeSheetRows($compSheet, [
            ['ID', 'Fecha', 'Paga (debe)', 'Recibe (adelantó)', 'Cuenta', 'Monto', 'Moneda', 'Notas'],
            ...$settlements->map(fn (InternalSettlement $s) => [
                $s->id,
                optional($s->settled_on)->toDateString(),
                $s->fromMembership?->user?->name,
                $s->toMembership?->user?->name,
                $s->account?->name,
                $s->amount,
                $s->currency_code,
                $s->notes,
            ])->all(),
        ]);

        $ahorrosSheet = $spreadsheet->createSheet();
        $ahorrosSheet->setTitle('Ahorros');
        $this->writeSheetRows($ahorrosSheet, [
            ['ID', 'Fecha', 'Tipo', 'Meta', 'Integrante', 'Cuenta', 'Monto', 'Moneda', 'Notas'],
            ...$savingsMoves->map(fn (SavingsMovement $m) => [
                $m->id,
                optional($m->moved_on)->toDateString(),
                $m->type,
                $m->savingsGoal?->name,
                $m->membership?->user?->name,
                $m->account?->name,
                $m->amount,
                $m->currency_code,
                $m->notes,
            ])->all(),
        ]);

        $auditSheet = $spreadsheet->createSheet();
        $auditSheet->setTitle('Auditoría');
        $this->writeSheetRows($auditSheet, [
            ['ID', 'Fecha/hora', 'Actor', 'Acción', 'Entidad', 'Entidad ID', 'Antes', 'Después'],
            ...$audits->map(fn (AuditLog $log) => [
                $log->id,
                optional($log->created_at)?->format('Y-m-d H:i:s'),
                $log->actor?->name ?? 'Sistema',
                $log->action,
                class_basename((string) $log->auditable_type),
                $log->auditable_id,
                $log->old_values ? json_encode($log->old_values, JSON_UNESCAPED_UNICODE) : '',
                $log->new_values ? json_encode($log->new_values, JSON_UNESCAPED_UNICODE) : '',
            ])->all(),
        ]);

        $spreadsheet->setActiveSheetIndex(0);

        $tmp = tmpfile();
        if ($tmp === false) {
            throw new DomainException('No se pudo generar el archivo Excel.');
        }
        $path = stream_get_meta_data($tmp)['uri'];
        (new Xlsx($spreadsheet))->save($path);
        rewind($tmp);
        $binary = stream_get_contents($tmp);
        fclose($tmp);
        $spreadsheet->disconnectWorksheets();

        if ($binary === false) {
            throw new DomainException('No se pudo leer el archivo Excel generado.');
        }

        return $binary;
    }

    /** @param list<list<mixed>|array<int, mixed>> $rows */
    private function writeSheetRows(Worksheet $sheet, array $rows): void
    {
        foreach ($rows as $r => $row) {
            foreach (array_values($row) as $c => $value) {
                $sheet->setCellValue([$c + 1, $r + 1], $value);
            }
        }
        if ($rows !== []) {
            $sheet->getStyle('1:1')->getFont()->setBold(true);
        }
        foreach (range(1, max(1, count($rows[0] ?? [1]))) as $col) {
            $sheet->getColumnDimensionByColumn($col)->setAutoSize(true);
        }
    }

    private function essentialMonthlyAverage(Household $household): string
    {
        $from = now()->subMonths(3)->toDateString();
        $total = Expense::query()
            ->where('household_id', $household->id)
            ->where('classification', 'essential')
            ->whereNotIn('status', ['cancelled', 'planned'])
            ->where('occurred_on', '>=', $from)
            ->sum('amount');

        return bcdiv(bcadd((string) $total, '0', 4), '3', 4);
    }

    /** @return array{0:string,1:string} */
    private function periodBounds(string $period): array
    {
        if (! preg_match('/^\d{4}-\d{2}$/', $period)) {
            throw new DomainException('El período debe ser YYYY-MM.');
        }
        $start = CarbonImmutable::createFromFormat('Y-m-d', $period.'-01')->startOfMonth();

        return [$start->toDateString(), $start->endOfMonth()->toDateString()];
    }

    private function systemActorFor(Household $household): ?User
    {
        $membership = HouseholdMembership::query()
            ->where('household_id', $household->id)
            ->where('status', 'active')
            ->orderBy('id')
            ->first();

        return $membership?->user;
    }

    private function assertMembership(Household $household, int $id): HouseholdMembership
    {
        return HouseholdMembership::query()
            ->where('household_id', $household->id)
            ->where('status', 'active')
            ->findOrFail($id);
    }

    private function account(Household $household, int $id): FinancialAccount
    {
        return FinancialAccount::query()
            ->where('household_id', $household->id)
            ->where('is_active', true)
            ->findOrFail($id);
    }

    private function category(Household $household, int $id): FinancialCategory
    {
        return FinancialCategory::query()
            ->where('household_id', $household->id)
            ->findOrFail($id);
    }

    private function assertBelongs(object $model, Household $household): void
    {
        if ((int) $model->household_id !== (int) $household->id) {
            abort(404);
        }
    }
}
