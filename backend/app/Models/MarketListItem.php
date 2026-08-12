<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketListItem extends Model
{
    protected $fillable = [
        'market_list_id',
        'market_product_id',
        'name',
        'unit',
        'quantity_planned',
        'quantity_bought',
        'estimated_unit_price',
        'actual_unit_price',
        'is_checked',
        'notes',
        'photo_path',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity_planned' => 'decimal:4',
            'quantity_bought' => 'decimal:4',
            'estimated_unit_price' => 'decimal:4',
            'actual_unit_price' => 'decimal:4',
            'is_checked' => 'boolean',
        ];
    }

    public function list(): BelongsTo
    {
        return $this->belongsTo(MarketList::class, 'market_list_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(MarketProduct::class, 'market_product_id');
    }

    public function photoUrl(): ?string
    {
        return $this->photo_path ? '/storage/'.$this->photo_path : null;
    }

    public function estimatedTotal(): string
    {
        return bcmul((string) $this->quantity_planned, (string) $this->estimated_unit_price, 4);
    }

    public function boughtTotal(): string
    {
        if (! $this->is_checked) {
            return '0.0000';
        }
        $qty = $this->quantity_bought ?? $this->quantity_planned;
        $price = $this->actual_unit_price ?? $this->estimated_unit_price;

        return bcmul((string) $qty, (string) $price, 4);
    }
}
