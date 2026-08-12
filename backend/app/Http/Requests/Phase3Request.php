<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class Phase3Request extends FormRequest
{
    public function authorize(): bool
    {
        if ($this->route()?->getName() === 'recurrences.generateDue') {
            return $this->user()?->isActive() ?? false;
        }

        $household = $this->route('household');
        $ability = match ($this->route()?->getName()) {
            'debts.index', 'debts.store', 'debts.update', 'debts.cancel', 'debts.payments' => 'debtsAccess',
            'savings.index', 'savings.store', 'savings.update', 'savings.cancel', 'savings.move' => 'savingsAccess',
            'budgets.index', 'budgets.store', 'budgets.update', 'budgets.cancel', 'budgets.tracking', 'cashflow.show', 'periods.index', 'periods.close' => 'budgetsAccess',
            'distribution.preview' => 'expensesCreate',
            'settlements.index', 'settlements.store' => 'expensesView',
            'audit.index' => 'auditView',
            'export.download' => 'exportData',
            default => null,
        };

        return $ability && $household
            ? ($this->user()?->can($ability, $household) ?? false)
            : false;
    }

    public function rules(): array
    {
        return match ($this->route()?->getName()) {
            'debts.store' => [
                'owner_membership_id' => ['required', 'integer'],
                'creditor_name' => ['required', 'string', 'max:120'],
                'name' => ['required', 'string', 'max:120'],
                'principal_amount' => ['required', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'current_balance' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'minimum_payment' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'interest_rate_annual' => ['nullable', 'regex:/^\d{1,3}(\.\d{1,4})?$/'],
                'rate_type' => ['nullable', Rule::in(['effective', 'nominal'])],
                'currency_code' => ['required', 'string', 'size:3'],
                'frequency' => ['nullable', Rule::in(['weekly', 'biweekly', 'monthly'])],
                'opened_on' => ['nullable', 'date'],
                'next_payment_on' => ['nullable', 'date'],
                'notes' => ['nullable', 'string', 'max:2000'],
                'responsibilities' => ['nullable', 'array', 'min:1'],
                'responsibilities.*.membership_id' => ['required_with:responsibilities', 'integer'],
                'responsibilities.*.percentage' => ['required_with:responsibilities', 'regex:/^\d{1,3}(\.\d{1,4})?$/'],
            ],
            'debts.update' => [
                'name' => ['sometimes', 'string', 'max:120'],
                'creditor_name' => ['sometimes', 'string', 'max:120'],
                'minimum_payment' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'interest_rate_annual' => ['nullable', 'regex:/^\d{1,3}(\.\d{1,4})?$/'],
                'next_payment_on' => ['nullable', 'date'],
                'notes' => ['nullable', 'string', 'max:2000'],
                'status' => ['sometimes', Rule::in(['active', 'paid', 'cancelled'])],
            ],
            'debts.payments' => [
                'payer_membership_id' => ['required', 'integer'],
                'account_id' => ['required', 'integer'],
                'amount' => ['required', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'paid_on' => ['required', 'date'],
                'idempotency_key' => ['required', 'string', 'max:100'],
                'notes' => ['nullable', 'string', 'max:2000'],
            ],
            'savings.store' => [
                'name' => ['required', 'string', 'max:120'],
                'kind' => ['required', Rule::in(['goal', 'emergency'])],
                'scope' => ['required', Rule::in(['individual', 'shared'])],
                'owner_membership_id' => ['nullable', 'integer'],
                'account_id' => ['nullable', 'integer'],
                'target_amount' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'emergency_months' => ['nullable', 'integer', 'min:1', 'max:24'],
                'currency_code' => ['required', 'string', 'size:3'],
                'target_on' => ['nullable', 'date'],
                'notes' => ['nullable', 'string', 'max:2000'],
            ],
            'savings.update' => [
                'name' => ['sometimes', 'string', 'max:120'],
                'kind' => ['sometimes', Rule::in(['goal', 'emergency'])],
                'target_amount' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'emergency_months' => ['nullable', 'integer', 'min:1', 'max:24'],
                'account_id' => ['nullable', 'integer'],
                'target_on' => ['nullable', 'date'],
                'notes' => ['nullable', 'string', 'max:2000'],
                'status' => ['sometimes', Rule::in(['active', 'completed', 'cancelled'])],
            ],
            'savings.move' => [
                'membership_id' => ['required', 'integer'],
                'account_id' => ['nullable', 'integer'],
                'type' => ['required', Rule::in(['contribution', 'withdrawal'])],
                'amount' => ['required', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'moved_on' => ['nullable', 'date'],
                'notes' => ['nullable', 'string', 'max:2000'],
            ],
            'budgets.store' => [
                'name' => ['required', 'string', 'max:120'],
                'scope' => ['required', Rule::in(['individual', 'shared'])],
                'owner_membership_id' => ['nullable', 'integer'],
                'period' => ['required', 'regex:/^\d{4}-\d{2}$/'],
                'currency_code' => ['required', 'string', 'size:3'],
                'lines' => ['required', 'array', 'min:1'],
                'lines.*.category_id' => ['required', 'integer'],
                'lines.*.planned_amount' => ['required', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
            ],
            'budgets.update' => [
                'name' => ['sometimes', 'string', 'max:120'],
                'lines' => ['sometimes', 'array', 'min:1'],
                'lines.*.category_id' => ['required_with:lines', 'integer'],
                'lines.*.planned_amount' => ['required_with:lines', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
            ],
            'cashflow.show', 'periods.close', 'export.download' => [
                'period' => ['nullable', 'regex:/^\d{4}-\d{2}$/'],
            ],
            'distribution.preview' => [
                'membership_ids' => ['required', 'array', 'min:1'],
                'membership_ids.*' => ['integer'],
                'mode' => ['required', Rule::in(['income', 'capacity'])],
            ],
            'settlements.store' => [
                'from_membership_id' => ['required', 'integer'],
                'to_membership_id' => ['required', 'integer'],
                'account_id' => ['nullable', 'integer'],
                'amount' => ['required', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'currency_code' => ['required', 'string', 'size:3'],
                'settled_on' => ['nullable', 'date'],
                'notes' => ['nullable', 'string', 'max:2000'],
            ],
            default => [],
        };
    }
}
