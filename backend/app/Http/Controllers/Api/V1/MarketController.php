<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\MarketRequest;
use App\Models\Household;
use App\Models\MarketList;
use App\Models\MarketListItem;
use App\Models\MarketProduct;
use App\Services\MarketService;
use DomainException;
use Illuminate\Http\JsonResponse;

class MarketController extends Controller
{
    public function __construct(private readonly MarketService $market) {}

    public function products(MarketRequest $request, Household $household): JsonResponse
    {
        $this->market->ensureMercadoCategory($household);
        $items = array_map(
            fn (MarketProduct $p) => $this->market->serializeProduct($p),
            $this->market->products($household),
        );

        return response()->json(['data' => $items]);
    }

    public function storeProduct(MarketRequest $request, Household $household): JsonResponse
    {
        try {
            $product = $this->market->createProduct(
                $request->user(),
                $household,
                $request->validated(),
                $request->file('photo'),
            );
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $this->market->serializeProduct($product)], 201);
    }

    public function updateProduct(MarketRequest $request, Household $household, MarketProduct $product): JsonResponse
    {
        try {
            $product = $this->market->updateProduct(
                $request->user(),
                $household,
                $product,
                $request->validated(),
                $request->file('photo'),
            );
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $this->market->serializeProduct($product)]);
    }

    public function lists(MarketRequest $request, Household $household): JsonResponse
    {
        $this->market->ensureMercadoCategory($household);
        $data = array_map(
            fn (MarketList $list) => $this->market->serializeList($list, $household),
            $this->market->lists($household),
        );

        return response()->json(['data' => $data]);
    }

    public function showList(MarketRequest $request, Household $household, MarketList $list): JsonResponse
    {
        $list = $this->market->list($household, $list);

        return response()->json(['data' => $this->market->serializeList($list, $household)]);
    }

    public function storeList(MarketRequest $request, Household $household): JsonResponse
    {
        try {
            $list = $this->market->createList($request->user(), $household, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $this->market->serializeList($list, $household)], 201);
    }

    public function updateList(MarketRequest $request, Household $household, MarketList $list): JsonResponse
    {
        try {
            $list = $this->market->updateList($request->user(), $household, $list, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $this->market->serializeList($list, $household)]);
    }

    public function storeItem(MarketRequest $request, Household $household, MarketList $list): JsonResponse
    {
        try {
            $item = $this->market->addItem(
                $request->user(),
                $household,
                $list,
                $request->validated(),
                $request->file('photo'),
            );
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $this->market->serializeItem($item)], 201);
    }

    public function updateItem(
        MarketRequest $request,
        Household $household,
        MarketList $list,
        MarketListItem $item,
    ): JsonResponse {
        try {
            $item = $this->market->updateItem(
                $request->user(),
                $household,
                $list,
                $item,
                $request->validated(),
                $request->file('photo'),
            );
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $this->market->serializeItem($item)]);
    }

    public function destroyItem(
        MarketRequest $request,
        Household $household,
        MarketList $list,
        MarketListItem $item,
    ): JsonResponse {
        try {
            $this->market->deleteItem($request->user(), $household, $list, $item);
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json([], 204);
    }

    public function closeList(MarketRequest $request, Household $household, MarketList $list): JsonResponse
    {
        try {
            $result = $this->market->closeList($request->user(), $household, $list, $request->validated());
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json([
            'data' => [
                'list' => $this->market->serializeList($result['list'], $household),
                'expense' => $result['expense'],
                'totals' => $result['totals'],
            ],
        ]);
    }

    public function cancelList(MarketRequest $request, Household $household, MarketList $list): JsonResponse
    {
        try {
            $list = $this->market->cancelList($request->user(), $household, $list);
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $this->market->serializeList($list, $household)]);
    }

    public function budget(MarketRequest $request, Household $household): JsonResponse
    {
        $period = $request->validated('period') ?? now()->format('Y-m');
        try {
            $snapshot = $this->market->budgetSnapshot($household, $period);
        } catch (DomainException $e) {
            abort(422, $e->getMessage());
        }

        return response()->json(['data' => $snapshot]);
    }
}
