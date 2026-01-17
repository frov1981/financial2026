import os
import json
import pandas as pd

from df_utils import get_column_widths, write_df_to_txt
from sql00_accounts import build_accounts_insert
from sql01_categories import build_bulk_insert_categories_multiline
from sql02_incomes_and_expenses import build_bulk_insert_expense_transactions_multiline, build_bulk_insert_income_transactions_multiline
from sql03_loans import build_bulk_insert_loans_multiline
from sql03_payments import build_bulk_insert_loan_payments_and_update_balance
from sql04_savings_and_withdrawals import build_insert_savings_transactions_sql, build_insert_withdrawals_transactions_sql

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

json_path = os.path.join(BASE_DIR, 'data.json')
sql_path1 = os.path.join(BASE_DIR, 'sql.sql')

txt_path1 = os.path.join(BASE_DIR, '01_acc_income.txt')
txt_path2 = os.path.join(BASE_DIR, '01_acc_expense.txt')
txt_path3 = os.path.join(BASE_DIR, '02_mov_income.txt')
txt_path4 = os.path.join(BASE_DIR, '02_mov_expense.txt')
txt_path5 = os.path.join(BASE_DIR, '03_loan_income.txt')
txt_path6 = os.path.join(BASE_DIR, '03_paym_expense.txt')
txt_path7 = os.path.join(BASE_DIR, '03_inte_expense.txt')
txt_path8 = os.path.join(BASE_DIR, '03_savings.txt')
txt_path9 = os.path.join(BASE_DIR, '03_withdrawals.txt')

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

##########################################################################################
# Leyendo "accounts" del viejo esquema para transformarlo a "categories" hacia nuevo esquema
dfa = pd.DataFrame(data['accounts'])
df_accounts = dfa.copy()
cols = ["id", "moveType", "accountType", "name", "state"]
dfa = dfa[[c for c in cols if c in dfa.columns]]
df1 = dfa[dfa["moveType"] == 1]
df1 = df1.sort_values(by=["name"])
df2 = dfa[dfa["moveType"] == 2]
df2 = df2.sort_values(by=["name"])
##########################################################################################
# Leyendo "moves" del viejo esquema para transformarlo a "transactions" hacia nuevo esquema
dfm = pd.DataFrame(data['moves'])  
dfm["accountType"] = dfm["account"].apply(lambda a: a.get("accountType") if isinstance(a, dict) else None)
dfm["accountName"] = dfm["account"].apply(lambda a: a.get("name") if isinstance(a, dict) else None)
dfm["categoryId"] = dfm["account"].apply(lambda a: a.get("id") if isinstance(a, dict) else None)
df_moves = dfm.copy()
cols = ["id", "trxType", "moveType", "accountType","amount", "movedAt", "accountName"]
dfm = dfm[[c for c in cols if c in dfm.columns]]
df3 = dfm[(dfm["moveType"] == 1) & (dfm["accountType"] == 1) & (dfm["trxType"] == 1)]
df3 = df3.sort_values(by=["accountName"])
df4 = dfm[(dfm["moveType"] == 2) & (dfm["accountType"] == 1) & (dfm["trxType"] == 2)]
df4 = df4.sort_values(by=["accountName"])
###########################################################################################
# Leyendo "moves" del viejo esquema para transformarlo a "loans" y "loan_payments" hacia nuevo esquema
dfl = pd.DataFrame(data['moves'])  
dfl["accountType"] = dfl["account"].apply(lambda a: a.get("accountType") if isinstance(a, dict) else None)
dfl["accountName"] = dfl["account"].apply(lambda a: a.get("name") if isinstance(a, dict) else None)
df_loans = dfl.copy()
cols = ["id", "trxType", "moveType", "accountType","amount", "movedAt", "accountName"]
dfl = dfl[[c for c in cols if c in dfl.columns]]
df5 = dfl[(dfl["moveType"] == 1) & (dfl["accountType"] == 3) & (dfl["trxType"].isin([1,7]))]
df5 = df5.sort_values(by=["accountName"])
df6 = dfl[(dfl["moveType"] == 2) & (dfl["accountType"] == 4) & (dfl["trxType"].isin([2,6]))]
df6 = df6.sort_values(by=["accountName"])
df7 = dfl[(dfl["moveType"] == 2) & (dfl["accountType"] == 5) & (dfl["trxType"].isin([2,6]))]
df7 = df7.sort_values(by=["accountName"])
###########################################################################################
# Leyendo "moves" del viejo esquema para transformarlo a "savings" y "withdrawals" hacia nuevo esquema
dfs = pd.DataFrame(data['moves'])  
dfs["accountType"] = dfs["account"].apply(lambda a: a.get("accountType") if isinstance(a, dict) else None)
dfs["accountName"] = dfs["account"].apply(lambda a: a.get("name") if isinstance(a, dict) else None)
df_savings = dfs.copy()
cols = ["id", "trxType", "moveType", "accountType","amount", "movedAt", "accountName"]
dfs = dfs[[c for c in cols if c in dfs.columns]]
df8 = dfs[(dfs["moveType"] == 1) & (dfs["accountType"] == 2) & (dfs["trxType"].isin([1,4]))]
df8 = df8.sort_values(by=["accountName"])
df9 = dfs[(dfs["trxType"] == 5) & (dfs["accountType"] == 2) & (dfs["moveType"].isin([2,1]))]
df9 = df9.sort_values(by=["accountName"])


print("Accounts:", len(dfa), "filas")
print("Income accounts:", len(df1), "filas")
print("Expense accounts:", len(df2), "filas")
print("Moves", len(dfm), "filas.")
print("Income Moves:", len(df3), "filas")
print("Expense Moves:", len(df4), "filas.")
print("Loan Moves:", len(df5), "filas.")
print("Loan Payment Moves:", len(df6), "filas.")
print("Loan Interest Moves:", len(df7), "filas.")
print("Savings Moves:", len(df8), "filas.")
print("Withdrawals Moves:", len(df9), "filas.")


# Escribiendo DataFrames a TXT
widths = get_column_widths(df1, padding=5)
write_df_to_txt(df1, widths, txt_path1)
widths = get_column_widths(df2, padding=5)
write_df_to_txt(df2, widths, txt_path2)
widths = get_column_widths(df3, padding=5)
write_df_to_txt(df3, widths, txt_path3)
widths = get_column_widths(df4, padding=5)
write_df_to_txt(df4, widths, txt_path4)
widths = get_column_widths(df5, padding=5)
write_df_to_txt(df5, widths, txt_path5)
widths = get_column_widths(df6, padding=5)
write_df_to_txt(df6, widths, txt_path6)
widths = get_column_widths(df7, padding=5)
write_df_to_txt(df7, widths, txt_path7)
widths = get_column_widths(df8, padding=5)
write_df_to_txt(df8, widths, txt_path8)
widths = get_column_widths(df9, padding=5)
write_df_to_txt(df9, widths, txt_path9)


sql_accounts = build_accounts_insert()
sql_categories, accounts_array = build_bulk_insert_categories_multiline(df_accounts, table_name="categories")
sql_incomes_transactions = build_bulk_insert_income_transactions_multiline(df=df_moves, categories_array=accounts_array, table_name="transactions")
sql_expenses_transactions = build_bulk_insert_expense_transactions_multiline(df=df_moves, categories_array=accounts_array, table_name="transactions")
sql_loans, sql_transactions, sql_update_relation, loan_array = build_bulk_insert_loans_multiline(df=df_loans, loans_table="loans", transactions_table="transactions", categories_array=accounts_array)
sql_insert_payments, sql_insert_transactions, sql_update_payment_transaction, sql_update_balance, sql_update_total_interest, sql_close_loans = build_bulk_insert_loan_payments_and_update_balance(df=df_loans, loan_array=loan_array, categories_array=accounts_array, loans_table="loans", payments_table="loan_payments", transactions_table="transactions")
sql_savings = build_insert_savings_transactions_sql(df=df_savings)
sql_withdrawals = build_insert_withdrawals_transactions_sql(df=df_savings)

sql_final = """
START TRANSACTION;

/* =========================================================
   1) Actualizar monto de la transacción #3
========================================================= */
UPDATE transactions
SET amount = 5445.27
WHERE id = 3;

/* =========================================================
   2) Resetear balances de todas las cuentas del usuario
========================================================= */
UPDATE accounts
SET balance = 0
WHERE user_id = 1;

/* =========================================================
   3) Aplicar INCOME y EXPENSE
      income  -> suma
      expense -> resta
========================================================= */
UPDATE accounts a
JOIN (
    SELECT
        account_id,
        SUM(
            CASE
                WHEN type = 'income' THEN amount
                WHEN type = 'expense' THEN -amount
                ELSE 0
            END
        ) AS balance_delta
    FROM transactions
    WHERE user_id = 1
    GROUP BY account_id
) t ON t.account_id = a.id
SET a.balance = a.balance + t.balance_delta;

/* =========================================================
   4) Aplicar TRANSFERS (origen)
      account_id -> resta
========================================================= */
UPDATE accounts a
JOIN (
    SELECT
        account_id,
        SUM(amount) AS total_out
    FROM transactions
    WHERE user_id = 1
      AND type = 'transfer'
    GROUP BY account_id
) t ON t.account_id = a.id
SET a.balance = a.balance - t.total_out;

/* =========================================================
   5) Aplicar TRANSFERS (destino)
      to_account_id -> suma
========================================================= */
UPDATE accounts a
JOIN (
    SELECT
        to_account_id,
        SUM(amount) AS total_in
    FROM transactions
    WHERE user_id = 1
      AND type = 'transfer'
      AND to_account_id IS NOT NULL
    GROUP BY to_account_id
) t ON t.to_account_id = a.id
SET a.balance = a.balance + t.total_in;

COMMIT;

"""

print("Total de cuentas SQL:", len(sql_accounts.splitlines()))
print("Total de categorias SQL:", len(sql_categories.splitlines()))
print("Total de transacciones income SQL:", len(sql_incomes_transactions.splitlines()))
print("Total de transacciones expense SQL:", len(sql_expenses_transactions.splitlines()))
print("Total de préstamos SQL:", len(sql_loans.splitlines()))
print("Total de pagos de préstamos SQL:", len(sql_insert_payments.splitlines()))   
print("Total de transacciones de ahorros SQL:", len(sql_savings.splitlines())) 
print("Total de transacciones de retiros SQL:", len(sql_withdrawals.splitlines()))

sql = (
    sql_accounts.strip()
    + "\n\n"
    + sql_categories.strip()
    + "\n\n"
    + sql_incomes_transactions.strip()
    + "\n\n"
    + sql_expenses_transactions.strip()
    + "\n\n"
    + sql_loans.strip()
    + "\n\n"    
    + sql_transactions.strip()
    + "\n\n"
    + sql_update_relation.strip()
    + "\n\n"
    + sql_insert_payments.strip()
    + "\n\n"
    + sql_insert_transactions.strip()
    + "\n\n"
    + sql_update_payment_transaction.strip()
    + "\n\n"            
    + sql_update_balance.strip()
    + "\n\n"
    + sql_update_total_interest.strip()
    + "\n\n"
    + sql_close_loans.strip()
    + "\n\n"
    + sql_savings.strip()
    + "\n\n"
    + sql_withdrawals.strip()
    + "\n\n"
    + sql_final.strip()
)
with open(sql_path1, "w", encoding="utf-8") as f:
    f.write(sql) 

if 1==0:
    # Movimientos desde JSON a DataFrame -- Transacciones
    df = pd.DataFrame(data['moves'])  
    print("DataFrame cargado con", len(df), "filas.")
    df["accountType"] = df["account"].apply(lambda a: a.get("accountType") if isinstance(a, dict) else None)
    df["accountName"] = df["account"].apply(lambda a: a.get("name") if isinstance(a, dict) else None)
    df["categoryId"] = df["account"].apply(lambda a: a.get("id") if isinstance(a, dict) else None)
    df_moves = df.copy()
    print("Columnas en df_moves:", df_moves.columns.tolist())
    # Columnas:  ['id', 'loanId', 'transfId', 'title', 'remark', 'moveType', 'trxType', 'amount', 'movedAt', 'movedY', 'movedYM', 'movedYMD', 'account', 'accountLoan', 'accountType', 'accountName', 'categoryId']
    cols = ["id", "trxType", "moveType", "accountType","amount", "movedAt", "accountName"]
    df = df[[c for c in cols if c in df.columns]]

 

    df2 = df[(df["moveType"] == 2)& (df["accountType"] == 4)& (df["trxType"].isin([2, 6]))]
    df2 = df2.sort_values(by=["accountName"])
    print("Filas con moveType 2 / accountType 4:", len(df2))
    widths = get_column_widths(df2, padding=5)
    write_df_to_txt(df2, widths, txt_path2)

    df3 = df[(df["moveType"] == 2)& (df["accountType"] == 5)& (df["trxType"].isin([2, 6]))]
    df3 = df3.sort_values(by=["accountName"])
    print("Filas con moveType 2 / accountType 5:", len(df3))
    widths = get_column_widths(df3, padding=5)
    write_df_to_txt(df3, widths, txt_path3)

    # Escribiendo categorias a SQL
    # Escribiendo cuentas + categorias a UN SOLO SQL
  
    sql_loans, sql_transactions, sql_update_relation = build_bulk_insert_loans_multiline(df=df_moves, loans_table="loans", transactions_table="transactions")
    sql_insert_payments, sql_update_payment_loan, sql_update_loan_balance, sql_close_loans, sql_insert_transactions = build_bulk_insert_loan_payments_and_update_balance(df=df_moves, loans_table="loans", payments_table="loan_payments", transactions_table="transactions")

   
    print("Total de transacciones income SQL:", len(sql_incomes_transactions.splitlines()))
    print("Total de transacciones expense SQL:", len(sql_expenses_transactions.splitlines()))
    print("Total de préstamos SQL:", len(sql_loans.splitlines()))
    print("Total de transacciones loans SQL:", len(sql_transactions.splitlines()))






