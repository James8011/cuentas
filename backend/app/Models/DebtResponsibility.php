<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DebtResponsibility extends Model
{
    protected $fillable = ['debt_id', 'membership_id', 'percentage'];

    protected function casts(): array
    {
        return ['percentage' => 'decimal:4'];
    }

    public function debt(): BelongsTo
    {
        return $this->belongsTo(Debt::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class);
    }
}
