import pandas as pd
from df_utils import normalize_loan_name, sql_safe_text

def build_bulk_insert_loans_multiline(df, loans_table="loans", transactions_table="transactions"):
    # Reutilizar lógica de préstamos
    df1 = df[
        (df["moveType"] == 1)
        & (df["accountType"] == 3)
        & (df["trxType"].isin([1, 7]))
    ]

    if df1.empty:
        raise ValueError("No hay registros de préstamos")

    # Ordenar para asegurar fecha inicial correcta
    df1 = df1.sort_values(by=["accountName", "movedAt"])

    # Agrupar por préstamo
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

    for _, row in grouped.iterrows():
        name = sql_safe_text(row["accountName"])
        amount = abs(float(row["total_amount"]))

        start_date = pd.to_datetime(
            row["start_date"],
            utc=True
        ).strftime("%Y-%m-%d %H:%M:%S")

        # INSERT loans
        loan_values.append(
            f"(NULL,'{name}',{amount},0,0.00,'{start_date}',NULL,'active',1,2,NULL)"
        )

        # INSERT transactions (desembolso del préstamo)
        trx_values.append(
            f"('income',{amount},'{start_date}','{name}',1,2,NULL,NULL)"
        )

    if not loan_values:
        raise ValueError("No hay préstamos para insertar")

    # SQL préstamos
    sql_loans = (
        f"INSERT INTO {loans_table} "
        f"(loan_number,name,total_amount,balance,interest_rate,start_date,end_date,status,user_id,disbursement_account_id,transaction_id)\n"
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

    return sql_loans, sql_transactions, sql_update_relation

def build_bulk_insert_loan_payments_and_update_balance(
    df,
    loans_table="loans",
    payments_table="loan_payments",
    transactions_table="transactions"
):
    def normalize_loan_name(name):
        if not isinstance(name, str):
            return ""
        return (
            name
            .replace("(PAGOS)", "")
            .replace("(pagos)", "")
            .replace("(INTERES)", "")
            .replace("(interes)", "")
            .strip()
        )

    df1 = df[
        (df["moveType"] == 2)
        & (df["trxType"].isin([2, 6]))
        & (df["accountType"].isin([4, 5]))
    ].copy()

    if df1.empty:
        raise ValueError("No hay pagos de préstamos")

    df1["loan_name"] = df1["accountName"].apply(normalize_loan_name)
    df1["payment_date"] = pd.to_datetime(
        df1["movedAt"],
        utc=True
    ).dt.strftime("%Y-%m-%d %H:%M:%S")

    payment_groups = {}
    orphan_interests = []

    # ============================
    # 1. Agrupar por préstamo + fecha
    # ============================
    for _, row in df1.iterrows():
        key = (row["loan_name"], row["payment_date"])
        payment_groups.setdefault(key, {
            "capital": None,
            "interest": None
        })

        if row["accountType"] == 4:
            payment_groups[key]["capital"] = abs(float(row["amount"]))
        elif row["accountType"] == 5:
            payment_groups[key]["interest"] = abs(float(row["amount"]))

    payment_values = []
    transaction_values = []
    payment_counter = {}

    # ============================
    # 2. Construcción de pagos
    # ============================
    for (loan_name, payment_date), data in payment_groups.items():
        if data["capital"] is None:
            if data["interest"] is not None:
                orphan_interests.append({
                    "loan_name": loan_name,
                    "amount": data["interest"],
                    "date": payment_date
                })
            continue

        principal = data["capital"]
        interest = data["interest"] or 0.00

        payment_counter.setdefault(loan_name, 0)
        payment_counter[loan_name] += 1

        note = f"Pago #{payment_counter[loan_name]}"

        payment_values.append(
            f"(NULL,{principal},{interest},"
            f"'{payment_date}','{note}',NULL,2,NULL,'{loan_name}')"
        )

        total_amount = principal + interest

        transaction_values.append(
            f"(NULL,2,{total_amount},'{payment_date}',NULL)"
        )

    # ============================
    # 3. Reportar intereses huérfanos
    # ============================
    if orphan_interests:
        print("⚠️ Intereses huérfanos detectados:")
        for o in orphan_interests:
            print(
                f"- prestamo='{o['loan_name']}' | "
                f"monto={o['amount']} | "
                f"fecha={o['date']}"
            )

    if not payment_values:
        raise ValueError("No hay pagos válidos")

    # ============================
    # 4. SQL
    # ============================
    sql_insert_payments = (
        f"INSERT INTO {payments_table} "
        f"(id,principal_amount,interest_amount,payment_date,"
        f"note,loan_id,account_id,transaction_id,loan_name_tmp)\n"
        f"VALUES\n"
        + ",\n".join(payment_values)
        + ";"
    )

    sql_update_payment_loan = (
        f"UPDATE {payments_table} lp\n"
        f"JOIN {loans_table} l ON l.name = lp.loan_name_tmp\n"
        f"SET lp.loan_id = l.id\n"
        f"WHERE lp.loan_id IS NULL;"
    )

    sql_update_loan_balance = (
        f"UPDATE {loans_table} l\n"
        f"JOIN (\n"
        f"  SELECT loan_id, SUM(principal_amount) AS total_paid\n"
        f"  FROM {payments_table}\n"
        f"  WHERE loan_id IS NOT NULL\n"
        f"  GROUP BY loan_id\n"
        f") p ON p.loan_id = l.id\n"
        f"SET l.balance = l.total_amount - p.total_paid;"
    )

    sql_close_loans = (
        f"UPDATE {loans_table}\n"
        f"SET status = 'closed'\n"
        f"WHERE balance = 0\n"
        f"AND status <> 'closed';"
    )

    sql_insert_transactions = None
    if transaction_values:
        sql_insert_transactions = (
            f"INSERT INTO {transactions_table} "
            f"(id,type,amount,created_at,loan_id)\n"
            f"VALUES\n"
            + ",\n".join(transaction_values)
            + ";"
        )

    return (
        sql_insert_payments,
        sql_update_payment_loan,
        sql_update_loan_balance,
        sql_close_loans,
        sql_insert_transactions
    )

