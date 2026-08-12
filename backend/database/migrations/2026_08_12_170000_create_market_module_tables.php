<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('financial_categories', function (Blueprint $table) {
            $table->string('system_key', 40)->nullable()->after('name');
            $table->unique(['household_id', 'system_key'], 'financial_categories_household_system_key_unique');
        });

        $householdIds = DB::table('households')->pluck('id');
        foreach ($householdIds as $householdId) {
            $exists = DB::table('financial_categories')
                ->where('household_id', $householdId)
                ->where(function ($q) {
                    $q->where('system_key', 'mercado')
                        ->orWhere(function ($q2) {
                            $q2->where('type', 'expense')->where('name', 'Mercado');
                        });
                })
                ->first();

            if ($exists) {
                DB::table('financial_categories')
                    ->where('id', $exists->id)
                    ->update([
                        'name' => 'Mercado',
                        'type' => 'expense',
                        'classification' => 'essential',
                        'system_key' => 'mercado',
                        'is_active' => true,
                        'updated_at' => now(),
                    ]);
            } else {
                DB::table('financial_categories')->insert([
                    'household_id' => $householdId,
                    'name' => 'Mercado',
                    'system_key' => 'mercado',
                    'type' => 'expense',
                    'classification' => 'essential',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        Schema::create('market_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('unit', 20)->default('unit');
            $table->decimal('last_unit_price', 19, 4)->nullable();
            $table->string('photo_path', 255)->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['household_id', 'name']);
            $table->index(['household_id', 'is_active']);
        });

        Schema::create('market_lists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->string('name', 120);
            $table->string('status', 20)->default('active'); // active | shopping | closed | cancelled
            $table->string('period', 7); // YYYY-MM
            $table->text('notes')->nullable();
            $table->foreignId('expense_id')->nullable()->constrained('expenses')->nullOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->index(['household_id', 'status']);
            $table->index(['household_id', 'period']);
        });

        Schema::create('market_list_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('market_list_id')->constrained('market_lists')->cascadeOnDelete();
            $table->foreignId('market_product_id')->nullable()->constrained('market_products')->nullOnDelete();
            $table->string('name', 120);
            $table->string('unit', 20)->default('unit');
            $table->decimal('quantity_planned', 19, 4)->default(1);
            $table->decimal('quantity_bought', 19, 4)->nullable();
            $table->decimal('estimated_unit_price', 19, 4)->default(0);
            $table->decimal('actual_unit_price', 19, 4)->nullable();
            $table->boolean('is_checked')->default(false);
            $table->text('notes')->nullable();
            $table->string('photo_path', 255)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['market_list_id', 'is_checked']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('market_list_items');
        Schema::dropIfExists('market_lists');
        Schema::dropIfExists('market_products');

        Schema::table('financial_categories', function (Blueprint $table) {
            $table->dropUnique('financial_categories_household_system_key_unique');
            $table->dropColumn('system_key');
        });
    }
};
