<?php

namespace App\Services;

use App\Models\Budget;
use App\Models\Expense;
use App\Models\FinancialCategory;
use App\Models\Household;
use App\Models\MarketList;
use App\Models\MarketListItem;
use App\Models\MarketProduct;
use App\Models\User;
use DomainException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class MarketService
{
    public const MERCADO_KEY = 'mercado';

    public const UNITS = ['unit', 'kg', 'g', 'lb', 'l', 'ml', 'pack'];

    public function __construct(
        private readonly DecimalMoney $money,
        private readonly AuditLogger $audit,
        private readonly FinancialService $financial,
    ) {}

    public function ensureMercadoCategory(Household $household): FinancialCategory
    {
        $category = FinancialCategory::query()
            ->where('household_id', $household->id)
            ->where('system_key', self::MERCADO_KEY)
            ->first();

        if ($category) {
            if (! $category->is_active || $category->name !== 'Mercado') {
                $category->update([
                    'name' => 'Mercado',
                    'type' => 'expense',
                    'classification' => 'essential',
                    'is_active' => true,
                ]);
            }

            return $category->refresh();
        }

        $byName = FinancialCategory::query()
            ->where('household_id', $household->id)
            ->where('type', 'expense')
            ->where('name', 'Mercado')
            ->first();

        if ($byName) {
            $byName->update([
                'system_key' => self::MERCADO_KEY,
                'classification' => 'essential',
                'is_active' => true,
            ]);

            return $byName->refresh();
        }

        return FinancialCategory::query()->create([
            'household_id' => $household->id,
            'name' => 'Mercado',
            'system_key' => self::MERCADO_KEY,
            'type' => 'expense',
            'classification' => 'essential',
            'is_active' => true,
        ]);
    }

    /** @return list<MarketProduct> */
    public function products(Household $household): array
    {
        return MarketProduct::query()
            ->where('household_id', $household->id)
            ->orderBy('name')
            ->get()
            ->all();
    }

    /** @param array<string, mixed> $data */
    public function createProduct(User $actor, Household $household, array $data, ?UploadedFile $photo = null): MarketProduct
    {
        $product = MarketProduct::query()->create([
            'household_id' => $household->id,
            'name' => trim((string) $data['name']),
            'unit' => $data['unit'] ?? 'unit',
            'last_unit_price' => isset($data['last_unit_price'])
                ? $this->money->normalize($data['last_unit_price'])
                : null,
            'notes' => $data['notes'] ?? null,
            'is_active' => true,
        ]);

        if ($photo) {
            $product->update(['photo_path' => $this->storePhoto($household, $photo, 'products')]);
        }

        $this->audit->log('market.product.created', $household->id, $product, newValues: [
            'name' => $product->name,
            'unit' => $product->unit,
        ], actor: $actor);

        return $product->refresh();
    }

    /** @param array<string, mixed> $data */
    public function updateProduct(User $actor, Household $household, MarketProduct $product, array $data, ?UploadedFile $photo = null): MarketProduct
    {
        $this->assertProduct($household, $product);
        $old = $product->only(['name', 'unit', 'last_unit_price', 'is_active', 'notes']);
        $product->update([
            'name' => array_key_exists('name', $data) ? trim((string) $data['name']) : $product->name,
            'unit' => $data['unit'] ?? $product->unit,
            'last_unit_price' => array_key_exists('last_unit_price', $data)
                ? (isset($data['last_unit_price']) ? $this->money->normalize($data['last_unit_price']) : null)
                : $product->last_unit_price,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $product->notes,
            'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : $product->is_active,
        ]);

        if ($photo) {
            $path = $this->storePhoto($household, $photo, 'products');
            if ($product->photo_path) {
                Storage::disk('public')->delete($product->photo_path);
            }
            $product->update(['photo_path' => $path]);
        }

        $this->audit->log('market.product.updated', $household->id, $product, oldValues: $old, newValues: $product->only(['name', 'unit', 'last_unit_price', 'is_active']), actor: $actor);

        return $product->refresh();
    }

    /** @return list<MarketList> */
    public function lists(Household $household): array
    {
        return MarketList::query()
            ->where('household_id', $household->id)
            ->with(['creator.user', 'items.product'])
            ->orderByDesc('id')
            ->get()
            ->all();
    }

    public function list(Household $household, MarketList $list): MarketList
    {
        $this->assertList($household, $list);

        return $list->load(['creator.user', 'items.product', 'expense']);
    }

    /** @param array<string, mixed> $data */
    public function createList(User $actor, Household $household, array $data): MarketList
    {
        $membership = $this->financial->membership($actor, $household);
        $period = $data['period'] ?? now()->format('Y-m');
        if (! preg_match('/^\d{4}-\d{2}$/', $period)) {
            throw new DomainException('El período debe ser YYYY-MM.');
        }

        $this->ensureMercadoCategory($household);

        $list = MarketList::query()->create([
            'household_id' => $household->id,
            'created_by_membership_id' => $membership->id,
            'name' => trim((string) $data['name']),
            'status' => 'active',
            'period' => $period,
            'notes' => $data['notes'] ?? null,
        ]);

        $this->audit->log('market.list.created', $household->id, $list, newValues: [
            'name' => $list->name,
            'period' => $list->period,
        ], actor: $actor);

        return $list->load(['creator.user', 'items.product']);
    }

    /** @param array<string, mixed> $data */
    public function updateList(User $actor, Household $household, MarketList $list, array $data): MarketList
    {
        $this->assertList($household, $list);
        $this->assertEditable($list);

        $list->update([
            'name' => array_key_exists('name', $data) ? trim((string) $data['name']) : $list->name,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $list->notes,
            'period' => $data['period'] ?? $list->period,
            'status' => in_array($data['status'] ?? null, ['active', 'shopping'], true)
                ? $data['status']
                : $list->status,
        ]);

        $this->audit->log('market.list.updated', $household->id, $list, newValues: $list->only(['name', 'status', 'period']), actor: $actor);

        return $list->refresh()->load(['creator.user', 'items.product']);
    }

    /** @param array<string, mixed> $data */
    public function addItem(User $actor, Household $household, MarketList $list, array $data, ?UploadedFile $photo = null): MarketListItem
    {
        $this->assertList($household, $list);
        $this->assertEditable($list);

        $product = null;
        if (! empty($data['market_product_id'])) {
            $product = MarketProduct::query()
                ->where('household_id', $household->id)
                ->findOrFail((int) $data['market_product_id']);
        }

        $name = trim((string) ($data['name'] ?? $product?->name ?? ''));
        if ($name === '') {
            throw new DomainException('El ítem necesita un nombre.');
        }

        $unit = $data['unit'] ?? $product?->unit ?? 'unit';
        $estimated = isset($data['estimated_unit_price'])
            ? $this->money->normalize($data['estimated_unit_price'])
            : ($product?->last_unit_price ?? '0.0000');

        $item = MarketListItem::query()->create([
            'market_list_id' => $list->id,
            'market_product_id' => $product?->id,
            'name' => $name,
            'unit' => $unit,
            'quantity_planned' => $this->money->normalize($data['quantity_planned'] ?? '1'),
            'estimated_unit_price' => $estimated,
            'notes' => $data['notes'] ?? null,
            'sort_order' => (int) ($data['sort_order'] ?? ($list->items()->max('sort_order') + 1)),
            'is_checked' => false,
        ]);

        if ($photo) {
            $item->update(['photo_path' => $this->storePhoto($household, $photo, 'items')]);
        }

        if ($list->status === 'active') {
            $list->update(['status' => 'shopping']);
        }

        $this->audit->log('market.item.added', $household->id, $item, newValues: [
            'list_id' => $list->id,
            'name' => $item->name,
        ], actor: $actor);

        return $item->load('product');
    }

    /** @param array<string, mixed> $data */
    public function updateItem(User $actor, Household $household, MarketList $list, MarketListItem $item, array $data, ?UploadedFile $photo = null): MarketListItem
    {
        $this->assertList($household, $list);
        $this->assertItem($list, $item);
        $this->assertEditable($list);

        $item->update([
            'name' => array_key_exists('name', $data) ? trim((string) $data['name']) : $item->name,
            'unit' => $data['unit'] ?? $item->unit,
            'quantity_planned' => isset($data['quantity_planned'])
                ? $this->money->normalize($data['quantity_planned'])
                : $item->quantity_planned,
            'quantity_bought' => array_key_exists('quantity_bought', $data)
                ? (isset($data['quantity_bought']) ? $this->money->normalize($data['quantity_bought']) : null)
                : $item->quantity_bought,
            'estimated_unit_price' => isset($data['estimated_unit_price'])
                ? $this->money->normalize($data['estimated_unit_price'])
                : $item->estimated_unit_price,
            'actual_unit_price' => array_key_exists('actual_unit_price', $data)
                ? (isset($data['actual_unit_price']) ? $this->money->normalize($data['actual_unit_price']) : null)
                : $item->actual_unit_price,
            'is_checked' => array_key_exists('is_checked', $data) ? (bool) $data['is_checked'] : $item->is_checked,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $item->notes,
            'sort_order' => isset($data['sort_order']) ? (int) $data['sort_order'] : $item->sort_order,
        ]);

        if (! empty($data['is_checked']) && $item->quantity_bought === null) {
            $item->update(['quantity_bought' => $item->quantity_planned]);
        }
        if (! empty($data['is_checked']) && $item->actual_unit_price === null) {
            $item->update(['actual_unit_price' => $item->estimated_unit_price]);
        }

        if ($photo) {
            $path = $this->storePhoto($household, $photo, 'items');
            if ($item->photo_path) {
                Storage::disk('public')->delete($item->photo_path);
            }
            $item->update(['photo_path' => $path]);
        }

        if ($list->status === 'active') {
            $list->update(['status' => 'shopping']);
        }

        return $item->refresh()->load('product');
    }

    public function deleteItem(User $actor, Household $household, MarketList $list, MarketListItem $item): void
    {
        $this->assertList($household, $list);
        $this->assertItem($list, $item);
        $this->assertEditable($list);
        if ($item->photo_path) {
            Storage::disk('public')->delete($item->photo_path);
        }
        $item->delete();
        $this->audit->log('market.item.deleted', $household->id, $list, newValues: ['item_id' => $item->id], actor: $actor);
    }

    /** @return array<string, mixed> */
    public function listTotals(MarketList $list): array
    {
        $estimated = '0.0000';
        $bought = '0.0000';
        $pending = '0.0000';
        $checked = 0;
        foreach ($list->items as $item) {
            $lineEst = $item->estimatedTotal();
            $estimated = bcadd($estimated, $lineEst, 4);
            if ($item->is_checked) {
                $bought = bcadd($bought, $item->boughtTotal(), 4);
                $checked++;
            } else {
                $pending = bcadd($pending, $lineEst, 4);
            }
        }

        return [
            'estimated_total' => $estimated,
            'bought_total' => $bought,
            'pending_estimated_total' => $pending,
            'projection_total' => bcadd($bought, $pending, 4),
            'items_count' => $list->items->count(),
            'checked_count' => $checked,
        ];
    }

    /** @return array<string, mixed> */
    public function budgetSnapshot(Household $household, string $period): array
    {
        $category = $this->ensureMercadoCategory($household);
        [$start, $end] = $this->periodBounds($period);

        $budget = Budget::query()
            ->where('household_id', $household->id)
            ->where('period', $period)
            ->where('status', 'open')
            ->with('lines')
            ->orderByDesc('id')
            ->first();

        $planned = '0.0000';
        if ($budget) {
            foreach ($budget->lines as $line) {
                if ((int) $line->category_id === (int) $category->id) {
                    $planned = bcadd($planned, (string) $line->planned_amount, 4);
                }
            }
        }

        $spent = (string) Expense::query()
            ->where('household_id', $household->id)
            ->where('category_id', $category->id)
            ->whereNotIn('status', ['cancelled', 'planned'])
            ->whereBetween('occurred_on', [$start, $end])
            ->sum('amount');

        $spent = bcadd($spent, '0', 4);
        $available = bcsub($planned, $spent, 4);

        return [
            'period' => $period,
            'category' => $category,
            'budget_id' => $budget?->id,
            'planned_amount' => $planned,
            'spent_amount' => $spent,
            'available_amount' => $available,
            'has_budget_line' => bccomp($planned, '0', 4) > 0,
        ];
    }

    /**
     * Cierra la lista y crea un único gasto en categoría Mercado.
     *
     * @param  array<string, mixed>  $data
     * @return array{list: MarketList, expense: Expense, totals: array<string, mixed>}
     */
    public function closeList(User $actor, Household $household, MarketList $list, array $data): array
    {
        $this->assertList($household, $list);
        if (in_array($list->status, ['closed', 'cancelled'], true)) {
            throw new DomainException('La lista ya está cerrada o cancelada.');
        }

        $list->load('items.product');
        $checked = $list->items->where('is_checked', true);
        if ($checked->isEmpty()) {
            throw new DomainException('Marca al menos un producto comprado para cerrar la lista.');
        }

        $total = '0.0000';
        foreach ($checked as $item) {
            $total = bcadd($total, $item->boughtTotal(), 4);
        }
        if (bccomp($total, '0', 4) <= 0) {
            throw new DomainException('El total comprado debe ser mayor a cero.');
        }

        $membership = $this->financial->membership($actor, $household);
        $category = $this->ensureMercadoCategory($household);
        $currency = strtoupper((string) ($data['currency_code'] ?? $household->currency_code));

        return DB::transaction(function () use ($actor, $household, $list, $data, $checked, $total, $membership, $category, $currency): array {
            $shares = $data['shares'] ?? [[
                'membership_id' => $membership->id,
                'percentage' => '100.0000',
            ]];

            $expense = $this->financial->createExpense($actor, $household, [
                'category_id' => $category->id,
                'scope' => $data['scope'] ?? 'shared',
                'classification' => 'essential',
                'amount' => $total,
                'currency_code' => $currency,
                'occurred_on' => $data['occurred_on'] ?? now()->toDateString(),
                'frequency' => 'once',
                'status' => 'committed',
                'notes' => $data['notes'] ?? ('Mercado: '.$list->name),
                'shares' => $shares,
            ]);

            foreach ($checked as $item) {
                if ($item->market_product_id) {
                    $price = $item->actual_unit_price ?? $item->estimated_unit_price;
                    MarketProduct::query()->where('id', $item->market_product_id)->update([
                        'last_unit_price' => $price,
                    ]);
                }
            }

            $list->update([
                'status' => 'closed',
                'expense_id' => $expense->id,
                'closed_at' => now(),
            ]);

            $this->audit->log('market.list.closed', $household->id, $list, newValues: [
                'expense_id' => $expense->id,
                'amount' => $total,
            ], actor: $actor);

            return [
                'list' => $list->refresh()->load(['creator.user', 'items.product', 'expense']),
                'expense' => $expense,
                'totals' => $this->listTotals($list->refresh()->load('items')),
            ];
        });
    }

    public function cancelList(User $actor, Household $household, MarketList $list): MarketList
    {
        $this->assertList($household, $list);
        if ($list->status === 'closed') {
            throw new DomainException('No se puede cancelar una lista ya cerrada.');
        }
        $list->update(['status' => 'cancelled']);
        $this->audit->log('market.list.cancelled', $household->id, $list, actor: $actor);

        return $list->refresh()->load(['creator.user', 'items.product']);
    }

    /** @return array<string, mixed> */
    public function serializeProduct(MarketProduct $product): array
    {
        return [
            'id' => $product->id,
            'household_id' => $product->household_id,
            'name' => $product->name,
            'unit' => $product->unit,
            'last_unit_price' => $product->last_unit_price,
            'photo_path' => $product->photo_path,
            'photo_url' => $product->photoUrl(),
            'notes' => $product->notes,
            'is_active' => $product->is_active,
        ];
    }

    /** @return array<string, mixed> */
    public function serializeItem(MarketListItem $item): array
    {
        return [
            'id' => $item->id,
            'market_list_id' => $item->market_list_id,
            'market_product_id' => $item->market_product_id,
            'name' => $item->name,
            'unit' => $item->unit,
            'quantity_planned' => $item->quantity_planned,
            'quantity_bought' => $item->quantity_bought,
            'estimated_unit_price' => $item->estimated_unit_price,
            'actual_unit_price' => $item->actual_unit_price,
            'estimated_total' => $item->estimatedTotal(),
            'bought_total' => $item->boughtTotal(),
            'is_checked' => $item->is_checked,
            'notes' => $item->notes,
            'photo_path' => $item->photo_path,
            'photo_url' => $item->photoUrl(),
            'sort_order' => $item->sort_order,
            'product' => $item->product ? $this->serializeProduct($item->product) : null,
        ];
    }

    /** @return array<string, mixed> */
    public function serializeList(MarketList $list, ?Household $household = null): array
    {
        $list->loadMissing(['creator.user', 'items.product', 'expense']);
        $totals = $this->listTotals($list);
        $budget = $household
            ? $this->budgetSnapshot($household, $list->period)
            : null;

        return [
            'id' => $list->id,
            'household_id' => $list->household_id,
            'name' => $list->name,
            'status' => $list->status,
            'period' => $list->period,
            'notes' => $list->notes,
            'expense_id' => $list->expense_id,
            'closed_at' => optional($list->closed_at)?->toIso8601String(),
            'created_by' => $list->creator?->user?->name,
            'items' => $list->items->map(fn (MarketListItem $i) => $this->serializeItem($i))->values()->all(),
            'totals' => $totals,
            'budget' => $budget,
        ];
    }

    private function storePhoto(Household $household, UploadedFile $photo, string $folder): string
    {
        return $photo->store("market/{$household->id}/{$folder}", 'public');
    }

    private function assertProduct(Household $household, MarketProduct $product): void
    {
        if ((int) $product->household_id !== (int) $household->id) {
            abort(404);
        }
    }

    private function assertList(Household $household, MarketList $list): void
    {
        if ((int) $list->household_id !== (int) $household->id) {
            abort(404);
        }
    }

    private function assertItem(MarketList $list, MarketListItem $item): void
    {
        if ((int) $item->market_list_id !== (int) $list->id) {
            abort(404);
        }
    }

    private function assertEditable(MarketList $list): void
    {
        if (in_array($list->status, ['closed', 'cancelled'], true)) {
            throw new DomainException('La lista no se puede editar en su estado actual.');
        }
    }

    /** @return array{0:string,1:string} */
    private function periodBounds(string $period): array
    {
        if (! preg_match('/^\d{4}-\d{2}$/', $period)) {
            throw new DomainException('El período debe ser YYYY-MM.');
        }
        $start = \Carbon\CarbonImmutable::createFromFormat('Y-m-d', $period.'-01')->startOfMonth();

        return [$start->toDateString(), $start->endOfMonth()->toDateString()];
    }
}
