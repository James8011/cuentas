<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('debts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->string('creditor_name', 120);
            $table->string('name', 120);
            $table->decimal('principal_amount', 19, 4);
            $table->decimal('current_balance', 19, 4);
            $table->decimal('minimum_payment', 19, 4)->default(0);
            $table->decimal('interest_rate_annual', 7, 4)->nullable();
            $table->string('rate_type', 20)->default('effective');
            $table->string('currency_code', 3);
            $table->string('frequency', 20)->default('monthly');
            $table->date('opened_on')->nullable();
            $table->date('next_payment_on')->nullable();
            $table->string('status', 20)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['household_id', 'status']);
        });

        Schema::create('debt_responsibilities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('debt_id')->constrained()->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->decimal('percentage', 7, 4);
            $table->timestamps();
            $table->unique(['debt_id', 'membership_id']);
        });

        Schema::create('debt_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('debt_id')->constrained()->restrictOnDelete();
            $table->foreignId('payer_membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->foreignId('account_id')->constrained('financial_accounts')->restrictOnDelete();
            $table->decimal('amount', 19, 4);
            $table->string('currency_code', 3);
            $table->date('paid_on');
            $table->string('idempotency_key', 100);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['household_id', 'idempotency_key']);
        });

        Schema::create('savings_goals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_membership_id')->nullable()->constrained('household_memberships')->nullOnDelete();
            $table->foreignId('account_id')->nullable()->constrained('financial_accounts')->nullOnDelete();
            $table->string('name', 120);
            $table->string('kind', 30)->default('goal'); // goal | emergency
            $table->string('scope', 20)->default('shared');
            $table->decimal('target_amount', 19, 4);
            $table->decimal('current_amount', 19, 4)->default(0);
            $table->string('currency_code', 3);
            $table->unsignedTinyInteger('emergency_months')->nullable();
            $table->date('target_on')->nullable();
            $table->string('status', 20)->default('active');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['household_id', 'status']);
        });

        Schema::create('savings_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('savings_goal_id')->constrained()->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->foreignId('account_id')->nullable()->constrained('financial_accounts')->nullOnDelete();
            $table->string('type', 20); // contribution | withdrawal
            $table->decimal('amount', 19, 4);
            $table->string('currency_code', 3);
            $table->date('moved_on');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('budgets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_membership_id')->nullable()->constrained('household_memberships')->nullOnDelete();
            $table->string('name', 120);
            $table->string('scope', 20)->default('shared');
            $table->string('period', 7); // YYYY-MM
            $table->string('currency_code', 3);
            $table->string('status', 20)->default('open'); // open | closed
            $table->timestamps();
            $table->unique(['household_id', 'period', 'scope', 'owner_membership_id'], 'budgets_unique_period');
        });

        Schema::create('budget_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('budget_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('financial_categories')->restrictOnDelete();
            $table->decimal('planned_amount', 19, 4);
            $table->timestamps();
            $table->unique(['budget_id', 'category_id']);
        });

        Schema::create('period_closes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('closed_by_membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->string('period', 7);
            $table->json('snapshot');
            $table->timestamp('closed_at');
            $table->timestamps();
            $table->unique(['household_id', 'period']);
        });

        Schema::create('internal_settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('from_membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->foreignId('to_membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->foreignId('account_id')->nullable()->constrained('financial_accounts')->nullOnDelete();
            $table->decimal('amount', 19, 4);
            $table->string('currency_code', 3);
            $table->date('settled_on');
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->index(['household_id', 'settled_on']);
        });

        Schema::create('capacity_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->decimal('fixed_deduction', 19, 4)->default(0);
            $table->decimal('percent_deduction', 7, 4)->default(0);
            $table->timestamps();
            $table->unique(['household_id', 'membership_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capacity_settings');
        Schema::dropIfExists('internal_settlements');
        Schema::dropIfExists('period_closes');
        Schema::dropIfExists('budget_lines');
        Schema::dropIfExists('budgets');
        Schema::dropIfExists('savings_movements');
        Schema::dropIfExists('savings_goals');
        Schema::dropIfExists('debt_payments');
        Schema::dropIfExists('debt_responsibilities');
        Schema::dropIfExists('debts');
    }
};
