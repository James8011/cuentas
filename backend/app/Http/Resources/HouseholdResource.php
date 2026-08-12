<?php

namespace App\Http\Resources;

use App\Models\HouseholdMembership;
use App\Services\PermissionResolver;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Household */
class HouseholdResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $membership = null;
        $effective = [];

        if ($user) {
            $membership = HouseholdMembership::query()
                ->with(['roles.permissions'])
                ->where('household_id', $this->id)
                ->where('user_id', $user->id)
                ->first();

            if ($membership) {
                $effective = app(PermissionResolver::class)->forMembership($membership);
            }
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'country_code' => $this->country_code,
            'locale' => $this->locale,
            'currency_code' => $this->currency_code,
            'timezone' => $this->timezone,
            'created_at' => $this->created_at?->toIso8601String(),
            'membership' => $membership ? [
                'id' => $membership->id,
                'status' => $membership->status->value,
            ] : null,
            'effective_permissions' => $effective,
            'roles' => RoleResource::collection($this->whenLoaded('roles')),
            'memberships' => MembershipResource::collection($this->whenLoaded('memberships')),
        ];
    }
}
