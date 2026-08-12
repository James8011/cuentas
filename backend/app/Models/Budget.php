<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Budget extends Model
{
    protected $fillable = ['household_id', 'owner_membership_id', 'name', 'scope', 'period', 'currency_code', 'status'];

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'owner_membership_id');
    }

    public function lines(): HasMany
    {
        return $this->hasMany(BudgetLine::class);
    }
}
