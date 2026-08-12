<?php

namespace App\Services;

use App\Enums\MembershipStatus;
use App\Enums\RoleStatus;
use App\Enums\UserStatus;
use App\Models\HouseholdMembership;
use App\Models\User;
use Illuminate\Support\Collection;

class PermissionResolver
{
    /**
     * Effective permissions = union of permissions from active roles.
     * No explicit denials in MVP.
     *
     * @return list<string>
     */
    public function forMembership(HouseholdMembership $membership): array
    {
        $membership->loadMissing(['roles.permissions', 'user']);

        if ($membership->user?->status !== UserStatus::Active) {
            return [];
        }

        if ($membership->status !== MembershipStatus::Active) {
            return [];
        }

        /** @var Collection<int, string> $keys */
        $keys = $membership->roles
            ->filter(fn ($role) => $role->status === RoleStatus::Active)
            ->flatMap(fn ($role) => $role->permissions->pluck('key'))
            ->unique()
            ->values();

        return $keys->all();
    }

    public function userHas(User $user, int $householdId, string $permission): bool
    {
        $membership = HouseholdMembership::query()
            ->where('household_id', $householdId)
            ->where('user_id', $user->id)
            ->first();

        if (! $membership) {
            return false;
        }

        return in_array($permission, $this->forMembership($membership), true);
    }

    public function membershipHas(HouseholdMembership $membership, string $permission): bool
    {
        return in_array($permission, $this->forMembership($membership), true);
    }
}
