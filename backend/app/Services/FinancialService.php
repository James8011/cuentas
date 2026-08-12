<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\Household;
use App\Models\HouseholdMembership;
use App\Models\Income;
use App\Models\Payment;
use App\Models\RecurrenceTemplate;
use App\Models\User;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FinancialService
{
    public function __construct(
        private readonly DecimalMoney $money,
        private readonly AuditLogger $audit,
        private readonly PermissionResolver $permissions,
    ) {}

    public function membership(User $user, Household $household): HouseholdMembership
    {
        return HouseholdMembership::query()
            ->where('household_id', $household->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->firstOrFail();
    }

    public function hasPermission(User $user, Household $household, string $permission): bool
    {
        return $this->permissions->userHas($user, $household->id, $permission);
    }

    /** @return Collection<int, Income> */
    public function visibleIncomes(User $user, Household $household): Collection
    {
        $membership = $this->membership($user, $household);
        $keys = $this->permissions->forMembership($membership);

        return Income::query()
            ->with(['owner.user', 'account', 'category'])
            ->where('household_id', $household->id)
            ->where(function ($query) use ($membership, $keys): void {
                if (in_array('ingresos.ver_ajenos', $keys, true)) {
                    return;
                }
                $query->where('owner_membership_id', $membership->id);
                if (in_array('ingresos.ver_compartidos', $keys, true)) {
                    $query->orWhere('scope', 'shared');
                }
            })
            ->orderByDesc('effective_on')
            ->orderByDesc('id')
            ->get();
    }

    /** @return Collection<int, Expense> */
    public function visibleExpenses(User $user, Household $household): Collection
    {
        $membership = $this->membership($user, $household);
        $keys = $this->permissions->forMembership($membership);

        return Expense::query()
            ->with(['creator.user', 'beneficiary.user', 'category', 'shares.membership.user', 'payments.payer.user', 'payments.account'])
            ->where('household_id', $household->id)
            ->where(function ($query) use ($membership, $keys): void {
                if (in_array('gastos.ver_ajenos', $keys, true)) {
                    return;
                }
                $query->where('created_by_membership_id', $membership->id)
                    ->orWhere('beneficiary_membership_id', $membership->id)
                    ->orWhereHas('shares', fn ($share) => $share->where('membership_id', $membership->id));
                if (in_array('gastos.ver_compartidos', $keys, true)) {
                    $query->orWhere('scope', 'shared');
                }
            })
            ->orderByDesc('occurred_on')
            ->orderByDesc('id')
            ->get();
    }

    /** @param array<string, mixed> $data */
    public function createIncome(User $actor, Household $household, array $data): Income
    {
        $actorMembership = $this->membership($actor, $household);
        $effectivePermissions = $this->permissions->forMembership($actorMembership);
        if ((int) $data['owner_membership_id'] !== $actorMembership->id
            && ! in_array('ingresos.editar_ajenos', $effectivePermissions, true)) {
            abort(403);
        }
        $this->assertMembership($household, (int) $data['owner_membership_id']);
        $category = $this->category($household, (int) $data['category_id'], 'income');
        $account = isset($data['account_id']) ? $this->account($household, (int) $data['account_id']) : null;
        $currency = strtoupper($data['currency_code']);

        if ($account && $account->currency_code !== $currency) {
            throw new DomainException('La moneda del ingreso debe coincidir con la cuenta destino.');
        }

        return DB::transaction(function () use ($actor, $household, $data, $category, $account, $currency): Income {
            $income = Income::query()->create([
                ...$data,
                'household_id' => $household->id,
                'account_id' => $account?->id,
                'category_id' => $category->id,
                'currency_code' => $currency,
                'gross_amount' => isset($data['gross_amount']) ? $this->money->normalize($data['gross_amount']) : null,
                'net_amount' => $this->money->normalize($data['net_amount']),
            ]);
            $this->audit->log('income.created', $household->id, $income, newValues: $income->only(['kind', 'scope', 'net_amount', 'currency_code', 'status']), actor: $actor);

            return $income->load(['owner.user', 'account', 'category']);
        });
    }

    /**
     * Programa un ingreso en estado esperado y, si es recurrente, crea la plantilla
     * dejando la próxima generación después de la primera ocurrencia.
     *
     * @param  array<string, mixed>  $data
     */
    public function scheduleIncome(User $actor, Household $household, array $data): Income
    {
        $frequency = $data['frequency'] ?? 'once';
        $expectedOn = $data['expected_on'] ?? $data['effective_on'] ?? now()->toDateString();
        $data['status'] = 'expected';
        $data['expected_on'] = $expectedOn;
        $data['effective_on'] = $data['effective_on'] ?? $expectedOn;

        return DB::transaction(function () use ($actor, $household, $data, $frequency, $expectedOn): Income {
            $income = $this->createIncome($actor, $household, $data);

            if (! in_array($frequency, ['weekly', 'biweekly', 'monthly'], true)) {
                return $income;
            }

            $payload = [
                'owner_membership_id' => (int) $data['owner_membership_id'],
                'account_id' => $data['account_id'] ?? null,
                'category_id' => (int) $data['category_id'],
                'kind' => $data['kind'],
                'scope' => $data['scope'] ?? 'individual',
                'gross_amount' => $data['gross_amount'] ?? null,
                'net_amount' => $data['net_amount'],
                'currency_code' => strtoupper((string) $data['currency_code']),
                'frequency' => $frequency,
                'status' => 'expected',
                'notes' => $data['notes'] ?? null,
            ];

            $template = $this->createRecurrence($actor, $household, [
                'kind' => 'income',
                'frequency' => $frequency,
                'starts_on' => $expectedOn,
                'ends_on' => null,
                'payload' => $payload,
            ]);

            $next = $this->nextDate(CarbonImmutable::parse($expectedOn), $frequency)->toDateString();
            $template->update(['next_occurrence_on' => $next]);

            $income->update([
                'recurrence_template_id' => $template->id,
                'occurrence_key' => $expectedOn,
            ]);

            DB::table('recurrence_generations')->insert([
                'recurrence_template_id' => $template->id,
                'occurrence_on' => $expectedOn,
                'idempotency_key' => 'income-first-'.$income->id,
                'generated_type' => $income::class,
                'generated_id' => $income->id,
                'created_at' => now(),
            ]);

            return $income->refresh()->load(['owner.user', 'account', 'category']);
        });
    }

    /**
     * Confirma un ingreso programado creando una ocurrencia recibida.
     * La programación original permanece activa hasta que se desactive.
     *
     * @param  array<string, mixed>  $data
     */
    public function receiveIncome(User $actor, Household $household, Income $income, array $data = []): Income
    {
        $this->assertBelongs($income, $household);
        if ($income->status === 'cancelled') {
            throw new DomainException('No se puede recibir un ingreso desactivado.');
        }
        if ($income->status !== 'expected') {
            throw new DomainException('Solo se pueden confirmar ingresos programados.');
        }

        $actorMembership = $this->membership($actor, $household);
        $effectivePermissions = $this->permissions->forMembership($actorMembership);
        $canEditAjenos = in_array('ingresos.editar_ajenos', $effectivePermissions, true);
        $canEditPropios = in_array('ingresos.editar_propios', $effectivePermissions, true);
        $isOwner = (int) $income->owner_membership_id === (int) $actorMembership->id;
        if ($isOwner ? ! ($canEditPropios || $canEditAjenos) : ! $canEditAjenos) {
            abort(403);
        }

        $accountId = array_key_exists('account_id', $data) ? $data['account_id'] : $income->account_id;
        $account = null;
        if ($accountId) {
            $account = $this->account($household, (int) $accountId);
            if ($account->currency_code !== $income->currency_code) {
                throw new DomainException('La moneda del ingreso debe coincidir con la cuenta destino.');
            }
        }

        return DB::transaction(function () use ($actor, $household, $income, $data, $account): Income {
            $effectiveOn = $data['effective_on'] ?? now()->toDateString();
            $netAmount = isset($data['net_amount'])
                ? $this->money->normalize($data['net_amount'])
                : $income->net_amount;

            $received = Income::query()->create([
                'household_id' => $income->household_id,
                'owner_membership_id' => $income->owner_membership_id,
                'account_id' => $account?->id,
                'category_id' => $income->category_id,
                'recurrence_template_id' => $income->recurrence_template_id,
                'kind' => $income->kind,
                'scope' => $income->scope,
                'gross_amount' => $income->gross_amount,
                'net_amount' => $netAmount,
                'currency_code' => $income->currency_code,
                'expected_on' => $income->expected_on,
                'effective_on' => $effectiveOn,
                'frequency' => $income->frequency,
                'status' => 'received',
                'notes' => $income->notes,
                'occurrence_key' => $effectiveOn,
            ]);

            // La programación sigue activa; solo avanza la próxima fecha esperada si es recurrente.
            if (in_array($income->frequency, ['weekly', 'biweekly', 'monthly'], true)) {
                $anchor = CarbonImmutable::parse($income->expected_on ?? $effectiveOn);
                $next = $this->nextDate($anchor, $income->frequency)->toDateString();
                $income->update([
                    'expected_on' => $next,
                    'effective_on' => $next,
                ]);
            }

            $this->audit->log(
                'income.received',
                $household->id,
                $received,
                newValues: [
                    'from_schedule_id' => $income->id,
                    'status' => 'received',
                    'effective_on' => $effectiveOn,
                    'net_amount' => $netAmount,
                    'account_id' => $account?->id,
                ],
                actor: $actor,
            );

            return $received->load(['owner.user', 'account', 'category']);
        });
    }

    /** @param array<string, mixed> $data */
    public function updateIncome(User $actor, Household $household, Income $income, array $data): Income
    {
        $this->assertBelongs($income, $household);
        if ($income->status === 'cancelled') {
            throw new DomainException('No se puede editar un ingreso cancelado.');
        }

        $actorMembership = $this->membership($actor, $household);
        $effectivePermissions = $this->permissions->forMembership($actorMembership);
        $canEditAjenos = in_array('ingresos.editar_ajenos', $effectivePermissions, true);
        $canEditPropios = in_array('ingresos.editar_propios', $effectivePermissions, true);
        $isOwner = (int) $income->owner_membership_id === (int) $actorMembership->id;
        if ($isOwner ? ! ($canEditPropios || $canEditAjenos) : ! $canEditAjenos) {
            abort(403);
        }

        $ownerId = (int) ($data['owner_membership_id'] ?? $income->owner_membership_id);
        if ($ownerId !== (int) $actorMembership->id && ! $canEditAjenos) {
            abort(403);
        }
        $this->assertMembership($household, $ownerId);

        $categoryId = (int) ($data['category_id'] ?? $income->category_id);
        $category = FinancialCategory::query()
            ->where('household_id', $household->id)
            ->where('type', 'income')
            ->where(function ($query) use ($income, $categoryId) {
                $query->where('is_active', true)->orWhere('id', $income->category_id);
            })
            ->findOrFail($categoryId);

        $accountId = array_key_exists('account_id', $data) ? $data['account_id'] : $income->account_id;
        $account = null;
        if ($accountId) {
            $account = FinancialAccount::query()
                ->where('household_id', $household->id)
                ->where(function ($query) use ($income, $accountId) {
                    $query->where('is_active', true)->orWhere('id', $income->account_id);
                })
                ->findOrFail((int) $accountId);
        }

        $currency = strtoupper($data['currency_code'] ?? $income->currency_code);
        if ($account && $account->currency_code !== $currency) {
            throw new DomainException('La moneda del ingreso debe coincidir con la cuenta destino.');
        }

        if (isset($data['status']) && $data['status'] === 'cancelled') {
            throw new DomainException('Usa la acción de cancelar para anular un ingreso.');
        }
        if (isset($data['status']) && $data['status'] === 'received' && $income->status !== 'received') {
            throw new DomainException('Usa la acción de recibir para confirmar un ingreso esperado.');
        }

        return DB::transaction(function () use ($actor, $household, $income, $data, $ownerId, $category, $account, $currency): Income {
            $old = $income->only(['owner_membership_id', 'account_id', 'category_id', 'kind', 'scope', 'net_amount', 'currency_code', 'effective_on', 'status']);
            $income->update([
                'owner_membership_id' => $ownerId,
                'account_id' => $account?->id,
                'category_id' => $category->id,
                'kind' => $data['kind'] ?? $income->kind,
                'scope' => $data['scope'] ?? $income->scope,
                'gross_amount' => array_key_exists('gross_amount', $data)
                    ? (isset($data['gross_amount']) ? $this->money->normalize($data['gross_amount']) : null)
                    : $income->gross_amount,
                'net_amount' => isset($data['net_amount'])
                    ? $this->money->normalize($data['net_amount'])
                    : $income->net_amount,
                'currency_code' => $currency,
                'expected_on' => array_key_exists('expected_on', $data) ? $data['expected_on'] : $income->expected_on,
                'effective_on' => array_key_exists('effective_on', $data) ? $data['effective_on'] : $income->effective_on,
                'frequency' => $data['frequency'] ?? $income->frequency,
                'status' => $data['status'] ?? $income->status,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $income->notes,
            ]);
            $this->audit->log(
                'income.updated',
                $household->id,
                $income,
                oldValues: $old,
                newValues: $income->only(['owner_membership_id', 'account_id', 'category_id', 'kind', 'scope', 'net_amount', 'currency_code', 'effective_on', 'status']),
                actor: $actor,
            );

            return $income->refresh()->load(['owner.user', 'account', 'category']);
        });
    }

    /** @param array<string, mixed> $data */
    public function createExpense(User $actor, Household $household, array $data): Expense
    {
        $creator = $this->membership($actor, $household);
        $category = $this->category($household, (int) $data['category_id'], 'expense');
        $shares = $this->money->allocate($data['amount'], $data['shares']);

        foreach ($shares as $share) {
            $this->assertMembership($household, $share['membership_id']);
        }
        if (isset($data['beneficiary_membership_id'])) {
            $this->assertMembership($household, (int) $data['beneficiary_membership_id']);
        }
        if ($data['scope'] === 'individual' && count($shares) !== 1) {
            throw new DomainException('Un gasto individual debe tener una sola participación.');
        }

        return DB::transaction(function () use ($actor, $household, $creator, $category, $data, $shares): Expense {
            $expense = Expense::query()->create([
                'household_id' => $household->id,
                'created_by_membership_id' => $creator->id,
                'beneficiary_membership_id' => $data['beneficiary_membership_id'] ?? null,
                'category_id' => $category->id,
                'scope' => $data['scope'],
                'classification' => $data['classification'],
                'amount' => $this->money->normalize($data['amount']),
                'currency_code' => strtoupper($data['currency_code']),
                'occurred_on' => $data['occurred_on'],
                'frequency' => $data['frequency'] ?? 'once',
                'status' => $data['status'],
                'notes' => $data['notes'] ?? null,
            ]);
            $expense->shares()->createMany($shares);
            $this->audit->log('expense.created', $household->id, $expense, newValues: [
                'amount' => $expense->amount,
                'currency_code' => $expense->currency_code,
                'scope' => $expense->scope,
                'shares' => $shares,
            ], actor: $actor);

            return $expense->load(['creator.user', 'beneficiary.user', 'category', 'shares.membership.user', 'payments']);
        });
    }

    /**
     * Crea un gasto (programado o comprometido). Si la frecuencia es recurrente,
     * deja la ocurrencia en planned y crea la plantilla de recurrencia.
     *
     * @param  array<string, mixed>  $data
     */
    public function scheduleExpense(User $actor, Household $household, array $data): Expense
    {
        $frequency = $data['frequency'] ?? 'once';
        if (in_array($frequency, ['weekly', 'biweekly', 'monthly'], true)) {
            $data['status'] = 'planned';
        }

        return DB::transaction(function () use ($actor, $household, $data, $frequency): Expense {
            $expense = $this->createExpense($actor, $household, $data);

            if (! in_array($frequency, ['weekly', 'biweekly', 'monthly'], true)) {
                return $expense;
            }

            $payload = [
                'beneficiary_membership_id' => $data['beneficiary_membership_id'] ?? null,
                'category_id' => (int) $data['category_id'],
                'scope' => $data['scope'],
                'classification' => $data['classification'],
                'amount' => $data['amount'],
                'currency_code' => strtoupper((string) $data['currency_code']),
                'status' => 'planned',
                'frequency' => $frequency,
                'notes' => $data['notes'] ?? null,
                'distribution_method' => $data['distribution_method'] ?? 'custom',
                'shares' => $data['shares'],
            ];

            $occurredOn = $data['occurred_on'];
            $template = $this->createRecurrence($actor, $household, [
                'kind' => 'expense',
                'frequency' => $frequency,
                'starts_on' => $occurredOn,
                'ends_on' => null,
                'payload' => $payload,
            ]);

            $next = $this->nextDate(CarbonImmutable::parse($occurredOn), $frequency)->toDateString();
            $template->update(['next_occurrence_on' => $next]);

            $expense->update([
                'recurrence_template_id' => $template->id,
                'occurrence_key' => $occurredOn,
            ]);

            DB::table('recurrence_generations')->insert([
                'recurrence_template_id' => $template->id,
                'occurrence_on' => $occurredOn,
                'idempotency_key' => 'expense-first-'.$expense->id,
                'generated_type' => $expense::class,
                'generated_id' => $expense->id,
                'created_at' => now(),
            ]);

            return $expense->refresh()->load(['creator.user', 'beneficiary.user', 'category', 'shares.membership.user', 'payments']);
        });
    }

    /**
     * Confirma un gasto programado creando una ocurrencia comprometida.
     * La programación original permanece activa hasta que se desactive.
     *
     * @param  array<string, mixed>  $data
     */
    public function commitExpense(User $actor, Household $household, Expense $expense, array $data = []): Expense
    {
        $this->assertBelongs($expense, $household);
        if ($expense->status === 'cancelled') {
            throw new DomainException('No se puede comprometer un gasto desactivado.');
        }
        if ($expense->status !== 'planned') {
            throw new DomainException('Solo se pueden comprometer gastos programados.');
        }

        return DB::transaction(function () use ($actor, $household, $expense, $data): Expense {
            $occurredOn = $data['occurred_on'] ?? now()->toDateString();
            $amount = isset($data['amount'])
                ? $this->money->normalize($data['amount'])
                : $expense->amount;

            $shares = $expense->shares()
                ->get(['membership_id', 'percentage'])
                ->map(fn ($share) => [
                    'membership_id' => (int) $share->membership_id,
                    'percentage' => (string) $share->percentage,
                ])
                ->all();

            $committed = $this->createExpense($actor, $household, [
                'beneficiary_membership_id' => $expense->beneficiary_membership_id,
                'category_id' => $expense->category_id,
                'scope' => $expense->scope,
                'classification' => $expense->classification,
                'amount' => $amount,
                'currency_code' => $expense->currency_code,
                'occurred_on' => $occurredOn,
                'frequency' => $expense->frequency ?? 'once',
                'status' => 'committed',
                'notes' => $expense->notes,
                'distribution_method' => 'custom',
                'shares' => $shares,
            ]);

            $committed->update([
                'recurrence_template_id' => $expense->recurrence_template_id,
                'occurrence_key' => $occurredOn.'-committed-'.$committed->id,
            ]);

            if (in_array($expense->frequency, ['weekly', 'biweekly', 'monthly'], true)) {
                $anchor = CarbonImmutable::parse($expense->occurred_on);
                $next = $this->nextDate($anchor, $expense->frequency)->toDateString();
                $expense->update(['occurred_on' => $next]);
                if ($expense->recurrence_template_id) {
                    RecurrenceTemplate::query()
                        ->where('id', $expense->recurrence_template_id)
                        ->where('household_id', $household->id)
                        ->update(['next_occurrence_on' => $this->nextDate(CarbonImmutable::parse($next), $expense->frequency)->toDateString()]);
                }
            }

            $this->audit->log(
                'expense.committed',
                $household->id,
                $committed,
                newValues: [
                    'from_schedule_id' => $expense->id,
                    'status' => 'committed',
                    'occurred_on' => $occurredOn,
                    'amount' => $amount,
                ],
                actor: $actor,
            );

            return $committed->load(['creator.user', 'beneficiary.user', 'category', 'shares.membership.user', 'payments']);
        });
    }

    /** @param array<string, mixed> $data */
    public function registerPayment(User $actor, Household $household, Expense $expense, array $data): Payment
    {
        $this->assertBelongs($expense, $household);

        return DB::transaction(function () use ($actor, $household, $expense, $data): Payment {
            $existing = Payment::query()
                ->where('household_id', $household->id)
                ->where('idempotency_key', $data['idempotency_key'])
                ->first();
            if ($existing) {
                if ($existing->expense_id !== $expense->id) {
                    throw new DomainException('La clave idempotente ya pertenece a otra operación.');
                }

                return $existing->load(['payer.user', 'account']);
            }

            $lockedExpense = Expense::query()->lockForUpdate()->findOrFail($expense->id);
            if (in_array($lockedExpense->status, ['cancelled', 'planned'], true)) {
                throw new DomainException(
                    $lockedExpense->status === 'planned'
                        ? 'Primero marca el gasto programado como comprometido.'
                        : 'No se puede pagar un gasto cancelado.',
                );
            }
            $payer = $this->assertMembership($household, (int) $data['payer_membership_id']);
            $account = $this->account($household, (int) $data['account_id']);
            if ($account->currency_code !== $lockedExpense->currency_code) {
                throw new DomainException('La moneda del pago y la cuenta deben coincidir con el gasto.');
            }
            if ($account->scope === 'individual' && $account->owner_membership_id !== $payer->id) {
                throw new DomainException('El pagador no puede usar una cuenta individual ajena.');
            }

            $amount = $this->money->normalize($data['amount']);
            if (bccomp($amount, '0.0000', 4) <= 0) {
                throw new DomainException('El pago debe ser mayor que cero.');
            }
            $paid = Payment::query()->where('expense_id', $lockedExpense->id)->sum('amount');
            $remaining = bcsub($lockedExpense->amount, (string) $paid, 4);
            if (bccomp($amount, $remaining, 4) === 1) {
                throw new DomainException('El pago supera el saldo pendiente.');
            }

            $payment = Payment::query()->create([
                'household_id' => $household->id,
                'expense_id' => $lockedExpense->id,
                'payer_membership_id' => $payer->id,
                'account_id' => $account->id,
                'amount' => $amount,
                'currency_code' => $lockedExpense->currency_code,
                'paid_on' => $data['paid_on'],
                'idempotency_key' => $data['idempotency_key'],
                'notes' => $data['notes'] ?? null,
            ]);

            $newPaid = bcadd((string) $paid, $amount, 4);
            $lockedExpense->status = bccomp($newPaid, $lockedExpense->amount, 4) === 0 ? 'paid' : 'partial';
            $lockedExpense->save();
            $this->audit->log('payment.created', $household->id, $payment, newValues: [
                'expense_id' => $expense->id, 'amount' => $amount, 'currency_code' => $payment->currency_code,
            ], actor: $actor);

            return $payment->load(['payer.user', 'account']);
        }, 3);
    }

    public function cancelExpense(User $actor, Household $household, Expense $expense): Expense
    {
        $this->assertBelongs($expense, $household);
        if ($expense->payments()->exists()) {
            throw new DomainException('Un gasto con pagos no puede cancelarse sin un flujo de reversión.');
        }
        $old = $expense->status;
        $expense->update(['status' => 'cancelled']);
        if ($expense->recurrence_template_id) {
            RecurrenceTemplate::query()
                ->where('id', $expense->recurrence_template_id)
                ->where('household_id', $household->id)
                ->update(['is_active' => false]);
        }
        $this->audit->log('expense.cancelled', $household->id, $expense, oldValues: ['status' => $old], newValues: ['status' => 'cancelled'], actor: $actor);

        return $expense->refresh()->load(['creator.user', 'beneficiary.user', 'category', 'shares.membership.user', 'payments']);
    }

    /** @return list<array<string, mixed>> */
    public function internalBalances(Household $household): array
    {
        $members = $household->memberships()->with('user')->where('status', 'active')->get();

        return $members->map(function (HouseholdMembership $membership) use ($household): array {
            $responsibility = DB::table('expense_shares')
                ->join('expenses', 'expenses.id', '=', 'expense_shares.expense_id')
                ->where('expenses.household_id', $household->id)
                ->whereNotIn('expenses.status', ['cancelled', 'planned'])
                ->where('expense_shares.membership_id', $membership->id)
                ->sum('expense_shares.amount');
            $paid = Payment::query()
                ->where('household_id', $household->id)
                ->where('payer_membership_id', $membership->id)
                ->sum('amount');
            $settledAsPayer = DB::table('internal_settlements')
                ->where('household_id', $household->id)
                ->where('from_membership_id', $membership->id)
                ->sum('amount');
            $settledAsReceiver = DB::table('internal_settlements')
                ->where('household_id', $household->id)
                ->where('to_membership_id', $membership->id)
                ->sum('amount');

            $responsibility = bcadd((string) $responsibility, '0', 4);
            $paid = bcadd((string) $paid, '0', 4);
            // Compensación: quien paga (from) reduce su deuda; quien recibe (to) reduce su adelanto.
            $net = bcsub(
                bcadd($paid, bcadd((string) $settledAsPayer, '0', 4), 4),
                bcadd($responsibility, bcadd((string) $settledAsReceiver, '0', 4), 4),
                4,
            );

            return [
                'membership_id' => $membership->id,
                'name' => $membership->user->name,
                'responsibility' => $responsibility,
                'paid' => $paid,
                'settled_paid' => bcadd((string) $settledAsPayer, '0', 4),
                'settled_received' => bcadd((string) $settledAsReceiver, '0', 4),
                'net_internal_balance' => $net,
                'meaning' => bccomp($net, '0.0000', 4) >= 0 ? 'adelantó' : 'debe',
            ];
        })->all();
    }

    /** @param array<string, mixed> $data */
    public function createRecurrence(User $actor, Household $household, array $data): RecurrenceTemplate
    {
        $template = RecurrenceTemplate::query()->create([
            ...$data,
            'household_id' => $household->id,
            'next_occurrence_on' => $data['starts_on'],
            'is_active' => true,
        ]);
        $this->audit->log('recurrence.created', $household->id, $template, newValues: $template->only(['kind', 'frequency', 'starts_on', 'ends_on']), actor: $actor);

        return $template;
    }

    public function generateRecurrence(User $actor, Household $household, RecurrenceTemplate $template, string $date, string $key): Model
    {
        $this->assertBelongs($template, $household);
        $occurrence = CarbonImmutable::parse($date)->startOfDay();
        if ($occurrence->lt($template->starts_on) || ($template->ends_on && $occurrence->gt($template->ends_on))) {
            throw new DomainException('La fecha está fuera de la vigencia de la recurrencia.');
        }

        return DB::transaction(function () use ($actor, $household, $template, $occurrence, $key): Model {
            $byKey = DB::table('recurrence_generations')->where('idempotency_key', $key)->first();
            if ($byKey) {
                if ((int) $byKey->recurrence_template_id !== $template->id) {
                    throw new DomainException('La clave idempotente ya pertenece a otra recurrencia.');
                }
                $class = $byKey->generated_type;

                return $class::query()->findOrFail($byKey->generated_id);
            }
            $existing = DB::table('recurrence_generations')
                ->where('recurrence_template_id', $template->id)
                ->where('occurrence_on', $occurrence->toDateString())
                ->first();
            if ($existing) {
                $class = $existing->generated_type;

                return $class::query()->findOrFail($existing->generated_id);
            }

            $payload = $template->payload;
            if ($template->kind === 'expense') {
                $payload['occurred_on'] = $occurrence->toDateString();
                $payload['status'] = $payload['status'] ?? 'planned';
                $payload['frequency'] = $template->frequency;
                $generated = $this->createExpense($actor, $household, $payload);
            } else {
                $payload['expected_on'] = $occurrence->toDateString();
                $payload['effective_on'] = $occurrence->toDateString();
                $payload['status'] = 'expected';
                $generated = $this->createIncome($actor, $household, $payload);
            }
            $generated->update(['recurrence_template_id' => $template->id, 'occurrence_key' => $occurrence->toDateString()]);
            DB::table('recurrence_generations')->insert([
                'recurrence_template_id' => $template->id,
                'occurrence_on' => $occurrence->toDateString(),
                'idempotency_key' => $key,
                'generated_type' => $generated::class,
                'generated_id' => $generated->id,
                'created_at' => now(),
            ]);
            $template->update(['next_occurrence_on' => $this->nextDate($occurrence, $template->frequency)->toDateString()]);
            $this->audit->log('recurrence.generated', $household->id, $template, newValues: ['occurrence_on' => $occurrence->toDateString(), 'generated_id' => $generated->id], actor: $actor);

            return $generated->refresh();
        }, 3);
    }

    private function nextDate(CarbonImmutable $date, string $frequency): CarbonImmutable
    {
        return match ($frequency) {
            'weekly' => $date->addWeek(),
            'biweekly' => $this->nextQuincenaDate($date),
            'monthly' => $date->addMonthNoOverflow(),
            default => throw new DomainException('Frecuencia no soportada.'),
        };
    }

    /**
     * Quincenal: avanza de la 1.ª a la 2.ª quincena (día D → D+15)
     * y de la 2.ª a la 1.ª del mes siguiente ((D-15) del próximo mes).
     */
    private function nextQuincenaDate(CarbonImmutable $date): CarbonImmutable
    {
        $day = $date->day;
        if ($day <= 15) {
            $target = min($day + 15, $date->daysInMonth);

            return $date->day($target);
        }

        $nextMonth = $date->addMonthNoOverflow();
        $target = min($day - 15, $nextMonth->daysInMonth);

        return $nextMonth->day($target);
    }

    private function assertMembership(Household $household, int $id): HouseholdMembership
    {
        return HouseholdMembership::query()->where('household_id', $household->id)->where('status', 'active')->findOrFail($id);
    }

    private function category(Household $household, int $id, string $type): FinancialCategory
    {
        return FinancialCategory::query()->where('household_id', $household->id)->where('type', $type)->where('is_active', true)->findOrFail($id);
    }

    private function account(Household $household, int $id): FinancialAccount
    {
        return FinancialAccount::query()->where('household_id', $household->id)->where('is_active', true)->findOrFail($id);
    }

    private function assertBelongs(Model $model, Household $household): void
    {
        if ((int) $model->getAttribute('household_id') !== $household->id) {
            abort(404);
        }
    }
}
