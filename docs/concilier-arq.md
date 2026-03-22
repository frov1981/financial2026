-- ==================================================================
-- PROCESO CONCILIATORIO PARA LOS NUMEROS DE PAGOS
-- ==================================================================
-- Paso 1: sacar del rango positivo
UPDATE loan_payments
SET payment_number = payment_number + 1000000;
-- Paso 2: recalcular correctamente
UPDATE loan_payments lp
  JOIN (
	  SELECT id, ROW_NUMBER() OVER ( PARTITION BY loan_id ORDER BY payment_date ASC, id ASC ) AS new_payment_number
	  FROM loan_payments
   ) t ON lp.id = t.id
 SET lp.payment_number = t.new_payment_number;
 
-- ==================================================================
-- PROCESO CONCILIATORIO PARA LOS PAGOS Y BALANCES DE PRESTAMOS
-- ==================================================================
-- Paso 1: actualizar la suma total de pagos en los prestamos
UPDATE loans l
  LEFT JOIN ( SELECT loan_id, SUM(principal_paid) AS total_principal FROM loan_payments GROUP BY loan_id ) p 
    ON l.id = p.loan_id
    SET l.principal_paid = COALESCE(p.total_principal, 0);
-- Paso 2: actualizar el balance de cada prestamo
UPDATE loans
SET balance = total_amount - principal_paid;

-- ==================================================================
-- PROCESO CONCILIATORIO PARA BALANCES DE LAS CUENTAS
-- ==================================================================
-- Paso 1: actualizar las cuentas de balance de cada usuario
UPDATE accounts a
  LEFT JOIN (
  SELECT acc_id, SUM(balance_change) AS balance
  FROM (    
    SELECT t.account_id AS acc_id,
      CASE 
        WHEN t.type IN ('income','loan') THEN t.amount
        WHEN t.type IN ('expense','payment') THEN -t.amount
        WHEN t.type='transfer' THEN -t.amount
        ELSE 0
      END AS balance_change
     FROM transactions t
    WHERE t.account_id IS NOT NULL
    UNION ALL
    SELECT t.to_account_id AS acc_id, t.amount AS balance_change
      FROM transactions t
     WHERE t.type='transfer'
       AND t.to_account_id IS NOT NULL
  ) x
  GROUP BY acc_id
) calc ON a.id = calc.acc_id
SET a.balance = COALESCE(calc.balance,0);
-- Paso 2: verificar el resultado
SELECT a.user_id, a.id, a.name, a.balance
  FROM accounts a
 ORDER BY a.user_id, a.id;


-- ==================================================================
-- PROCESO CONCILIATORIO PARA KPI POR PERIODOS (AÑOS Y MESES)
-- ==================================================================
TRUNCATE TABLE cache_kpi_balances;
INSERT INTO cache_kpi_balances (user_id,period_year,period_month,incomes,expenses,savings,withdrawals,loans,payments,total_inflows,total_outflows,net_cash_flow,net_savings,available_balance,principal_breakdown,interest_breakdown)
SELECT
user_id,
y,
m,
incomes,
expenses,
savings,
withdrawals,
loans,
payments,
(incomes+loans),
(expenses+payments),
(incomes+loans-expenses-payments),
(savings-withdrawals),
((incomes+loans-expenses-payments)-(savings-withdrawals)),
principal_paid,
interest_paid
FROM (
SELECT
user_id,
YEAR(d) y,
MONTH(d) m,
SUM(incomes) incomes,
SUM(expenses) expenses,
SUM(savings) savings,
SUM(withdrawals) withdrawals,
SUM(loans) loans,
SUM(payments) payments,
SUM(principal_paid) principal_paid,
SUM(interest_paid) interest_paid
FROM (
SELECT t.user_id,t.date d,t.amount incomes,0 expenses,0 savings,0 withdrawals,0 loans,0 payments,0 principal_paid,0 interest_paid
FROM transactions t
LEFT JOIN loans l ON l.transaction_id=t.id
WHERE t.type='income' AND l.id IS NULL
UNION ALL
SELECT t.user_id,t.date,0,t.amount,0,0,0,0,0,0
FROM transactions t
LEFT JOIN loan_payments lp ON lp.transaction_id=t.id
WHERE t.type='expense' AND lp.id IS NULL
UNION ALL
SELECT t.user_id,t.date,0,0,t.amount,0,0,0,0,0
FROM transactions t
JOIN accounts a_to ON a_to.id=t.to_account_id
WHERE t.type='transfer' AND a_to.type='saving'
UNION ALL
SELECT t.user_id,t.date,0,0,0,t.amount,0,0,0,0
FROM transactions t
JOIN accounts a_from ON a_from.id=t.account_id
JOIN accounts a_to ON a_to.id=t.to_account_id
WHERE t.type='transfer' AND a_from.type='saving' AND a_to.type<>'saving'
UNION ALL
SELECT t.user_id,t.date,0,0,0,0,t.amount,0,0,0
FROM transactions t
JOIN loans l ON l.transaction_id=t.id
UNION ALL
SELECT t.user_id,t.date,0,0,0,0,0,t.amount,0,0
FROM transactions t
JOIN loan_payments lp ON lp.transaction_id=t.id
UNION ALL
SELECT l.user_id,lp.payment_date,0,0,0,0,0,0,lp.principal_paid,lp.interest_paid
FROM loan_payments lp
JOIN loans l ON l.id=lp.loan_id
) m
GROUP BY user_id,YEAR(d),MONTH(d)
) x;