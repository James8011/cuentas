<?php

namespace App\Http\Requests\Auth;

use App\Support\PhoneNormalizer;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
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
            'phone' => ['required', 'string', 'max:32'],
            'password' => ['required', 'string'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            if (! PhoneNormalizer::isValidE164((string) $this->input('phone'))) {
                $validator->errors()->add('phone', 'El teléfono no es válido.');
            }
        });
    }
}
