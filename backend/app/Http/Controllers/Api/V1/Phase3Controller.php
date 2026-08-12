<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Phase3Request;
use App\Http\Resources\FinancialResource;
use App\Models\AuditLog;
use App\Models\Budget;
use App\Models\Debt;
use App\Models\Household;
use App\Models\InternalSettlement;
use App\Models\PeriodClose;
use App\Models\SavingsGoal;
use App\Services\Phase3Service;
use DomainException;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class Phase3Controller extends Controller
{
    public function __construct(private readonly Phase3Service $phase3) {}

    public function debts(Phase3Request $request, Household $household): JsonResponse
    {
        $items = Debt::query()
            ->where('household_id', $household->id)
            ->with(['owner.user', 'responsibilities.membership.user', 'payments'])
            ->orderByDesc('id')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function storeDebt(Phase3Request $request, Household $household): JsonResponse
    {
        try {
            $debt = $this->phase3->createDebt($request->user(), $household, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $debt], 201);
    }

    public function updateDebt(Phase3Request $request, Household $household, Debt $debt): JsonResponse
    {
        try {
            $updated = $this->phase3->updateDebt($request->user(), $household, $debt, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $updated]);
    }

    public function cancelDebt(Phase3Request $request, Household $household, Debt $debt): JsonResponse
    {
        try {
            $updated = $this->phase3->cancelDebt($request->user(), $household, $debt);
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $updated]);
    }

    public function storeDebtPayment(Phase3Request $request, Household $household, Debt $debt): JsonResponse
    {
        try {
            $payment = $this->phase3->registerDebtPayment($request->user(), $household, $debt, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $payment], 201);
    }

    public function savings(Phase3Request $request, Household $household): JsonResponse
    {
        $items = SavingsGoal::query()
            ->where('household_id', $household->id)
            ->with(['owner.user', 'account', 'movements'])
            ->orderByDesc('id')
            ->get()
            ->map(function (SavingsGoal $goal) {
                $target = (string) $goal->target_amount;
                $current = (string) $goal->current_amount;
                $remaining = bcsub($target, $current, 4);
                $progress = bccomp($target, '0', 4) === 0
                    ? '0.0000'
                    : bcdiv(bcmul($current, '100', 8), $target, 4);

                return [
                    ...$goal->toArray(),
                    'remaining_amount' => $remaining,
                    'progress_percent' => $progress,
                ];
            });

        return response()->json(['data' => $items]);
    }

    public function storeSavings(Phase3Request $request, Household $household): JsonResponse
    {
        try {
            $goal = $this->phase3->createSavingsGoal($request->user(), $household, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $goal], 201);
    }

    public function updateSavings(Phase3Request $request, Household $household, SavingsGoal $goal): JsonResponse
    {
        try {
            $updated = $this->phase3->updateSavingsGoal($request->user(), $household, $goal, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $updated]);
    }

    public function cancelSavings(Phase3Request $request, Household $household, SavingsGoal $goal): JsonResponse
    {
        try {
            $updated = $this->phase3->cancelSavingsGoal($request->user(), $household, $goal);
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $updated]);
    }

    public function moveSavings(Phase3Request $request, Household $household, SavingsGoal $goal): JsonResponse
    {
        try {
            $movement = $this->phase3->moveSavings($request->user(), $household, $goal, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $movement], 201);
    }

    public function budgets(Phase3Request $request, Household $household): JsonResponse
    {
        $items = Budget::query()
            ->where('household_id', $household->id)
            ->with(['lines.category', 'owner.user'])
            ->orderByDesc('period')
            ->get();

        return response()->json(['data' => $items]);
    }

    public function storeBudget(Phase3Request $request, Household $household): JsonResponse
    {
        try {
            $budget = $this->phase3->createBudget($request->user(), $household, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $budget], 201);
    }

    public function updateBudget(Phase3Request $request, Household $household, Budget $budget): JsonResponse
    {
        try {
            $updated = $this->phase3->updateBudget($request->user(), $household, $budget, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $updated]);
    }

    public function cancelBudget(Phase3Request $request, Household $household, Budget $budget): JsonResponse
    {
        try {
            $updated = $this->phase3->cancelBudget($request->user(), $household, $budget);
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $updated]);
    }

    public function budgetTracking(Phase3Request $request, Household $household, Budget $budget): JsonResponse
    {
        try {
            return response()->json(['data' => $this->phase3->budgetTracking($household, $budget)]);
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }
    }

    public function cashFlow(Phase3Request $request, Household $household): JsonResponse
    {
        $period = $request->validated('period') ?? now()->format('Y-m');
        try {
            return response()->json(['data' => $this->phase3->cashFlow($household, $period)]);
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }
    }

    public function closePeriod(Phase3Request $request, Household $household): JsonResponse
    {
        try {
            $close = $this->phase3->closePeriod($request->user(), $household, $request->validated('period'));
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $close], 201);
    }

    public function periodCloses(Phase3Request $request, Household $household): JsonResponse
    {
        return response()->json([
            'data' => PeriodClose::query()
                ->where('household_id', $household->id)
                ->orderByDesc('period')
                ->get(),
        ]);
    }

    public function distributionPreview(Phase3Request $request, Household $household): JsonResponse
    {
        $data = $request->validated();
        try {
            $shares = $this->phase3->proportionalShares(
                $household,
                array_map('intval', $data['membership_ids']),
                $data['mode'] ?? 'income',
            );
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $shares]);
    }

    public function settlements(Phase3Request $request, Household $household): JsonResponse
    {
        return response()->json([
            'data' => InternalSettlement::query()
                ->where('household_id', $household->id)
                ->with(['fromMembership.user', 'toMembership.user', 'account'])
                ->orderByDesc('id')
                ->get(),
        ]);
    }

    public function storeSettlement(Phase3Request $request, Household $household): JsonResponse
    {
        try {
            $settlement = $this->phase3->settleInternal($request->user(), $household, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $settlement], 201);
    }

    public function auditLogs(Phase3Request $request, Household $household): JsonResponse
    {
        $logs = AuditLog::query()
            ->where('household_id', $household->id)
            ->with('actor')
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json(['data' => $logs]);
    }

    public function export(Phase3Request $request, Household $household): StreamedResponse
    {
        $period = $request->validated('period') ?? now()->format('Y-m');
        try {
            $binary = $this->phase3->exportMonthlyXlsx($household, $period);
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        $filename = "reporte-{$household->id}-{$period}.xlsx";

        return response()->streamDownload(function () use ($binary) {
            echo $binary;
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    public function generateDue(Phase3Request $request): JsonResponse
    {
        $results = $this->phase3->generateDueRecurrences();

        return response()->json(['data' => $results]);
    }
}
