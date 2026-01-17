import pandas as pd
from df_utils import normalize_account_name, normalize_loan_name, sql_safe_text

def build_bulk_insert_loans_multiline(
    df,
    categories_array,
    loans_table="loans",
    transactions_table="transactions"
):
    # Reutilizar lógica de préstamos
    df1 = df[
        (df["moveType"] == 1)
        & (df["accountType"] == 3)
        & (df["trxType"].isin([1, 7]))
    ]

    if df1.empty:
        raise ValueError("No hay registros de préstamos")

    # Ordenar para asegurar fecha inicial correcta
    df1 = df1.sort_values(by=["accountName"])

    # Agrupar por préstamo (se preserva el nombre completo)
    grouped = (
        df1
        .groupby("accountName", as_index=False)
        .agg(
            total_amount=("amount", "sum"),
            start_date=("movedAt", "first")
        )
    )

    loan_values = []
    trx_values = []
    loan_array = []

    # Índice de categorías por nombre normalizado
    categories_index = {
        cat["name"]: cat["id"]
        for cat in categories_array
    }

    loan_seq = 1

    for _, row in grouped.iterrows():
        raw_name = row["accountName"]
        name = sql_safe_text(raw_name)
        amount = abs(float(row["total_amount"]))

        start_date = pd.to_datetime(
            row["start_date"],
            utc=True
        ).strftime("%Y-%m-%d %H:%M:%S")

        # INSERT loans
        loan_values.append(
            f"({loan_seq},'{name}',{amount},0,0.00,'{start_date}',NULL,true,1,2,NULL)"
        )

        # Resolver category_id normalizando accountName
        category_id = "NULL"
        if raw_name:
            clean_name = normalize_account_name(raw_name)
            category_id = categories_index.get(clean_name, "NULL")

        # INSERT transactions (desembolso del préstamo)
        trx_values.append(
            f"('income',{amount},'{start_date}','{name}',1,2,NULL,{category_id})"
        )

        # Arreglo de préstamos (sin normalizar, préstamos separados)
        loan_array.append({
            "id": loan_seq,
            "name": raw_name
        })

        loan_seq += 1

    if not loan_values:
        raise ValueError("No hay préstamos para insertar")

    # SQL préstamos
    sql_loans = (
        f"INSERT INTO {loans_table} "
        f"(loan_number,name,total_amount,balance,interest_amount,start_date,end_date,is_active,user_id,disbursement_account_id,transaction_id)\n"
        f"VALUES\n"
        + ",\n".join(loan_values)
        + ";"
    )

    # SQL transacciones
    sql_transactions = (
        f"INSERT INTO {transactions_table} "
        f"(type,amount,date,description,user_id,account_id,to_account_id,category_id)\n"
        f"VALUES\n"
        + ",\n".join(trx_values)
        + ";"
    )

    # SQL actualización de relación
    sql_update_relation = (
        f"UPDATE {loans_table} l\n"
        f"JOIN {transactions_table} t ON (\n"
        f"  t.type = 'income'\n"
        f"  AND t.user_id = 1\n"
        f"  AND t.account_id = 2\n"
        f"  AND t.amount = l.total_amount\n"
        f"  AND t.date = l.start_date\n"
        f"  AND t.description = l.name\n"
        f")\n"
        f"SET l.transaction_id = t.id\n"
        f"WHERE l.transaction_id IS NULL;"
    )

    return sql_loans, sql_transactions, sql_update_relation, loan_array
