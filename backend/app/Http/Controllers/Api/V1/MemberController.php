<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\CreateHouseholdMemberAction;
use App\Actions\UpdateMembershipAction;
use App\Http\Controllers\Controller;
use App\Http\Requests\Member\StoreMemberRequest;
use App\Http\Requests\Member\UpdateMemberRequest;
use App\Http\Resources\MembershipResource;
use App\Models\Household;
use App\Models\HouseholdMembership;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class MemberController extends Controller
{
    public function __construct(
        private readonly CreateHouseholdMemberAction $createMember,
        private readonly UpdateMembershipAction $updateMembership,
    ) {}

    public function index(Household $household): AnonymousResourceCollection
    {
        $this->authorize('viewMembers', $household);

        $memberships = $household->memberships()
            ->with(['user', 'roles.permissions'])
            ->orderBy('id')
            ->get();

        return MembershipResource::collection($memberships);
    }

    public function store(StoreMemberRequest $request, Household $household): JsonResponse
    {
        $membership = $this->createMember->execute(
            $request->user(),
            $household,
            $request->validated()
        );

        return (new MembershipResource($membership))
            ->response()
            ->setStatusCode(201);
    }

    public function update(
        UpdateMemberRequest $request,
        Household $household,
        HouseholdMembership $membership,
    ): MembershipResource|JsonResponse {
        $this->ensureMembershipBelongsToHousehold($household, $membership);

        try {
            $updated = $this->updateMembership->execute(
                $request->user(),
                $membership,
                $request->validated()
            );
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return new MembershipResource($updated);
    }

    private function ensureMembershipBelongsToHousehold(Household $household, HouseholdMembership $membership): void
    {
        if ($membership->household_id !== $household->id) {
            abort(404);
        }
    }
}
