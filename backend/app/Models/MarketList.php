<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketList extends Model
{
    protected $fillable = [
        'household_id',
        'created_by_membership_id',
        'name',
        'status',
        'period',
        'notes',
        'expense_id',
        'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'closed_at' => 'datetime',
        ];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'created_by_membership_id');
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(Expense::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(MarketListItem::class)->orderBy('sort_order')->orderBy('id');
    }
}
