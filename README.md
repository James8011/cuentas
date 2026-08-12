# Finanzas del hogar

Aplicación web para administrar finanzas de parejas y hogares.

- **Frontend:** React 19 + TypeScript + Vite (`frontend/`)
- **Backend:** Laravel 12 + Sanctum (`backend/`)
- **Base de datos:** MariaDB (`cuentas`)

## Fase 1 (implementada)

Identidad, hogares, integrantes, roles personalizados y catálogo cerrado de permisos.

## Fase 2 (implementada)

Núcleo financiero sin reglas avanzadas, deudas, ahorros ni presupuestos:

- Cuentas de efectivo, ahorro, corriente y tarjeta, individuales o compartidas.
- Categorías de ingresos y gastos por hogar, con catálogo colombiano inicial editable.
- Ingresos fijos, variables y extraordinarios.
- Gastos individuales/compartidos con distribución 50/50 o porcentajes personalizados.
- Pagos parciales/completos idempotentes, sin sobrepago.
- Saldos internos derivados de participaciones y pagos.
- Plantillas semanales, quincenales y mensuales con generación manual idempotente.

Los importes usan `DECIMAL(19,4)`, los porcentajes `DECIMAL(7,4)` y la API entrega
strings decimales. El último share listado recibe de forma explícita el residuo
determinista de redondeo.

## Fase 3 (implementada)

Extiende el núcleo hacia el MVP:

- Scheduler diario de recurrencias (`recurrences:generate-due` a las 01:15).
- Deudas con saldo, cuota mínima, titular y pagos idempotentes.
- Objetivos de ahorro y fondo de emergencia.
- Presupuestos por período, flujo de caja y cierre mensual.
- Distribución de gastos 50/50, proporcional a ingresos y por capacidad.
- Compensación explícita de saldos internos.
- Exportación CSV y listado de auditoría.

## Arranque local

1. Inicia MariaDB (XAMPP o servicio local) en `127.0.0.1:3306`.
2. Backend:

```bash
cd backend
composer install
cp .env.example .env   # si aún no existe
php artisan key:generate
php artisan migrate
php artisan db:seed
php artisan serve
```

3. Frontend:

```bash
cd frontend
npm install
npm run dev
```

- UI: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8000/api/v1`

Vite reenvía `/api` y `/sanctum` al backend para autenticación SPA con cookies.

## Flujo de uso de Fase 2

1. Inicia sesión y entra al hogar.
2. Abre **Núcleo financiero**.
3. Crea al menos una cuenta y revisa/crea categorías.
4. Registra ingresos o gastos.
5. Para un gasto compartido selecciona integrantes, aplica 50/50 o escribe
   porcentajes que sumen exactamente `100.0000`.
6. Abre el gasto y registra pagos desde una cuenta compatible con su moneda.
7. Consulta **Saldos internos** para ver responsabilidades frente a pagos.
8. Un gasto recurrente crea una plantilla; genera la próxima ocurrencia desde
   **Recurrencias**.

La generación recurrente es manual en Fase 2. Un scheduler posterior podrá llamar
al mismo servicio idempotente; no deberá modificar ocurrencias pagadas.

### Actualizar una instalación existente

```bash
cd backend
php artisan migrate
php artisan db:seed
```

No uses `migrate:fresh` sobre `cuentas`; las pruebas destructivas usan
exclusivamente `cuentas_test`.

## Credenciales de desarrollo (solo local)

Se crean con `DevAdminSeeder` (no usar en producción):

| Campo | Valor |
| --- | --- |
| Teléfono | `+573001112233` (también `3001112233`) |
| Contraseña inicial | `DevAdmin123!` |
| Hogar | `Hogar de desarrollo` |

**Obligatorio:** cambia esa contraseña antes de cualquier uso fuera de desarrollo local. No son secretos de producción.

## Pruebas

```bash
# Backend (MariaDB: cuentas_test)
cd backend
php artisan test

# Frontend
cd frontend
npm run test
npm run lint
npm run build
```

## Decisiones aplicadas en Fase 1

- Identificador de login: teléfono E.164; email opcional y no sirve para login.
- Sin autorregistro, invitaciones, OTP ni verificación telefónica.
- Permisos efectivos = unión de roles activos; sin denegaciones explícitas.
- Continuidad administrativa: siempre debe quedar alguien con `roles.gestionar`.
- Autenticación de primera parte: cookies de sesión Sanctum + CSRF.
- IDs enteros autoincrementales (decisión simple para el MVP).

## Decisiones aplicadas en Fase 2

- COP es el default, pero cada cuenta y movimiento conserva un código ISO.
- No hay conversión implícita entre monedas.
- Los saldos internos se calculan; no se almacenan como deuda ni columna mutable.
- Los movimientos confirmados se cancelan o revierten; no se borran físicamente.
- La primera recurrencia automática queda pendiente; la generación manual usa
  fecha + plantilla e idempotencia.
