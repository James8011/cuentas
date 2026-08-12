# Stack tecnológico del sistema

## 1. Información del documento

- **Producto:** Sistema de gestión financiera para parejas y hogares.
- **Mercado inicial:** Colombia.
- **Estado:** Decisión técnica inicial.
- **Documentos relacionados:**
  - `HISTORIAS_DE_USUARIO.md`
  - `REQUERIMIENTOS.md`
- **Proyecto de referencia visual:** `prospecto_atiendelo`.
- **Propósito:** Definir las tecnologías, responsabilidades y restricciones con las que se desarrollará el sistema.

## 2. Decisión principal

El sistema utilizará una arquitectura web separada en:

```text
React + TypeScript
        │
        │ HTTPS / API REST
        ▼
Laravel
        │
        ▼
MariaDB / InnoDB
```

React será responsable de toda la interfaz, incluidos formularios, tablas, navegación, paneles, gráficos y diálogos.

Laravel funcionará exclusivamente como backend y API. No se utilizarán Filament, Livewire ni Blade como sistema principal de interfaz.

MariaDB será la base de datos relacional. DBeaver se utilizará como herramienta de administración y visualización. El entorno local utilizará XAMPP para alojar MariaDB, PHP y Composer; Laragon podrá usarse como alternativa siempre que no exista conflicto de puertos.

## 3. Alcance de la reutilización

Del proyecto `prospecto_atiendelo` se reutilizarán:

- Stack frontend.
- Componentes genéricos del design system.
- Tokens visuales y patrones de composición.
- Tablas, filtros, paginación y exportación.
- Formularios, selectores y diálogos.
- Paneles, estadísticas, gráficos y estados de carga.
- Concepto de catálogo cerrado de permisos y roles configurables.

No se trasladarán:

- Nombre, logotipo o identidad Atendo.
- Lógica de POS, ERP, Connect o dispositivos.
- Datos de demostración.
- Persistencia mediante `localStorage`.
- Autenticación y autorización simuladas.
- Arquitectura PostgreSQL de schema por tenant.
- Componentes dependientes de impresión térmica, códigos de barras o hardware.

La reutilización será mediante extracción y adaptación del UI kit, no mediante la continuación del producto Atendo.

---

## 4. Frontend

### 4.1. Núcleo

- **React 19:** construcción de interfaces mediante componentes.
- **TypeScript:** tipado estático del frontend.
- **Vite 8:** servidor de desarrollo y compilación.
- **Node.js:** versión compatible con Vite 8; como mínimo Node 20.19 o una versión LTS posterior compatible.
- **npm:** gestión de dependencias y scripts.

Las versiones exactas deberán quedar bloqueadas mediante `package-lock.json`. El lockfile será la fuente de verdad para instalaciones reproducibles.

### 4.2. Estilos y design system

- **Tailwind CSS 4:** utilidades y tokens visuales.
- **class-variance-authority:** variantes tipadas de componentes.
- **clsx:** composición condicional de clases.
- **tailwind-merge:** resolución de conflictos entre clases.
- **Radix UI:** primitivas accesibles para diálogos, selectores, menús, popovers, tooltips, switches, radio groups y checkboxes.
- **Lucide React:** biblioteca de iconos.

El UI kit deberá quedar separado de la marca:

```text
frontend/src/
├── design-system/
│   ├── components/
│   ├── layouts/
│   ├── tokens/
│   ├── providers/
│   └── index.ts
├── features/
├── routes/
├── services/
└── app/
```

### 4.3. Formularios y validación

- **React Hook Form:** gestión del estado de formularios.
- **Zod:** esquemas y validación en el cliente.
- **Integración Zod/React Hook Form:** traducción de errores a cada campo.

La validación del frontend mejora la experiencia, pero no reemplaza la validación de Laravel.

Los formularios financieros deberán:

- Diferenciar valor de presentación y valor enviado.
- Respetar moneda y configuración regional.
- No convertir dinero mediante `number` cuando pueda perder precisión.
- Mostrar claramente los redondeos.
- Prevenir envíos duplicados mientras una operación está en curso.

### 4.4. Navegación

- **React Router:** rutas, layouts, parámetros y protección visual de pantallas.

La autorización real siempre será validada por Laravel. Proteger una ruta en React no se considerará una medida suficiente de seguridad.

### 4.5. Datos remotos

- **TanStack Query:** consultas, caché temporal, invalidación, reintentos controlados y estados de carga.
- **Fetch API o cliente HTTP pequeño:** comunicación con la API.

No se almacenarán datos financieros como fuente de verdad en `localStorage`.

`localStorage` podrá utilizarse únicamente para preferencias no sensibles, como:

- Tema visual.
- Densidad de tablas.
- Columnas visibles.
- Preferencias de interfaz.

### 4.6. Tablas

- **TanStack Table:** motor de tablas.
- **FilamentTable del UI kit:** se conservará el componente visual, pero se renombrará para evitar confusión con Laravel Filament.

Nombre sugerido:

```text
DataGrid
```

Las tablas deberán soportar:

- Ordenamiento.
- Filtros.
- Paginación.
- Selección de columnas.
- Densidad.
- Estados vacíos.
- Exportación autorizada.
- Paginación y filtros del servidor para conjuntos grandes.

Laravel Filament no forma parte del stack.

### 4.7. Fechas

- **date-fns:** operaciones de fechas.
- **react-day-picker:** selección de fechas y rangos.

Reglas:

- Los instantes se recibirán y enviarán en UTC.
- La zona horaria del hogar se utilizará para presentación.
- Las fechas sin hora, como un período presupuestal, no deberán convertirse innecesariamente a UTC.

### 4.8. Gráficos

- **Recharts:** gráficos de presupuestos, gastos, ahorro, deudas y flujo de caja.

Los gráficos serán complementarios. La información también deberá estar disponible como texto o tabla accesible.

### 4.9. Notificaciones y diálogos

- **Sonner:** notificaciones breves y no bloqueantes.
- **Radix Dialog:** confirmaciones, formularios modales y operaciones sensibles.

SweetAlert2 no será el mecanismo principal. Mantener simultáneamente Radix Dialog, Sonner y SweetAlert2 produciría comportamientos visuales y de accesibilidad inconsistentes.

### 4.10. Exportaciones

- **jsPDF:** exportaciones PDF pequeñas o inmediatas.
- **CSV:** formato preferido para datos tabulares simples.

Las exportaciones grandes o sensibles deberán generarse en el backend mediante jobs y enlaces temporales autorizados.

La dependencia comunitaria `xlsx` no se utilizará mientras mantenga vulnerabilidades de seguridad conocidas sin una versión corregida. Las hojas de cálculo se evaluarán posteriormente mediante una alternativa mantenida o generación controlada desde el backend.

### 4.11. Fuentes

El UI kit de referencia usa:

- **Fredoka:** títulos y elementos de identidad.
- **Nunito:** contenido e interfaz.

Estas fuentes podrán conservarse como parte del lenguaje visual si la nueva identidad las aprueba. Se deberán revisar sus licencias y decidir si se cargarán desde Google Fonts o se alojarán localmente.

### 4.12. Dependencias no adoptadas inicialmente

Las siguientes dependencias del prospecto no se incluirán salvo que aparezca una necesidad funcional:

- `react-thermal-printer`
- `react-barcode`
- `qrcode.react`
- `iconv-lite`
- `buffer`
- `mermaid` dentro de la aplicación productiva

Mermaid podrá utilizarse en documentación técnica sin formar parte del bundle principal.

---

## 5. Backend

### 5.1. Plataforma

- **PHP:** versión estable compatible con la versión de Laravel seleccionada.
- **Laravel:** backend modular y API REST.
- **Composer:** gestión de dependencias PHP.

La versión exacta de PHP y Laravel deberá fijarse al crear el proyecto y documentarse en:

- `composer.json`
- `composer.lock`
- README de instalación.

### 5.2. Responsabilidades de Laravel

Laravel será responsable de:

- Autenticación.
- Autorización.
- Validación definitiva.
- Reglas financieras.
- Transacciones.
- Persistencia.
- Auditoría.
- Cierres de períodos.
- Jobs y tareas programadas.
- Importaciones y exportaciones.
- Envío de notificaciones.
- API versionada.

### 5.3. API

La API utilizará rutas versionadas:

```text
/api/v1/households
/api/v1/incomes
/api/v1/expenses
/api/v1/debts
/api/v1/savings-goals
/api/v1/budgets
```

Reglas:

- Respuestas JSON.
- Códigos HTTP correctos.
- Errores con estructura consistente.
- Paginación para colecciones.
- Filtros documentados.
- Idempotencia en operaciones financieras críticas.
- Identificador de correlación para trazabilidad.

### 5.4. Autenticación

- **Laravel Sanctum:** autenticación de primera parte mediante cookies seguras.
- **MFA:** incorporación para cuentas o acciones sensibles.
- **Rate limiting:** protección de autenticación y endpoints críticos.

Para la aplicación web de primera parte se preferirán cookies `HttpOnly`, `Secure` y `SameSite` frente a almacenar tokens en `localStorage`.

### 5.5. Autorización

- **Policies y Gates de Laravel.**
- Roles configurables por hogar.
- Catálogo de permisos controlado por el sistema.
- Validación de pertenencia al hogar.
- Validación de propiedad del recurso.
- Alcance sobre datos propios, compartidos y ajenos.

La autorización combinará:

```text
permiso + hogar + propiedad + privacidad + estado del integrante
```

Tener un permiso no autoriza por sí mismo a acceder a cualquier registro.

### 5.6. Arquitectura del backend

Se utilizará un monolito modular. No se crearán microservicios para el MVP.

Estructura conceptual:

```text
backend/app/
├── Modules/
│   ├── Identity/
│   ├── Households/
│   ├── Income/
│   ├── Expenses/
│   ├── Debts/
│   ├── Savings/
│   ├── Budgets/
│   ├── ExchangeRates/
│   └── Audit/
├── Http/
├── Policies/
├── Jobs/
└── Support/
```

Cada módulo deberá separar, en la medida necesaria:

- Dominio.
- Casos de uso.
- Persistencia.
- Controladores y recursos HTTP.

No se adoptará una arquitectura distribuida prematuramente.

### 5.7. Colas y programación

- **Laravel Queue:** trabajos en segundo plano.
- **Laravel Scheduler:** tareas periódicas.
- **Redis:** driver preferido cuando se habiliten colas.

Casos de uso:

- Reportes grandes.
- Exportaciones.
- Alertas.
- Importaciones.
- Correos.
- Actualización de tasas externas.
- Reintentos de integraciones.

Para una primera ejecución local podrá utilizarse el driver de base de datos, pero Redis será preferible antes de producción.

### 5.8. Documentación de API

- **OpenAPI:** contrato de la API.
- **Scramble:** generación de documentación OpenAPI para Laravel, sujeto a validación de compatibilidad.
- **Bruno:** colecciones versionadas para pruebas manuales y colaboración.

---

## 6. Base de datos

### 6.1. Motor

- **MariaDB 10.4+** (entorno local actual: MariaDB 10.4.32 vía XAMPP).
- **InnoDB:** motor obligatorio para tablas transaccionales.
- **utf8mb4:** juego de caracteres.

Laravel utilizará `DB_CONNECTION=mysql` porque el driver PDO es compatible con MariaDB. Las pruebas de integración deberán ejecutarse contra MariaDB, no contra SQLite, para validar decimales, collations, JSON e índices.

### 6.2. Modelo de aislamiento

Se utilizará una base compartida:

```text
cuentas
```

Las entidades pertenecientes a un hogar incluirán:

```text
household_id
```

No se creará una base de datos ni un schema por hogar.

Entidades iniciales:

```text
users
households
household_memberships
roles
permissions
role_permissions
membership_roles
accounts
incomes
expenses
expense_shares
payments
debts
debt_payments
savings_goals
savings_contributions
allocation_rules
budgets
budget_lines
period_closures
exchange_rates
audit_logs
```

### 6.3. Reglas de diseño

- Tablas y columnas en `snake_case` minúsculo.
- Claves foráneas.
- Índices compuestos por hogar y criterio de consulta.
- Restricciones únicas con alcance del hogar cuando corresponda.
- Fechas de auditoría.
- Borrado lógico únicamente donde tenga una justificación funcional.
- No almacenar relaciones financieras importantes dentro de JSON.
- No depender de valores autocalculados exclusivamente en el frontend.

Ejemplo de índice:

```text
(household_id, occurred_at)
```

### 6.4. Dinero y precisión

No se utilizarán:

- `FLOAT`
- `DOUBLE`
- `number` de JavaScript como representación definitiva

Se utilizarán:

- `DECIMAL` en MariaDB.
- Strings decimales u objetos de valor en los contratos.
- Un objeto `Money` en backend.
- Código ISO 4217.
- Política explícita de redondeo.

Las tasas de interés, cambio y unidades indexadas tendrán mayor precisión que los importes monetarios.

La precisión definitiva deberá establecerse antes de crear las migraciones. Como criterio inicial:

```text
Importes monetarios: DECIMAL con precisión suficiente para monedas soportadas.
Tasas de cambio:      DECIMAL de alta precisión.
Porcentajes:          DECIMAL, nunca FLOAT.
Unidades UVR:         DECIMAL de alta precisión.
```

### 6.5. Fechas y zonas horarias

- Instantes almacenados en UTC.
- Precisión de microsegundos cuando sea necesaria.
- Zona horaria IANA del hogar almacenada por separado.
- Fechas civiles, como vencimientos o períodos, modeladas como fecha cuando no representen un instante.

### 6.6. Transacciones e idempotencia

Se utilizarán transacciones para:

- Registrar pagos.
- Distribuir gastos.
- Realizar cierres.
- Aplicar aportes.
- Actualizar saldos de deuda.
- Confirmar importaciones.

Las operaciones críticas aceptarán una clave de idempotencia para evitar duplicados por reintentos.

### 6.7. Migraciones y datos iniciales

- Migraciones de Laravel versionadas.
- Seeders para catálogos y datos de desarrollo.
- Factories para pruebas.
- Prohibido modificar manualmente producción como sustituto de una migración.
- Toda migración de alto riesgo deberá incluir estrategia de recuperación.

---

## 7. DBeaver

DBeaver será una herramienta de administración, no un componente de la aplicación.

Usos:

- Visualizar tablas y relaciones.
- Ejecutar consultas de diagnóstico.
- Revisar índices.
- Inspeccionar datos de desarrollo.
- Generar diagramas ER de apoyo.

Conexión local típica:

```text
Driver:   MariaDB (o MySQL si DBeaver no lista MariaDB por separado)
Host:     127.0.0.1
Puerto:   3306
Base:     cuentas
Usuario:  cuentas_app
Contraseña: la definida en backend/.env
```

Reglas:

- No utilizar el usuario `root` desde Laravel.
- No usar contraseñas vacías en la aplicación.
- Separar usuarios de aplicación, migración y administración cuando el entorno lo requiera.
- No exponer el puerto 3306 a Internet.
- Utilizar conexión cifrada para bases remotas.
- Evitar cambios manuales sobre datos financieros de producción.

### 7.1. Conexión DBeaver paso a paso

1. Abrir DBeaver.
2. Nueva conexión → elegir **MariaDB** (si no aparece, usar **MySQL**).
3. Completar:
   - Host: `127.0.0.1`
   - Port: `3306`
   - Database: `cuentas`
   - Username: `cuentas_app`
   - Password: el valor de `DB_PASSWORD` en `backend/.env`
4. Probar conexión.
5. Guardar y abrir el esquema `cuentas`.

Si la conexión falla, confirmar que MariaDB está iniciado en XAMPP y que el puerto 3306 no está ocupado por otro servicio.

---

## 8. Entorno local

### 8.1. Entorno local actual: XAMPP + MariaDB

El entorno local confirmado es:

- PHP 8.2 desde XAMPP.
- MariaDB 10.4.32 desde XAMPP.
- Frontend con Vite en `http://127.0.0.1:5173`.
- API Laravel en `http://127.0.0.1:8000`.
- Base de datos en `127.0.0.1:3306`.

Durante desarrollo, Vite redirigirá `/api` al backend para evitar una configuración CORS innecesariamente compleja.

MariaDB puede iniciarse desde el panel de XAMPP o con su ejecutable:

```text
C:\xampp\mysql\bin\mysqld.exe --defaults-file=C:\xampp\mysql\bin\my.ini --standalone
```

### 8.2. Alternativa: Laragon

Laragon podrá utilizarse si:

- La versión de PHP es compatible con Laravel.
- El motor de base instalado es MariaDB o MySQL compatible.
- Composer y Node se administran por separado.
- No existe conflicto de puertos con XAMPP.

No deberán ejecutarse simultáneamente los servicios de base de datos de Laragon y XAMPP sobre el puerto 3306.

### 8.3. Variables de entorno

Frontend:

```text
VITE_API_URL=/api
```

Backend:

```text
APP_ENV=local
APP_URL=http://cuentas.test

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=cuentas
DB_USERNAME=cuentas_app
DB_PASSWORD=valor_local_seguro
```

Los archivos `.env` no deberán incluirse en el repositorio.

---

## 9. Producción

Laragon y XAMPP se utilizarán únicamente para desarrollo local. No se consideran una plataforma de producción pública.

Stack recomendado para producción:

- Linux.
- Nginx o Apache.
- PHP-FPM.
- Laravel.
- MariaDB o MySQL administrado y correctamente asegurado.
- Redis cuando existan colas.
- Worker de Laravel.
- Scheduler de Laravel.
- HTTPS obligatorio.
- Copias de seguridad cifradas.
- Monitoreo y alertas.

La compilación de React podrá servirse:

1. Desde el mismo dominio que Laravel, opción preferida para simplificar autenticación; o
2. Desde un hosting estático/CDN, con configuración controlada de cookies y CORS.

Para el MVP se preferirá un único origen:

```text
https://cuentas.example.com
├── /          React
└── /api/v1    Laravel
```

---

## 10. Pruebas y calidad

### 10.1. Frontend

- **Vitest:** pruebas unitarias.
- **React Testing Library:** comportamiento de componentes.
- **Playwright:** pruebas de flujos críticos.
- **ESLint:** análisis estático.
- **TypeScript:** comprobación de tipos.

Flujos prioritarios:

- Inicio de sesión.
- Cambio de hogar.
- Creación y distribución de gastos.
- Registro de pagos.
- Permisos y privacidad.
- Cierre de período.
- Manejo y formato de monedas.

### 10.2. Backend

- Pruebas unitarias para objetos de valor y reglas financieras.
- Pruebas de integración con MariaDB.
- Pruebas de API.
- Pruebas de autorización.
- Pruebas de concurrencia e idempotencia.
- Pruebas de jobs y cierres.

Se podrá utilizar PHPUnit o Pest. La elección deberá estandarizarse al crear el backend.

### 10.3. Base de datos de pruebas

Las pruebas de integración deberán ejecutarse contra MariaDB, no solamente SQLite, porque existen diferencias en:

- Tipos decimales.
- Restricciones.
- Collations.
- JSON.
- Índices.
- Bloqueos.
- Comportamiento transaccional.

---

## 11. Seguridad

Controles mínimos:

- HTTPS.
- Cookies seguras.
- Protección CSRF.
- Validación en backend.
- Policies sobre todos los recursos del hogar.
- Rate limiting.
- Contraseñas con hash seguro.
- MFA para acciones sensibles.
- Auditoría de roles, permisos y movimientos.
- Cifrado de copias de seguridad.
- Secretos fuera del repositorio.
- Dependencias revisadas periódicamente.
- Ningún dato financiero sensible en logs del navegador o servidor.

La referencia inicial de verificación será OWASP ASVS nivel 2.

---

## 12. Observabilidad

El sistema deberá disponer de:

- Logs estructurados.
- Identificador de correlación por solicitud.
- Registro separado de errores y auditoría funcional.
- Monitoreo de tiempos de respuesta.
- Monitoreo de jobs fallidos.
- Alertas operativas.
- Endpoint de salud sin información sensible.

Los logs técnicos no sustituirán la auditoría financiera.

---

## 13. Dependencias y licencias

Antes de copiar componentes desde `prospecto_atiendelo` se deberá:

1. Confirmar que el código pertenece al mismo propietario o que existe autorización para reutilizarlo.
2. Retirar nombres, logos y datos de Atendo.
3. Conservar avisos de licencia exigidos por dependencias externas.
4. Revisar licencias de fuentes, iconos y librerías.
5. Documentar nuevas dependencias antes de incorporarlas.

El repositorio de referencia se identifica como prototipo interno y no contiene un archivo de licencia explícito. Por ello, su reutilización fuera del mismo propietario requeriría autorización.

---

## 14. Tecnologías excluidas

No forman parte del stack inicial:

- Laravel Filament.
- Livewire como interfaz.
- Blade como interfaz principal.
- PostgreSQL.
- Base o schema por hogar.
- Microservicios.
- Persistencia financiera en `localStorage`.
- Firebase o bases NoSQL como fuente principal.
- SQLite como sustituto de MariaDB en pruebas de integración.
- Laragon o XAMPP como servidor público de producción.

---

## 15. Resumen del stack

### Aplicación

```text
Frontend:
React + TypeScript + Vite + Tailwind
Radix UI + TanStack Table + Recharts
React Hook Form + Zod + TanStack Query

Backend:
Laravel API + Sanctum
Policies + Jobs + Scheduler

Datos:
MariaDB + InnoDB + utf8mb4
Redis opcional para colas y caché

Administración:
DBeaver

Desarrollo local:
XAMPP + MariaDB (entorno actual)
Laragon como alternativa

Producción:
Linux + Nginx/Apache + PHP-FPM
Laravel + MariaDB + HTTPS
```

## 16. Decisiones pendientes

Antes de iniciar la implementación se deberá decidir:

1. Nombre e identidad visual del producto.
2. Versión exacta de PHP y Laravel.
3. Versión mínima exacta de MariaDB en producción.
4. Precisión y escala de importes, tasas y porcentajes.
5. Estrategia de identificadores: enteros, ULID o UUID.
6. PHPUnit o Pest.
7. Si Redis estará incluido desde el MVP.
8. Dónde se almacenarán exportaciones y archivos.
9. Política de respaldos del entorno inicial.
10. Forma de despliegue de React: mismo origen o hosting separado.

## 17. Criterios de aprobación

El stack podrá considerarse aprobado cuando:

1. Se confirme React como única interfaz.
2. Se confirme Laravel como API sin Filament.
3. Se confirme MariaDB como motor definitivo.
4. Se elija Laragon o XAMPP como entorno estándar del equipo.
5. Se definan versiones mínimas reproducibles.
6. Se apruebe la estrategia de precisión monetaria.
7. Se autorice la extracción del UI kit.
8. Las decisiones pendientes críticas estén resueltas.

