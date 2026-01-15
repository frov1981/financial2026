from df_utils import normalize_account_name

def build_bulk_insert_categories_multiline(df, table_name="categories"):
    unique_categories = {}
    values = []
    seq = 1

    df = df.sort_values(by=["name"])

    for _, row in df.iterrows():
        raw_name = row["name"]
        clean_name = normalize_account_name(raw_name)

        if not clean_name:
            continue

        if row["moveType"] == 1:
            category_type = "income"
        elif row["moveType"] == 2:
            category_type = "expense"
        else:
            continue

        is_active = 1 if row.get("state", 1) == 1 else 0

        unique_key = f"{clean_name}|{category_type}"

        if unique_key not in unique_categories:
            unique_categories[unique_key] = {
                "seq": seq,
                "name": clean_name,
                "type": category_type,
                "is_active": is_active
            }
            seq += 1

    if not unique_categories:
        raise ValueError("No hay categorías válidas para insertar")

    for cat in unique_categories.values():
        name = cat["name"].replace("'", "''")
        values.append(
            f"({cat['seq']},'{name}','{cat['type']}',{cat['is_active']},1,NULL)"
        )

    sql = (
        f"INSERT INTO {table_name} "
        f"(id,name,type,is_active,user_id,parent_id)\n"
        f"VALUES\n"
        + ",\n".join(values)
        + ";"
    )

    categories_array = [
        {
            "id": v["seq"],
            "name": v["name"],
            "type": v["type"]
        }
        for v in unique_categories.values()
    ]

    return sql, categories_array
