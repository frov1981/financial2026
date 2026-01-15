import pandas as pd
from df_utils import sql_safe_text

import pandas as pd
from df_utils import sql_safe_text, normalize_account_name

import pandas as pd
from df_utils import sql_safe_text, normalize_account_name

def build_bulk_insert_transactions_by_filter_multiline(
    df,
    categories_array,
    *,
    trx_type,
    move_type,
    account_type,
    table_name="transactions",
    type
):
    values = []

    # Indexar categorías por nombre normalizado
    categories_index = {
        cat["name"]: cat["id"]
        for cat in categories_array
    }

    for _, row in df.iterrows():

        if (
            row["trxType"] != trx_type
            or row["moveType"] != move_type
            or row["accountType"] != account_type
        ):
            continue

        amount = abs(float(row["amount"]))

        moved_at = pd.to_datetime(
            row["movedAt"],
            utc=True
        ).strftime("%Y-%m-%d %H:%M:%S")

        title = sql_safe_text(row["title"])
        remark = sql_safe_text(row["remark"])

        if title and remark:
            description = f"{title}\\n{remark}"
        else:
            description = title or remark or None

        description_sql = f"'{description}'" if description else "NULL"

        # account_id fijo (modelo correcto)
        account_id = 2

        # category_id desde categories_array usando accountName (esquema viejo)
        raw_name = row.get("accountName")
        category_id = "NULL"

        if raw_name:
            clean_name = normalize_account_name(raw_name)
            category_id = categories_index.get(clean_name, "NULL")

        values.append(
            f"('{type}',{amount},'{moved_at}',{description_sql[:1000]},1,{account_id},NULL,{category_id})"
        )

    if not values:
        raise ValueError("No hay transacciones que cumplan los filtros")

    sql = (
        f"INSERT INTO {table_name} "
        f"(type,amount,date,description,user_id,account_id,to_account_id,category_id)\n"
        f"VALUES\n"
        + ",\n".join(values)
        + ";"
    )

    return sql


def build_bulk_insert_income_transactions_multiline(df, categories_array, table_name="transactions"):
    return build_bulk_insert_transactions_by_filter_multiline(
        df,
        categories_array,
        trx_type=1,
        move_type=1,
        account_type=1,
        type="income",
        table_name=table_name
    )

def build_bulk_insert_expense_transactions_multiline(df, categories_array, table_name="transactions"):
    return build_bulk_insert_transactions_by_filter_multiline(
        df,
        categories_array,
        trx_type=2,
        move_type=2,
        account_type=1,
        type="expense",
        table_name=table_name
    )
