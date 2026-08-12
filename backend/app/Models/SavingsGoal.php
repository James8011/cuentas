<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SavingsGoal extends Model
{
    protected $fillable = ['household_id', 'owner_membership_id', 'account_id', 'name', 'kind', 'scope', 'target_amount', 'current_amount', 'currency_code', 'emergency_months', 'target_on', 'status', 'notes'];

    protected function casts(): array
    {
        return [
            'target_amount' => 'decimal:4',
            'current_amount' => 'decimal:4',
            'target_on' => 'date',
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

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class, 'account_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(SavingsMovement::class);
    }
}
