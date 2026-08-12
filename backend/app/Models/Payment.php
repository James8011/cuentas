<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = ['household_id', 'expense_id', 'payer_membership_id', 'account_id', 'amount', 'currency_code', 'paid_on', 'idempotency_key', 'notes'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:4', 'paid_on' => 'date'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'payer_membership_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class, 'account_id');
    }
}
