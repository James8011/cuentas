<?php

namespace App\Policies;

use App\Models\Household;
use App\Models\HouseholdMembership;
use App\Models\User;
use App\Services\PermissionResolver;

class HouseholdPolicy
{
    public function __construct(
        private readonly PermissionResolver $permissions,
    ) {}

    public function viewAny(User $user): bool
    {
        return $user->isActive();
    }

    public function view(User $user, Household $household): bool
    {
        return $this->isActiveMember($user, $household)
            && $this->permissions->userHas($user, $household->id, 'hogar.ver');
    }

    public function create(User $user): bool
    {
        return $user->isActive();
    }

    public function update(User $user, Household $household): bool
    {
        return $this->isActiveMember($user, $household)
            && $this->permissions->userHas($user, $household->id, 'hogar.editar');
    }

    public function manageMembers(User $user, Household $household): bool
    {
        return $this->isActiveMember($user, $household)
            && $this->permissions->userHas($user, $household->id, 'miembros.gestionar');
    }

    public function createMembers(User $user, Household $household): bool
    {
        return $this->isActiveMember($user, $household)
            && $this->permissions->userHas($user, $household->id, 'miembros.crear');
    }

    public function viewMembers(User $user, Household $household): bool
    {
        return $this->isActiveMember($user, $household)
            && $this->permissions->userHas($user, $household->id, 'miembros.ver');
    }

    public function viewRoles(User $user, Household $household): bool
    {
        return $this->isActiveMember($user, $household)
            && $this->permissions->userHas($user, $household->id, 'roles.ver');
    }

    public function manageRoles(User $user, Household $household): bool
    {
        return $this->isActiveMember($user, $household)
            && $this->permissions->userHas($user, $household->id, 'roles.gestionar');
    }

    public function accountsView(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'cuentas.ver');
    }

    public function accountsManage(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'cuentas.gestionar');
    }

    public function categoriesView(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'categorias.ver');
    }

    public function categoriesManage(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'categorias.gestionar');
    }

    public function incomesView(User $user, Household $household): bool
    {
        return $this->hasAny($user, $household, ['ingresos.ver_propios', 'ingresos.ver_compartidos', 'ingresos.ver_ajenos']);
    }

    public function incomesCreate(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'ingresos.crear');
    }

    public function incomesManage(User $user, Household $household): bool
    {
        return $this->hasAny($user, $household, ['ingresos.editar_propios', 'ingresos.editar_ajenos', 'ingresos.eliminar']);
    }

    public function expensesView(User $user, Household $household): bool
    {
        return $this->hasAny($user, $household, ['gastos.ver_propios', 'gastos.ver_compartidos', 'gastos.ver_ajenos']);
    }

    public function expensesCreate(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'gastos.crear');
    }

    public function expensesManage(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'gastos.editar');
    }

    public function paymentsCreate(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'gastos.registrar_pago');
    }

    public function recurrencesView(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'recurrencias.ver');
    }

    public function recurrencesManage(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'recurrencias.gestionar');
    }

    public function debtsAccess(User $user, Household $household): bool
    {
        return $this->hasAny($user, $household, ['deudas.ver_propias', 'deudas.ver_compartidas', 'deudas.ver_ajenas', 'deudas.crear', 'deudas.editar']);
    }

    public function savingsAccess(User $user, Household $household): bool
    {
        return $this->hasAny($user, $household, ['ahorros.ver_propios', 'ahorros.ver_compartidos', 'ahorros.ver_ajenos', 'ahorros.gestionar']);
    }

    public function budgetsAccess(User $user, Household $household): bool
    {
        return $this->hasAny($user, $household, ['presupuestos.ver', 'presupuestos.gestionar', 'cierres.ejecutar']);
    }

    public function auditView(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'auditoria.ver');
    }

    public function exportData(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'datos.exportar');
    }

    public function marketView(User $user, Household $household): bool
    {
        return $this->hasAny($user, $household, ['mercado.ver', 'mercado.gestionar']);
    }

    public function marketManage(User $user, Household $household): bool
    {
        return $this->has($user, $household, 'mercado.gestionar');
    }

    private function has(User $user, Household $household, string $permission): bool
    {
        return $this->isActiveMember($user, $household)
            && $this->permissions->userHas($user, $household->id, $permission);
    }

    /** @param list<string> $permissions */
    private function hasAny(User $user, Household $household, array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->has($user, $household, $permission)) {
                return true;
            }
        }

        return false;
    }

    private function isActiveMember(User $user, Household $household): bool
    {
        if (! $user->isActive()) {
            return false;
        }

        return HouseholdMembership::query()
            ->where('household_id', $household->id)
            ->where('user_id', $user->id)
            ->where('status', 'active')
            ->exists();
    }
}
