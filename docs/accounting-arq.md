MODELO CONTABLE DEL SISTEMA

## 1. Fuente de verdad: `transactions`

Cada movimiento real se registra en `transactions`. `type` indica el movimiento
físico y `detailed_type` su significado contable:

| `detailed_type` | `type` | Significado |
| --- | --- | --- |
| `income` | `income` | Ingreso ordinario |
| `expense` | `expense` | Gasto ordinario |
| `income_for_payable` | `income` | Préstamo recibido |
| `payment_for_payable` | `expense` | Pago de préstamo |
| `expense_for_receivable` | `expense` | Desembolso a terceros |
| `collection_for_receivable` | `income` | Cobro a terceros |
| `saving` | `transfer` | Transferencia hacia ahorro |
| `withdrawal` | `transfer` | Transferencia desde ahorro |
| `transfer` | `transfer` | Transferencia sin clasificación especial |

Los valores deben coincidir exactamente con los anteriores. El nombre correcto
es `payment_for_payable`, en singular.

## 2. Cuentas y saldo real: `accounts`

`accounts.balance` representa el saldo material de cada cuenta y se actualiza
en la misma transacción de base de datos que el movimiento:

- Un ingreso aumenta la cuenta.
- Un gasto disminuye la cuenta.
- Una transferencia disminuye la cuenta origen y aumenta la destino.
- Un desembolso de receivable disminuye la cuenta de desembolso.
- Un cobro de receivable aumenta la cuenta receptora.
- Ahorro y retiro mueven dinero entre cuentas, sin ser ingreso o gasto ordinario.

Las operaciones normales admiten cuentas activas `cash`, `bank` y `card`; las
transferencias también admiten `saving`.

## 3. Payables

`payables` representa el préstamo recibido y se vincula a
`income_for_payable`. No es un ingreso ordinario.

`payable_payments` representa la devolución y se vincula a
`payment_for_payable`. Cada pago se separa en `principal_paid`, que reduce la
deuda, e `interest_paid`, que representa el costo financiero.

Ambos movimientos afectan la caja, pero no deben mezclarse con ingresos o
gastos ordinarios.

## 4. Receivables y cobros

### 4.1 Alta y modificación

Un `receivable` representa dinero prestado a terceros:

1. Se valida cuenta de desembolso, categoría y monto.
2. Se descuenta `total_amount` de `disbursement_account.balance`.
3. Se crea una transacción `expense_for_receivable`.
4. Se inicializa `balance = total_amount`.

Al modificar monto o cuenta se aplica solo la diferencia contra la cuenta
anterior y se actualiza la transacción vinculada. Al eliminarlo se revierte el
desembolso y se elimina la transacción.

### 4.2 Registro de un cobro

`receivable_collection` representa un cobro asociado:

1. Se valida que principal e intereses respeten el saldo pendiente.
2. `principal_collected` reduce `receivable.balance` y aumenta
  `principal_received`.
3. `interest_collected` aumenta `interest_received`.
4. El total cobrado aumenta la cuenta receptora.
5. Se crea o actualiza una transacción `collection_for_receivable`.
6. Si el principal pendiente llega a cero, el receivable queda inactivo.

Editar un cobro aplica deltas sobre principal, intereses y cuenta. Eliminarlo
revierte el receivable, la cuenta y la transacción asociada.

Un receivable no es ingreso al crearse: el desembolso es una salida de caja y
el ingreso ocurre al registrar el cobro.

## 5. KPI de flujo de caja: `cache_kpi_balances`

La caché se agrupa por `user_id`, año y mes. La consulta clasifica por
`COALESCE(NULLIF(detailed_type, ''), type)`:

- `incomes`: `income` ordinario.
- `expenses`: `expense` ordinario.
- `payables`: `income_for_payable`.
- `payable_payments`: `payment_for_payable`.
- `receivables`: `expense_for_receivable`.
- `receivable_collections`: `collection_for_receivable`.
- `savings`: `saving`.
- `withdrawals`: `withdrawal`.

```text
total_inflows     = incomes + payables + receivable_collections
total_outflows    = expenses + payable_payments + receivables
net_cash_flow     = total_inflows - total_outflows
net_savings       = savings - withdrawals
available_balance = net_cash_flow - net_savings
```

Los cobros son entradas y los desembolsos son salidas. Principal e intereses
son información analítica del préstamo y no deben contarse otra vez como
ingreso o gasto ordinario.

El KPI se recalcula después de insertar, editar o eliminar transacciones,
receivables o cobros. `transactions` es la fuente de verdad y
`cache_kpi_balances` una proyección derivada.

## 6. Flujo general

```text
receivable  --desembolso--> transaction(expense_for_receivable)
                   --> account.balance disminuye

collection  --cobro-------> transaction(collection_for_receivable)
                   --> account.balance aumenta
                   --> receivable.balance disminuye

payable    --recibido-----> transaction(income_for_payable)
payment    --pagado-------> transaction(payment_for_payable)

transactions --> accounts (saldo real)
transactions --> cache_kpi_balances (análisis mensual/acumulado)
```

## 7. Evaluación y puntos a vigilar

El flujo está conceptualmente correcto: cada desembolso o cobro tiene una
transacción, actualiza la cuenta correspondiente y recalcula los KPI. Las
operaciones de alta, edición y eliminación usan `QueryRunner` para mantener
consistencia entre entidades relacionadas.

Hay dos detalles importantes:

1. `available_balance` es el resultado del período seleccionado y se acumula
  por períodos en home; no es necesariamente el saldo actual de todas las
  cuentas.
2. `AccountBalanceService.getNetAvailableBalance` suma solo cuentas activas
  `cash` y `bank`. Las operaciones también actualizan `card`, por lo que ese
  servicio puede diferir del saldo agregado de cuentas operativas. Debe
  definirse si `card` se incluye y homogeneizar el criterio con la UI y los
  KPI.

Conviene mantener pruebas de estas invariantes:

- saldo de cuenta antes y después de cada desembolso y cobro;
- `balance + principal_received = total_amount`;
- una única transacción asociada a cada desembolso o cobro;
- recálculo correcto del mes afectado al cambiar una fecha.

## 8. Capas del sistema

**Capa operativa:** `transactions`, `accounts`, `receivables`,
`receivable_collections`, `payables` y `payable_payments`.

**Capa analítica:** `cache_kpi_balances` y las cachés de listados y home. Las
cachés se pueden invalidar o reconstruir; no son la fuente primaria.
