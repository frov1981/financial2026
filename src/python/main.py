import os
import json
import pandas as pd

from df_utils import get_column_widths, write_df_to_txt
from sql02_moves import build_bulk_insert_expense_transactions_multiline, build_bulk_insert_income_transactions_multiline
from sql03_loans import build_bulk_insert_loan_payments_and_update_balance, build_bulk_insert_loans_multiline

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

json_path = os.path.join(BASE_DIR, 'data.json')
txt_path1 = os.path.join(BASE_DIR, 'out1.txt')
txt_path2 = os.path.join(BASE_DIR, 'out2.txt')
txt_path3 = os.path.join(BASE_DIR, 'out3.txt')
sql_path1 = os.path.join(BASE_DIR, 'sql.sql')

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Cuentas desde JSON a DataFrame -- Categorias
df = pd.DataFrame(data['accounts'])
df_accounts = df.copy()
print("DataFrame cargado con", len(df), "filas.")
cols = ["id", "moveType", "accountType", "name", "state"]
df = df[[c for c in cols if c in df.columns]]

df1 = df[df["moveType"] == 1]
df1 = df1.sort_values(by=["moveType", "accountType", "name"])
print("Filas con moveType 1:", len(df1))
widths = get_column_widths(df1, padding=5)
write_df_to_txt(df1, widths, txt_path1)

df2 = df[df["moveType"] == 2]
df2 = df2.sort_values(by=["moveType", "accountType", "name"])
print("Filas con moveType 2:", len(df2))
widths = get_column_widths(df2, padding=5)
write_df_to_txt(df2, widths, txt_path2)

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


#df1 = df[(df["moveType"] == 1) & (df["accountType"] == 3) & (df["trxType"].isin([1, 7]))]
#df1 = df1.sort_values(by=["accountName"])
#print("Filas con moveType 1:", len(df1))
#widths = get_column_widths(df1, padding=5)
#write_df_to_txt(df1, widths, txt_path1)

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
from sql00_accounts import build_accounts_insert
from sql01_categories import build_bulk_insert_categories_multiline
sql_accounts = build_accounts_insert()
sql_categories = build_bulk_insert_categories_multiline(df_accounts, table_name="categories")
sql_incomes_transactions = build_bulk_insert_income_transactions_multiline(df=df_moves, table_name="transactions")
sql_expenses_transactions = build_bulk_insert_expense_transactions_multiline(df=df_moves, table_name="transactions")
sql_loans, sql_transactions, sql_update_relation = build_bulk_insert_loans_multiline(df=df_moves, loans_table="loans", transactions_table="transactions")
sql_insert_payments, sql_update_payment_loan, sql_update_loan_balance, sql_close_loans, sql_insert_transactions = build_bulk_insert_loan_payments_and_update_balance(df=df_moves, loans_table="loans", payments_table="loan_payments", transactions_table="transactions")

print("Total de cuentas SQL:", len(sql_accounts.splitlines()))
print("Total de categorias SQL:", len(sql_categories.splitlines()))
print("Total de transacciones income SQL:", len(sql_incomes_transactions.splitlines()))
print("Total de transacciones expense SQL:", len(sql_expenses_transactions.splitlines()))
print("Total de préstamos SQL:", len(sql_loans.splitlines()))
print("Total de transacciones loans SQL:", len(sql_transactions.splitlines()))

sql = (
    sql_accounts.strip()
    + "\n\n"
    + sql_categories.strip()
    + "\n"
    + sql_incomes_transactions.strip()
    + "\n"
    + sql_expenses_transactions.strip()
    + "\n"
    + sql_loans.strip()
    + "\n"
    + sql_transactions.strip()      
    + "\n"
    + sql_update_relation.strip()
    + "\n"  
    + sql_insert_payments.strip()
    + "\n"
    + sql_update_payment_loan.strip()   
    + "\n"
    + sql_update_loan_balance.strip()
    + "\n"
    + sql_close_loans.strip()
    + "\n"
    + sql_insert_transactions.strip()
)
with open(sql_path1, "w", encoding="utf-8") as f:
    f.write(sql) 




