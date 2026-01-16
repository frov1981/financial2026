from df_utils import extract_payment_date, normalize_account_name, normalize_loan_base_name

def build_bulk_insert_loan_payments_and_update_balance(
    df,
    loan_array,
    categories_array,
    loans_table="loans",
    payments_table="loan_payments",
    transactions_table="transactions"
):
    loan_index = {
        l["name"].upper(): l["id"]
        for l in loan_array
    }

    category_index = {
        normalize_account_name(c["name"]): c["id"]
        for c in categories_array
    }

    payments = {}

    # ============================
    # FILTRAR PAGOS (capital + interés)
    # ============================
    df_payments = df[
        (df["moveType"] == 2)
        & (df["trxType"].isin([2, 6]))
        & (df["accountType"].isin([4, 5]))
    ]

    for _, row in df_payments.iterrows():
        base_name = normalize_loan_base_name(row["accountName"])
        loan_id = loan_index.get(base_name)

        if loan_id is None:
            continue

        payment_date = extract_payment_date(row["movedAt"])
        key = (loan_id, payment_date)

        if key not in payments:
            payments[key] = {
                "loan_id": loan_id,
                "principal": 0.0,
                "interest": 0.0,
                "date": payment_date,
                "category_id": category_index.get(
                    normalize_account_name(base_name)
                )
            }

        amount = abs(float(row["amount"]))

        if row["accountType"] == 4:
            payments[key]["principal"] += amount
        elif row["accountType"] == 5:
            payments[key]["interest"] += amount

    if not payments:
        raise ValueError("No hay pagos para procesar")

    # ============================
    # SQL VALUES
    # ============================
    payment_values = []
    transaction_values = []

    for p in payments.values():
        total = p["principal"] + p["interest"]
        category_id = p["category_id"] if p["category_id"] is not None else "NULL"

        payment_values.append(
            f"(NULL,{p['principal']},{p['interest']},"
            f"'{p['date']}',NULL,{p['loan_id']},2,NULL)"
        )

        transaction_values.append(
            f"(NULL,'expense',{total},'{p['date']}',"
            f"'Pago préstamo',1,2,NULL,{category_id})"
        )

    # ============================
    # SQL
    # ============================
    sql_insert_payments = (
        f"INSERT INTO {payments_table} "
        f"(id,principal_amount,interest_amount,payment_date,"
        f"note,loan_id,account_id,transaction_id)\n"
        f"VALUES\n" + ",\n".join(payment_values) + ";"
    )

    sql_insert_transactions = (
        f"INSERT INTO {transactions_table} "
        f"(id,type,amount,date,description,user_id,account_id,"
        f"to_account_id,category_id)\n"
        f"VALUES\n" + ",\n".join(transaction_values) + ";"
    )

    sql_update_payment_transaction = (
        f"UPDATE {payments_table} lp\n"
        f"JOIN {transactions_table} t ON (\n"
        f"  t.type = 'expense'\n"
        f"  AND t.account_id = 2\n"
        f"  AND t.amount = lp.principal_amount + lp.interest_amount\n"
        f"  AND DATE(t.date) = DATE(lp.payment_date)\n"
        f")\n"
        f"SET lp.transaction_id = t.id\n"
        f"WHERE lp.transaction_id IS NULL;"
    )

    sql_update_balance = (
        f"UPDATE {loans_table} l\n"
        f"JOIN (\n"
        f"  SELECT loan_id, SUM(principal_amount) total_paid\n"
        f"  FROM {payments_table}\n"
        f"  GROUP BY loan_id\n"
        f") p ON p.loan_id = l.id\n"
        f"SET l.balance = l.total_amount - p.total_paid;"
    )
    
    sql_update_total_interest = (
        f"UPDATE {loans_table} l\n"
        f"JOIN (\n"
        f"  SELECT loan_id, SUM(interest_amount) total_interest\n"
        f"  FROM {payments_table}\n"
        f"  GROUP BY loan_id\n"
        f") i ON i.loan_id = l.id\n"
        f"SET l.interest_amount = i.total_interest;"
    )


    sql_close_loans = (
        f"UPDATE {loans_table}\n"
        f"SET status = 'closed'\n"
        f"WHERE balance <= 0\n"
        f"AND status <> 'closed';"
    )

    return (
        sql_insert_payments,
        sql_insert_transactions,
        sql_update_payment_transaction,
        sql_update_balance,
        sql_update_total_interest,
        sql_close_loans
    )
