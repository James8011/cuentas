<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\CreateHouseholdAction;
use App\Enums\MembershipStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Household\StoreHouseholdRequest;
use App\Http\Requests\Household\UpdateHouseholdRequest;
use App\Http\Resources\HouseholdResource;
use App\Models\Household;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class HouseholdController extends Controller
{
    public function __construct(
        private readonly CreateHouseholdAction $createHousehold,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Household::class);

        $households = Household::query()
            ->whereHas('memberships', function ($query) use ($request): void {
                $query->where('user_id', $request->user()->id)
                    ->where('status', MembershipStatus::Active);
            })
            ->orderBy('name')
            ->get();

        return HouseholdResource::collection($households);
    }

    public function store(StoreHouseholdRequest $request): JsonResponse
    {
        $household = $this->createHousehold->execute(
            $request->user(),
            $request->validated()
        );

        return (new HouseholdResource($household))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Household $household): HouseholdResource
    {
        $this->authorize('view', $household);

        return new HouseholdResource($household);
    }

    public function update(UpdateHouseholdRequest $request, Household $household): HouseholdResource
    {
        $old = $household->only(['name', 'country_code', 'locale', 'currency_code', 'timezone']);
        $household->fill($request->validated())->save();

        $this->audit->log(
            action: 'household.updated',
            householdId: $household->id,
            auditable: $household,
            oldValues: $old,
            newValues: $household->only(['name', 'country_code', 'locale', 'currency_code', 'timezone']),
            actor: $request->user(),
        );

        return new HouseholdResource($household);
    }
}
