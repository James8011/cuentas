<?php

namespace App\Actions;

use App\Enums\MembershipStatus;
use App\Enums\RoleStatus;
use App\Models\HouseholdMembership;
use App\Models\Role;
use App\Models\User;
use App\Services\AdminContinuityGuard;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UpdateMembershipAction
{
    public function __construct(
        private readonly AdminContinuityGuard $adminGuard,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{
     *     status?: string,
     *     role_ids?: list<int>
     * }  $data
     */
    public function execute(User $actor, HouseholdMembership $membership, array $data): HouseholdMembership
    {
        $status = isset($data['status'])
            ? MembershipStatus::from($data['status'])
            : $membership->status;

        $roleIds = array_key_exists('role_ids', $data)
            ? array_values(array_unique(array_map('intval', $data['role_ids'])))
            : null;

        if ($roleIds !== null) {
            if ($roleIds === []) {
                throw ValidationException::withMessages([
                    'role_ids' => ['Debe conservar al menos un rol.'],
                ]);
            }

            $roles = Role::query()
                ->where('household_id', $membership->household_id)
                ->where('status', RoleStatus::Active)
                ->whereIn('id', $roleIds)
                ->get();

            if ($roles->count() !== count($roleIds)) {
                throw ValidationException::withMessages([
                    'role_ids' => ['Uno o más roles no pertenecen a este hogar o están inactivos.'],
                ]);
            }
        }

        $this->adminGuard->assertMembershipChangeKeepsAdmin($membership, $status, $roleIds);

        return DB::transaction(function () use ($actor, $membership, $status, $roleIds): HouseholdMembership {
            $old = [
                'status' => $membership->status->value,
                'role_ids' => $membership->roles()->pluck('roles.id')->all(),
            ];

            $membership->status = $status;
            $membership->suspended_at = $status === MembershipStatus::Suspended ? now() : null;
            $membership->save();

            if ($roleIds !== null) {
                $membership->roles()->sync($roleIds);
            }

            $this->audit->log(
                action: 'membership.updated',
                householdId: $membership->household_id,
                auditable: $membership,
                oldValues: $old,
                newValues: [
                    'status' => $membership->status->value,
                    'role_ids' => $roleIds ?? $old['role_ids'],
                ],
                actor: $actor,
            );

            if ($roleIds !== null) {
                $this->audit->log(
                    action: 'membership.roles_assigned',
                    householdId: $membership->household_id,
                    auditable: $membership,
                    oldValues: ['role_ids' => $old['role_ids']],
                    newValues: ['role_ids' => $roleIds],
                    actor: $actor,
                );
            }

            return $membership->load(['user', 'roles.permissions']);
        });
    }
}
