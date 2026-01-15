import os
import json
import pandas as pd

from df_utils import get_column_widths, write_df_to_txt
from sql00_accounts import build_accounts_insert
from sql01_categories import build_bulk_insert_categories_multiline
from sql02_moves import build_bulk_insert_expense_transactions_multiline, build_bulk_insert_income_transactions_multiline
from sql03_loans import build_bulk_insert_loan_payments_and_update_balance, build_bulk_insert_loans_multiline

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

json_path = os.path.join(BASE_DIR, 'data.json')
sql_path1 = os.path.join(BASE_DIR, 'sql.sql')

txt_path1 = os.path.join(BASE_DIR, '01_acc_income.txt')
txt_path2 = os.path.join(BASE_DIR, '01_acc_expense.txt')
txt_path3 = os.path.join(BASE_DIR, '02_mov_income.txt')
txt_path4 = os.path.join(BASE_DIR, '02_mov_expense.txt')
txt_path5 = os.path.join(BASE_DIR, '03_loan_income.txt')
txt_path6 = os.path.join(BASE_DIR, '02_paym_expense.txt')

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

print("Accounts:", len(dfa), "filas")
print("Income accounts:", len(df1), "filas")
print("Expense accounts:", len(df2), "filas")
print("Moves", len(dfm), "filas.")
print("Income Moves:", len(df3), "filas")
print("Expense Moves:", len(df4), "filas.")
print("Loan Moves:", len(df5), "filas.")

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


sql_accounts = build_accounts_insert()
sql_categories, accounts_array = build_bulk_insert_categories_multiline(df_accounts, table_name="categories")
sql_incomes_transactions = build_bulk_insert_income_transactions_multiline(df=df_moves, categories_array=accounts_array, table_name="transactions")
sql_expenses_transactions = build_bulk_insert_expense_transactions_multiline(df=df_moves, categories_array=accounts_array, table_name="transactions")
sql_loans, sql_transactions, sql_update_relation, loan_array = build_bulk_insert_loans_multiline(df=df_loans, loans_table="loans", transactions_table="transactions", categories_array=accounts_array)

print("Total de cuentas SQL:", len(sql_accounts.splitlines()))
print("Total de categorias SQL:", len(sql_categories.splitlines()))
print("Total de transacciones income SQL:", len(sql_incomes_transactions.splitlines()))
print("Total de transacciones expense SQL:", len(sql_expenses_transactions.splitlines()))
print("Total de préstamos SQL:", len(sql_loans.splitlines()))

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






