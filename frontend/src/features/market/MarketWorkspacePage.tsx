import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Pencil,
  Plus,
  Power,
  ShoppingBasket,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Alert,
  Badge,
  Button,
  Dialog,
  FormField,
  Input,
  MoneyInput,
  Panel,
  Select,
} from '../../design-system'
import { formatMoney, parseDecimalInput } from '../../lib/money'
import { ApiError, api } from '../../services/api'
import type { MarketList, MarketListItem, MarketProduct } from '../../services/types'
import { useAuth } from '../auth/useAuth'

const UNITS: [string, string][] = [
  ['unit', 'Unidad'],
  ['kg', 'Kilogramo'],
  ['g', 'Gramo'],
  ['lb', 'Libra'],
  ['l', 'Litro'],
  ['ml', 'Mililitro'],
  ['pack', 'Paquete'],
]

function unitLabel(unit: string) {
  return UNITS.find(([v]) => v === unit)?.[1] ?? unit
}

function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function money4(raw: string) {
  return parseDecimalInput(raw, 4) ?? '0.0000'
}

/** Cantidad legible en es-CO (2.0000 → 2, 1.5000 → 1,5). */
function formatQuantity(value: string | null | undefined) {
  const parsed = parseDecimalInput(value ?? '0', 4)
  if (!parsed) return '0'
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 4,
    useGrouping: true,
  }).format(Number(parsed))
}

function fail(e: unknown) {
  return e instanceof ApiError ? e.message : 'Error inesperado'
}

function statusLabel(status: string) {
  if (status === 'active') return 'Activa'
  if (status === 'shopping') return 'En compra'
  if (status === 'closed') return 'Cerrada'
  if (status === 'cancelled') return 'Cancelada'
  return status
}

function statusTone(status: string): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'closed') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'shopping') return 'warning'
  return 'neutral'
}

export function MarketWorkspacePage() {
  const { householdId } = useParams()
  const id = Number(householdId)
  const { households, hasPermission, setCurrentHouseholdId, logout } = useAuth()
  const household = households.find((h) => h.id === id)
  const queryClient = useQueryClient()
  const currency = household?.currency_code ?? 'COP'
  const period = currentPeriod()

  const canView = hasPermission('mercado.ver') || hasPermission('mercado.gestionar')
  const canManage = hasPermission('mercado.gestionar')

  const [view, setView] = useState<'lists' | 'catalog'>('lists')
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [listDialog, setListDialog] = useState(false)
  const [productDialog, setProductDialog] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [itemDialog, setItemDialog] = useState(false)
  const [listName, setListName] = useState('')
  const [productForm, setProductForm] = useState({
    name: '',
    unit: 'unit',
    last_unit_price: '0',
    notes: '',
  })
  const [productPhoto, setProductPhoto] = useState<File | null>(null)
  const [itemForm, setItemForm] = useState({
    market_product_id: '',
    name: '',
    unit: 'unit',
    quantity_planned: '1',
    estimated_unit_price: '0',
    notes: '',
  })
  const [itemPhoto, setItemPhoto] = useState<File | null>(null)
  const [catalogQuery, setCatalogQuery] = useState('')

  useEffect(() => {
    if (Number.isFinite(id)) setCurrentHouseholdId(id)
  }, [id, setCurrentHouseholdId])

  const listsQuery = useQuery({
    queryKey: ['market-lists', id],
    queryFn: () => api.marketLists(id),
    enabled: Number.isFinite(id) && canView,
  })
  const productsQuery = useQuery({
    queryKey: ['market-products', id],
    queryFn: () => api.marketProducts(id),
    enabled: Number.isFinite(id) && canView,
  })
  const budgetQuery = useQuery({
    queryKey: ['market-budget', id, period],
    queryFn: () => api.marketBudget(id, period),
    enabled: Number.isFinite(id) && canView,
  })
  const listQuery = useQuery({
    queryKey: ['market-list', id, selectedListId],
    queryFn: () => api.marketList(id, selectedListId!),
    enabled: Number.isFinite(id) && canView && selectedListId != null,
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['market-lists', id] }),
      queryClient.invalidateQueries({ queryKey: ['market-products', id] }),
      queryClient.invalidateQueries({ queryKey: ['market-budget', id] }),
      selectedListId
        ? queryClient.invalidateQueries({ queryKey: ['market-list', id, selectedListId] })
        : Promise.resolve(),
    ])
  }

  const createList = useMutation({
    mutationFn: () =>
      api.createMarketList(id, { name: listName.trim() || `Mercado ${period}`, period }),
    onSuccess: async (res) => {
      setListDialog(false)
      setListName('')
      await refresh()
      setSelectedListId(res.data.id)
      toast.success('Lista creada')
    },
    onError: (e) => toast.error('No se pudo crear la lista', { description: fail(e) }),
  })

  const resetProductForm = () => {
    setEditingProductId(null)
    setProductForm({ name: '', unit: 'unit', last_unit_price: '0', notes: '' })
    setProductPhoto(null)
  }

  const openCreateProduct = () => {
    resetProductForm()
    setProductDialog(true)
  }

  const openEditProduct = (product: MarketProduct) => {
    setEditingProductId(product.id)
    setProductForm({
      name: product.name,
      unit: product.unit,
      last_unit_price: product.last_unit_price
        ? String(Number(product.last_unit_price))
        : '0',
      notes: product.notes ?? '',
    })
    setProductPhoto(null)
    setProductDialog(true)
  }

  const saveProduct = useMutation({
    mutationFn: () => {
      const body = {
        name: productForm.name.trim(),
        unit: productForm.unit,
        last_unit_price: money4(productForm.last_unit_price),
        notes: productForm.notes || null,
      }
      if (editingProductId != null) {
        return api.updateMarketProduct(id, editingProductId, body, productPhoto)
      }
      return api.createMarketProduct(id, body, productPhoto)
    },
    onSuccess: async () => {
      const wasEdit = editingProductId != null
      setProductDialog(false)
      resetProductForm()
      await refresh()
      toast.success(wasEdit ? 'Producto actualizado' : 'Producto agregado al catálogo')
    },
    onError: (e) =>
      toast.error(
        editingProductId != null ? 'No se pudo actualizar el producto' : 'No se pudo crear el producto',
        { description: fail(e) },
      ),
  })

  const toggleProductActive = useMutation({
    mutationFn: (product: MarketProduct) =>
      api.updateMarketProduct(id, product.id, { is_active: !product.is_active }),
    onSuccess: async (_res, product) => {
      await refresh()
      toast.success(product.is_active ? 'Producto desactivado' : 'Producto reactivado', {
        description: product.is_active
          ? 'Ya no aparecerá al agregar ítems a una lista.'
          : 'Volvió a estar disponible en el catálogo.',
      })
    },
    onError: (e) => toast.error('No se pudo cambiar el estado', { description: fail(e) }),
  })

  const addItem = useMutation({
    mutationFn: () => {
      if (!selectedListId) throw new Error('Sin lista')
      const product = productsQuery.data?.data.find(
        (p) => String(p.id) === itemForm.market_product_id,
      )
      return api.addMarketItem(
        id,
        selectedListId,
        {
          market_product_id: itemForm.market_product_id || null,
          name: itemForm.name.trim() || product?.name || '',
          unit: itemForm.unit || product?.unit || 'unit',
          quantity_planned: money4(itemForm.quantity_planned),
          estimated_unit_price: money4(itemForm.estimated_unit_price),
          notes: itemForm.notes || null,
        },
        itemPhoto,
      )
    },
    onSuccess: async () => {
      setItemDialog(false)
      setItemForm({
        market_product_id: '',
        name: '',
        unit: 'unit',
        quantity_planned: '1',
        estimated_unit_price: '0',
        notes: '',
      })
      setItemPhoto(null)
      setCatalogQuery('')
      await refresh()
      toast.success('Producto agregado a la lista')
    },
    onError: (e) => toast.error('No se pudo agregar', { description: fail(e) }),
  })

  const toggleItem = useMutation({
    mutationFn: (item: MarketListItem) =>
      api.updateMarketItem(id, selectedListId!, item.id, {
        is_checked: !item.is_checked,
        actual_unit_price: item.actual_unit_price ?? item.estimated_unit_price,
        quantity_bought: item.quantity_bought ?? item.quantity_planned,
      }),
    onSuccess: async () => {
      await refresh()
    },
    onError: (e) => toast.error('No se pudo actualizar', { description: fail(e) }),
  })

  const updateItemPrice = useMutation({
    mutationFn: (payload: { item: MarketListItem; price: string; qty?: string }) =>
      api.updateMarketItem(id, selectedListId!, payload.item.id, {
        actual_unit_price: money4(payload.price),
        quantity_bought: money4(payload.qty ?? payload.item.quantity_bought ?? payload.item.quantity_planned),
        is_checked: true,
      }),
    onSuccess: async () => {
      await refresh()
      toast.success('Precio actualizado')
    },
    onError: (e) => toast.error('No se pudo guardar el precio', { description: fail(e) }),
  })

  const uploadItemPhoto = useMutation({
    mutationFn: (payload: { item: MarketListItem; file: File }) =>
      api.updateMarketItem(id, selectedListId!, payload.item.id, {}, payload.file),
    onSuccess: async () => {
      await refresh()
      toast.success('Foto guardada')
    },
    onError: (e) => toast.error('No se pudo subir la foto', { description: fail(e) }),
  })

  const deleteItem = useMutation({
    mutationFn: (itemId: number) => api.deleteMarketItem(id, selectedListId!, itemId),
    onSuccess: async () => {
      await refresh()
      toast.success('Ítem eliminado')
    },
    onError: (e) => toast.error('No se pudo eliminar', { description: fail(e) }),
  })

  const closeList = useMutation({
    mutationFn: () => api.closeMarketList(id, selectedListId!, { currency_code: currency }),
    onSuccess: async () => {
      await refresh()
      toast.success('Lista cerrada', {
        description: 'Se creó un gasto único en la categoría Mercado.',
      })
    },
    onError: (e) => toast.error('No se pudo cerrar', { description: fail(e) }),
  })

  const cancelList = useMutation({
    mutationFn: () => api.cancelMarketList(id, selectedListId!),
    onSuccess: async () => {
      await refresh()
      toast.success('Lista cancelada')
    },
    onError: (e) => toast.error('No se pudo cancelar', { description: fail(e) }),
  })

  const lists = listsQuery.data?.data ?? []
  const products = productsQuery.data?.data ?? []
  const activeProducts = products.filter((p) => p.is_active)
  const inactiveProducts = products.filter((p) => !p.is_active)
  const list = listQuery.data?.data
  const budget = list?.budget ?? budgetQuery.data?.data
  const selectedCatalogProduct = activeProducts.find(
    (p) => String(p.id) === itemForm.market_product_id,
  )
  const catalogHasPhoto = Boolean(selectedCatalogProduct?.photo_url)
  const needsItemPhoto = !catalogHasPhoto

  const editable = list && !['closed', 'cancelled'].includes(list.status)

  if (!household) return <Navigate to="/app" replace />
  if (!canView) {
    return (
      <main className="min-h-screen bg-stone-100 p-6">
        <Alert tone="danger">No tienes permiso para ver la lista de mercado.</Alert>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-stone-100 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl border-t-8 border-brand-500 bg-white p-5 shadow-panel">
          <Link
            to={`/app/households/${id}`}
            className="inline-flex items-center gap-1 text-sm font-black text-brand-600"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBasket className="h-10 w-10 text-brand-600" />
              <div>
                <h1 className="text-3xl font-black text-slate-900">Lista de mercado</h1>
                <p className="font-semibold text-slate-500">
                  {household.name} · categoría fija Mercado · {period}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={view === 'lists' ? 'primary' : 'secondary'}
                onClick={() => {
                  setView('lists')
                  setSelectedListId(null)
                }}
              >
                Listas
              </Button>
              <Button
                size="sm"
                variant={view === 'catalog' ? 'primary' : 'secondary'}
                onClick={() => {
                  setView('catalog')
                  setSelectedListId(null)
                }}
              >
                Catálogo
              </Button>
              <Button size="sm" variant="outline" onClick={() => void logout()}>
                Salir
              </Button>
            </div>
          </div>
        </header>

        {budget ? (
          <Panel title="Presupuesto Mercado">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Planificado" value={formatMoney(budget.planned_amount, currency)} />
              <Metric label="Ya gastado" value={formatMoney(budget.spent_amount, currency)} />
              <Metric label="Disponible" value={formatMoney(budget.available_amount, currency)} />
            </div>
            {!budget.has_budget_line ? (
              <Alert className="mt-3" tone="info">
                Agrega una línea “Mercado” en el presupuesto del mes para estimar si te alcanza.
              </Alert>
            ) : Number(budget.available_amount) < 0 ? (
              <Alert className="mt-3" tone="danger">
                La categoría Mercado ya supera el presupuesto planificado.
              </Alert>
            ) : null}
          </Panel>
        ) : null}

        {selectedListId && list ? (
          <ListDetail
            list={list}
            currency={currency}
            editable={Boolean(editable)}
            canManage={canManage}
            onBack={() => setSelectedListId(null)}
            onAddItem={() => setItemDialog(true)}
            onToggle={(item) => toggleItem.mutate(item)}
            onDelete={(itemId) => deleteItem.mutate(itemId)}
            onPrice={(item, price, qty) => updateItemPrice.mutate({ item, price, qty })}
            onPhoto={(item, file) => uploadItemPhoto.mutate({ item, file })}
            onClose={() => closeList.mutate()}
            onCancel={() => cancelList.mutate()}
            closing={closeList.isPending}
          />
        ) : view === 'catalog' ? (
          <Panel title="Catálogo de productos">
            {canManage ? (
              <div className="mb-4">
                <Button size="sm" onClick={openCreateProduct}>
                  <Plus className="h-4 w-4" /> Nuevo producto
                </Button>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {activeProducts.length === 0 ? (
                <p className="text-sm font-semibold text-slate-400">Aún no hay productos activos</p>
              ) : (
                activeProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    currency={currency}
                    canManage={canManage}
                    busy={toggleProductActive.isPending || saveProduct.isPending}
                    onEdit={() => openEditProduct(p)}
                    onToggleActive={() => {
                      if (
                        p.is_active &&
                        !window.confirm(
                          `¿Desactivar “${p.name}”? Dejará de aparecer al agregar ítems a una lista.`,
                        )
                      ) {
                        return
                      }
                      toggleProductActive.mutate(p)
                    }}
                  />
                ))
              )}
            </div>
            {canManage && inactiveProducts.length > 0 ? (
              <div className="mt-6 space-y-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                  Desactivados ({inactiveProducts.length})
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {inactiveProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      currency={currency}
                      canManage={canManage}
                      busy={toggleProductActive.isPending || saveProduct.isPending}
                      onEdit={() => openEditProduct(p)}
                      onToggleActive={() => toggleProductActive.mutate(p)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>
        ) : (
          <Panel title="Listas de mercado">
            <Alert className="mb-4">
              Puedes tener varias listas activas. Al cerrar una, se crea un solo gasto en Mercado.
            </Alert>
            {canManage ? (
              <div className="mb-4">
                <Button
                  size="sm"
                  onClick={() => {
                    setListName(`Mercado ${period}`)
                    setListDialog(true)
                  }}
                >
                  <Plus className="h-4 w-4" /> Nueva lista
                </Button>
              </div>
            ) : null}
            <div className="space-y-3">
              {lists.length === 0 ? (
                <p className="text-sm font-semibold text-slate-400">No hay listas todavía</p>
              ) : (
                lists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setSelectedListId(l.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left hover:border-brand-200"
                  >
                    <div>
                      <p className="font-black text-slate-800">{l.name}</p>
                      <p className="text-xs font-semibold text-slate-500">
                        {l.period} · {l.totals.checked_count}/{l.totals.items_count} comprados ·
                        estimado {formatMoney(l.totals.estimated_total, currency)}
                      </p>
                    </div>
                    <Badge tone={statusTone(l.status)}>{statusLabel(l.status)}</Badge>
                  </button>
                ))
              )}
            </div>
          </Panel>
        )}
      </div>

      <Dialog
        open={listDialog}
        onOpenChange={(open) => !open && setListDialog(false)}
        title="Nueva lista"
        footer={
          <Button disabled={createList.isPending} onClick={() => createList.mutate()}>
            {createList.isPending ? 'Creando…' : 'Crear lista'}
          </Button>
        }
      >
        <FormField label="Nombre">
          <Input value={listName} onChange={(e) => setListName(e.target.value)} />
        </FormField>
      </Dialog>

      <Dialog
        open={productDialog}
        onOpenChange={(open) => {
          if (!open) {
            setProductDialog(false)
            resetProductForm()
          }
        }}
        title={editingProductId != null ? 'Editar producto' : 'Nuevo producto'}
        footer={
          <Button
            disabled={saveProduct.isPending || !productForm.name.trim()}
            onClick={() => saveProduct.mutate()}
          >
            {saveProduct.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        }
      >
        <FormField label="Nombre">
          <Input
            value={productForm.name}
            onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
          />
        </FormField>
        <FormField label="Unidad">
          <Select
            value={productForm.unit}
            onValueChange={(v) => setProductForm({ ...productForm, unit: v })}
            options={UNITS.map(([value, label]) => ({ value, label }))}
          />
        </FormField>
        <FormField label="Último precio unitario" tooltip="Precio manual de referencia">
          <MoneyInput
            value={productForm.last_unit_price}
            onChange={(v) => setProductForm({ ...productForm, last_unit_price: v })}
          />
        </FormField>
        <FormField label="Notas">
          <Input
            value={productForm.notes}
            onChange={(e) => setProductForm({ ...productForm, notes: e.target.value })}
          />
        </FormField>
        <FormField
          label="Foto de referencia"
          tooltip="Usa la cámara del celular o tablet, o elige una imagen de la galería."
        >
          <CameraPhotoField file={productPhoto} onChange={setProductPhoto} />
        </FormField>
      </Dialog>

      <Dialog
        open={itemDialog}
        onOpenChange={(open) => {
          if (!open) {
            setItemDialog(false)
            setCatalogQuery('')
            setItemPhoto(null)
          }
        }}
        title="Agregar a la lista"
        footer={
          <Button
            disabled={addItem.isPending || (!itemForm.market_product_id && !itemForm.name.trim())}
            onClick={() => addItem.mutate()}
          >
            {addItem.isPending ? 'Agregando…' : 'Agregar'}
          </Button>
        }
      >
        <FormField
          label="Buscar en catálogo"
          tooltip="Escribe el nombre para filtrar. Verás la foto de referencia de cada producto."
        >
          <CatalogProductPicker
            products={activeProducts}
            query={catalogQuery}
            onQueryChange={setCatalogQuery}
            selectedId={itemForm.market_product_id}
            currency={currency}
            onSelect={(product) => {
              if (!product) {
                setItemForm({
                  ...itemForm,
                  market_product_id: '',
                })
                setItemPhoto(null)
                return
              }
              setItemForm({
                ...itemForm,
                market_product_id: String(product.id),
                name: product.name,
                unit: product.unit,
                estimated_unit_price: product.last_unit_price
                  ? String(Number(product.last_unit_price))
                  : itemForm.estimated_unit_price,
              })
              setItemPhoto(null)
              setCatalogQuery('')
            }}
          />
        </FormField>

        {selectedCatalogProduct ? (
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2">
            <ProductThumb url={selectedCatalogProduct.photo_url} name={selectedCatalogProduct.name} />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide text-brand-700">
                Referencia del catálogo
              </p>
              <p className="truncate font-black text-slate-800">{selectedCatalogProduct.name}</p>
              <p className="text-xs font-semibold text-slate-500">
                {unitLabel(selectedCatalogProduct.unit)}
                {selectedCatalogProduct.last_unit_price
                  ? ` · ${formatMoney(selectedCatalogProduct.last_unit_price, currency)}`
                  : ''}
              </p>
              {catalogHasPhoto ? (
                <p className="mt-0.5 text-xs font-semibold text-emerald-700">
                  Usa la foto del catálogo; no hace falta subir otra.
                </p>
              ) : (
                <p className="mt-0.5 text-xs font-semibold text-amber-700">
                  Este producto aún no tiene foto en el catálogo.
                </p>
              )}
            </div>
          </div>
        ) : (
          <Alert className="mb-3" tone="info">
            Producto libre: puedes nombrar uno nuevo o elegir del catálogo con búsqueda.
          </Alert>
        )}

        <FormField label="Nombre">
          <Input
            value={itemForm.name}
            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
            disabled={Boolean(selectedCatalogProduct)}
          />
        </FormField>
        <FormField label="Unidad">
          <Select
            value={itemForm.unit}
            onValueChange={(v) => setItemForm({ ...itemForm, unit: v })}
            options={UNITS.map(([value, label]) => ({ value, label }))}
            disabled={Boolean(selectedCatalogProduct)}
          />
        </FormField>
        <FormField label="Cantidad planeada">
          <Input
            value={itemForm.quantity_planned}
            onChange={(e) => setItemForm({ ...itemForm, quantity_planned: e.target.value })}
          />
        </FormField>
        <FormField label="Precio unitario estimado">
          <MoneyInput
            value={itemForm.estimated_unit_price}
            onChange={(v) => setItemForm({ ...itemForm, estimated_unit_price: v })}
          />
        </FormField>
        <FormField label="Notas">
          <Input
            value={itemForm.notes}
            onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })}
          />
        </FormField>
        {needsItemPhoto ? (
          <FormField
            label="Foto"
            tooltip="Toma una foto con la cámara o súbela desde la galería. Solo si es producto libre o el del catálogo no tiene imagen."
          >
            <CameraPhotoField file={itemPhoto} onChange={setItemPhoto} />
          </FormField>
        ) : null}
      </Dialog>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-black text-slate-900">{value}</p>
    </div>
  )
}

function CameraPhotoField({
  file,
  onChange,
}: {
  file: File | null
  onChange: (file: File | null) => void
}) {
  const galleryRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setCameraOpen(true)}>
          <Camera className="h-4 w-4" /> Tomar foto
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="h-4 w-4" /> Galería
        </Button>
        {file ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(null)}>
            <X className="h-4 w-4" /> Quitar
          </Button>
        ) : null}
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          onChange(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />
      {preview ? (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
          <img src={preview} alt="Vista previa" className="max-h-48 w-full object-cover" />
          <p className="truncate px-3 py-2 text-xs font-semibold text-slate-500">{file?.name}</p>
        </div>
      ) : (
        <p className="text-xs font-semibold text-slate-400">
          “Tomar foto” pide permiso de cámara y muestra la vista en vivo. “Galería” abre archivos.
        </p>
      )}
      <DeviceCameraDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(captured) => {
          onChange(captured)
          setCameraOpen(false)
        }}
      />
    </div>
  )
}

function CameraCaptureButtons({ onFile }: { onFile: (file: File) => void }) {
  const galleryRef = useRef<HTMLInputElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  return (
    <div className="inline-flex gap-1">
      <button
        type="button"
        onClick={() => setCameraOpen(true)}
        className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-xs font-black text-slate-600"
        title="Tomar foto con la cámara"
      >
        <Camera className="h-3.5 w-3.5" /> Cámara
      </button>
      <button
        type="button"
        onClick={() => galleryRef.current?.click()}
        className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-xs font-black text-slate-600"
        title="Elegir de la galería"
      >
        <ImagePlus className="h-3.5 w-3.5" /> Galería
      </button>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      <DeviceCameraDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(captured) => {
          onFile(captured)
          setCameraOpen(false)
        }}
      />
    </div>
  )
}

function DeviceCameraDialog({
  open,
  onClose,
  onCapture,
}: {
  open: boolean
  onClose: () => void
  onCapture: (file: File) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setReady(false)
  }

  useEffect(() => {
    if (!open) {
      stopStream()
      setError(null)
      return
    }

    let cancelled = false

    const start = async () => {
      setError(null)
      setReady(false)
      stopStream()

      if (!window.isSecureContext) {
        setError(
          'La cámara solo funciona en un contexto seguro (HTTPS o localhost). Abre la app por https:// o http://localhost.',
        )
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite acceso directo a la cámara.')
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setReady(true)
        }
      } catch (e) {
        const name = e instanceof DOMException ? e.name : ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Permiso de cámara denegado. Actívalo en el navegador e inténtalo de nuevo.')
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('No se encontró una cámara en este dispositivo.')
        } else if (name === 'NotReadableError') {
          setError('La cámara está en uso por otra aplicación.')
        } else {
          setError('No se pudo abrir la cámara. Revisa permisos del navegador.')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      stopStream()
    }
  }, [open, facing])

  const capture = () => {
    const video = videoRef.current
    if (!video || !ready) return
    const canvas = document.createElement('canvas')
    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, width, height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `mercado-${Date.now()}.jpg`, { type: 'image/jpeg' })
        onCapture(file)
        stopStream()
      },
      'image/jpeg',
      0.92,
    )
  }

  return (
    <Dialog
      open={open}
      nested
      onOpenChange={(next) => {
        if (!next) {
          stopStream()
          onClose()
        }
      }}
      title="Cámara del dispositivo"
      footer={
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>
            Cambiar cámara
          </Button>
          <Button type="button" disabled={!ready} onClick={capture}>
            <Camera className="h-4 w-4" /> Capturar
          </Button>
        </div>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!error ? (
        <div className="overflow-hidden rounded-2xl bg-slate-900">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className="aspect-[3/4] max-h-[55vh] w-full object-cover"
          />
          {!ready ? (
            <p className="px-3 py-2 text-center text-xs font-semibold text-slate-300">
              Solicitando permiso de cámara…
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-xs font-semibold text-slate-500">
        El navegador pedirá permiso para usar la cámara. En PC también funciona con webcam.
      </p>
    </Dialog>
  )
}

function ProductThumb({
  url,
  name,
  size = 'md',
}: {
  url?: string | null
  name: string
  size?: 'sm' | 'md'
}) {
  const box = size === 'sm' ? 'h-10 w-10' : 'h-14 w-14'
  if (url) {
    return <img src={url} alt={name} className={`${box} rounded-xl object-cover`} />
  }
  return (
    <div className={`flex ${box} items-center justify-center rounded-xl bg-white text-slate-300`}>
      <Camera className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </div>
  )
}

function CatalogProductPicker({
  products,
  query,
  onQueryChange,
  selectedId,
  currency,
  onSelect,
}: {
  products: MarketProduct[]
  query: string
  onQueryChange: (value: string) => void
  selectedId: string
  currency: string
  onSelect: (product: MarketProduct | null) => void
}) {
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return products.slice(0, 8)
    return products
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 12)
  }, [products, query])

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar por nombre…"
        aria-label="Buscar producto en catálogo"
      />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm font-semibold ${
            !selectedId ? 'bg-brand-500 text-white' : 'text-slate-700 hover:bg-white'
          }`}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xs font-black">
            +
          </div>
          <span>Producto nuevo / libre</span>
        </button>
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs font-semibold text-slate-400">
            Sin coincidencias. Prueba otro nombre o usa producto libre.
          </p>
        ) : (
          filtered.map((product) => {
            const active = selectedId === String(product.id)
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${
                  active ? 'bg-brand-500 text-white' : 'text-slate-700 hover:bg-white'
                }`}
              >
                <ProductThumb url={product.photo_url} name={product.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">{product.name}</span>
                  <span
                    className={`block text-xs font-semibold ${
                      active ? 'text-white/80' : 'text-slate-500'
                    }`}
                  >
                    {unitLabel(product.unit)}
                    {product.last_unit_price
                      ? ` · ${formatMoney(product.last_unit_price, currency)}`
                      : ''}
                  </span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0" /> : null}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

function ProductCard({
  product,
  currency,
  canManage = false,
  busy = false,
  onEdit,
  onToggleActive,
}: {
  product: MarketProduct
  currency: string
  canManage?: boolean
  busy?: boolean
  onEdit?: () => void
  onToggleActive?: () => void
}) {
  return (
    <div
      className={`flex gap-3 rounded-2xl border p-3 ${
        product.is_active
          ? 'border-slate-100 bg-slate-50'
          : 'border-dashed border-slate-200 bg-white opacity-80'
      }`}
    >
      {product.photo_url ? (
        <img
          src={product.photo_url}
          alt={product.name}
          className="h-16 w-16 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white text-slate-300">
          <Camera className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-black text-slate-800">{product.name}</p>
            <p className="text-xs font-semibold text-slate-500">
              {unitLabel(product.unit)}
              {product.last_unit_price
                ? ` · ${formatMoney(product.last_unit_price, currency)}`
                : ''}
            </p>
            {product.notes ? <p className="text-xs text-slate-400">{product.notes}</p> : null}
            {!product.is_active ? (
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-amber-600">
                Desactivado
              </p>
            ) : null}
          </div>
          {canManage ? (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                aria-label={`Editar ${product.name}`}
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                aria-label={product.is_active ? `Desactivar ${product.name}` : `Reactivar ${product.name}`}
                onClick={onToggleActive}
              >
                <Power className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ListDetail({
  list,
  currency,
  editable,
  canManage,
  onBack,
  onAddItem,
  onToggle,
  onDelete,
  onPrice,
  onPhoto,
  onClose,
  onCancel,
  closing,
}: {
  list: MarketList
  currency: string
  editable: boolean
  canManage: boolean
  onBack: () => void
  onAddItem: () => void
  onToggle: (item: MarketListItem) => void
  onDelete: (id: number) => void
  onPrice: (item: MarketListItem, price: string, qty?: string) => void
  onPhoto: (item: MarketListItem, file: File) => void
  onClose: () => void
  onCancel: () => void
  closing: boolean
}) {
  const budget = list.budget
  const projection = Number(list.totals.projection_total)
  const available = Number(budget?.available_amount ?? 0)
  const fits = !budget?.has_budget_line || projection <= available

  return (
    <Panel title={list.name}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Listas
        </Button>
        <Badge tone={statusTone(list.status)}>{statusLabel(list.status)}</Badge>
        {editable && canManage ? (
          <>
            <Button size="sm" onClick={onAddItem}>
              <Plus className="h-4 w-4" /> Agregar
            </Button>
            <Button size="sm" variant="secondary" disabled={closing} onClick={onClose}>
              Cerrar y crear gasto
            </Button>
            <Button size="sm" variant="outline" onClick={onCancel}>
              Cancelar lista
            </Button>
          </>
        ) : null}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Estimado" value={formatMoney(list.totals.estimated_total, currency)} />
        <Metric label="Comprado" value={formatMoney(list.totals.bought_total, currency)} />
        <Metric label="Pendiente est." value={formatMoney(list.totals.pending_estimated_total, currency)} />
        <Metric label="Proyección" value={formatMoney(list.totals.projection_total, currency)} />
      </div>

      {budget?.has_budget_line ? (
        <Alert className="mb-4" tone={fits ? 'success' : 'danger'}>
          {fits
            ? `La proyección cabe en el disponible de Mercado (${formatMoney(budget.available_amount, currency)}).`
            : `La proyección supera el disponible de Mercado (${formatMoney(budget.available_amount, currency)}).`}
        </Alert>
      ) : null}

      <div className="sticky bottom-4 z-10 mb-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 shadow-panel sm:static">
        <p className="text-xs font-black uppercase tracking-wide text-brand-700">Calculadora en compra</p>
        <p className="text-lg font-black text-brand-900">
          Llevas {formatMoney(list.totals.bought_total, currency)}
          <span className="ml-2 text-sm font-semibold text-brand-700">
            · {list.totals.checked_count}/{list.totals.items_count} ítems
          </span>
        </p>
      </div>

      <ul className="space-y-3">
        {list.items.length === 0 ? (
          <p className="text-sm font-semibold text-slate-400">Agrega productos para empezar</p>
        ) : (
          list.items.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border px-3 py-3 ${
                item.is_checked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <div className="flex gap-3">
                {item.photo_url || item.product?.photo_url ? (
                  <img
                    src={item.photo_url ?? item.product?.photo_url ?? ''}
                    alt={item.name}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-slate-300">
                    <Camera className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-800">{item.name}</p>
                      <p className="text-xs font-semibold text-slate-500">
                        {formatQuantity(item.quantity_planned)} {unitLabel(item.unit)} · est.{' '}
                        {formatMoney(item.estimated_total, currency)}
                        {item.is_checked
                          ? ` · real ${formatMoney(item.bought_total, currency)}${
                              item.quantity_bought
                                ? ` (${formatQuantity(item.quantity_bought)} ${unitLabel(item.unit)})`
                                : ''
                            }`
                          : ''}
                      </p>
                      {item.notes ? (
                        <p className="text-xs text-slate-400">{item.notes}</p>
                      ) : null}
                    </div>
                    {editable && canManage ? (
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant={item.is_checked ? 'secondary' : 'primary'} onClick={() => onToggle(item)}>
                          <Check className="h-4 w-4" />
                          {item.is_checked ? 'Hecho' : 'Comprar'}
                        </Button>
                        <CameraCaptureButtons
                          onFile={(file) => onPhoto(item, file)}
                        />
                        <Button size="sm" variant="outline" onClick={() => onDelete(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {editable && canManage && item.is_checked ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <FormField label="Precio unitario real">
                        <Input
                          defaultValue={String(Number(item.actual_unit_price ?? item.estimated_unit_price))}
                          onBlur={(e) => {
                            const qty = String(Number(item.quantity_bought ?? item.quantity_planned))
                            onPrice(item, e.target.value, qty)
                          }}
                        />
                      </FormField>
                      <FormField label="Cantidad comprada">
                        <Input
                          defaultValue={formatQuantity(item.quantity_bought ?? item.quantity_planned)}
                          onBlur={(e) =>
                            onPrice(
                              item,
                              String(Number(item.actual_unit_price ?? item.estimated_unit_price)),
                              e.target.value,
                            )
                          }
                        />
                      </FormField>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </Panel>
  )
}
