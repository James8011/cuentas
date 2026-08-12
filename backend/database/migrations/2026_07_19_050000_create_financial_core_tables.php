<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('financial_accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_membership_id')->nullable()->constrained('household_memberships')->restrictOnDelete();
            $table->string('name', 100);
            $table->string('type', 20);
            $table->string('currency_code', 3)->default('COP');
            $table->decimal('opening_balance', 19, 4)->default(0);
            $table->string('scope', 20)->default('individual');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['household_id', 'name']);
            $table->index(['household_id', 'is_active']);
        });

        Schema::create('financial_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('type', 10);
            $table->string('classification', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->unique(['household_id', 'type', 'name']);
            $table->index(['household_id', 'type', 'is_active']);
        });

        Schema::create('recurrence_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 10);
            $table->string('frequency', 20);
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->date('next_occurrence_on');
            $table->json('payload');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['household_id', 'kind', 'is_active']);
        });

        Schema::create('incomes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('owner_membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->foreignId('account_id')->nullable()->constrained('financial_accounts')->restrictOnDelete();
            $table->foreignId('category_id')->constrained('financial_categories')->restrictOnDelete();
            $table->foreignId('recurrence_template_id')->nullable()->constrained('recurrence_templates')->nullOnDelete();
            $table->string('kind', 20);
            $table->string('scope', 20)->default('individual');
            $table->decimal('gross_amount', 19, 4)->nullable();
            $table->decimal('net_amount', 19, 4);
            $table->string('currency_code', 3);
            $table->date('expected_on')->nullable();
            $table->date('effective_on')->nullable();
            $table->string('frequency', 20)->default('once');
            $table->string('status', 20)->default('expected');
            $table->text('notes')->nullable();
            $table->string('occurrence_key', 100)->nullable();
            $table->timestamps();
            $table->unique(['recurrence_template_id', 'occurrence_key']);
            $table->index(['household_id', 'owner_membership_id', 'effective_on']);
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by_membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->foreignId('beneficiary_membership_id')->nullable()->constrained('household_memberships')->restrictOnDelete();
            $table->foreignId('category_id')->constrained('financial_categories')->restrictOnDelete();
            $table->foreignId('recurrence_template_id')->nullable()->constrained('recurrence_templates')->nullOnDelete();
            $table->string('scope', 20);
            $table->string('classification', 20);
            $table->decimal('amount', 19, 4);
            $table->string('currency_code', 3);
            $table->date('occurred_on');
            $table->string('status', 20)->default('planned');
            $table->text('notes')->nullable();
            $table->string('occurrence_key', 100)->nullable();
            $table->timestamps();
            $table->unique(['recurrence_template_id', 'occurrence_key']);
            $table->index(['household_id', 'status', 'occurred_on']);
        });

        Schema::create('expense_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignId('expense_id')->constrained()->cascadeOnDelete();
            $table->foreignId('membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->decimal('percentage', 7, 4);
            $table->decimal('amount', 19, 4);
            $table->boolean('receives_rounding_residue')->default(false);
            $table->timestamps();
            $table->unique(['expense_id', 'membership_id']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('expense_id')->constrained()->restrictOnDelete();
            $table->foreignId('payer_membership_id')->constrained('household_memberships')->restrictOnDelete();
            $table->foreignId('account_id')->constrained('financial_accounts')->restrictOnDelete();
            $table->decimal('amount', 19, 4);
            $table->string('currency_code', 3);
            $table->date('paid_on');
            $table->string('idempotency_key', 100);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->unique(['household_id', 'idempotency_key']);
            $table->index(['expense_id', 'paid_on']);
        });

        Schema::create('recurrence_generations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('recurrence_template_id')->constrained()->cascadeOnDelete();
            $table->date('occurrence_on');
            $table->string('idempotency_key', 100);
            $table->nullableMorphs('generated');
            $table->timestamp('created_at')->useCurrent();
            $table->unique(['recurrence_template_id', 'occurrence_on'], 'recurrence_occurrence_unique');
            $table->unique('idempotency_key', 'recurrence_idempotency_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recurrence_generations');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('expense_shares');
        Schema::dropIfExists('expenses');
        Schema::dropIfExists('incomes');
        Schema::dropIfExists('recurrence_templates');
        Schema::dropIfExists('financial_categories');
        Schema::dropIfExists('financial_accounts');
    }
};
