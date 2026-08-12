<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Income extends Model
{
    protected $fillable = ['household_id', 'owner_membership_id', 'account_id', 'category_id', 'recurrence_template_id', 'kind', 'scope', 'gross_amount', 'net_amount', 'currency_code', 'expected_on', 'effective_on', 'frequency', 'status', 'notes', 'occurrence_key'];

    protected function casts(): array
    {
        return ['gross_amount' => 'decimal:4', 'net_amount' => 'decimal:4', 'expected_on' => 'date', 'effective_on' => 'date'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'owner_membership_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class, 'account_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FinancialCategory::class, 'category_id');
    }
}
