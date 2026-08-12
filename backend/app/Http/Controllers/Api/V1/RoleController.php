<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\ManageRoleAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Role\StoreRoleRequest;
use App\Http\Requests\Role\UpdateRoleRequest;
use App\Http\Resources\RoleResource;
use App\Models\Household;
use App\Models\Role;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RoleController extends Controller
{
    public function __construct(
        private readonly ManageRoleAction $manageRole,
    ) {}

    public function index(Household $household): AnonymousResourceCollection
    {
        $this->authorize('viewRoles', $household);

        $roles = $household->roles()
            ->with('permissions')
            ->orderBy('name')
            ->get();

        return RoleResource::collection($roles);
    }

    public function store(StoreRoleRequest $request, Household $household): JsonResponse
    {
        $role = $this->manageRole->create(
            $request->user(),
            $household,
            $request->validated()
        );

        return (new RoleResource($role))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateRoleRequest $request, Household $household, Role $role): RoleResource|JsonResponse
    {
        $this->ensureRoleBelongsToHousehold($household, $role);

        try {
            $updated = $this->manageRole->update(
                $request->user(),
                $role,
                $request->validated()
            );
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return new RoleResource($updated);
    }

    public function duplicate(Request $request, Household $household, Role $role): JsonResponse
    {
        $this->authorize('manageRoles', $household);
        $this->ensureRoleBelongsToHousehold($household, $role);

        $copy = $this->manageRole->duplicate($request->user(), $role);

        return (new RoleResource($copy))
            ->response()
            ->setStatusCode(201);
    }

    private function ensureRoleBelongsToHousehold(Household $household, Role $role): void
    {
        if ($role->household_id !== $household->id) {
            abort(404);
        }
    }
}
