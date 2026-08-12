<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SavingsMovement extends Model
{
    protected $fillable = ['household_id', 'savings_goal_id', 'membership_id', 'account_id', 'type', 'amount', 'currency_code', 'moved_on', 'notes'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:4', 'moved_on' => 'date'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function savingsGoal(): BelongsTo
    {
        return $this->belongsTo(SavingsGoal::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class);
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class, 'account_id');
    }
}
