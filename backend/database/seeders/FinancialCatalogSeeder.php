<?php

namespace Database\Seeders;

use App\Models\FinancialCategory;
use App\Models\Household;
use Illuminate\Database\Seeder;

class FinancialCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $catalog = [
            ['name' => 'Salario', 'type' => 'income', 'classification' => null],
            ['name' => 'Honorarios', 'type' => 'income', 'classification' => null],
            ['name' => 'Prima y bonificaciones', 'type' => 'income', 'classification' => null],
            ['name' => 'Otros ingresos', 'type' => 'income', 'classification' => null],
            ['name' => 'Vivienda', 'type' => 'expense', 'classification' => 'essential'],
            ['name' => 'Alimentación', 'type' => 'expense', 'classification' => 'essential'],
            ['name' => 'Mercado', 'type' => 'expense', 'classification' => 'essential', 'system_key' => 'mercado'],
            ['name' => 'Servicios públicos', 'type' => 'expense', 'classification' => 'essential'],
            ['name' => 'Transporte', 'type' => 'expense', 'classification' => 'essential'],
            ['name' => 'Salud', 'type' => 'expense', 'classification' => 'essential'],
            ['name' => 'Educación', 'type' => 'expense', 'classification' => 'essential'],
            ['name' => 'Entretenimiento', 'type' => 'expense', 'classification' => 'discretionary'],
            ['name' => 'Restaurantes', 'type' => 'expense', 'classification' => 'discretionary'],
            ['name' => 'Otros gastos', 'type' => 'expense', 'classification' => 'discretionary'],
        ];

        Household::query()->each(function (Household $household) use ($catalog): void {
            foreach ($catalog as $category) {
                FinancialCategory::query()->updateOrCreate(
                    ['household_id' => $household->id, 'type' => $category['type'], 'name' => $category['name']],
                    [
                        'classification' => $category['classification'],
                        'is_active' => true,
                        'system_key' => $category['system_key'] ?? null,
                    ],
                );
            }
        });
    }
}
