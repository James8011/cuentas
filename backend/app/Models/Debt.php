<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Debt extends Model
{
    protected $fillable = ['household_id', 'owner_membership_id', 'creditor_name', 'name', 'principal_amount', 'current_balance', 'minimum_payment', 'interest_rate_annual', 'rate_type', 'currency_code', 'frequency', 'opened_on', 'next_payment_on', 'status', 'notes'];

    protected function casts(): array
    {
        return [
            'principal_amount' => 'decimal:4',
            'current_balance' => 'decimal:4',
            'minimum_payment' => 'decimal:4',
            'interest_rate_annual' => 'decimal:4',
            'opened_on' => 'date',
            'next_payment_on' => 'date',
        ];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'owner_membership_id');
    }

    public function responsibilities(): HasMany
    {
        return $this->hasMany(DebtResponsibility::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(DebtPayment::class);
    }
}
