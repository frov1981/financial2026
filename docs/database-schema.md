# Esquema de la base de datos

Este documento resume las tablas definidas por las entidades TypeORM de
`ssrfinan`. `PK` identifica la clave primaria y `FK` una clave foranea. Las
relaciones `1..*` son `ManyToOne`/`OneToMany`; las relaciones `1..1` son
`OneToOne`.

## Diagrama relacional

```text
users
  |--< accounts
  |--< categories >-- category_groups
  |--< transactions >-- accounts (account_id)
  |                    `-- accounts (to_account_id, transfers)
  |--< payables >-- payable_groups
  |                 `-- accounts (disbursement_account_id)
  |                 `-- categories
  |                 `-- transactions (transaction_id)
  |--< payable_payments >-- payables
  |                         `-- accounts
  |                         `-- categories
  |                         `-- transactions
  |--< receivables >-- receivable_groups
  |                   `-- accounts (disbursement_account_id)
  |                   `-- categories
  |                   `-- transactions (transaction_id)
  |--< receivable_collections >-- receivables
  |                              `-- accounts
  |                              `-- categories
  |                              `-- transactions
  |--< cache_kpi_balances
  `--< auth_codes

file_references
  `-- referencia polimorfica por table_name + record_id
```

## Tablas principales

### `users`

- `id` PK
- `email` unico
- `password_hash` no se selecciona por defecto
- `name`, `role`, `created_at`

Es la entidad propietaria de cuentas, categorias, transacciones, payables,
receivables, grupos y KPI.

### `accounts`

- `id` PK, `user_id` FK -> `users.id`
- `name`, `type`, `balance`, `is_active`
- `type`: `cash`, `bank`, `card` o `saving`
- Indice `idx_accounts_user_active_type`

Una cuenta puede ser origen o destino de transacciones, cuenta de desembolso
de payables/receivables y cuenta receptora de pagos/cobros.

### `categories` y grupos

`categories` contiene `user_id` FK, `name`, `type`,
`type_for_payable_or_receivable`, `is_active` y `category_group_id` FK.

`category_groups` contiene `user_id` FK, `name` e `is_active`. Un grupo puede
tener muchas categorias y una categoria puede no pertenecer a ningun grupo.

`type` de categoria es `income` o `expense`. La clasificacion adicional puede
ser `payable`, `payable_payment`, `receivable` o `receivable_collection`.

### `transactions`

- `id` PK, `user_id` FK -> `users.id`
- `account_id` FK -> `accounts.id`
- `to_account_id` FK -> `accounts.id`, nullable y usado en transferencias
- `category_id` FK -> `categories.id`, nullable en transferencias
- `type`: `income`, `expense` o `transfer`
- `detailed_type`, `amount`, `date`, `description`, `no_images`, `created_at`

Es la fuente de verdad de los movimientos. `detailed_type` distingue ingresos,
gastos, payables, pagos, receivables, cobros, ahorro, retiro y transferencias.

### `payables` y `payable_groups`

`payables` contiene:

- `id` PK, `user_id` FK -> `users.id`
- `payable_group_id` FK, `disbursement_account_id` FK y `category_id` FK
- `transaction_id` FK -> `transactions.id`
- `total_amount`, `principal_paid`, `interest_paid`, `balance`
- `start_date`, `end_date`, `is_active`, `note`, `created_at`

`payable_groups` pertenece a un usuario y agrupa payables. El payable se
relaciona con un `income_for_payable`; cada pago se guarda por separado.

### `payable_payments`

- `id` PK, `payment_number`
- `payable_id` FK -> `payables.id`
- `account_id` FK -> `accounts.id`
- `transaction_id` FK -> `transactions.id`
- `category_id` FK -> `categories.id`
- `principal_paid`, `interest_paid`, `payment_date`, `note`, `created_at`

Cada fila representa un pago y se vincula a una transaccion
`payment_for_payable`.

### `receivables` y `receivable_groups`

`receivables` contiene:

- `id` PK, `user_id` FK -> `users.id`
- `receivable_group_id` FK, `disbursement_account_id` FK y `category_id` FK
- `transaction_id` FK -> `transactions.id`
- `total_amount`, `principal_received`, `interest_received`, `balance`
- `start_date`, `end_date`, `is_active`, `note`, `created_at`

`receivable_groups` pertenece a un usuario y agrupa receivables. El desembolso
se vincula a una transaccion `expense_for_receivable`.

### `receivable_collections`

- `id` PK, `collection_number`
- `receivable_id` FK -> `receivables.id`
- `account_id` FK -> `accounts.id`
- `transaction_id` FK -> `transactions.id`
- `category_id` FK -> `categories.id`
- `principal_collected`, `interest_collected`, `collection_date`
- `note`, `created_at`

Cada fila representa un cobro y se vincula a una transaccion
`collection_for_receivable`.

### `cache_kpi_balances`

- `id` PK, `user_id` FK -> `users.id`
- `period_year`, `period_month`
- `incomes`, `expenses`, `savings`, `withdrawals`
- `payables`, `payable_payments`, `receivables`, `receivable_collections`
- `total_inflows`, `total_outflows`, `net_cash_flow`, `net_savings`
- `available_balance`, `principal_breakdown`, `interest_breakdown`
- Indice unico `uq_user_period` sobre usuario, año y mes

Es una proyeccion mensual derivada de `transactions`, no una fuente primaria.

### `auth_codes`

- `id` PK, `user_id` FK -> `users.id`
- `code_hash`, `expires_at`, `used_at`, `attempts`, `created_at`

Almacena codigos temporales de autenticacion y sus intentos de validacion.

### `file_references`

- `id` PK
- `table_name`, `record_id`, `path`, `thumbnail_path`
- `original_name`, `mime_type`, `size_bytes`, `created_at`
- Indice `idx_file_references_origin` sobre `table_name`, `record_id`

Es una referencia polimorfica: no declara una FK a una tabla concreta. La
integridad de `table_name` y `record_id` la debe controlar la aplicacion.

## Reglas de consistencia

- Un desembolso de receivable actualiza `receivables`, `accounts` y
  `transactions`.
- Un cobro actualiza `receivable_collections`, `receivables`, `accounts` y
  `transactions`.
- Los pagos de payable siguen el mismo patron con `payable_payments`.
- `cache_kpi_balances` debe reconstruirse desde `transactions` cuando se
  corrigen movimientos historicos.
- Las relaciones de transacciones y documentos adjuntos deben respetar el
  `user_id` autenticado; las FK por si solas no expresan ese aislamiento.

Las entidades son la referencia de estructura para nuevas modificaciones. Si
se agrega una entidad o una restriccion, este documento debe actualizarse junto
con la migracion o el cambio de esquema correspondiente.
