def build_bulk_insert_categories_multiline(df, table_name="categories"):
    values = []

    for _, row in df.iterrows():
        cat_id = int(row["id"])
        name = str(row["name"]).replace("'", "''")

        if row["moveType"] == 1:
            category_type = "income"
        elif row["moveType"] == 2:
            category_type = "expense"
        else:
            continue

        is_active = 1 if row["state"] == 1 else 0

        values.append(
            f"({cat_id},'{name}','{category_type}',{is_active},1,NULL)"
        )

    if not values:
        raise ValueError("No hay registros para insertar")

    sql = (
        f"INSERT INTO {table_name} "
        f"(id,name,type,is_active,user_id,parent_id)\n"
        f"VALUES\n"
        + ",\n".join(values)
        + ";"
    )

    return sql
