<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Expense extends Model
{
    protected $fillable = ['household_id', 'created_by_membership_id', 'beneficiary_membership_id', 'category_id', 'recurrence_template_id', 'scope', 'classification', 'amount', 'currency_code', 'occurred_on', 'frequency', 'status', 'notes', 'occurrence_key'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:4', 'occurred_on' => 'date'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'created_by_membership_id');
    }

    public function beneficiary(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'beneficiary_membership_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class, 'category_id');
    }

    public function shares(): HasMany
    {
        return $this->hasMany(ExpenseShare::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
