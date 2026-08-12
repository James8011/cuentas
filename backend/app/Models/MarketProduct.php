<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketProduct extends Model
{
    protected $fillable = [
        'household_id',
        'name',
        'unit',
        'last_unit_price',
        'photo_path',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'last_unit_price' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(MarketListItem::class);
    }

    public function photoUrl(): ?string
    {
        return $this->photo_path ? '/storage/'.$this->photo_path : null;
    }
}
