<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinancialAccount extends Model
{
    protected $fillable = ['household_id', 'owner_membership_id', 'name', 'type', 'currency_code', 'opening_balance', 'scope', 'is_active'];

    protected function casts(): array
    {
        return ['opening_balance' => 'decimal:4', 'is_active' => 'boolean'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'owner_membership_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'account_id');
    }

    public function incomes(): HasMany
    {
        return $this->hasMany(Income::class, 'account_id');
    }
}
