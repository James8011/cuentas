<?php

namespace Tests\Feature;

use App\Actions\CreateHouseholdAction;
use App\Actions\CreateHouseholdMemberAction;
use App\Enums\MembershipStatus;
use App\Enums\RoleStatus;
use App\Enums\UserStatus;
use App\Models\Household;
use App\Models\HouseholdMembership;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class Phase1IdentityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(PermissionSeeder::class);
    }

    #[Test]
    public function user_can_login_and_logout_with_phone_and_password(): void
    {
        $user = User::factory()->create([
            'phone' => '+573001112233',
            'password' => 'Secret123!',
        ]);

        $login = $this->withStatefulApi()->postJson('/api/v1/login', [
            'phone' => '3001112233',
            'password' => 'Secret123!',
        ]);

        $login->assertOk()
            ->assertJsonPath('user.phone', '+573001112233')
            ->assertJsonMissingPath('user.password');

        $this->assertAuthenticatedAs($user);

        $logout = $this->withStatefulApi()->postJson('/api/v1/logout');
        $logout->assertOk()->assertJsonPath('message', 'Sesión cerrada.');

        // Fresh guard/session state between HTTP cycles in the test client.
        $this->app['auth']->forgetGuards();
        $this->flushSession();

        $this->withStatefulApi()->getJson('/api/v1/me')->assertUnauthorized();
    }

    #[Test]
    public function suspended_user_cannot_login(): void
    {
        User::factory()->suspended()->create([
            'phone' => '+573009998877',
            'password' => 'Secret123!',
        ]);

        $this->withStatefulApi()->postJson('/api/v1/login', [
            'phone' => '+573009998877',
            'password' => 'Secret123!',
        ])->assertStatus(422);
    }

    #[Test]
    public function authorized_member_can_create_user_with_role(): void
    {
        [$admin, $household] = $this->createAdminHousehold();

        $viewer = Role::query()->create([
            'household_id' => $household->id,
            'name' => 'Consulta',
            'description' => 'Solo lectura',
            'is_system' => false,
            'status' => RoleStatus::Active,
        ]);

        $viewer->permissions()->sync(
            Permission::query()->whereIn('key', ['hogar.ver', 'miembros.ver', 'roles.ver'])->pluck('id')
        );

        $response = $this->actingAs($admin)->postJson("/api/v1/households/{$household->id}/members", [
            'name' => 'Integrante Nuevo',
            'phone' => '3002223344',
            'password' => 'Member123!',
            'role_ids' => [$viewer->id],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.user.phone', '+573002223344')
            ->assertJsonPath('data.status', 'active');

        $this->assertDatabaseHas('users', [
            'phone' => '+573002223344',
            'status' => UserStatus::Active->value,
        ]);
    }

    #[Test]
    public function household_isolation_blocks_cross_household_member_listing(): void
    {
        [$adminA, $householdA] = $this->createAdminHousehold('+573001111111');
        [, $householdB] = $this->createAdminHousehold('+573002222222');

        $this->actingAs($adminA)
            ->getJson("/api/v1/households/{$householdB->id}/members")
            ->assertForbidden();

        $this->actingAs($adminA)
            ->getJson("/api/v1/households/{$householdA->id}/members")
            ->assertOk();
    }

    #[Test]
    public function effective_permissions_are_union_of_active_roles(): void
    {
        [$admin, $household] = $this->createAdminHousehold();

        $roleA = Role::query()->create([
            'household_id' => $household->id,
            'name' => 'A',
            'status' => RoleStatus::Active,
        ]);
        $roleB = Role::query()->create([
            'household_id' => $household->id,
            'name' => 'B',
            'status' => RoleStatus::Active,
        ]);

        $roleA->permissions()->sync(Permission::query()->where('key', 'hogar.ver')->pluck('id'));
        $roleB->permissions()->sync(Permission::query()->where('key', 'miembros.ver')->pluck('id'));

        $member = app(CreateHouseholdMemberAction::class)->execute($admin, $household, [
            'name' => 'Union',
            'phone' => '3003334455',
            'password' => 'Member123!',
            'role_ids' => [$roleA->id, $roleB->id],
        ]);

        $this->actingAs($admin)
            ->getJson("/api/v1/households/{$household->id}/members")
            ->assertOk()
            ->assertJsonFragment(['phone' => '+573003334455'])
            ->assertJsonFragment(['hogar.ver'])
            ->assertJsonFragment(['miembros.ver']);

        $this->assertContains('hogar.ver', $member->fresh()->load('roles.permissions')
            ? app(\App\Services\PermissionResolver::class)->forMembership($member->fresh()->load(['roles.permissions', 'user']))
            : []);
    }

    #[Test]
    public function cannot_remove_last_administrator_capability(): void
    {
        [$admin, $household] = $this->createAdminHousehold();

        $adminRole = $household->roles()->where('name', 'Administrador')->firstOrFail();
        $membership = HouseholdMembership::query()
            ->where('household_id', $household->id)
            ->where('user_id', $admin->id)
            ->firstOrFail();

        $this->actingAs($admin)
            ->patchJson("/api/v1/households/{$household->id}/members/{$membership->id}", [
                'status' => MembershipStatus::Suspended->value,
            ])
            ->assertStatus(422);

        $this->actingAs($admin)
            ->patchJson("/api/v1/households/{$household->id}/roles/{$adminRole->id}", [
                'permission_keys' => ['hogar.ver'],
                'status' => RoleStatus::Active->value,
            ])
            ->assertStatus(422);
    }

    /**
     * @return array{0: User, 1: Household}
     */
    private function createAdminHousehold(string $phone = '+573001112233'): array
    {
        $user = User::factory()->create([
            'phone' => $phone,
            'password' => 'Secret123!',
        ]);

        $household = app(CreateHouseholdAction::class)->execute($user, [
            'name' => 'Hogar '.$phone,
        ]);

        return [$user, $household];
    }

    private function withStatefulApi(): self
    {
        return $this->withHeaders([
            'Origin' => 'http://127.0.0.1:5173',
            'Referer' => 'http://127.0.0.1:5173/',
        ]);
    }
}
