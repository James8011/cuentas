<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Normalizes phone numbers to E.164.
 * Default country: Colombia (+57). International input with leading + is accepted.
 */
final class PhoneNormalizer
{
    public const DEFAULT_COUNTRY_CALLING_CODE = '57';

    public static function normalize(?string $input, string $defaultCountryCallingCode = self::DEFAULT_COUNTRY_CALLING_CODE): string
    {
        if ($input === null) {
            throw new InvalidArgumentException('El teléfono es obligatorio.');
        }

        $trimmed = trim($input);

        if ($trimmed === '') {
            throw new InvalidArgumentException('El teléfono es obligatorio.');
        }

        $hasPlus = str_starts_with($trimmed, '+');
        $digits = preg_replace('/\D+/', '', $trimmed) ?? '';

        if ($digits === '') {
            throw new InvalidArgumentException('El teléfono no contiene dígitos válidos.');
        }

        if ($hasPlus) {
            $e164 = '+'.$digits;
        } elseif (str_starts_with($digits, $defaultCountryCallingCode) && strlen($digits) >= 11) {
            $e164 = '+'.$digits;
        } elseif (strlen($digits) === 10 && str_starts_with($digits, '3')) {
            // Colombian mobile without country code.
            $e164 = '+'.$defaultCountryCallingCode.$digits;
        } elseif (strlen($digits) >= 8 && strlen($digits) <= 15) {
            $e164 = '+'.$defaultCountryCallingCode.$digits;
        } else {
            throw new InvalidArgumentException('El teléfono no tiene un formato reconocible.');
        }

        if (! self::isValidE164($e164)) {
            throw new InvalidArgumentException('El teléfono normalizado no es un E.164 válido.');
        }

        return $e164;
    }

    public static function isValidE164(string $value): bool
    {
        return (bool) preg_match('/^\+[1-9]\d{7,14}$/', $value);
    }

    public static function tryNormalize(?string $input, string $defaultCountryCallingCode = self::DEFAULT_COUNTRY_CALLING_CODE): ?string
    {
        try {
            return self::normalize($input, $defaultCountryCallingCode);
        } catch (InvalidArgumentException) {
            return null;
        }
    }
}
