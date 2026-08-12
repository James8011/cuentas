<?php

namespace App\Models;

use App\Enums\RoleStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'household_id',
        'name',
        'description',
        'is_system',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'status' => RoleStatus::class,
        ];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'role_permissions');
    }

    public function memberships(): BelongsToMany
    {
        return $this->belongsToMany(HouseholdMembership::class, 'membership_roles', 'role_id', 'membership_id');
    }

    public function isActive(): bool
    {
        return $this->status === RoleStatus::Active;
    }
}
