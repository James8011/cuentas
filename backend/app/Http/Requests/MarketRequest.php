<?php

namespace App\Http\Requests;

use App\Services\MarketService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MarketRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['is_checked', 'is_active'] as $flag) {
            if ($this->has($flag)) {
                $merge[$flag] = filter_var($this->input($flag), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            }
        }
        if ($merge !== []) {
            $this->merge($merge);
        }
    }

    public function authorize(): bool
    {
        $household = $this->route('household');
        $ability = match ($this->route()?->getName()) {
            'market.products.index',
            'market.lists.index',
            'market.lists.show',
            'market.budget' => 'marketView',
            'market.products.store',
            'market.products.update',
            'market.lists.store',
            'market.lists.update',
            'market.lists.cancel',
            'market.lists.close',
            'market.items.store',
            'market.items.update',
            'market.items.destroy' => 'marketManage',
            default => null,
        };

        return $ability && $household
            ? ($this->user()?->can($ability, $household) ?? false)
            : false;
    }

    public function rules(): array
    {
        $units = MarketService::UNITS;

        return match ($this->route()?->getName()) {
            'market.products.store' => [
                'name' => ['required', 'string', 'max:120'],
                'unit' => ['required', Rule::in($units)],
                'last_unit_price' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'notes' => ['nullable', 'string', 'max:2000'],
                'photo' => ['nullable', 'image', 'max:5120'],
            ],
            'market.products.update' => [
                'name' => ['sometimes', 'string', 'max:120'],
                'unit' => ['sometimes', Rule::in($units)],
                'last_unit_price' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'notes' => ['nullable', 'string', 'max:2000'],
                'is_active' => ['sometimes', 'boolean'],
                'photo' => ['nullable', 'image', 'max:5120'],
            ],
            'market.lists.store' => [
                'name' => ['required', 'string', 'max:120'],
                'period' => ['nullable', 'regex:/^\d{4}-\d{2}$/'],
                'notes' => ['nullable', 'string', 'max:2000'],
            ],
            'market.lists.update' => [
                'name' => ['sometimes', 'string', 'max:120'],
                'period' => ['sometimes', 'regex:/^\d{4}-\d{2}$/'],
                'notes' => ['nullable', 'string', 'max:2000'],
                'status' => ['sometimes', Rule::in(['active', 'shopping'])],
            ],
            'market.items.store' => [
                'market_product_id' => ['nullable', 'integer'],
                'name' => ['nullable', 'string', 'max:120'],
                'unit' => ['nullable', Rule::in($units)],
                'quantity_planned' => ['required', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'estimated_unit_price' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'notes' => ['nullable', 'string', 'max:2000'],
                'photo' => ['nullable', 'image', 'max:5120'],
            ],
            'market.items.update' => [
                'name' => ['sometimes', 'string', 'max:120'],
                'unit' => ['sometimes', Rule::in($units)],
                'quantity_planned' => ['sometimes', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'quantity_bought' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'estimated_unit_price' => ['sometimes', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'actual_unit_price' => ['nullable', 'regex:/^\d{1,15}(\.\d{1,4})?$/'],
                'is_checked' => ['sometimes', 'boolean'],
                'notes' => ['nullable', 'string', 'max:2000'],
                'sort_order' => ['sometimes', 'integer', 'min:0'],
                'photo' => ['nullable', 'image', 'max:5120'],
            ],
            'market.lists.close' => [
                'occurred_on' => ['nullable', 'date'],
                'currency_code' => ['nullable', 'string', 'size:3'],
                'scope' => ['nullable', Rule::in(['individual', 'shared'])],
                'notes' => ['nullable', 'string', 'max:2000'],
                'shares' => ['nullable', 'array', 'min:1'],
                'shares.*.membership_id' => ['required_with:shares', 'integer'],
                'shares.*.percentage' => ['required_with:shares', 'regex:/^\d{1,3}(\.\d{1,4})?$/'],
            ],
            'market.budget' => [
                'period' => ['nullable', 'regex:/^\d{4}-\d{2}$/'],
            ],
            default => [],
        };
    }
}
