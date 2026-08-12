<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PeriodClose extends Model
{
    protected $fillable = ['household_id', 'closed_by_membership_id', 'period', 'snapshot', 'closed_at'];

    protected function casts(): array
    {
        return ['snapshot' => 'array', 'closed_at' => 'datetime'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'closed_by_membership_id');
    }
}
