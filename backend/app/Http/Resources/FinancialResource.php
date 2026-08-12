<?php

namespace App\Http\Resources;

use App\Models\Expense;
use App\Models\FinancialAccount;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FinancialResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = parent::toArray($request);

        if ($this->resource instanceof Expense) {
            $paid = $this->payments->reduce(
                fn (string $sum, $payment) => bcadd($sum, $payment->amount, 4),
                '0.0000',
            );
            $data['paid_amount'] = $paid;
            $data['pending_amount'] = bcsub($this->amount, $paid, 4);
            $data['rounding_explanation'] = 'Los importes se muestran con 2 decimales. Si al repartir sobran centavos, el último integrante de la lista recibe ese residuo para que la suma cuadre exactamente.';
        }

        if ($this->resource instanceof FinancialAccount) {
            $income = $this->incomes()
                ->where('status', 'received')
                ->sum('net_amount');
            $payments = $this->payments()->sum('amount');
            $data['current_balance'] = bcsub(
                bcadd($this->opening_balance, (string) $income, 4),
                (string) $payments,
                4,
            );
        }

        return $data;
    }
}
