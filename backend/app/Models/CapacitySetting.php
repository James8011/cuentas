<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CapacitySetting extends Model
{
    protected $fillable = ['household_id', 'membership_id', 'fixed_deduction', 'percent_deduction'];

    protected function casts(): array
    {
        return [
            'fixed_deduction' => 'decimal:4',
            'percent_deduction' => 'decimal:4',
        ];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class);
    }
}
