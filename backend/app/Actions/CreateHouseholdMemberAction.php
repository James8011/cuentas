<?php

namespace App\Actions;

use App\Enums\MembershipStatus;
use App\Enums\RoleStatus;
use App\Enums\UserStatus;
use App\Models\Household;
use App\Models\HouseholdMembership;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\PhoneNormalizer;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateHouseholdMemberAction
{
    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{
     *     name: string,
     *     phone: string,
     *     email?: string|null,
     *     password: string,
     *     role_ids: list<int>
     * }  $data
     */
    public function execute(User $actor, Household $household, array $data): HouseholdMembership
    {
        $phone = PhoneNormalizer::normalize($data['phone']);

        if (User::query()->where('phone', $phone)->exists()) {
            throw ValidationException::withMessages([
                'phone' => ['Ya existe una cuenta con este teléfono. En el MVP no se vincula silenciosamente a otro hogar.'],
            ]);
        }

        $roleIds = array_values(array_unique(array_map('intval', $data['role_ids'])));

        if ($roleIds === []) {
            throw ValidationException::withMessages([
                'role_ids' => ['Debe asignar al menos un rol.'],
            ]);
        }

        $roles = Role::query()
            ->where('household_id', $household->id)
            ->where('status', RoleStatus::Active)
            ->whereIn('id', $roleIds)
            ->get();

        if ($roles->count() !== count($roleIds)) {
            throw ValidationException::withMessages([
                'role_ids' => ['Uno o más roles no pertenecen a este hogar o están inactivos.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $household, $data, $phone, $roleIds): HouseholdMembership {
            $user = User::query()->create([
                'name' => $data['name'],
                'phone' => $phone,
                'email' => $data['email'] ?? null,
                'password' => $data['password'],
                'status' => UserStatus::Active,
            ]);

            $membership = HouseholdMembership::query()->create([
                'household_id' => $household->id,
                'user_id' => $user->id,
                'status' => MembershipStatus::Active,
                'joined_at' => now(),
                'created_by_user_id' => $actor->id,
            ]);

            $membership->roles()->sync($roleIds);

            $this->audit->log(
                action: 'user.created',
                householdId: $household->id,
                auditable: $user,
                newValues: [
                    'name' => $user->name,
                    'phone' => $user->phone,
                    'email' => $user->email,
                    'status' => $user->status->value,
                ],
                actor: $actor,
            );

            $this->audit->log(
                action: 'membership.created',
                householdId: $household->id,
                auditable: $membership,
                newValues: [
                    'user_id' => $user->id,
                    'role_ids' => $roleIds,
                    'status' => $membership->status->value,
                ],
                actor: $actor,
            );

            $this->audit->log(
                action: 'membership.roles_assigned',
                householdId: $household->id,
                auditable: $membership,
                newValues: ['role_ids' => $roleIds],
                actor: $actor,
            );

            return $membership->load(['user', 'roles.permissions']);
        });
    }
}
