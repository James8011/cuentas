<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InternalSettlement extends Model
{
    protected $fillable = ['household_id', 'from_membership_id', 'to_membership_id', 'account_id', 'amount', 'currency_code', 'settled_on', 'notes'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:4', 'settled_on' => 'date'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function fromMembership(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'from_membership_id');
    }

    public function toMembership(): BelongsTo
    {
        return $this->belongsTo(HouseholdMembership::class, 'to_membership_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class, 'account_id');
    }
}
