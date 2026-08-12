<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach (config('permissions.catalog') as $permission) {
            Permission::query()->updateOrCreate(
                ['key' => $permission['key']],
                [
                    'name' => $permission['name'],
                    'description' => $permission['description'],
                    'group' => $permission['group'],
                ]
            );
        }

        $allPermissionIds = Permission::query()->pluck('id');
        Role::query()
            ->where('is_system', true)
            ->where('name', 'Administrador')
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($allPermissionIds));
    }
}
