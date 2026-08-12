<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Role */
class RoleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'household_id' => $this->household_id,
            'name' => $this->name,
            'description' => $this->description,
            'is_system' => $this->is_system,
            'status' => $this->status->value,
            'permissions' => PermissionResource::collection($this->whenLoaded('permissions')),
            'permission_keys' => $this->whenLoaded(
                'permissions',
                fn () => $this->permissions->pluck('key')->values()->all()
            ),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
