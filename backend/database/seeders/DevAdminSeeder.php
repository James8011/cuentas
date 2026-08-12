<?php

namespace Database\Seeders;

use App\Actions\CreateHouseholdAction;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Development-only bootstrap user and household.
 * Password is intentionally weak and must be changed outside local use.
 */
class DevAdminSeeder extends Seeder
{
    public const DEV_PHONE = '+573001112233';

    public const DEV_PASSWORD = 'DevAdmin123!';

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('DevAdminSeeder omitted in production.');

            return;
        }

        $user = User::query()->firstOrCreate(
            ['phone' => self::DEV_PHONE],
            [
                'name' => 'Admin Desarrollo',
                'email' => 'admin.dev@example.local',
                'password' => self::DEV_PASSWORD,
                'status' => UserStatus::Active,
            ]
        );

        if ($user->memberships()->exists()) {
            $this->command?->info('Usuario de desarrollo ya tiene hogar; se omite recreación.');

            return;
        }

        app(CreateHouseholdAction::class)->execute($user, [
            'name' => 'Hogar de desarrollo',
            'country_code' => 'CO',
            'locale' => 'es_CO',
            'currency_code' => 'COP',
            'timezone' => 'America/Bogota',
        ]);

        $this->command?->warn('Usuario de desarrollo creado. Cambie la contraseña inicial antes de cualquier uso real.');
        $this->command?->line('Teléfono: '.self::DEV_PHONE);
        $this->command?->line('Contraseña inicial (solo local): '.self::DEV_PASSWORD);
    }
}
