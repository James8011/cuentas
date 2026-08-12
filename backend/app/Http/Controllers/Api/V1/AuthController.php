<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\MembershipStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\HouseholdResource;
use App\Http\Resources\UserResource;
use App\Models\Household;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = [
            'phone' => $request->validated('phone'),
            'password' => $request->validated('password'),
        ];

        if (! Auth::attempt($credentials)) {
            throw ValidationException::withMessages([
                'phone' => ['Credenciales incorrectas.'],
            ]);
        }

        /** @var User $user */
        $user = Auth::user();

        if (! $user->isActive()) {
            $this->audit->log(
                action: 'auth.login_denied_suspended',
                auditable: $user,
                newValues: ['phone' => $user->phone],
                actor: $user,
                request: $request,
            );

            Auth::guard('web')->logout();
            $this->invalidateSession($request);

            throw ValidationException::withMessages([
                'phone' => ['Tu cuenta está suspendida.'],
            ]);
        }

        $this->regenerateSession($request);

        $this->audit->log(
            action: 'auth.login',
            auditable: $user,
            newValues: ['phone' => $user->phone],
            actor: $user,
            request: $request,
        );

        return response()->json([
            'user' => (new UserResource($user))->resolve(),
            'households' => HouseholdResource::collection($this->householdsFor($user))->resolve(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $request->user();

        if ($user) {
            $this->audit->log(
                action: 'auth.logout',
                auditable: $user,
                newValues: ['phone' => $user->phone],
                actor: $user,
                request: $request,
            );
        }

        Auth::guard('web')->logout();
        $this->invalidateSession($request);

        return response()->json(['message' => 'Sesión cerrada.']);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => (new UserResource($user))->resolve(),
            'households' => HouseholdResource::collection($this->householdsFor($user))->resolve(),
        ]);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Household>
     */
    private function householdsFor(User $user)
    {
        return Household::query()
            ->whereHas('memberships', function ($query) use ($user): void {
                $query->where('user_id', $user->id)
                    ->where('status', MembershipStatus::Active);
            })
            ->orderBy('name')
            ->get();
    }

    private function regenerateSession(Request $request): void
    {
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
    }

    private function invalidateSession(Request $request): void
    {
        if (! $request->hasSession()) {
            return;
        }

        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
