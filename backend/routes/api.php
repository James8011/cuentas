<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\FinancialController;
use App\Http\Controllers\Api\V1\HouseholdController;
use App\Http\Controllers\Api\V1\MarketController;
use App\Http\Controllers\Api\V1\MemberController;
use App\Http\Controllers\Api\V1\PermissionController;
use App\Http\Controllers\Api\V1\Phase3Controller;
use App\Http\Controllers\Api\V1\RoleController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function () {
        return response()->json([
            'status' => 'ok',
            'service' => 'cuentas-api',
        ]);
    });

    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

    Route::middleware(['auth:sanctum', 'active'])->group(function (): void {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        Route::get('/permissions', [PermissionController::class, 'index']);

        Route::get('/households', [HouseholdController::class, 'index']);
        Route::post('/households', [HouseholdController::class, 'store']);
        Route::get('/households/{household}', [HouseholdController::class, 'show']);
        Route::patch('/households/{household}', [HouseholdController::class, 'update']);

        Route::get('/households/{household}/members', [MemberController::class, 'index']);
        Route::post('/households/{household}/members', [MemberController::class, 'store']);
        Route::patch('/households/{household}/members/{membership}', [MemberController::class, 'update']);

        Route::get('/households/{household}/roles', [RoleController::class, 'index']);
        Route::post('/households/{household}/roles', [RoleController::class, 'store']);
        Route::patch('/households/{household}/roles/{role}', [RoleController::class, 'update']);
        Route::post('/households/{household}/roles/{role}/duplicate', [RoleController::class, 'duplicate']);

        Route::get('/households/{household}/accounts', [FinancialController::class, 'accounts'])->name('accounts.index');
        Route::post('/households/{household}/accounts', [FinancialController::class, 'storeAccount'])->name('accounts.store');
        Route::patch('/households/{household}/accounts/{account}', [FinancialController::class, 'updateAccount'])->name('accounts.update');
        Route::get('/households/{household}/categories', [FinancialController::class, 'categories'])->name('categories.index');
        Route::post('/households/{household}/categories', [FinancialController::class, 'storeCategory'])->name('categories.store');
        Route::patch('/households/{household}/categories/{category}', [FinancialController::class, 'updateCategory'])->name('categories.update');
        Route::get('/households/{household}/incomes', [FinancialController::class, 'incomes'])->name('incomes.index');
        Route::post('/households/{household}/incomes', [FinancialController::class, 'storeIncome'])->name('incomes.store');
        Route::patch('/households/{household}/incomes/{income}', [FinancialController::class, 'updateIncome'])->name('incomes.update');
        Route::post('/households/{household}/incomes/{income}/receive', [FinancialController::class, 'receiveIncome'])->name('incomes.receive');
        Route::post('/households/{household}/incomes/{income}/cancel', [FinancialController::class, 'cancelIncome'])->name('incomes.cancel');
        Route::get('/households/{household}/expenses', [FinancialController::class, 'expenses'])->name('expenses.index');
        Route::post('/households/{household}/expenses', [FinancialController::class, 'storeExpense'])->name('expenses.store');
        Route::get('/households/{household}/expenses/{expense}', [FinancialController::class, 'showExpense'])->name('expenses.show');
        Route::post('/households/{household}/expenses/{expense}/cancel', [FinancialController::class, 'cancelExpense'])->name('expenses.cancel');
        Route::post('/households/{household}/expenses/{expense}/commit', [FinancialController::class, 'commitExpense'])->name('expenses.commit');
        Route::post('/households/{household}/expenses/{expense}/payments', [FinancialController::class, 'storePayment'])->name('payments.store');
        Route::get('/households/{household}/internal-balances', [FinancialController::class, 'balances'])->name('balances.index');
        Route::get('/households/{household}/recurrences', [FinancialController::class, 'recurrences'])->name('recurrences.index');
        Route::post('/households/{household}/recurrences', [FinancialController::class, 'storeRecurrence'])->name('recurrences.store');
        Route::post('/households/{household}/recurrences/{recurrence}/generate', [FinancialController::class, 'generateRecurrence'])->name('recurrences.generate');

        Route::get('/households/{household}/debts', [Phase3Controller::class, 'debts'])->name('debts.index');
        Route::post('/households/{household}/debts', [Phase3Controller::class, 'storeDebt'])->name('debts.store');
        Route::patch('/households/{household}/debts/{debt}', [Phase3Controller::class, 'updateDebt'])->name('debts.update');
        Route::post('/households/{household}/debts/{debt}/cancel', [Phase3Controller::class, 'cancelDebt'])->name('debts.cancel');
        Route::post('/households/{household}/debts/{debt}/payments', [Phase3Controller::class, 'storeDebtPayment'])->name('debts.payments');
        Route::get('/households/{household}/savings-goals', [Phase3Controller::class, 'savings'])->name('savings.index');
        Route::post('/households/{household}/savings-goals', [Phase3Controller::class, 'storeSavings'])->name('savings.store');
        Route::patch('/households/{household}/savings-goals/{goal}', [Phase3Controller::class, 'updateSavings'])->name('savings.update');
        Route::post('/households/{household}/savings-goals/{goal}/cancel', [Phase3Controller::class, 'cancelSavings'])->name('savings.cancel');
        Route::post('/households/{household}/savings-goals/{goal}/movements', [Phase3Controller::class, 'moveSavings'])->name('savings.move');
        Route::get('/households/{household}/budgets', [Phase3Controller::class, 'budgets'])->name('budgets.index');
        Route::post('/households/{household}/budgets', [Phase3Controller::class, 'storeBudget'])->name('budgets.store');
        Route::patch('/households/{household}/budgets/{budget}', [Phase3Controller::class, 'updateBudget'])->name('budgets.update');
        Route::post('/households/{household}/budgets/{budget}/cancel', [Phase3Controller::class, 'cancelBudget'])->name('budgets.cancel');
        Route::get('/households/{household}/budgets/{budget}/tracking', [Phase3Controller::class, 'budgetTracking'])->name('budgets.tracking');
        Route::get('/households/{household}/cash-flow', [Phase3Controller::class, 'cashFlow'])->name('cashflow.show');
        Route::get('/households/{household}/period-closes', [Phase3Controller::class, 'periodCloses'])->name('periods.index');
        Route::post('/households/{household}/period-closes', [Phase3Controller::class, 'closePeriod'])->name('periods.close');
        Route::post('/households/{household}/distribution-preview', [Phase3Controller::class, 'distributionPreview'])->name('distribution.preview');
        Route::get('/households/{household}/settlements', [Phase3Controller::class, 'settlements'])->name('settlements.index');
        Route::post('/households/{household}/settlements', [Phase3Controller::class, 'storeSettlement'])->name('settlements.store');
        Route::get('/households/{household}/audit-logs', [Phase3Controller::class, 'auditLogs'])->name('audit.index');
        Route::get('/households/{household}/export', [Phase3Controller::class, 'export'])->name('export.download');
        Route::post('/recurrences/generate-due', [Phase3Controller::class, 'generateDue'])->name('recurrences.generateDue');

        Route::get('/households/{household}/market/products', [MarketController::class, 'products'])->name('market.products.index');
        Route::post('/households/{household}/market/products', [MarketController::class, 'storeProduct'])->name('market.products.store');
        Route::post('/households/{household}/market/products/{product}', [MarketController::class, 'updateProduct'])->name('market.products.update');
        Route::get('/households/{household}/market/lists', [MarketController::class, 'lists'])->name('market.lists.index');
        Route::post('/households/{household}/market/lists', [MarketController::class, 'storeList'])->name('market.lists.store');
        Route::get('/households/{household}/market/lists/{list}', [MarketController::class, 'showList'])->name('market.lists.show');
        Route::patch('/households/{household}/market/lists/{list}', [MarketController::class, 'updateList'])->name('market.lists.update');
        Route::post('/households/{household}/market/lists/{list}/close', [MarketController::class, 'closeList'])->name('market.lists.close');
        Route::post('/households/{household}/market/lists/{list}/cancel', [MarketController::class, 'cancelList'])->name('market.lists.cancel');
        Route::post('/households/{household}/market/lists/{list}/items', [MarketController::class, 'storeItem'])->name('market.items.store');
        Route::post('/households/{household}/market/lists/{list}/items/{item}', [MarketController::class, 'updateItem'])->name('market.items.update');
        Route::delete('/households/{household}/market/lists/{list}/items/{item}', [MarketController::class, 'destroyItem'])->name('market.items.destroy');
        Route::get('/households/{household}/market/budget', [MarketController::class, 'budget'])->name('market.budget');
    });
});
