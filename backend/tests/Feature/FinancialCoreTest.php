<?php

namespace Tests\Feature;

use App\Actions\CreateHouseholdAction;
use App\Actions\CreateHouseholdMemberAction;
use App\Enums\RoleStatus;
use App\Models\FinancialAccount;
use App\Models\FinancialCategory;
use App\Models\Household;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\DecimalMoney;
use App\Services\FinancialService;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FinancialCoreTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    #[Test]
    public function shares_require_exactly_one_hundred_and_allocate_residue_deterministically(): void
    {
        $money = app(DecimalMoney::class);
        $shares = $money->allocate('100.0000', [
            ['membership_id' => 1, 'percentage' => '33.3333'],
            ['membership_id' => 2, 'percentage' => '33.3333'],
            ['membership_id' => 3, 'percentage' => '33.3334'],
        ]);

        $this->assertSame('33.3333', $shares[0]['amount']);
        $this->assertSame('33.3333', $shares[1]['amount']);
        $this->assertSame('33.3334', $shares[2]['amount']);
        $this->assertTrue($shares[2]['receives_rounding_residue']);

        $this->expectException(\InvalidArgumentException::class);
        $money->allocate('100.0000', [
            ['membership_id' => 1, 'percentage' => '60.0000'],
            ['membership_id' => 2, 'percentage' => '39.9999'],
        ]);
    }

    #[Test]
    public function partial_payments_reject_overpayment_are_idempotent_and_drive_internal_balances(): void
    {
        [$admin, $household, $adminMembership, $memberMembership] = $this->fixture();
        $service = app(FinancialService::class);
        [$account, $category] = $this->accountAndCategory($household, $adminMembership->id);

        $expense = $service->createExpense($admin, $household, [
            'category_id' => $category->id,
            'scope' => 'shared',
            'classification' => 'essential',
            'amount' => '100.0000',
            'currency_code' => 'COP',
            'occurred_on' => '2026-07-18',
            'status' => 'committed',
            'distribution_method' => 'equal',
            'shares' => [
                ['membership_id' => $adminMembership->id, 'percentage' => '50.0000'],
                ['membership_id' => $memberMembership->id, 'percentage' => '50.0000'],
            ],
        ]);

        $first = $service->registerPayment($admin, $household, $expense, [
            'payer_membership_id' => $adminMembership->id,
            'account_id' => $account->id,
            'amount' => '40.0000',
            'paid_on' => '2026-07-18',
            'idempotency_key' => 'pay-1',
        ]);
        $duplicate = $service->registerPayment($admin, $household, $expense, [
            'payer_membership_id' => $adminMembership->id,
            'account_id' => $account->id,
            'amount' => '40.0000',
            'paid_on' => '2026-07-18',
            'idempotency_key' => 'pay-1',
        ]);
        $this->assertSame($first->id, $duplicate->id);
        $this->assertSame('partial', $expense->fresh()->status);

        try {
            $service->registerPayment($admin, $household, $expense, [
                'payer_membership_id' => $adminMembership->id,
                'account_id' => $account->id,
                'amount' => '60.0001',
                'paid_on' => '2026-07-18',
                'idempotency_key' => 'pay-over',
            ]);
            $this->fail('Expected overpayment rejection.');
        } catch (\DomainException $exception) {
            $this->assertStringContainsString('supera', $exception->getMessage());
        }

        $service->registerPayment($admin, $household, $expense, [
            'payer_membership_id' => $adminMembership->id,
            'account_id' => $account->id,
            'amount' => '60.0000',
            'paid_on' => '2026-07-18',
            'idempotency_key' => 'pay-2',
        ]);
        $this->assertSame('paid', $expense->fresh()->status);

        $balances = collect($service->internalBalances($household))->keyBy('membership_id');
        $this->assertSame('50.0000', $balances[$adminMembership->id]['net_internal_balance']);
        $this->assertSame('-50.0000', $balances[$memberMembership->id]['net_internal_balance']);
    }

    #[Test]
    public function household_isolation_and_permissions_are_enforced(): void
    {
        [$adminA, $householdA] = $this->fixture('+573001111111');
        [, $householdB] = $this->fixture('+573002222222');

        $this->actingAs($adminA)
            ->getJson("/api/v1/households/{$householdB->id}/accounts")
            ->assertForbidden();

        $this->actingAs($adminA)
            ->getJson("/api/v1/households/{$householdA->id}/accounts")
            ->assertOk();
    }

    #[Test]
    public function recurrence_generation_is_idempotent(): void
    {
        [$admin, $household, $adminMembership, $memberMembership] = $this->fixture();
        [$account, $category] = $this->accountAndCategory($household, $adminMembership->id);
        $service = app(FinancialService::class);

        $template = $service->createRecurrence($admin, $household, [
            'kind' => 'expense',
            'frequency' => 'monthly',
            'starts_on' => '2026-07-01',
            'ends_on' => null,
            'payload' => [
                'category_id' => $category->id,
                'scope' => 'shared',
                'classification' => 'essential',
                'amount' => '90.0000',
                'currency_code' => $account->currency_code,
                'status' => 'planned',
                'distribution_method' => 'custom',
                'shares' => [
                    ['membership_id' => $adminMembership->id, 'percentage' => '50.0000'],
                    ['membership_id' => $memberMembership->id, 'percentage' => '50.0000'],
                ],
            ],
        ]);

        $first = $service->generateRecurrence($admin, $household, $template, '2026-07-01', 'rec-1');
        $second = $service->generateRecurrence($admin, $household, $template, '2026-07-01', 'rec-2');
        $this->assertSame($first->id, $second->id);
        $this->assertDatabaseCount('expenses', 1);
        $this->assertDatabaseCount('recurrence_generations', 1);
    }

    private function fixture(string $phone = '+573001112233'): array
    {
        $admin = User::factory()->create(['phone' => $phone]);
        $household = app(CreateHouseholdAction::class)->execute($admin, ['name' => 'Hogar '.$phone]);
        $memberRole = Role::query()->create([
            'household_id' => $household->id,
            'name' => 'Integrante',
            'status' => RoleStatus::Active,
        ]);
        $memberRole->permissions()->sync(Permission::query()->whereIn('key', [
            'hogar.ver', 'cuentas.ver', 'categorias.ver', 'gastos.ver_propios',
        ])->pluck('id'));
        $member = app(CreateHouseholdMemberAction::class)->execute($admin, $household, [
            'name' => 'Integrante',
            'phone' => $phone === '+573001112233' ? '3002223344' : '301'.substr($phone, -7),
            'password' => 'Member123!',
            'role_ids' => [$memberRole->id],
        ]);
        $adminMembership = $admin->memberships()->where('household_id', $household->id)->firstOrFail();

        return [$admin, $household, $adminMembership, $member];
    }

    private function accountAndCategory(Household $household, int $ownerId): array
    {
        $account = FinancialAccount::query()->create([
            'household_id' => $household->id,
            'owner_membership_id' => $ownerId,
            'name' => 'Cuenta test',
            'type' => 'checking',
            'currency_code' => 'COP',
            'opening_balance' => '0.0000',
            'scope' => 'individual',
            'is_active' => true,
        ]);
        $category = FinancialCategory::query()->create([
            'household_id' => $household->id,
            'name' => 'Vivienda',
            'type' => 'expense',
            'classification' => 'essential',
            'is_active' => true,
        ]);

        return [$account, $category];
    }
}
