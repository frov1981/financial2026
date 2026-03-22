MODELO CONTABLE DEL SISTEMA

1. FUENTE DE VERDAD → transactions
Cada registro representa un movimiento real:
- income → entra dinero
- expense → sale dinero
- transfer → mueve dinero entre cuentas
No clasifica completamente el negocio, solo el flujo bruto.

2. CLASIFICACIÓN → loans / loan_payments
loans:
- Vincula una transacción (income)
- Representa préstamo recibido (no ingreso real)

loan_payments:
- Vincula una transacción (expense)
- Representa pago de préstamo (no gasto real)
- Divide en:
  - principal_paid
  - interest_paid

3. CUENTAS → accounts
Reflejan el dinero real disponible.

Fórmula:
income + loan + transfer_in
- expense - payment - transfer_out

4. KPI → cache_kpi_balances
Agrupación por:
user_id + año + mes

Separación:
- incomes → income SIN loans
- expenses → expense SIN payments
- loans → transactions vinculadas a loans
- payments → transactions vinculadas a loan_payments
- savings → transfer hacia cuenta saving
- withdrawals → transfer desde saving

5. MÉTRICAS
total_inflows  = incomes + loans
total_outflows = expenses + payments
net_cash_flow  = inflows - outflows
net_savings    = savings - withdrawals
available_balance = net_cash_flow - net_savings

6. PRÉSTAMOS (ANÁLISIS)
principal_breakdown → reduce deuda
interest_breakdown → costo financiero

No afectan flujo de caja.

FLUJO GENERAL
transactions → clasificación → loans / loan_payments
             → accounts (dinero real)
             → cache_kpi_balances (análisis)

REGLA CLAVE
income ≠ loan
expense ≠ payment

Se separan usando JOIN, no por tipo.

CAPAS DEL SISTEMA
Capa real:
- transactions
- accounts

Capa analítica:
- loans
- loan_payments
- cache_kpi_balances
