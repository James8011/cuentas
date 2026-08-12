<?php

namespace App\Services;

use App\Enums\MembershipStatus;
use App\Enums\RoleStatus;
use App\Enums\UserStatus;
use App\Models\Household;
use App\Models\HouseholdMembership;
use App\Models\Role;
use DomainException;
use Illuminate\Support\Facades\DB;

/**
 * Ensures at least one active member retains roles.gestionar.
 */
class AdminContinuityGuard
{
    public function __construct(
        private readonly PermissionResolver $permissions,
    ) {}

    public function adminCapability(): string
    {
        return (string) config('permissions.admin_capability', 'roles.gestionar');
    }

    public function countAdministrators(Household $household): int
    {
        $capability = $this->adminCapability();

        $memberships = HouseholdMembership::query()
            ->with(['roles.permissions', 'user'])
            ->where('household_id', $household->id)
            ->where('status', MembershipStatus::Active)
            ->get();

        return $memberships
            ->filter(fn (HouseholdMembership $membership) => $membership->user?->status === UserStatus::Active
                && $this->permissions->membershipHas($membership, $capability))
            ->count();
    }

    /**
     * @param  list<int>  $permissionIds
     */
    public function assertRoleChangeKeepsAdmin(Role $role, array $permissionIds, RoleStatus $newStatus): void
    {
        $capability = $this->adminCapability();
        $household = $role->household;

        $memberships = HouseholdMembership::query()
            ->with(['roles.permissions', 'user'])
            ->where('household_id', $household->id)
            ->where('status', MembershipStatus::Active)
            ->get();

        $adminCount = 0;

        foreach ($memberships as $membership) {
            if ($membership->user?->status !== UserStatus::Active) {
                continue;
            }

            $effective = $this->simulateEffectivePermissions($membership, $role, $permissionIds, $newStatus);

            if (in_array($capability, $effective, true)) {
                $adminCount++;
            }
        }

        if ($adminCount < 1) {
            throw new DomainException(
                'El hogar debe conservar al menos un integrante activo capaz de gestionar roles y permisos.'
            );
        }
    }

    /**
     * @param  list<int>|null  $roleIds
     */
    public function assertMembershipChangeKeepsAdmin(
        HouseholdMembership $membership,
        MembershipStatus $newStatus,
        ?array $roleIds = null,
    ): void {
        $household = $membership->household;
        $capability = $this->adminCapability();

        $memberships = HouseholdMembership::query()
            ->with(['roles.permissions', 'user'])
            ->where('household_id', $household->id)
            ->where('status', MembershipStatus::Active)
            ->get();

        $adminCount = 0;

        foreach ($memberships as $candidate) {
            if ($candidate->user?->status !== UserStatus::Active) {
                continue;
            }

            if ($candidate->id === $membership->id) {
                if ($newStatus !== MembershipStatus::Active) {
                    continue;
                }

                $roles = $roleIds === null
                    ? $candidate->roles
                    : Role::query()
                        ->with('permissions')
                        ->where('household_id', $household->id)
                        ->whereIn('id', $roleIds)
                        ->get();

                $keys = $roles
                    ->filter(fn (Role $role) => $role->status === RoleStatus::Active)
                    ->flatMap(fn (Role $role) => $role->permissions->pluck('key'))
                    ->unique();

                if ($keys->contains($capability)) {
                    $adminCount++;
                }

                continue;
            }

            if ($this->permissions->membershipHas($candidate, $capability)) {
                $adminCount++;
            }
        }

        if ($adminCount < 1) {
            throw new DomainException(
                'El hogar debe conservar al menos un integrante activo capaz de gestionar roles y permisos.'
            );
        }
    }

    /**
     * @param  list<int>  $permissionIds
     * @return list<string>
     */
    private function simulateEffectivePermissions(
        HouseholdMembership $membership,
        Role $mutatedRole,
        array $permissionIds,
        RoleStatus $newStatus,
    ): array {
        $keys = collect();

        foreach ($membership->roles as $assignedRole) {
            if ($assignedRole->id === $mutatedRole->id) {
                if ($newStatus !== RoleStatus::Active) {
                    continue;
                }

                $permissionKeys = DB::table('permissions')
                    ->whereIn('id', $permissionIds)
                    ->pluck('key');

                $keys = $keys->merge($permissionKeys);

                continue;
            }

            if ($assignedRole->status !== RoleStatus::Active) {
                continue;
            }

            $keys = $keys->merge($assignedRole->permissions->pluck('key'));
        }

        return $keys->unique()->values()->all();
    }
}
