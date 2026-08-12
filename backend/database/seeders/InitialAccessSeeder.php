<?php

namespace Database\Seeders;

use App\Actions\CreateHouseholdAction;
use App\Enums\RoleStatus;
use App\Enums\UserStatus;
use App\Models\Household;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Carga inicial: permisos del catálogo, usuario admin, hogar y roles con permisos.
 * Idempotente (seguro re-ejecutar en deploy).
 *
 * Variables de entorno opcionales:
 *  SEED_ADMIN_PHONE, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL,
 *  SEED_HOUSEHOLD_NAME
 */
class InitialAccessSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(PermissionSeeder::class);

        $phone = (string) env('SEED_ADMIN_PHONE', '+573001112233');
        $password = (string) env('SEED_ADMIN_PASSWORD', 'HogarAdmin2026!');
        $name = (string) env('SEED_ADMIN_NAME', 'Administrador del hogar');
        $email = env('SEED_ADMIN_EMAIL', 'admin@hogar.local');
        $householdName = (string) env('SEED_HOUSEHOLD_NAME', 'Hogar principal');

        $user = User::query()->updateOrCreate(
            ['phone' => $phone],
            [
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'status' => UserStatus::Active,
            ]
        );

        $household = $user->memberships()
            ->where('status', 'active')
            ->with('household')
            ->first()
            ?->household;

        if (! $household) {
            $household = app(CreateHouseholdAction::class)->execute($user, [
                'name' => $householdName,
                'country_code' => 'CO',
                'locale' => 'es_CO',
                'currency_code' => 'COP',
                'timezone' => 'America/Bogota',
            ]);
            $this->command?->info("Hogar creado: {$household->name}");
        } else {
            $this->command?->info("Hogar existente: {$household->name}");
        }

        $this->ensureSystemRoles($household);

        $this->call(FinancialCatalogSeeder::class);

        $this->command?->warn('Acceso inicial listo (cámbialo en producción si usas la contraseña por defecto).');
        $this->command?->line('Teléfono: '.$phone);
        $this->command?->line('Contraseña: '.$password);
        $this->command?->line('Roles: Administrador, Integrante, Consulta');
    }

    private function ensureSystemRoles(Household $household): void
    {
        $byKey = Permission::query()->pluck('id', 'key');

        $admin = Role::query()->firstOrCreate(
            ['household_id' => $household->id, 'name' => 'Administrador'],
            [
                'description' => 'Acceso total al hogar',
                'is_system' => true,
                'status' => RoleStatus::Active,
            ]
        );
        $admin->update(['is_system' => true, 'status' => RoleStatus::Active]);
        $admin->permissions()->sync($byKey->values()->all());

        $memberKeys = [
            'hogar.ver',
            'miembros.ver',
            'roles.ver',
            'cuentas.ver',
            'cuentas.gestionar',
            'categorias.ver',
            'categorias.gestionar',
            'ingresos.ver_propios',
            'ingresos.ver_compartidos',
            'ingresos.crear',
            'ingresos.editar_propios',
            'gastos.ver_propios',
            'gastos.ver_compartidos',
            'gastos.crear',
            'gastos.editar',
            'gastos.registrar_pago',
            'pagos.ver',
            'recurrencias.ver',
            'recurrencias.gestionar',
            'deudas.ver_propias',
            'deudas.ver_compartidas',
            'deudas.crear',
            'deudas.editar',
            'ahorros.ver_propios',
            'ahorros.ver_compartidos',
            'ahorros.gestionar',
            'presupuestos.ver',
            'presupuestos.gestionar',
            'mercado.ver',
            'mercado.gestionar',
            'datos.exportar',
        ];

        $viewerKeys = [
            'hogar.ver',
            'miembros.ver',
            'roles.ver',
            'cuentas.ver',
            'categorias.ver',
            'ingresos.ver_propios',
            'ingresos.ver_compartidos',
            'gastos.ver_propios',
            'gastos.ver_compartidos',
            'pagos.ver',
            'recurrencias.ver',
            'deudas.ver_propias',
            'deudas.ver_compartidas',
            'ahorros.ver_propios',
            'ahorros.ver_compartidos',
            'presupuestos.ver',
            'mercado.ver',
            'auditoria.ver',
        ];

        $this->upsertRole(
            $household,
            'Integrante',
            'Opera finanzas del día a día (sin administrar roles/miembros).',
            $memberKeys,
            $byKey,
        );

        $this->upsertRole(
            $household,
            'Consulta',
            'Solo lectura de información del hogar.',
            $viewerKeys,
            $byKey,
        );
    }

    /**
     * @param  list<string>  $keys
     * @param  \Illuminate\Support\Collection<string, int>  $byKey
     */
    private function upsertRole(
        Household $household,
        string $name,
        string $description,
        array $keys,
        $byKey,
    ): void {
        $role = Role::query()->updateOrCreate(
            ['household_id' => $household->id, 'name' => $name],
            [
                'description' => $description,
                'is_system' => true,
                'status' => RoleStatus::Active,
            ]
        );

        $ids = collect($keys)
            ->map(fn (string $key) => $byKey->get($key))
            ->filter()
            ->values()
            ->all();

        $role->permissions()->sync($ids);
    }
}
