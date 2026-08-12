<?php

namespace App\Http\Resources;

use App\Services\PermissionResolver;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\HouseholdMembership */
class MembershipResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $effective = app(PermissionResolver::class)->forMembership($this->resource);

        return [
            'id' => $this->id,
            'household_id' => $this->household_id,
            'status' => $this->status->value,
            'joined_at' => $this->joined_at?->toIso8601String(),
            'suspended_at' => $this->suspended_at?->toIso8601String(),
            'user' => new UserResource($this->whenLoaded('user')),
            'roles' => RoleResource::collection($this->whenLoaded('roles')),
            'effective_permissions' => $effective,
        ];
    }
}
