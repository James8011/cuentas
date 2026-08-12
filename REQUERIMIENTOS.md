# Requerimientos funcionales y no funcionales

## 1. Información del documento

- **Producto:** Sistema de gestión financiera para parejas y hogares.
- **Mercado inicial:** Colombia.
- **Alcance internacional:** Múltiples países, monedas, formatos regionales y zonas horarias.
- **Documento relacionado:** `HISTORIAS_DE_USUARIO.md`.
- **Estado:** Borrador para validación.
- **Propósito:** Establecer qué debe hacer el sistema y bajo qué condiciones de calidad, seguridad y operación.

## 2. Convenciones

### Tipos

- **RF:** Requerimiento funcional.
- **RNF:** Requerimiento no funcional.

### Prioridades

- **Crítica:** indispensable para operar o proteger la información.
- **Alta:** necesaria para entregar valor importante.
- **Media:** puede incorporarse después del núcleo funcional.
- **Posterior:** especializada o dependiente de validaciones futuras.

### Interpretación normativa

Las referencias regulatorias incluidas en este documento son criterios iniciales de diseño. Antes de ofrecer el producto públicamente se deberá realizar una revisión jurídica que determine su aplicabilidad real.

---

## 3. Requerimientos funcionales

### 3.1. Identidad y hogares

#### RF-001 — Gestión de cuentas

El sistema deberá permitir crear, autenticar, recuperar y proteger cuentas cuyo identificador de acceso sea un número telefónico normalizado en formato E.164. El teléfono no será la clave primaria interna. El autorregistro público y la verificación telefónica estarán deshabilitados en el MVP.

**Prioridad:** Crítica.

#### RF-002 — Creación de hogares

El sistema deberá permitir que un usuario cree y administre uno o varios hogares.

**Prioridad:** Crítica.

#### RF-003 — Configuración del hogar

Cada hogar deberá tener configuraciones independientes de país, idioma, moneda principal, formato regional y zona horaria.

**Prioridad:** Crítica.

#### RF-004 — Gestión de integrantes

El sistema deberá permitir que un integrante autorizado cree cuentas con teléfono, asigne al menos un rol y una credencial inicial, suspenda o retire integrantes del hogar. Una cuenta activa podrá iniciar sesión de inmediato sin verificación del número. Las invitaciones y la verificación telefónica no forman parte del MVP.

**Prioridad:** Crítica.

#### RF-005 — Separación entre hogares

Un usuario podrá pertenecer a varios hogares, pero la información y los permisos de cada uno deberán mantenerse separados.

**Prioridad:** Crítica.

### 3.2. Roles y permisos

#### RF-006 — Roles personalizables

El sistema deberá permitir crear, editar, duplicar, activar y desactivar roles propios de cada hogar.

**Prioridad:** Crítica.

#### RF-007 — Catálogo de permisos

Los roles deberán construirse seleccionando permisos granulares definidos y controlados por el sistema.

Los integrantes podrán personalizar la composición de los roles, pero no crear tipos de permisos que el sistema no sepa validar.

**Prioridad:** Crítica.

#### RF-008 — Asignación de roles

El sistema deberá permitir asignar uno o varios roles a cada integrante.

**Prioridad:** Crítica.

#### RF-009 — Permisos efectivos

Los permisos efectivos de un integrante corresponderán a la unión de los permisos concedidos por sus roles activos.

Para la primera versión no se implementarán denegaciones explícitas. Esta decisión reduce conflictos entre roles y facilita explicar los accesos resultantes.

**Prioridad:** Crítica.

#### RF-010 — Continuidad administrativa

El sistema deberá impedir que un hogar quede sin al menos un integrante autorizado para administrar roles y permisos.

**Prioridad:** Crítica.

#### RF-011 — Alcance de permisos

El sistema deberá diferenciar permisos sobre información propia, compartida y perteneciente a otros integrantes.

**Prioridad:** Crítica.

#### RF-012 — Auditoría de accesos

El sistema deberá conservar el historial de creación, modificación, asignación y retiro de roles y permisos.

**Prioridad:** Crítica.

### 3.3. Privacidad entre integrantes

#### RF-013 — Niveles de visibilidad

La información individual deberá poder configurarse como detallada, resumida o privada según las políticas y permisos del hogar.

**Prioridad:** Alta.

#### RF-014 — Cálculos con información privada

El sistema podrá utilizar totales privados en cálculos consolidados sin revelar su detalle a integrantes no autorizados.

**Prioridad:** Alta.

#### RF-015 — Transparencia del resultado

Cuando un cálculo utilice valores no visibles para quien lo consulta, el sistema deberá informarlo claramente.

**Prioridad:** Alta.

#### RF-016 — Protección de preferencias

Un integrante no podrá modificar la privacidad de otro sin un permiso y una política que lo autoricen expresamente.

**Prioridad:** Alta.

### 3.4. Ingresos

#### RF-017 — Registro de ingresos

El sistema deberá permitir registrar ingresos fijos, variables y extraordinarios.

**Prioridad:** Crítica.

#### RF-018 — Frecuencia de ingresos

El sistema deberá soportar frecuencias mensuales, quincenales, semanales, únicas e irregulares.

**Prioridad:** Crítica.

#### RF-019 — Ingresos esperados y recibidos

El sistema deberá diferenciar valores y fechas esperadas de valores y fechas efectivamente recibidas.

**Prioridad:** Crítica.

#### RF-020 — Información del ingreso

Cada ingreso deberá registrar, como mínimo, propietario, fuente, valor bruto opcional, valor neto, moneda, frecuencia y fechas.

**Prioridad:** Crítica.

#### RF-021 — Distribución de ingresos extraordinarios

El sistema deberá permitir distribuir primas, cesantías, bonificaciones y otros ingresos extraordinarios entre gastos, ahorro, deuda y dinero personal.

Un ingreso extraordinario no deberá alterar automáticamente la regla regular de aportación.

**Prioridad:** Alta.

### 3.5. Gastos y pagos

#### RF-022 — Registro de gastos

El sistema deberá permitir registrar gastos individuales y compartidos.

**Prioridad:** Crítica.

#### RF-023 — Clasificación de gastos

Cada gasto deberá registrar categoría, carácter esencial o discrecional, responsables, beneficiarios, valor, moneda y fechas.

**Prioridad:** Crítica.

#### RF-024 — Gastos recurrentes

El sistema deberá permitir programar gastos recurrentes y generar sus ocurrencias futuras.

Modificar una recurrencia no deberá alterar ocurrencias pagadas o pertenecientes a períodos cerrados.

**Prioridad:** Crítica.

#### RF-025 — Pagos

El sistema deberá registrar pagos parciales o completos sin confundir la creación de una obligación con su pago.

**Prioridad:** Crítica.

#### RF-026 — Múltiples pagadores

Una obligación podrá recibir pagos de uno o varios integrantes.

**Prioridad:** Crítica.

#### RF-027 — Saldos internos

El sistema deberá calcular cuánto adelantó o debe cada integrante respecto a los acuerdos del hogar.

Estos saldos no deberán registrarse como deudas bancarias.

**Prioridad:** Crítica.

#### RF-028 — Compras a cuotas

El sistema deberá permitir registrar compras financiadas, incluyendo número de cuotas, intereses, cargos y medio de pago.

**Prioridad:** Alta.

#### RF-029 — Estados financieros diferenciados

El sistema deberá diferenciar, como mínimo, entre gasto planeado, obligación creada, valor comprometido, pago realizado y saldo pendiente.

**Prioridad:** Crítica.

### 3.6. Reglas de aportación

#### RF-030 — Métodos de distribución

El sistema deberá permitir distribuir obligaciones compartidas mediante:

- Partes iguales.
- Proporción de ingresos.
- Proporción de capacidad disponible.
- Porcentajes personalizados.
- Valores fijos.
- Reglas específicas por categoría.

**Prioridad:** Crítica.

#### RF-031 — Integridad de la distribución

Una distribución porcentual deberá cubrir exactamente el 100 % del valor distribuible, aplicando una política explícita de redondeo.

**Prioridad:** Crítica.

#### RF-032 — Capacidad disponible

El hogar deberá poder configurar qué conceptos reducen la capacidad disponible de cada integrante.

La fórmula inicial será:

```text
Capacidad disponible =
ingreso neto
- pagos mínimos admitidos
- obligaciones legales
- mínimo personal acordado
```

Los gastos discrecionales y pagos adicionales voluntarios de deuda no deberán reducirla automáticamente.

**Prioridad:** Alta.

#### RF-033 — Simulación

El sistema deberá permitir comparar reglas sin modificar datos reales.

La simulación mostrará aportes, disponibilidad, ahorro, déficit y supuestos utilizados.

**Prioridad:** Alta.

#### RF-034 — Vigencia de reglas

Cada regla deberá tener una fecha de inicio y una fecha final opcional.

**Prioridad:** Crítica.

#### RF-035 — Historial de reglas

Los cambios de reglas no deberán modificar períodos anteriores ni transacciones ya calculadas.

**Prioridad:** Crítica.

#### RF-036 — Explicación de cálculos

El sistema deberá mostrar la fórmula, los valores considerados y los redondeos aplicados a cada distribución.

**Prioridad:** Alta.

### 3.7. Deudas

#### RF-037 — Registro de deudas

El sistema deberá registrar acreedor, titular, saldo, moneda, cuota mínima, tasa, periodicidad, fechas y cargos adicionales.

**Prioridad:** Crítica.

#### RF-038 — Titularidad y responsabilidad

El sistema deberá diferenciar el titular legal de una deuda de los integrantes que acordaron aportar a su pago.

**Prioridad:** Crítica.

#### RF-039 — Movimientos de deuda

El sistema deberá conservar pagos, abonos, intereses, cargos y cambios de saldo.

**Prioridad:** Crítica.

#### RF-040 — Tipos de tasa

El sistema deberá manejar tasas efectivas y nominales junto con su periodicidad y fecha de vigencia.

En el perfil colombiano se priorizará la presentación de la tasa efectiva anual cuando corresponda.

**Prioridad:** Alta.

#### RF-041 — Estrategias de pago

El sistema deberá comparar los métodos de avalancha, bola de nieve y orden personalizado.

**Prioridad:** Alta.

#### RF-042 — Proyección de deuda

El sistema deberá proyectar pagos, intereses, costo total y fecha estimada de finalización.

**Prioridad:** Alta.

#### RF-043 — Obligaciones indexadas

El sistema deberá poder representar obligaciones indexadas, incluyendo créditos colombianos expresados en UVR, sin tratarlas como créditos fijos en COP.

**Prioridad:** Posterior, salvo necesidad inmediata.

### 3.8. Ahorros y objetivos

#### RF-044 — Objetivos de ahorro

El sistema deberá permitir crear objetivos individuales y compartidos.

**Prioridad:** Crítica.

#### RF-045 — Configuración de objetivos

Cada objetivo deberá registrar valor, moneda, fecha, participantes y reglas de aportación.

**Prioridad:** Crítica.

#### RF-046 — Movimientos de ahorro

El sistema deberá registrar aportes, retiros y saldo de cada objetivo.

**Prioridad:** Crítica.

#### RF-047 — Progreso

El sistema deberá mostrar progreso, valor faltante y aporte periódico sugerido.

**Prioridad:** Alta.

#### RF-048 — Fondo de emergencia

El sistema deberá calcular el fondo de emergencia a partir del número de meses y los gastos esenciales configurados.

**Prioridad:** Crítica.

#### RF-049 — Distribución de excedentes

El sistema deberá permitir distribuir excedentes entre objetivos, deudas y fondos personales sin utilizar recursos reservados para obligaciones próximas.

**Prioridad:** Alta.

### 3.9. Presupuesto y flujo de caja

#### RF-050 — Presupuestos

El sistema deberá permitir crear presupuestos por período y categoría.

**Prioridad:** Crítica.

#### RF-051 — Alcance del presupuesto

Los presupuestos podrán ser individuales o compartidos.

**Prioridad:** Crítica.

#### RF-052 — Seguimiento presupuestal

El sistema deberá comparar valores presupuestados, comprometidos, pagados y disponibles.

**Prioridad:** Crítica.

#### RF-053 — Flujo de caja

El sistema deberá proyectar ingresos y egresos por fecha, cuenta y moneda.

**Prioridad:** Crítica.

#### RF-054 — Detección de faltantes

El sistema deberá advertir días o períodos con saldo proyectado insuficiente.

**Prioridad:** Alta.

#### RF-055 — Cierre de períodos

El sistema deberá permitir cerrar períodos y conservar una fotografía de ingresos, gastos, pagos, ahorros, deudas y reglas aplicadas.

**Prioridad:** Crítica.

#### RF-056 — Inmutabilidad del cierre

Los períodos cerrados no podrán modificarse mediante operaciones ordinarias.

**Prioridad:** Crítica.

#### RF-057 — Reapertura

La reapertura requerirá un permiso específico, justificación y registro de auditoría.

**Prioridad:** Alta.

### 3.10. Monedas e internacionalización

#### RF-058 — Múltiples monedas

El sistema deberá manejar monedas identificadas mediante ISO 4217.

**Prioridad:** Crítica desde el diseño.

#### RF-059 — Valor original

Toda transacción deberá conservar su valor y moneda originales.

**Prioridad:** Crítica.

#### RF-060 — Conversión

Cada conversión deberá registrar tasa, fecha, fuente, moneda de origen, moneda de destino y valor resultante.

**Prioridad:** Crítica.

#### RF-061 — Conversiones históricas

Actualizar una tasa actual no deberá modificar conversiones históricas confirmadas.

**Prioridad:** Crítica.

#### RF-062 — Tasas manuales y externas

El sistema deberá permitir tasas ingresadas manualmente y tasas obtenidas desde fuentes externas.

**Prioridad:** Media.

#### RF-063 — TRM

El perfil colombiano podrá utilizar la TRM como referencia para USD/COP, sin asumir que corresponde a la tasa real de una operación.

**Prioridad:** Media.

#### RF-064 — Formatos regionales

La presentación de fechas, números y monedas deberá respetar la configuración regional sin modificar los valores almacenados.

**Prioridad:** Alta.

### 3.11. Reportes, alertas y datos

#### RF-065 — Panel consolidado

El sistema deberá mostrar un resumen del hogar respetando los permisos y niveles de privacidad.

**Prioridad:** Crítica.

#### RF-066 — Reportes

El sistema deberá generar reportes de ingresos, gastos, deudas, ahorros, aportes y cumplimiento presupuestal.

**Prioridad:** Alta.

#### RF-067 — Alertas

El sistema deberá generar alertas configurables sobre vencimientos, déficit, desviaciones y eventos relevantes.

**Prioridad:** Alta.

#### RF-068 — Exportación

Los usuarios autorizados deberán poder exportar su información en formatos documentados y legibles.

**Prioridad:** Crítica.

#### RF-069 — Historial

El sistema deberá mantener historial de operaciones financieras y acciones administrativas.

**Prioridad:** Crítica.

#### RF-070 — Derechos sobre datos

El sistema deberá disponer de mecanismos para consultar, actualizar, corregir y gestionar solicitudes sobre datos personales según corresponda.

**Prioridad:** Crítica antes de publicación.

---

## 4. Requerimientos no funcionales

### 4.1. Seguridad

#### RNF-001 — Autorización en servidor

Toda autorización deberá validarse en el servidor. Ocultar una acción en la interfaz no se considerará una medida de seguridad suficiente.

#### RNF-002 — Seguridad en tránsito

Las comunicaciones deberán utilizar TLS 1.2 o superior.

#### RNF-003 — Protección de credenciales

Las contraseñas deberán almacenarse mediante algoritmos especializados de hash. Nunca se almacenarán en texto plano ni mediante cifrado reversible.

#### RNF-004 — Cifrado en reposo

Los datos financieros sensibles y las copias de seguridad deberán cifrarse en reposo.

#### RNF-005 — Autenticación multifactor

La plataforma deberá contemplar autenticación multifactor, al menos para cuentas o acciones sensibles.

#### RNF-006 — Sesiones

Las sesiones deberán expirar, poder revocarse y permitir cerrar otros dispositivos.

#### RNF-007 — Seguridad de aplicación

La implementación deberá protegerse contra OWASP Top 10 y usar OWASP ASVS nivel 2 como referencia de verificación.

#### RNF-008 — Aislamiento

Los datos de un hogar no deberán ser accesibles desde otro hogar sin una pertenencia y autorización válidas.

#### RNF-009 — Operaciones sensibles

Las acciones de alto impacto podrán requerir reautenticación o confirmación adicional.

### 4.2. Integridad financiera

#### RNF-010 — Precisión monetaria

No se utilizarán números de punto flotante binario para almacenar o calcular dinero.

#### RNF-011 — Redondeo

Cada moneda respetará sus unidades menores y una política explícita de redondeo.

#### RNF-012 — Atomicidad

Las operaciones financieras deberán completarse totalmente o no aplicarse.

#### RNF-013 — Idempotencia

Repetir una solicitud por error de red no deberá duplicar pagos, aportes o movimientos.

#### RNF-014 — Determinismo

Los mismos datos, reglas y versiones deberán producir el mismo resultado.

#### RNF-015 — Trazabilidad del cálculo

Cada cálculo relevante deberá conservar fórmula, entradas, redondeos y versión de reglas.

#### RNF-016 — Inmutabilidad

La información de períodos cerrados será inmutable salvo mediante un proceso autorizado de reapertura.

### 4.3. Auditoría

#### RNF-017 — Contenido

La auditoría deberá registrar actor, acción, fecha y entidad afectada.

#### RNF-018 — Protección

Los registros financieros y de permisos deberán ser resistentes a alteraciones ordinarias.

#### RNF-019 — Tiempo

Los eventos se almacenarán en UTC y se presentarán según la zona horaria configurada.

#### RNF-020 — Historial de permisos

Deberá ser posible reconstruir los permisos efectivos que tenía una persona en una fecha.

#### RNF-021 — Retención

La política de conservación deberá ser documentada y configurable cuando las obligaciones del país lo requieran.

### 4.4. Rendimiento

Los siguientes valores son objetivos iniciales y deberán validarse mediante pruebas de carga:

#### RNF-022 — Operaciones comunes

El 95 % de las operaciones comunes deberá responder en menos de 500 milisegundos en el servidor, sin contar latencia externa.

#### RNF-023 — Panel mensual

El panel mensual deberá estar disponible en menos de dos segundos bajo carga normal.

#### RNF-024 — Simulaciones

Las simulaciones habituales deberán completarse en menos de tres segundos.

#### RNF-025 — Procesos extensos

Los reportes y cálculos extensos podrán ejecutarse en segundo plano e informar su progreso.

### 4.5. Disponibilidad y recuperación

#### RNF-026 — Disponibilidad

La disponibilidad objetivo inicial será de 99,5 % mensual. Se evaluará elevarla a 99,9 % antes de operar como servicio público crítico.

#### RNF-027 — Copias de seguridad

Las copias de seguridad deberán ser automáticas, cifradas y verificadas mediante restauraciones periódicas.

#### RNF-028 — RPO

El objetivo máximo inicial de pérdida de datos será de una hora.

#### RNF-029 — RTO

El objetivo inicial de recuperación del servicio será de cuatro horas.

#### RNF-030 — Aislamiento de fallos

Un fallo en notificaciones, exportaciones o reportes no deberá impedir el registro de operaciones principales.

### 4.6. Escalabilidad

#### RNF-031 — Límites configurables

La cantidad de integrantes, cuentas, monedas, categorías y movimientos no deberá estar codificada de forma fija.

#### RNF-032 — Procesamiento asíncrono

Los procesos intensivos deberán poder ejecutarse fuera del flujo principal de solicitudes.

#### RNF-033 — Escalamiento seguro

El sistema deberá poder escalar sin debilitar el aislamiento entre hogares.

#### RNF-034 — Perfil de carga

Antes de finalizar la arquitectura se deberán definir cantidades objetivo de usuarios concurrentes, hogares y movimientos para realizar pruebas de carga.

### 4.7. Usabilidad y accesibilidad

#### RNF-035 — Diseño adaptable

La interfaz deberá funcionar en computador, tableta y teléfono.

#### RNF-036 — Accesibilidad

La interfaz tendrá como objetivo cumplir WCAG 2.2 nivel AA.

#### RNF-037 — Explicabilidad

Los resultados financieros deberán indicar de dónde provienen y qué reglas utilizaron.

#### RNF-038 — Confirmaciones

Las acciones destructivas, irreversibles o de alto impacto requerirán confirmación clara.

#### RNF-039 — Lenguaje neutral

La interfaz deberá evitar mensajes culpabilizadores o comparaciones que fomenten conflictos entre integrantes.

#### RNF-040 — Mensajes de error

Los errores deberán explicar qué ocurrió y cómo corregirlo sin revelar información técnica sensible.

### 4.8. Internacionalización

#### RNF-041 — Separación entre valor y presentación

Los símbolos, separadores y textos regionales no deberán formar parte del valor financiero almacenado.

#### RNF-042 — Configuraciones independientes

Idioma, país, moneda, formato regional y zona horaria deberán ser independientes.

#### RNF-043 — Unidades monetarias

El sistema deberá soportar monedas con cero, dos, tres u otra cantidad definida de unidades menores.

#### RNF-044 — Núcleo independiente

La lógica financiera principal no deberá depender directamente de COP, TRM o UVR.

#### RNF-045 — Perfiles de país

Las particularidades colombianas deberán implementarse mediante configuración o módulos reemplazables.

### 4.9. Privacidad y cumplimiento

#### RNF-046 — Privacidad desde el diseño

El sistema deberá aplicar mínimo privilegio y protección de datos desde el diseño.

#### RNF-047 — Minimización

Solo se recopilarán datos necesarios para las funcionalidades declaradas.

#### RNF-048 — Consentimientos

Las políticas y consentimientos deberán versionarse cuando su aceptación sea requerida.

#### RNF-049 — Ciclo de vida de los datos

Se deberá documentar dónde se almacenan los datos, cuánto tiempo se conservan y si existen transferencias internacionales.

#### RNF-050 — Contexto colombiano

Antes de publicar el producto deberá evaluarse formalmente la aplicabilidad de las leyes colombianas 1581 de 2012 y 1266 de 2008.

#### RNF-051 — Datos de prueba

Los ambientes de desarrollo y pruebas no deberán utilizar información financiera real sin anonimización.

### 4.10. Mantenibilidad y calidad

#### RNF-052 — Separación de responsabilidades

La arquitectura deberá separar reglas financieras, autorización, presentación e integraciones externas.

#### RNF-053 — Versionado de reglas

Las reglas y fórmulas financieras deberán estar versionadas.

#### RNF-054 — Pruebas automatizadas

Los cálculos, permisos, cierres, conversiones y movimientos deberán contar con pruebas automatizadas.

#### RNF-055 — Migraciones

Las migraciones deberán contar con estrategia de reversión o recuperación verificada.

#### RNF-056 — Integraciones reemplazables

Las fuentes externas de tasas, notificaciones o servicios financieros deberán poder sustituirse sin modificar la lógica principal.

#### RNF-057 — Versionado de interfaces

Las API y formatos de exportación deberán estar documentados y versionados.

### 4.11. Observabilidad

#### RNF-058 — Registros seguros

Los registros técnicos no deberán exponer contraseñas, tokens ni valores financieros innecesarios.

#### RNF-059 — Monitoreo

Se deberán monitorear disponibilidad, tiempos de respuesta, errores y fallos de procesos.

#### RNF-060 — Trazabilidad

Cada operación deberá tener un identificador que permita rastrearla entre componentes.

#### RNF-061 — Alertas técnicas

Las alertas operativas deberán diferenciar fallos funcionales, incidentes de seguridad y errores de integraciones.

---

## 5. Alcance recomendado

### 5.1. MVP

El producto mínimo viable incluirá:

- Hogares e integrantes.
- Roles dinámicos formados por permisos del sistema.
- Ingresos fijos, variables y extraordinarios.
- Gastos individuales, compartidos y recurrentes.
- Pagos parciales y saldos internos.
- Distribución 50/50, proporcional al ingreso y personalizada.
- Deudas con saldo y pago mínimo.
- Objetivos de ahorro y fondo de emergencia.
- Presupuestos, flujo de caja y cierre mensual.
- COP como moneda inicial con arquitectura multimoneda.
- Auditoría, exportación, copias de seguridad y controles de seguridad.

### 5.2. Segunda etapa

- Capacidad disponible avanzada.
- Estrategias de avalancha y bola de nieve.
- Compras complejas a cuotas.
- Créditos en UVR.
- Consulta automática de TRM.
- Notificaciones multicanal.
- Importación de extractos.
- Integraciones con entidades financieras.

### 5.3. Fuera del alcance inicial

- Transferencias reales de dinero.
- Preparación o presentación de declaraciones tributarias.
- Recomendaciones automáticas de inversión.
- Puntaje crediticio propio.
- Contabilidad empresarial.
- Decisiones financieras ejecutadas automáticamente por inteligencia artificial.

---

## 6. Evaluación de riesgos

### 6.1. Autorización

Los roles dinámicos requieren combinar permisos con el contexto del recurso. Tener el permiso `deudas.ver_propias` no autoriza consultar cualquier deuda; el sistema también debe comprobar quién es el propietario.

Este modelo combina:

- Roles configurables.
- Permisos controlados por el sistema.
- Propiedad y alcance de los recursos.
- Políticas de privacidad del hogar.

### 6.2. Integridad monetaria

Redondeos, conversiones, tasas históricas y cierres deben diseñarse antes de construir las interfaces. Un error pequeño puede acumular diferencias o alterar los aportes de los integrantes.

### 6.3. Privacidad entre integrantes

El uso de información privada en cálculos consolidados puede producir resultados difíciles de explicar. Toda cifra oculta utilizada deberá identificarse como tal sin revelar su contenido.

### 6.4. Deudas

Las tasas nominales, efectivas, compras a cuotas y obligaciones en UVR incrementan significativamente la complejidad. Se recomienda implementar primero deudas con saldo, cuota mínima y tasa básica.

### 6.5. Temporalidad

Reglas, permisos, tasas y porcentajes cambian con el tiempo. El sistema deberá conocer qué versión estaba vigente cuando se realizó o cerró cada operación.

---

## 7. Decisiones pendientes

Antes de aprobar estos requerimientos se deberá decidir:

1. Si existirán permisos individuales excepcionales además de los roles.
2. Si los cambios de alto impacto necesitarán aprobación de más de un integrante.
3. Qué información mínima puede permanecer privada.
4. Qué conceptos reducen la capacidad disponible.
5. Cómo se compensarán los saldos internos.
6. Cuándo y por quién puede reabrirse un período.
7. Qué operaciones exigirán autenticación multifactor.
8. Cuánto tiempo se conservará la auditoría.
9. Qué escala inicial se utilizará para las pruebas de rendimiento.
10. Qué formatos de exportación estarán disponibles en el MVP.

## 8. Criterio de aprobación

Este documento podrá considerarse aprobado cuando:

1. Los interesados validen el alcance del MVP.
2. Las decisiones pendientes críticas tengan una respuesta.
3. Cada requerimiento funcional crítico esté relacionado con al menos una historia de usuario.
4. Los objetivos no funcionales tengan una forma de verificación.
5. Se hayan definido responsables para seguridad, privacidad y validación financiera.

