# Arquitectura: Controllers, Entities y Views

Esta documentación describe los patrones usados en el proyecto `ssrfinan` para controlar la interacción entre controladores (`controllers`), entidades (`entities`) y vistas (`views`). Se incluyen 
#### conceptos clave, convenciones y ejemplos.

---

## 📁 Entidades (TypeORM / class-validator)

Las entidades representan las tablas de la base de datos y están definidas en `src/entities`. Cada clase:

1. **Decoradores TypeORM**
   - `@Entity('table_name')` para mapear la tabla.
   - `@PrimaryGeneratedColumn()` para clave primaria automática.
   - `@Column()` con tipos, transformadores y valores por defecto.
   - `@ManyToOne`, `@OneToMany`, `@JoinColumn` y relaciones diversas según el dominio (e.g., `User`, `Account`, `Transaction`).
   - Índices con `@Index(...)` para consultas frecuentes.

2. **Validación de datos**
   - Se usan decoradores de `class-validator` (`@IsNotEmpty`, `@IsBoolean`, `@IsIn`, etc.) para reglas de validación declarativas a nivel de entidad.
   - Los mensajes de error se definen en español.

3. **Transformadores**
   - Se puede usar un `DecimalTransformer` para convertir decimales entre la base de datos y JavaScript.

> Ejemplo (simplificado de `Account.entity.ts`):
> ```ts
> @Entity('accounts')
> export class Account {
>   @PrimaryGeneratedColumn() id!: number
>   @ManyToOne(() => User, u => u.accounts)
>   @JoinColumn({ name: 'user_id' }) user!: User
>   @Column() @IsNotEmpty() name!: string
>   @Column({ type: 'decimal', transformer: DecimalTransformer }) balance!: number
>   @Column({ default: true }) @IsBoolean() is_active!: boolean
>   // ... relaciones con Transaction, LoanPayment, etc.
> }
> ```

**Normas generales:**

- Cada entidad reside en un archivo independiente nombrado `<Name>.entity.ts`.
- Las relaciones son bidireccionales cuando es pertinente (ej. `user.accounts` y `account.user`).
- Los campos booleanos y enums se validan con `@IsBoolean`/`@IsIn`.
- Los `transformer` se usan para tipos especiales como `decimal`.

---

### 🔍 Análisis completo de entidades y dependencias

Para implementar caché eficazmente es importante conocer cómo se consultan y enlazan las entidades; a continuación se resume cada modelo y su comportamiento típico:

- **User**: nodo raíz. Relaciona a cuentas, categorías, transacciones, préstamos y grupos. Suele usarse en filtros (`where user.id = ?`). No se cachea en forma global (datos sensibles). Dependencias: muchas relaciones *1‑to‑many*.

- **Account**: pertenece a un usuario y agrega `transactions`, `loanPayments` y `loans`. Consultas frecuentes extraen saldo y conteo de transacciones (`createQueryBuilder` con subquery). Ideal para cache por usuario/estado/tipo; las cuentas inactivas cambian raramente.

- **CategoryGroup / Category**: jerarquía de grupos y categorías; ambas tienen `is_active`. Las listas se recuperan para poblar selectores en formularios (`getActiveParentCategoriesByUser`). Las categorías también se usan en subconsultas de transacciones. Cachear la lista de grupos/categorías activas mejora rendimiento de formularios.

- **Transaction**: la entidad más volátil. Incluye relaciones a cuenta, categoría, préstamo y pago. Se crea/actualiza con cada movimiento; las consultas de KPI o saldos leen rangos de fechas. Cachear transacciones completas no es práctico; en su lugar se cachean resultados agregados (sumas, conteos) usando `CacheKpiBalance`.

- **LoanGroup / Loan**: los préstamos pueden agruparse y tener pagos (`LoanPayment`). Los préstamos generan automáticamente una transacción (`OneToOne transaction`). Existe relación padre‑hijo (restructuraciones). El balance de un préstamo depende de pagos y transacción vinculada.

- **LoanPayment**: ligado a un préstamo, cuenta y transacción. Contiene montos de principal e interés y opcionalmente categoría. Se usa para calcular el número de pago y actualizar balances.

- **CacheKpiBalance**: tabla de cache diseñado explícitamente. Guarda métricas financeiras calculadas mensualmente por usuario (ingresos, gastos, etc.). Tiene un índice único `user+period` y se utiliza en servicios de KPI. Actúa como ejemplo a seguir para cualquier otro cache: clave compuesta, regeneración periódica.

- **AuthCode**: códigos 2FA temporales; expiración y contador de intentos. No se cachea; su vida es muy corta y ya tiene campo `expires_at`.

**Patrones de uso y responsabilidad de caché**

1. **Listas estáticas/semistáticas**: cuentas, grupos, categorías (modo `active`). Actualizaciones generan invalidación manual o se recargan bajo demanda.
2. **Agregados**: balances, conteos, KPI. Ya existe `CacheKpiBalance`; se recomienda crear tablas similares si se quiere cachear resultados de consultas pesadas (por ejemplo, `transaction_count` por cuenta). La llave de caché debe incluir `user_id` y/o rango de fechas.
3. **Dependencias transitivas**: la modificación de una `Transaction` provoca recalcular cache relacionado (cuenta, préstamo, KPI). Tener una capa de servicio que orquesta invalidaciones facilita mantener coherencia.
4. **Relaciones uno‑a‑muchos** son el mayor motivo de carga. Cualquier consulta que haga `join` o `subquery` en `transactions`, `loan_payments` o `loans` es candidato para caché de resultados agregados.

> 💡 Nota: la implementación de caché puede apoyarse en el servicio existente `kpi-cache.service.ts`, que ya maneja creación y lectura de `CacheKpiBalance`.

Este análisis servirá de base para decidir qué entidades y consultas colocar bajo un mecanismo de caché (Redis, query caching de TypeORM, tablas de cache, etc.).

---

---

## 🧠 Controladores (Express + TypeORM)

Los controladores están en `src/controllers/<recurso>` y suelen incluir:

1. **Manejo API & páginas**
   - `apiForGettingX` para consultas REST (`res.json(...)`). Normalmente hace `AppDataSource.getRepository(Entity)` y utiliza `QueryBuilder` cuando se requieren subconsultas o joins.
   - `routeToPageX` para renderizar la vista principal (ej. lista) usando `res.render('layouts/main', { view: 'pages/.../index', ... })`.
   - `routeToFormInsertX`, `routeToFormUpdateX`, `routeToFormDeleteX`, etc., para mostrar formularios; llaman a un helper `renderXForm`.
   - Exportan también funciones auxiliares de guardado (`saveX` en `*.saving.ts`) bajo otro nombre (`apiForSaving...`).

2. **Renderización de formularios**
   - Cada controlador define un tipo de parámetros (`XFormViewParams`) que extiende `BaseFormViewParams`.
   - `renderXForm(res, params)` combina datos con políticas (`*FormMatrix`), listas auxiliares (servicios de populate), y llama a `res.render('layouts/main', { ... })`.
   - Políticas (`accountFormMatrix`, `categoryFormMatrix`) determinan qué campos son ocultos/lectura/edición según `mode` (`insert`, `update`, `delete`, etc.).

3. **Validaciones de ruta**
   - Convierten parámetros (`req.params.id`) a `Number`, verifican que sean enteros positivos y que el recurso exista antes de renderizar.
   - Si algo falla, redirigen a la página de lista correspondiente.

4. **Estructura y estilo**
   - Importan utilidades comunes (`logger`, tipos `AuthRequest`, servicios de apoyo, etc.).
   - Registran logs al inicio y al final de cada handler (`logger.debug(...Start)` / `logger.debug(...End)`), y manejan errores con respuestas 500.
   - Las funciones usan `async`/`await` y manejan errores con `try/catch`.

> Ejemplo modelo de controlador (`account.controller.ts`):
> ```ts
> export const routeToFormInsertAccount: RequestHandler = async (req, res) => {
>   const mode = 'insert'
>   const auth_req = req as AuthRequest
>   return renderAccountForm(res, {
>     title: 'Insertar Cuenta',
>     view: 'pages/accounts/form',
>     account: { type: null, is_active: true },
>     errors: {},
>     mode,
>     auth_req
>   })
> }
> ```

**Convenciones adicionales:**

- Nombres de exportaciones `apiForGettingX`, `routeToPageX`, `routeToFormX` facilitan la lectura y el mapeo en rutas.
- Los controladores delegan la lógica de persistencia a `saving` cuando se trata de `POST`/`PUT`/`DELETE`.
- Se usa la interfaz `AuthRequest` para acceder a `req.user` con tipado.

---

## 🎨 Vistas (EJS + partials)

Las vistas residen bajo `src/views/pages/...` y están integradas dentro de un layout común `layouts/main.ejs`.

1. **Estructura básica**
   - Las páginas de lista (`index.ejs`) contienen marcos para tarjetas móviles y tablas de escritorio;
   - Las páginas de formulario (`form.ejs`) reutilizan fragmentos de lógica para mostrar campos dinámicos según la política.
   - Se inyectan variables globales como `USER_ID` en un `<script>` al principio para el frontend JS.

2. **Políticas de formulario**
   - El template del formulario evalúa `account_form_policy` (u otro) para decidir si un campo es `hidden`, `read` o `edit`.
   - Helpers de EJS (`isHidden`, `isReadOnly`, `isEditable`) facilitan la condición de renderizado.
   - Error messages se muestran junto a cada campo con `errors?.campo`.

3. **Recursos estáticos y JavaScript**
   - Cada view inyecta scripts específicos (`/js/forms/account-form.js`, `/js/indexes/accounts-index.js`), los cuales implementan comportamiento dinámico e interacciones AJAX.
   - Se usan partials reutilizables (botones, buscadores, toggles) bajo `src/views/partials`.

4. **Responsividad**
   - El HTML está preparado para mobile/desktop con contenedores `.ui-page`, `.ui-header`, `.ui-scroll-area`, y templating condicional para tarjetas vs tabla.

> Fragmento de `form.ejs` mostrando uso de políticas:
> ```ejs
> <% if (isEditable('name')) { %>
>   <input type="text" name="name" value="<%= account?.name || '' %>" ...>
> <% } else { %>
>   <input type="text" name="name" value="<%= account?.name || '' %>" readonly>
> <% } %>
> ```

---

## 🔁 Flujo general de una operación CRUD

1. El usuario visita `/resources` → `routeToPageResource` renderiza el índice.
2. El frontend carga datos llamando a `apiForGettingResources` y luego pinta la tabla/tarjetas.
3. El usuario hace clic en "Nuevo" o "Editar" → se solicita `/resources/insert` o `/resources/update/:id`.
4. El servidor ejecuta `routeToFormInsertResource`/`routeToFormUpdateResource`:
   - valida parámetros;
   - obtiene datos de la entidad si procede;
   - llama a `renderResourceForm` con datos y políticas.
5. El formulario HTML se envía a `/resources` con método POST.
6. El archivo `resources.saving.ts` procesa la petición, aplica validaciones (usando la entidad y la política), guarda/modifica/elimina el registro.
7. Tras éxito, el controlador responde con redirección o JSON, y el frontend actualiza la UI.

---

## 🛠 Servicios y utilidades auxiliares

- **Servicios (`src/services`)**: funciones para poblar combos (`getActiveParentCategoriesByUser`), cálculo de saldos, envío de correos, etc.
- **Políticas (`src/policies`)**: matrices con reglas por modo (`insert`/`update`/`delete`) que determinan la visibilidad y editabilidad de campos en los formularios.
- **Middlewares**: autenticación (`session-auth.middleware.ts`), logging, inyección de balances (`inject-loan-balance.middleware.ts`).
- **Utilidades** (`src/utils`): manejo de errores SQL, generación de hashes, fechas, logger central.

---

## 💡 Consejos y patrones recurrentes

- **Reutilización**: la función `renderXForm` y los partials evitan duplicación de HTML.
- **Política + Entidad**: la validación se divide: la política controla la UI; `class-validator` asegura integridad en el backend.
- **Seguridad**: sólo el usuario dueño (`where: { user: { id: auth_req.user.id } }`) accede/modifica sus recursos.
- **Segragación por carpetas**: cada recurso (accounts, categories, loans, etc.) tiene su propio subdirectorio con controlador, guardado y validaciones.
- **Tipos**: se usan alias (`AuthRequest`, `BaseFormViewParams`) para mantener tipado en todo el stack.

---

Esta documentación debe servir como guía para comprender y extender el sistema. Mantener el patrón coherente facilita añadir nuevos recursos y asegurar la consistencia entre frontend y backend.

---

## 🗄️ Esquema de la base de datos

Para ver las tablas y sus relaciones de forma visual se ha creado un diagrama
ASCII independiente. Revisa el archivo `database-schema.md` dentro de esta
carpeta de `docs`:

```markdown
[docs/database-schema.md](./database-schema.md)
```

El esquema se actualiza manualmente cuando se añaden o modifican entidades.
