<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FinancialRequest extends FormRequest
{
    public function authorize(): bool
    {
        $household = $this->route('household');
        $ability = match ($this->route()?->getName()) {
            'accounts.index' => 'accountsView',
            'accounts.store', 'accounts.update' => 'accountsManage',
            'categories.index' => 'categoriesView',
            'categories.store', 'categories.update' => 'categoriesManage',
            'incomes.index', 'incomes.show' => 'incomesView',
            'incomes.store' => 'incomesCreate',
            'incomes.update', 'incomes.cancel', 'incomes.receive' => 'incomesManage',
            'expenses.index', 'expenses.show', 'balances.index' => 'expensesView',
            'expenses.store' => 'expensesCreate',
            'expenses.cancel', 'expenses.commit' => 'expensesManage',
            'payments.store' => 'paymentsCreate',
            'recurrences.index' => 'recurrencesView',
            'recurrences.store', 'recurrences.generate' => 'recurrencesManage',
            default => null,
        };

        return $ability && $household
            ? ($this->user()?->can($ability, $household) ?? false)
            : false;
    }

    public function rules(): array
    {
        return match ($this->route()?->getName()) {
            'accounts.store', 'accounts.update' => [
                'name' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:100'],
                'type' => [$this->isMethod('POST') ? 'required' : 'sometimes', Rule::in(['cash', 'savings', 'checking', 'credit_card'])],
                'currency_code' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'size:3'],
                'opening_balance' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'scope' => [$this->isMethod('POST') ? 'required' : 'sometimes', Rule::in(['individual', 'shared'])],
                'owner_membership_id' => ['nullable', 'integer'],
                'is_active' => ['sometimes', 'boolean'],
            ],
            'categories.store', 'categories.update' => [
                'name' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'max:100'],
                'type' => [$this->isMethod('POST') ? 'required' : 'sometimes', Rule::in(['income', 'expense'])],
                'classification' => ['nullable', Rule::in(['essential', 'discretionary'])],
                'is_active' => ['sometimes', 'boolean'],
            ],
            'incomes.store', 'incomes.update' => [
                'owner_membership_id' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'integer'],
                'account_id' => ['nullable', 'integer'],
                'category_id' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'integer'],
                'kind' => [$this->isMethod('POST') ? 'required' : 'sometimes', Rule::in(['fixed', 'variable', 'extraordinary'])],
                'scope' => [$this->isMethod('POST') ? 'required' : 'sometimes', Rule::in(['individual', 'shared'])],
                'gross_amount' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'net_amount' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'currency_code' => [$this->isMethod('POST') ? 'required' : 'sometimes', 'string', 'size:3'],
                'expected_on' => [$this->isMethod('POST') ? 'required' : 'nullable', 'date'],
                'effective_on' => ['nullable', 'date'],
                'frequency' => [$this->isMethod('POST') ? 'required' : 'sometimes', Rule::in(['once', 'weekly', 'biweekly', 'monthly'])],
                'status' => ['sometimes', Rule::in(['expected', 'received'])],
                'notes' => ['nullable', 'string', 'max:2000'],
            ],
            'incomes.receive' => [
                'effective_on' => ['nullable', 'date'],
                'net_amount' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'account_id' => ['nullable', 'integer'],
            ],
            'expenses.store' => [
                'beneficiary_membership_id' => ['nullable', 'integer'],
                'category_id' => ['required', 'integer'],
                'scope' => ['required', Rule::in(['individual', 'shared'])],
                'classification' => ['required', Rule::in(['essential', 'discretionary'])],
                'amount' => ['required', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'currency_code' => ['required', 'string', 'size:3'],
                'occurred_on' => ['required', 'date'],
                'frequency' => ['sometimes', Rule::in(['once', 'weekly', 'biweekly', 'monthly'])],
                'status' => ['required', Rule::in(['planned', 'committed'])],
                'notes' => ['nullable', 'string', 'max:2000'],
                'distribution_method' => ['required', Rule::in(['equal', 'custom'])],
                'shares' => ['required', 'array', 'min:1'],
                'shares.*.membership_id' => ['required', 'integer', 'distinct'],
                'shares.*.percentage' => ['required', 'regex:/^\d{1,3}(\.\d{1,4})?$/'],
            ],
            'expenses.commit' => [
                'occurred_on' => ['nullable', 'date'],
                'amount' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
            ],
            'payments.store' => [
                'payer_membership_id' => ['required', 'integer'],
                'account_id' => ['required', 'integer'],
                'amount' => ['required', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'paid_on' => ['required', 'date'],
                'idempotency_key' => ['required', 'string', 'max:100'],
                'notes' => ['nullable', 'string', 'max:2000'],
            ],
            'recurrences.store' => [
                'kind' => ['required', Rule::in(['income', 'expense'])],
                'frequency' => ['required', Rule::in(['weekly', 'biweekly', 'monthly'])],
                'starts_on' => ['required', 'date'],
                'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
                'payload' => ['required', 'array'],
            ],
            'recurrences.generate' => [
                'occurrence_on' => ['required', 'date'],
                'idempotency_key' => ['required', 'string', 'max:100'],
            ],
            default => [],
        };
    }
}
