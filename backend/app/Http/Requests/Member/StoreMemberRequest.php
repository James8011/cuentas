<?php

namespace App\Http\Requests\Member;

use App\Support\PhoneNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class StoreMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('createMembers', $this->route('household')) ?? false;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('phone')) {
            return;
        }

        $normalized = PhoneNormalizer::tryNormalize($this->input('phone'));

        if ($normalized !== null) {
            $this->merge(['phone' => $normalized]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', Password::defaults()],
            'role_ids' => ['required', 'array', 'min:1'],
            'role_ids.*' => ['integer', 'distinct'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->has('phone')) {
                return;
            }

            if (! PhoneNormalizer::isValidE164((string) $this->input('phone'))) {
                $validator->errors()->add('phone', 'El teléfono no es válido.');
            }
        });
    }
}
