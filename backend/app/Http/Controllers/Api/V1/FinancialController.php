<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\FinancialRequest;
use App\Http\Resources\FinancialResource;
use App\Models\Expense;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\Household;
use App\Models\Income;
use App\Models\RecurrenceTemplate;
use App\Services\AuditLogger;
use App\Services\DecimalMoney;
use App\Services\FinancialService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class FinancialController extends Controller
{
    public function __construct(
        private readonly FinancialService $financial,
        private readonly DecimalMoney $money,
        private readonly AuditLogger $audit,
    ) {}

    public function accounts(FinancialRequest $request, Household $household): AnonymousResourceCollection
    {
        $membership = $this->financial->membership($request->user(), $household);
        $query = FinancialAccount::query()->where('household_id', $household->id)->with(['owner.user']);
        if (! $request->user()->can('accountsManage', $household)) {
            $query->where(fn ($q) => $q->where('scope', 'shared')->orWhere('owner_membership_id', $membership->id));
        }

        return FinancialResource::collection($query->orderBy('name')->get());
    }

    public function storeAccount(FinancialRequest $request, Household $household): JsonResponse
    {
        $data = $request->validated();
        if ($data['scope'] === 'individual') {
            $owner = $data['owner_membership_id'] ?? $this->financial->membership($request->user(), $household)->id;
            $household->memberships()->where('status', 'active')->findOrFail($owner);
            $data['owner_membership_id'] = $owner;
        } else {
            $data['owner_membership_id'] = null;
        }
        $account = FinancialAccount::query()->create([
            ...$data,
            'household_id' => $household->id,
            'currency_code' => strtoupper($data['currency_code']),
            'opening_balance' => $this->money->normalize($data['opening_balance']),
            'is_active' => $data['is_active'] ?? true,
        ]);
        $this->audit->log('account.created', $household->id, $account, newValues: $account->only(['name', 'type', 'currency_code', 'scope', 'opening_balance']), actor: $request->user());

        return (new FinancialResource($account->load('owner.user')))->response()->setStatusCode(201);
    }

    public function updateAccount(FinancialRequest $request, Household $household, FinancialAccount $account): FinancialResource
    {
        $this->belongs($account, $household);
        $old = $account->only(['name', 'type', 'scope', 'is_active', 'owner_membership_id', 'opening_balance']);
        $data = $request->validated();
        if (isset($data['opening_balance'])) {
            $data['opening_balance'] = $this->money->normalize($data['opening_balance']);
        }
        if (isset($data['currency_code'])) {
            $data['currency_code'] = strtoupper($data['currency_code']);
        }
        $scope = $data['scope'] ?? $account->scope;
        if ($scope === 'individual') {
            $owner = $data['owner_membership_id']
                ?? $account->owner_membership_id
                ?? $this->financial->membership($request->user(), $household)->id;
            $household->memberships()->where('status', 'active')->findOrFail($owner);
            $data['owner_membership_id'] = $owner;
        } else {
            $data['owner_membership_id'] = null;
        }
        $account->update($data);
        $this->audit->log('account.updated', $household->id, $account, oldValues: $old, newValues: $account->only(['name', 'type', 'scope', 'is_active', 'owner_membership_id', 'opening_balance']), actor: $request->user());

        return new FinancialResource($account->refresh()->load('owner.user'));
    }

    public function categories(FinancialRequest $request, Household $household): AnonymousResourceCollection
    {
        return FinancialResource::collection(
            FinancialCategory::query()->where('household_id', $household->id)->orderBy('type')->orderBy('name')->get(),
        );
    }

    public function storeCategory(FinancialRequest $request, Household $household): JsonResponse
    {
        $data = $request->validated();
        if (($data['type'] ?? null) === 'income') {
            $data['classification'] = null;
        }
        $category = FinancialCategory::query()->create([
            ...$data,
            'household_id' => $household->id,
            'is_active' => true,
        ]);
        $this->audit->log('category.created', $household->id, $category, newValues: $category->only(['name', 'type', 'classification']), actor: $request->user());

        return (new FinancialResource($category))->response()->setStatusCode(201);
    }

    public function updateCategory(FinancialRequest $request, Household $household, FinancialCategory $category): FinancialResource
    {
        $this->belongs($category, $household);
        $old = $category->only(['name', 'type', 'classification', 'is_active']);
        $data = $request->validated();
        $type = $data['type'] ?? $category->type;
        if ($type === 'income') {
            $data['classification'] = null;
        }
        $category->update($data);
        $this->audit->log('category.updated', $household->id, $category, oldValues: $old, newValues: $category->only(['name', 'type', 'classification', 'is_active']), actor: $request->user());

        return new FinancialResource($category->refresh());
    }

    public function incomes(FinancialRequest $request, Household $household): AnonymousResourceCollection
    {
        return FinancialResource::collection($this->financial->visibleIncomes($request->user(), $household));
    }

    public function storeIncome(FinancialRequest $request, Household $household): JsonResponse
    {
        try {
            $income = $this->financial->scheduleIncome($request->user(), $household, $request->validated());
        } catch (DomainException $exception) {
            abort(422, $exception->getMessage());
        }

        return (new FinancialResource($income))->response()->setStatusCode(201);
    }

    public function updateIncome(FinancialRequest $request, Household $household, Income $income): FinancialResource
    {
        try {
            $updated = $this->financial->updateIncome(
                $request->user(),
                $household,
                $income,
                $request->validated(),
            );
        } catch (DomainException $exception) {
            abort(422, $exception->getMessage());
        }

        return new FinancialResource($updated);
    }

    public function receiveIncome(FinancialRequest $request, Household $household, Income $income): FinancialResource
    {
        try {
            $received = $this->financial->receiveIncome(
                $request->user(),
                $household,
                $income,
                $request->validated(),
            );
        } catch (DomainException $exception) {
            abort(422, $exception->getMessage());
        }

        return new FinancialResource($received);
    }

    public function cancelIncome(FinancialRequest $request, Household $household, Income $income): FinancialResource
    {
        $this->belongs($income, $household);
        $membership = $this->financial->membership($request->user(), $household);
        if ($income->owner_membership_id !== $membership->id
            && ! $this->financial->hasPermission($request->user(), $household, 'ingresos.editar_ajenos')) {
            abort(403);
        }
        if ($income->status === 'cancelled') {
            return new FinancialResource($income->load(['owner.user', 'account', 'category']));
        }
        $old = $income->only(['status']);
        $income->update(['status' => 'cancelled']);
        if ($income->recurrence_template_id) {
            RecurrenceTemplate::query()
                ->where('id', $income->recurrence_template_id)
                ->where('household_id', $household->id)
                ->update(['is_active' => false]);
        }
        $this->audit->log(
            'income.cancelled',
            $household->id,
            $income,
            oldValues: $old,
            newValues: ['status' => 'cancelled'],
            actor: $request->user(),
        );

        return new FinancialResource($income->refresh()->load(['owner.user', 'account', 'category']));
    }

    public function expenses(FinancialRequest $request, Household $household): AnonymousResourceCollection
    {
        return FinancialResource::collection($this->financial->visibleExpenses($request->user(), $household));
    }

    public function showExpense(FinancialRequest $request, Household $household, Expense $expense): FinancialResource
    {
        $visible = $this->financial->visibleExpenses($request->user(), $household)->firstWhere('id', $expense->id);
        abort_unless($visible, 404);

        return new FinancialResource($visible);
    }

    public function storeExpense(FinancialRequest $request, Household $household): JsonResponse
    {
        try {
            $expense = $this->financial->scheduleExpense($request->user(), $household, $request->validated());
        } catch (DomainException $exception) {
            abort(422, $exception->getMessage());
        }

        return (new FinancialResource($expense))->response()->setStatusCode(201);
    }

    public function commitExpense(FinancialRequest $request, Household $household, Expense $expense): FinancialResource
    {
        try {
            $committed = $this->financial->commitExpense(
                $request->user(),
                $household,
                $expense,
                $request->validated(),
            );
        } catch (DomainException $exception) {
            abort(422, $exception->getMessage());
        }

        return new FinancialResource($committed);
    }

    public function cancelExpense(FinancialRequest $request, Household $household, Expense $expense): FinancialResource
    {
        try {
            return new FinancialResource($this->financial->cancelExpense($request->user(), $household, $expense));
        } catch (DomainException $exception) {
            abort(422, $exception->getMessage());
        }
    }

    public function storePayment(FinancialRequest $request, Household $household, Expense $expense): JsonResponse
    {
        $payment = $this->financial->registerPayment($request->user(), $household, $expense, $request->validated());

        return (new FinancialResource($payment))->response()->setStatusCode(201);
    }

    public function balances(FinancialRequest $request, Household $household): JsonResponse
    {
        return response()->json(['data' => $this->financial->internalBalances($household)]);
    }

    public function recurrences(FinancialRequest $request, Household $household): AnonymousResourceCollection
    {
        return FinancialResource::collection(
            RecurrenceTemplate::query()->where('household_id', $household->id)->orderByDesc('id')->get(),
        );
    }

    public function storeRecurrence(FinancialRequest $request, Household $household): JsonResponse
    {
        $template = $this->financial->createRecurrence($request->user(), $household, $request->validated());

        return (new FinancialResource($template))->response()->setStatusCode(201);
    }

    public function generateRecurrence(FinancialRequest $request, Household $household, RecurrenceTemplate $recurrence): JsonResponse
    {
        try {
            $generated = $this->financial->generateRecurrence(
                $request->user(),
                $household,
                $recurrence,
                $request->validated('occurrence_on'),
                $request->validated('idempotency_key'),
            );
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json(['data' => (new FinancialResource($generated))->resolve()], 201);
    }

    private function belongs($model, Household $household): void
    {
        abort_unless((int) $model->household_id === $household->id, 404);
    }
}
