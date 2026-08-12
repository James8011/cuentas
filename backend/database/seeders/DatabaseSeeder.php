<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            InitialAccessSeeder::class,
        ]);

        // Solo entorno local: usuario débil adicional de desarrollo (si difiere del seed principal).
        if (! app()->environment('production')) {
            $this->call([
                DevAdminSeeder::class,
            ]);
        }
    }
}
