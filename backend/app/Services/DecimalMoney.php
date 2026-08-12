<?php

namespace App\Services;

use InvalidArgumentException;

final class DecimalMoney
{
    public const SCALE = 4;

    public const PERCENT_SCALE = 4;

    public function normalize(string|int $value, int $scale = self::SCALE): string
    {
        $value = trim((string) $value);
        if (! preg_match('/^-?\d+(?:\.\d+)?$/', $value)) {
            throw new InvalidArgumentException('Valor decimal inválido.');
        }

        if (bccomp($value, '0', $scale) < 0) {
            throw new InvalidArgumentException('El valor no puede ser negativo.');
        }

        return bcadd($value, '0', $scale);
    }

    /**
     * Deterministic largest-remainder allocation. The final listed member
     * receives the explicit residue produced by four-decimal rounding.
     *
     * @param  list<array{membership_id:int, percentage:string}>  $shares
     * @return list<array{membership_id:int, percentage:string, amount:string, receives_rounding_residue:bool}>
     */
    public function allocate(string $amount, array $shares): array
    {
        $amount = $this->normalize($amount);
        if ($shares === []) {
            throw new InvalidArgumentException('Debe existir al menos una participación.');
        }

        $sum = '0.0000';
        foreach ($shares as $share) {
            $sum = bcadd($sum, $this->normalize($share['percentage'], self::PERCENT_SCALE), self::PERCENT_SCALE);
        }

        if (bccomp($sum, '100.0000', self::PERCENT_SCALE) !== 0) {
            throw new InvalidArgumentException('Los porcentajes deben sumar exactamente 100.0000.');
        }

        $allocated = '0.0000';
        $result = [];
        $lastIndex = array_key_last($shares);

        foreach ($shares as $index => $share) {
            $percentage = $this->normalize($share['percentage'], self::PERCENT_SCALE);
            $isLast = $index === $lastIndex;
            $shareAmount = $isLast
                ? bcsub($amount, $allocated, self::SCALE)
                : bcdiv(bcmul($amount, $percentage, self::SCALE + self::PERCENT_SCALE), '100', self::SCALE);

            $allocated = bcadd($allocated, $shareAmount, self::SCALE);
            $result[] = [
                'membership_id' => (int) $share['membership_id'],
                'percentage' => $percentage,
                'amount' => $shareAmount,
                'receives_rounding_residue' => $isLast,
            ];
        }

        return $result;
    }
}
