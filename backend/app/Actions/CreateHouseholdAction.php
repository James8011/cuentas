<?php

namespace App\Actions;

use App\Enums\MembershipStatus;
use App\Enums\RoleStatus;
use App\Enums\UserStatus;
use App\Models\Household;
use App\Models\HouseholdMembership;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\MarketService;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class CreateHouseholdAction
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly MarketService $market,
    ) {}

    /**
     * @param  array{
     *     name: string,
     *     country_code?: string,
     *     locale?: string,
     *     currency_code?: string,
     *     timezone?: string
     * }  $data
     */
    public function execute(User $creator, array $data): Household
    {
        if ($creator->status !== UserStatus::Active) {
            throw new InvalidArgumentException('Solo un usuario activo puede crear un hogar.');
        }

        return DB::transaction(function () use ($creator, $data): Household {
            $household = Household::query()->create([
                'name' => $data['name'],
                'country_code' => $data['country_code'] ?? 'CO',
                'locale' => $data['locale'] ?? 'es_CO',
                'currency_code' => $data['currency_code'] ?? 'COP',
                'timezone' => $data['timezone'] ?? 'America/Bogota',
                'created_by_user_id' => $creator->id,
            ]);

            $adminRole = Role::query()->create([
                'household_id' => $household->id,
                'name' => 'Administrador',
                'description' => 'Rol inicial con todos los permisos del sistema',
                'is_system' => true,
                'status' => RoleStatus::Active,
            ]);

            $permissionIds = Permission::query()->pluck('id');
            $adminRole->permissions()->sync($permissionIds);

            $membership = HouseholdMembership::query()->create([
                'household_id' => $household->id,
                'user_id' => $creator->id,
                'status' => MembershipStatus::Active,
                'joined_at' => now(),
                'created_by_user_id' => $creator->id,
            ]);

            $membership->roles()->sync([$adminRole->id]);

            $this->market->ensureMercadoCategory($household);

            $this->audit->log(
                action: 'household.created',
                householdId: $household->id,
                auditable: $household,
                newValues: $household->only(['name', 'country_code', 'locale', 'currency_code', 'timezone']),
                actor: $creator,
            );

            $this->audit->log(
                action: 'membership.created',
                householdId: $household->id,
                auditable: $membership,
                newValues: [
                    'user_id' => $creator->id,
                    'role_ids' => [$adminRole->id],
                ],
                actor: $creator,
            );

            return $household->load(['memberships.user', 'roles.permissions']);
        });
    }
}
