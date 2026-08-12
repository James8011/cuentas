<?php

namespace App\Actions;

use App\Enums\RoleStatus;
use App\Models\Household;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\AdminContinuityGuard;
use App\Services\AuditLogger;
use DomainException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ManageRoleAction
{
    public function __construct(
        private readonly AdminContinuityGuard $adminGuard,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{
     *     name: string,
     *     description?: string|null,
     *     permission_keys: list<string>,
     *     status?: string
     * }  $data
     */
    public function create(User $actor, Household $household, array $data): Role
    {
        $permissionIds = $this->resolvePermissionIds($data['permission_keys']);

        return DB::transaction(function () use ($actor, $household, $data, $permissionIds): Role {
            $role = Role::query()->create([
                'household_id' => $household->id,
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'is_system' => false,
                'status' => RoleStatus::Active,
            ]);

            $role->permissions()->sync($permissionIds);

            $this->audit->log(
                action: 'role.created',
                householdId: $household->id,
                auditable: $role,
                newValues: [
                    'name' => $role->name,
                    'permission_keys' => $data['permission_keys'],
                ],
                actor: $actor,
            );

            return $role->load('permissions');
        });
    }

    /**
     * @param  array{
     *     name?: string,
     *     description?: string|null,
     *     permission_keys?: list<string>,
     *     status?: string
     * }  $data
     */
    public function update(User $actor, Role $role, array $data): Role
    {
        $permissionKeys = $data['permission_keys'] ?? $role->permissions()->pluck('key')->all();
        $permissionIds = $this->resolvePermissionIds($permissionKeys);
        $status = isset($data['status'])
            ? RoleStatus::from($data['status'])
            : $role->status;

        $this->adminGuard->assertRoleChangeKeepsAdmin($role, $permissionIds, $status);

        return DB::transaction(function () use ($actor, $role, $data, $permissionIds, $permissionKeys, $status): Role {
            $old = [
                'name' => $role->name,
                'description' => $role->description,
                'status' => $role->status->value,
                'permission_keys' => $role->permissions()->pluck('key')->all(),
            ];

            $role->fill([
                'name' => $data['name'] ?? $role->name,
                'description' => array_key_exists('description', $data) ? $data['description'] : $role->description,
                'status' => $status,
            ])->save();

            $role->permissions()->sync($permissionIds);

            $this->audit->log(
                action: 'role.updated',
                householdId: $role->household_id,
                auditable: $role,
                oldValues: $old,
                newValues: [
                    'name' => $role->name,
                    'description' => $role->description,
                    'status' => $role->status->value,
                    'permission_keys' => $permissionKeys,
                ],
                actor: $actor,
            );

            return $role->load('permissions');
        });
    }

    public function duplicate(User $actor, Role $role): Role
    {
        $keys = $role->permissions()->pluck('key')->all();

        return $this->create($actor, $role->household, [
            'name' => $role->name.' (copia)',
            'description' => $role->description,
            'permission_keys' => $keys,
        ]);
    }

    /**
     * @param  list<string>  $keys
     * @return list<int>
     */
    private function resolvePermissionIds(array $keys): array
    {
        $keys = array_values(array_unique($keys));
        $catalog = collect(config('permissions.catalog'))->pluck('key')->all();

        $unknown = array_diff($keys, $catalog);

        if ($unknown !== []) {
            throw ValidationException::withMessages([
                'permission_keys' => ['Permisos desconocidos: '.implode(', ', $unknown)],
            ]);
        }

        $permissions = Permission::query()->whereIn('key', $keys)->get();

        if ($permissions->count() !== count($keys)) {
            throw new DomainException('El catálogo de permisos en base de datos está incompleto. Ejecute los seeders.');
        }

        return $permissions->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}
