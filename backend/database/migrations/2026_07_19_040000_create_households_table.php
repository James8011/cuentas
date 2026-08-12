<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('households', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('country_code', 2)->default('CO');
            $table->string('locale', 16)->default('es_CO');
            $table->string('currency_code', 3)->default('COP');
            $table->string('timezone', 64)->default('America/Bogota');
            $table->foreignId('created_by_user_id')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->index(['country_code', 'currency_code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('households');
    }
};
