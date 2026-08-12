<?php

namespace App\Http\Requests\Role;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manageRoles', $this->route('household')) ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $householdId = $this->route('household')?->id;

        return [
            'name' => [
                'required',
                'string',
                'max:80',
                Rule::unique('roles', 'name')->where(fn ($q) => $q->where('household_id', $householdId)),
            ],
            'description' => ['nullable', 'string', 'max:255'],
            'permission_keys' => ['required', 'array', 'min:1'],
            'permission_keys.*' => ['string', 'distinct'],
        ];
    }
}
