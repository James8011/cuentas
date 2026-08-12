# Historias de usuario — Sistema de finanzas para hogares

## 1. Información del documento

- **Producto:** Sistema de gestión financiera para parejas y hogares.
- **Mercado inicial:** Colombia.
- **Alcance internacional:** Soporte para múltiples países, monedas, formatos regionales y zonas horarias.
- **Estado:** Borrador inicial para validación funcional.
- **Propósito:** Definir las necesidades del producto antes del diseño técnico y la implementación.

## 2. Visión del producto

El sistema permitirá que dos o más integrantes de un hogar administren ingresos, gastos, deudas, presupuestos y objetivos de ahorro sin perder su autonomía financiera.

La solución debe facilitar acuerdos transparentes y configurables. No debe asumir que todos los hogares dividen sus obligaciones en partes iguales ni que todas las deudas pertenecen a todos sus integrantes.

Aunque Colombia será el contexto inicial, las reglas de negocio no deben depender directamente de COP, del idioma español ni de condiciones regulatorias exclusivamente colombianas.

## 3. Principios funcionales

1. Separar la propiedad legal de una obligación de la responsabilidad acordada para pagarla.
2. Diferenciar información individual, compartida y consolidada.
3. Conservar el valor y la moneda originales de cada movimiento.
4. Mantener el historial de reglas, tasas y porcentajes aplicados.
5. No modificar períodos cerrados al cambiar una configuración.
6. Permitir diferentes interpretaciones de una distribución justa.
7. Utilizar roles dinámicos formados por permisos configurables.
8. Proteger la privacidad sin ocultar información necesaria para calcular compromisos conjuntos.
9. Informar y proyectar sin presentarse como asesoría financiera, tributaria o legal.

## 4. Roles y modelo de autorización

El sistema no tendrá roles funcionales estáticos. Cada hogar podrá crear roles con nombres y permisos personalizados.

Un rol estará compuesto por:

- Nombre y descripción.
- Conjunto de permisos.
- Alcance dentro del hogar.
- Estado activo o inactivo.
- Fecha de creación y modificación.
- Historial de cambios.

Al crear un hogar, el sistema asignará temporalmente al creador todos los permisos necesarios para administrarlo. Posteriormente podrá crear y asignar sus propios roles.

### Reglas generales de autorización

- Cada integrante podrá tener uno o varios roles.
- Los permisos efectivos serán la unión de los permisos concedidos por sus roles.
- Una denegación explícita, si se implementa, prevalecerá sobre los permisos concedidos.
- Los permisos deberán validarse tanto en la interfaz como en el servidor.
- Los cambios en roles y permisos deberán quedar auditados.
- Siempre deberá existir al menos un integrante capaz de administrar roles y permisos.
- Los permisos sobre información propia serán independientes de los permisos sobre información de otros integrantes.

### Catálogo inicial de permisos

El catálogo podrá ampliarse sin cambiar la estructura de roles:

- `hogar.ver`
- `hogar.editar`
- `hogar.eliminar`
- `miembros.ver`
- `miembros.gestionar`
- `miembros.crear`
- `roles.ver`
- `roles.gestionar`
- `ingresos.ver_propios`
- `ingresos.ver_compartidos`
- `ingresos.ver_ajenos`
- `ingresos.crear`
- `ingresos.editar_propios`
- `ingresos.editar_ajenos`
- `ingresos.eliminar`
- `gastos.ver_propios`
- `gastos.ver_compartidos`
- `gastos.ver_ajenos`
- `gastos.crear`
- `gastos.editar`
- `gastos.eliminar`
- `gastos.registrar_pago`
- `deudas.ver_propias`
- `deudas.ver_compartidas`
- `deudas.ver_ajenas`
- `deudas.ver_totales`
- `deudas.crear`
- `deudas.editar`
- `deudas.planificar`
- `reglas.ver`
- `reglas.simular`
- `reglas.aplicar`
- `ahorros.ver_propios`
- `ahorros.ver_compartidos`
- `ahorros.ver_ajenos`
- `ahorros.gestionar`
- `presupuestos.ver`
- `presupuestos.gestionar`
- `cierres.ejecutar`
- `cierres.reabrir`
- `auditoria.ver`
- `datos.exportar`

## 5. Convenciones de las historias

### Prioridades

- **Crítica:** necesaria para operar o para evitar errores estructurales.
- **Alta:** aporta valor importante y debe incorporarse poco después del núcleo.
- **Media:** conveniente, pero puede esperar sin impedir la operación inicial.
- **Posterior:** funcionalidad especializada que se evaluará después del MVP.

### Estados

- Propuesta.
- En validación.
- Aprobada.
- En desarrollo.
- Terminada.
- Descartada.

Todas las historias de este documento se encuentran inicialmente **en validación**.

---

## 6. Épica: hogares, miembros y autorización

### HU-00 — Administrar roles y permisos dinámicos

**Como** integrante con autorización para administrar accesos,  
**quiero** crear y modificar roles mediante permisos específicos,  
**para** adaptar el acceso a la forma de organización del hogar.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se puede crear un rol con nombre, descripción y permisos.
2. Se puede editar, duplicar, activar y desactivar un rol.
3. Se puede asignar uno o varios roles a un integrante.
4. El cambio de permisos se refleja sin modificar registros históricos.
5. Toda modificación identifica quién la realizó y cuándo.
6. El sistema impide dejar el hogar sin una persona autorizada para administrar accesos.
7. No se permite obtener acceso a información ajena únicamente mediante manipulación de la interfaz.

### HU-01 — Crear un hogar

**Como** usuario,  
**quiero** crear un hogar con país, moneda principal, zona horaria y configuración regional,  
**para** administrar sus finanzas bajo un contexto común.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Colombia y COP se sugieren inicialmente, pero pueden modificarse.
2. País, moneda, idioma y zona horaria se almacenan como configuraciones independientes.
3. El creador recibe los permisos iniciales para administrar el hogar.
4. Un usuario puede pertenecer a más de un hogar.

### HU-02 — Crear integrantes con teléfono y rol

**Como** integrante con permiso para gestionar miembros,  
**quiero** crear una cuenta mediante un número de teléfono y asignarle un rol,  
**para** que la persona pueda ingresar al hogar con ese usuario.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Solamente un integrante con `miembros.crear` puede crear la cuenta.
2. La creación solicita nombre, país, número de teléfono y credencial inicial.
3. El teléfono se normaliza al formato internacional E.164.
4. La cuenta debe recibir al menos un rol activo durante su creación.
5. El sistema no permite crear dos cuentas con el mismo teléfono normalizado.
6. La cuenta inicia en estado `activo` y puede iniciar sesión de inmediato.
7. No se exige verificación del número telefónico para ingresar.
8. Una cuenta suspendida no puede acceder a información financiera.
9. La creación, el rol inicial y sus responsables quedan auditados.
10. No existe autorregistro público: las cuentas son creadas desde la administración del hogar.
11. El MVP no envía ni gestiona invitaciones.

**Reglas de negocio:**

- Crear una cuenta no equivale a enviar una invitación.
- La asignación inicial de rol es obligatoria.
- Quien crea la cuenta entrega el teléfono y la credencial inicial a la persona.
- Si el teléfono ya está registrado, el sistema no lo agrega silenciosamente a otro hogar.
- La vinculación de cuentas existentes entre hogares se resolverá mediante un flujo futuro de consentimiento.

### HU-03 — Configurar privacidad individual

**Como** integrante,  
**quiero** controlar la visibilidad de mi información individual,  
**para** conservar autonomía sin impedir los cálculos acordados por el hogar.

**Prioridad:** Alta.

**Criterios de aceptación:**

1. La información puede ser detallada, resumida o privada según permisos y políticas.
2. Una obligación privada puede aportar un total anónimo al cálculo de capacidad.
3. El sistema informa cuando un cálculo contiene valores no desglosados.
4. Ningún integrante puede cambiar la privacidad de otro sin autorización.

---

## 7. Épica: ingresos

### HU-04 — Registrar ingresos

**Como** integrante autorizado,  
**quiero** registrar ingresos fijos o variables,  
**para** conocer mi capacidad económica real.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se admiten frecuencias mensuales, quincenales, semanales, únicas e irregulares.
2. Se registran valor bruto, valor neto, moneda, fuente y fechas esperada y efectiva.
3. Se distingue entre ingreso individual y compartido.
4. Un ingreso en moneda extranjera conserva su valor original.

### HU-05 — Registrar ingresos extraordinarios

**Como** integrante,  
**quiero** registrar primas, cesantías, bonificaciones y otros ingresos extraordinarios,  
**para** decidir expresamente cómo utilizarlos.

**Prioridad:** Alta.

**Criterios de aceptación:**

1. El ingreso se marca como recurrente o extraordinario.
2. Un ingreso extraordinario no cambia automáticamente los porcentajes regulares.
3. Puede asignarse total o parcialmente a deudas, ahorros, gastos o dinero personal.

---

## 8. Épica: gastos y pagos

### HU-06 — Crear gastos individuales y compartidos

**Como** integrante autorizado,  
**quiero** registrar gastos e identificar a quién corresponden,  
**para** calcular correctamente las responsabilidades.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se registra valor, moneda, categoría, fecha, responsable y beneficiario.
2. El gasto puede ser individual, compartido o distribuido de forma personalizada.
3. Se diferencia entre gasto esencial y discrecional.
4. Crear el gasto no implica que ya haya sido pagado.

### HU-07 — Programar gastos recurrentes

**Como** integrante autorizado,  
**quiero** programar obligaciones periódicas,  
**para** anticipar el flujo de caja.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se configura frecuencia, fecha de inicio, fecha final y vencimiento.
2. Cada ocurrencia puede conservar el valor estimado o ser ajustada.
3. Modificar la recurrencia no cambia ocurrencias pagadas o cerradas.

### HU-08 — Registrar quién realizó un pago

**Como** integrante,  
**quiero** indicar quién pagó realmente una obligación,  
**para** conocer los saldos pendientes entre integrantes.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. El pagador puede ser diferente de los responsables del gasto.
2. Se permiten pagos parciales y múltiples pagadores.
3. El sistema calcula cuánto adelantó o debe cada integrante.
4. Los saldos internos no se confunden con deudas financieras.

### HU-09 — Registrar compras a cuotas

**Como** integrante,  
**quiero** registrar compras financiadas,  
**para** proyectar su impacto en períodos futuros.

**Prioridad:** Alta.

**Criterios de aceptación:**

1. Se registra valor, número de cuotas, tasa, cargos y responsable.
2. Se proyectan las cuotas futuras sin marcarlas como pagadas.
3. Se distingue la compra compartida del medio de pago individual.

---

## 9. Épica: reglas de aportación

### HU-10 — Elegir el método de distribución

**Como** hogar,  
**quiero** seleccionar el método para repartir obligaciones compartidas,  
**para** aplicar el acuerdo que consideremos justo.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se admiten 50/50, proporcional al ingreso, proporcional a capacidad, porcentajes personalizados y valores fijos.
2. Se pueden aplicar reglas diferentes por categoría.
3. Los porcentajes aplicables deben sumar el 100 %.
4. El resultado muestra el valor correspondiente a cada integrante.

### HU-11 — Calcular la capacidad disponible

**Como** hogar,  
**quiero** calcular aportes después de obligaciones individuales acordadas,  
**para** no comprometer recursos indispensables.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. La fórmula indica qué conceptos se descuentan.
2. Se pueden considerar pagos mínimos, obligaciones legales y mínimos personales.
3. Los gastos discrecionales no se descuentan automáticamente.
4. Los pagos adicionales de deuda requieren un acuerdo explícito.

### HU-12 — Simular reglas

**Como** hogar,  
**quiero** comparar métodos antes de aplicarlos,  
**para** entender su impacto.

**Prioridad:** Alta.

**Criterios de aceptación:**

1. La simulación no modifica información real.
2. Se comparan aportes, disponibilidad, ahorro y déficit.
3. Se muestran los supuestos y valores empleados.

### HU-13 — Programar la vigencia de reglas

**Como** integrante autorizado,  
**quiero** establecer cuándo entra en vigor una regla,  
**para** preservar el historial financiero.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Cada regla tiene fecha de inicio y final opcional.
2. No pueden existir reglas incompatibles activas para el mismo alcance.
3. Los períodos cerrados conservan la regla utilizada originalmente.
4. La activación queda auditada.

---

## 10. Épica: deudas

### HU-14 — Registrar una deuda

**Como** integrante autorizado,  
**quiero** registrar una deuda y sus condiciones,  
**para** proyectar pagos e intereses.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se registra acreedor, titular, saldo, moneda, tasa, cuota mínima y fechas.
2. Se identifica el tipo y periodicidad de la tasa.
3. Se admiten cargos adicionales.
4. Se mantiene historial del saldo y de los pagos.

### HU-15 — Clasificar la responsabilidad de una deuda

**Como** hogar,  
**quiero** diferenciar propiedad legal y responsabilidad acordada,  
**para** evitar que una ayuda se interprete como cambio de titularidad.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. La deuda puede ser individual, conjunta o individual con apoyo del hogar.
2. El titular legal se registra independientemente de la distribución.
3. Cambiar el acuerdo de pago no altera al titular.

### HU-16 — Comparar estrategias de pago

**Como** hogar,  
**quiero** comparar avalancha, bola de nieve y orden personalizado,  
**para** elegir una estrategia sostenible.

**Prioridad:** Alta.

**Criterios de aceptación:**

1. Se muestra fecha estimada de finalización.
2. Se muestran capital, intereses y costo total proyectado.
3. Se pueden simular abonos adicionales.
4. Las proyecciones muestran sus supuestos.

### HU-17 — Manejar tasas colombianas

**Como** usuario colombiano,  
**quiero** registrar tasas efectivas y nominales con su periodicidad,  
**para** representar correctamente mis créditos.

**Prioridad:** Alta.

**Criterios de aceptación:**

1. Se indica si una tasa es efectiva o nominal.
2. Se almacena su periodicidad y fecha de vigencia.
3. Toda conversión identifica la tasa original.
4. La interfaz colombiana prioriza la tasa efectiva anual cuando corresponda.

### HU-18 — Registrar créditos indexados a UVR

**Como** usuario colombiano,  
**quiero** registrar obligaciones expresadas en UVR,  
**para** proyectarlas sin tratarlas como créditos fijos en COP.

**Prioridad:** Posterior, salvo necesidad inmediata.

**Criterios de aceptación:**

1. Se conserva el saldo original en la unidad indexada.
2. Cada conversión a COP utiliza el valor de la UVR correspondiente a una fecha.
3. La proyección distingue variación de la unidad e intereses.

---

## 11. Épica: ahorro y objetivos

### HU-19 — Crear objetivos de ahorro

**Como** integrante autorizado,  
**quiero** crear objetivos individuales o compartidos,  
**para** planificar aportes y fechas.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se define valor objetivo, moneda, fecha y participantes.
2. Se registran aportes de uno o varios integrantes.
3. Se muestra progreso y aporte periódico sugerido.

### HU-20 — Configurar un fondo de emergencia

**Como** hogar,  
**quiero** definir un fondo de emergencia basado en gastos esenciales,  
**para** afrontar eventos inesperados.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se define el número objetivo de meses.
2. El cálculo usa categorías esenciales configurables.
3. Se muestra el monto actual, objetivo y faltante.
4. Un retiro reduce el progreso y puede generar un plan de reposición.

### HU-21 — Distribuir excedentes

**Como** hogar,  
**quiero** distribuir el dinero sobrante entre objetivos, deudas y fondos personales,  
**para** ejecutar nuestras prioridades.

**Prioridad:** Alta.

**Criterios de aceptación:**

1. Solo se distribuye dinero no reservado para obligaciones.
2. Se admiten porcentajes, prioridades o valores fijos.
3. La distribución puede simularse antes de confirmarse.

---

## 12. Épica: presupuesto y seguimiento

### HU-22 — Crear un presupuesto

**Como** hogar,  
**quiero** establecer límites por período y categoría,  
**para** comparar el plan con la ejecución real.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Existen presupuestos individuales y compartidos.
2. Se compara valor presupuestado, comprometido y pagado.
3. Se permite copiar un presupuesto a un período futuro.

### HU-23 — Consultar flujo de caja

**Como** integrante,  
**quiero** visualizar ingresos y egresos por fecha,  
**para** prevenir faltantes temporales.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se muestran movimientos reales y proyectados.
2. Se identifican días con saldo insuficiente.
3. La vista admite diferentes cuentas y monedas.

### HU-24 — Cerrar un período

**Como** integrante autorizado,  
**quiero** cerrar un período financiero,  
**para** conservar una fotografía verificable de sus resultados.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. El cierre guarda ingresos, gastos, aportes, ahorros, deudas y reglas aplicadas.
2. Un cierre no puede modificarse sin un proceso autorizado de reapertura.
3. La reapertura requiere permiso específico y queda auditada.

### HU-25 — Recibir alertas

**Como** integrante,  
**quiero** recibir alertas relevantes,  
**para** actuar antes de un vencimiento o déficit.

**Prioridad:** Alta.

**Criterios de aceptación:**

1. Se alertan vencimientos, déficit proyectado y desviaciones configurables.
2. Cada integrante configura sus canales y preferencias.
3. Las alertas son informativas y no sugieren endeudamiento automático.

---

## 13. Épica: internacionalización

### HU-26 — Manejar múltiples monedas

**Como** usuario,  
**quiero** registrar operaciones en diferentes monedas,  
**para** consolidar mis finanzas sin perder el valor original.

**Prioridad:** Crítica desde el diseño.

**Criterios de aceptación:**

1. Las monedas se identifican mediante códigos ISO 4217.
2. Se respeta la cantidad de unidades menores y la política de redondeo.
3. Se guarda valor original, tasa, fecha, fuente y valor convertido.
4. Actualizar una tasa no modifica conversiones históricas confirmadas.

### HU-27 — Configurar formatos regionales

**Como** usuario,  
**quiero** visualizar números, fechas y monedas según mi región,  
**para** interpretar correctamente la información.

**Prioridad:** Alta.

**Criterios de aceptación:**

1. El formato visual no modifica los valores almacenados.
2. Idioma, país, moneda y zona horaria se configuran por separado.
3. El formato colombiano usa inicialmente `es-CO`.

### HU-28 — Gestionar tasas de cambio

**Como** usuario,  
**quiero** usar tasas de referencia o ingresar la tasa real de una operación,  
**para** obtener conversiones verificables.

**Prioridad:** Media.

**Criterios de aceptación:**

1. Se identifica si la tasa fue manual o provino de una fuente externa.
2. En Colombia puede utilizarse la TRM como referencia para USD/COP.
3. La tasa real de la operación puede diferir de la tasa de referencia.

---

## 14. Épica: seguridad, auditoría y cumplimiento

### HU-29 — Gestionar consentimiento y datos personales

**Como** usuario,  
**quiero** conocer y controlar el tratamiento de mis datos,  
**para** ejercer mis derechos de privacidad.

**Prioridad:** Crítica antes de publicación.

**Criterios de aceptación:**

1. Se informa finalidad, tratamiento, conservación y posibles transferencias.
2. El consentimiento queda registrado y versionado cuando sea necesario.
3. Existen mecanismos de consulta, actualización y corrección.
4. La implementación colombiana considera las leyes 1581 de 2012 y 1266 de 2008 según su aplicabilidad.

### HU-30 — Consultar auditoría y exportar datos

**Como** usuario autorizado,  
**quiero** consultar cambios y exportar información,  
**para** conservar control y portabilidad.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. La auditoría registra actor, acción, fecha y entidad afectada.
2. Las modificaciones sensibles incluyen valores anteriores y nuevos cuando sea seguro.
3. La exportación utiliza formatos documentados y legibles.
4. Exportar requiere un permiso específico.

### HU-31 — Proteger el acceso

**Como** usuario,  
**quiero** proteger y recuperar mi cuenta,  
**para** impedir accesos no autorizados.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Las credenciales no se almacenan en texto plano.
2. Se gestionan sesiones, recuperación y revocación de acceso.
3. Se contempla autenticación multifactor.
4. Los datos de hogares diferentes permanecen aislados.

### HU-32 — Auditar cambios de autorización

**Como** integrante autorizado,  
**quiero** consultar asignaciones y cambios de roles y permisos,  
**para** detectar accesos incorrectos.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. Se registra creación, edición, asignación, retiro y desactivación de roles.
2. Se puede conocer qué permisos efectivos tenía un usuario en una fecha.
3. Los registros de auditoría no pueden ser alterados por permisos ordinarios.

### HU-33 — Iniciar sesión con teléfono

**Como** usuario,  
**quiero** utilizar mi teléfono como identificador de acceso,  
**para** iniciar sesión sin depender de un correo electrónico ni verificar el número.

**Prioridad:** Crítica.

**Criterios de aceptación:**

1. La cuenta fue creada previamente por un integrante autorizado y tiene un rol asignado.
2. El sistema normaliza el teléfono al formato internacional E.164; para Colombia utiliza inicialmente el prefijo `+57`.
3. El número normalizado es único entre cuentas activas.
4. El inicio de sesión utiliza el teléfono normalizado y la credencial definida.
5. Si la cuenta está activa, el ingreso es inmediato; no se exige código de verificación telefónica.
6. El correo electrónico es opcional y no funciona como identificador principal de acceso.
7. El teléfono se muestra enmascarado cuando no es necesario revelar el número completo.
8. Un integrante autorizado puede cambiar el teléfono de una cuenta; el cambio queda auditado.
9. Los mensajes de autenticación no revelan si un número está registrado.
10. El teléfono no se utiliza como clave primaria: cada cuenta conserva un identificador interno inmutable.
11. Cambiar el teléfono no altera hogares, roles, transacciones, deudas ni registros de auditoría asociados.
12. No se permite crear una cuenta desde la pantalla pública de inicio de sesión.

**Reglas de negocio:**

- Se almacena una versión normalizada para identificación y una presentación enmascarada para interfaz.
- No se aceptan dos cuentas activas con el mismo número normalizado.
- El MVP no utiliza SMS, WhatsApp ni códigos OTP para autenticación o alta.
- La estructura técnica podrá admitir invitaciones o verificación telefónica en versiones posteriores.
- Los cambios de teléfono deben quedar auditados.

---

## 15. Alcance recomendado

### MVP

- Hogares y miembros.
- Creación de usuarios con teléfono y rol, e inicio de sesión sin verificación telefónica.
- Roles y permisos dinámicos.
- Ingresos fijos, variables y extraordinarios.
- Gastos individuales, compartidos y recurrentes.
- Registro de pagos y saldos internos.
- Distribución 50/50, proporcional, por capacidad y personalizada.
- Deudas, pagos mínimos y responsabilidad.
- Objetivos de ahorro y fondo de emergencia.
- Presupuesto, flujo de caja y cierre mensual.
- Arquitectura multimoneda con COP como valor inicial.
- Auditoría, exportación y controles de seguridad.

### Versiones posteriores

- Invitaciones opcionales por SMS o WhatsApp.
- Verificación telefónica opcional, si se requiere más adelante.
- Compras a cuotas avanzadas.
- Estrategias avanzadas de pago de deuda.
- Créditos en UVR.
- Consulta automática de TRM.
- Notificaciones multicanal.
- Importación de extractos.
- Integraciones con entidades financieras.

### Fuera del alcance inicial

- Transferencias reales de dinero.
- Preparación o presentación de declaraciones tributarias.
- Recomendaciones automáticas de inversión.
- Puntaje crediticio propio.
- Contabilidad empresarial.
- Decisiones financieras ejecutadas automáticamente por inteligencia artificial.

## 16. Reglas pendientes de validación

Antes del diseño técnico deben validarse:

1. Si un integrante puede asignar excepciones de permisos directamente a otro o únicamente mediante roles.
2. Si existirán denegaciones explícitas de permisos.
3. Qué conceptos reducen la capacidad disponible.
4. Cómo se aprueban los cambios de reglas compartidas.
5. Si una transacción compartida necesita aceptación de todos los responsables.
6. Qué información mínima debe mostrarse cuando una deuda es privada.
7. Cómo se compensan los saldos entre integrantes.
8. Qué acciones requieren aprobación de más de una persona.
9. Cuándo se permite reabrir un período.
10. Qué datos se eliminarán y cuáles se conservarán por auditoría.
11. Cómo se recuperará el acceso cuando una persona pierda la credencial.
12. Cómo funcionará en el futuro el consentimiento para vincular una cuenta existente a otro hogar.

## 17. Definiciones

- **Hogar:** espacio financiero compartido por uno o más integrantes.
- **Integrante:** usuario que pertenece a un hogar.
- **Rol:** conjunto configurable de permisos.
- **Permiso:** autorización granular para ejecutar una acción o consultar información.
- **Gasto compartido:** obligación distribuida entre varios integrantes.
- **Propietario legal:** persona titular de una deuda o cuenta.
- **Responsable de pago:** persona que, por acuerdo, aporta a una obligación.
- **Capacidad disponible:** ingreso utilizable después de descuentos expresamente acordados.
- **Período cerrado:** fotografía financiera que no admite cambios ordinarios.
- **Moneda principal:** moneda usada para reportes consolidados.
- **TRM:** tasa de referencia del mercado para USD/COP en Colombia.
- **UVR:** unidad de valor utilizada en Colombia que varía y puede indexar obligaciones.
- **Teléfono normalizado:** número almacenado en formato internacional E.164, por ejemplo `+573001234567`.
- **Identificador interno:** clave inmutable de la cuenta, independiente del teléfono utilizado para iniciar sesión.

