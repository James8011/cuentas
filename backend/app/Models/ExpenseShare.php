<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExpenseShare extends Model
{
    protected $fillable = ['expense_id', 'membership_id', 'percentage', 'amount', 'receives_rounding_residue'];

    protected function casts(): array
    {
        return ['percentage' => 'decimal:4', 'amount' => 'decimal:4', 'receives_rounding_residue' => 'boolean'];
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class);
    }
}
