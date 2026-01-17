import pandas as pd
import re

def build_insert_savings_transactions_sql(df: pd.DataFrame) -> str:
    """
    Procesa el DataFrame df de movimientos bancarios y genera sentencias SQL INSERT INTO transactions
    para transacciones del tipo "Ahorros".
    """

    # ============================
    # FILTRO DE MOVIMIENTOS
    # ============================
    cond1 = (df['trxType'] == 1) & (df['moveType'] == 1) & (df['accountType'] == 2)
    cond2 = (df['trxType'] == 4) & (df['moveType'] == 1) & (df['accountType'] == 2)
    df_filtered = df[cond1 | cond2].copy()

    # ============================
    # NORMALIZAR NOMBRE DE CUENTA
    # ============================
    def normalize_account_name(name: str) -> str:
        if not name:
            return ""

        name = str(name).upper()
        name = re.sub(r'[^A-Z ]', ' ', name)
        name = re.sub(r'\s+', ' ', name).strip()
        return name

    # ============================
    # RESOLVER CUENTA DESTINO
    # ============================
    def get_to_account_id(account_name: str):
        if pd.isna(account_name):
            return None

        name = normalize_account_name(account_name)

        if name in ('AHORRO CONECEL', 'AHORRO FLEX', 'CERT APORTA CONECEL'):
            return 4
        if name == 'BANQUITO FERTIZA':
            return 5
        if name == 'BCO PICHINCHA':
            return 2

        return None

    # ============================
    # VALUES
    # ============================
    values_list = []

    for _, row in df_filtered.iterrows():
        to_id = get_to_account_id(row.get('accountName'))
        if to_id is None:
            continue

        # ----------------------------
        # DESCRIPCIÓN
        # ----------------------------
        title = str(row.get('title') or '')
        remark = str(row.get('remark') or '')
        description = f"{title} {remark}"
        description = re.sub(r'\s+', ' ', description.replace('\n', ' ').replace('\r', ' ')).strip()
        description = description.replace("'", "''")

        # ----------------------------
        # FECHA (FORMATO MySQL)
        # ----------------------------
        moved_at = row.get('movedAt')
        if pd.isna(moved_at):
            continue

        date_str = pd.to_datetime(moved_at).strftime('%Y-%m-%d %H:%M:%S')

        # ----------------------------
        # MONTO
        # ----------------------------
        try:
            amount = abs(float(row.get('amount', 0)))
        except Exception:
            continue

        values_list.append(
            f"(NULL,'transfer',{amount},'{date_str}',"
            f"'{description}',1,2,{to_id},NULL)"
        )

    if not values_list:
        return ""

    # ============================
    # SQL FINAL
    # ============================
    sql_savings = (
        "INSERT INTO transactions "
        "(id,type,amount,date,description,user_id,account_id,to_account_id,category_id)\n"
        "VALUES\n"
        + ",\n".join(values_list)
        + ";"
    )

    return sql_savings

def build_insert_withdrawals_transactions_sql(df: pd.DataFrame) -> str:
    """
    Procesa el DataFrame df de movimientos bancarios y genera sentencias SQL INSERT INTO transactions
    para transacciones del tipo "Retiros".

    Condición:
      (trxType == 5 AND moveType == 2 AND accountType == 2)
      OR
      (trxType == 5 AND moveType == 1 AND accountType == 2)

    Reglas:
      - type: 'transfer'
      - amount: abs(amount)
      - date: movedAt (YYYY-MM-DD HH:MM:SS)
      - user_id: 1
      - account_id: cuenta origen (antes era to_account_id)
      - to_account_id: siempre 2
    """

    # ============================
    # FILTRO DE MOVIMIENTOS
    # ============================
    cond1 = (df['trxType'] == 5) & (df['moveType'] == 2) & (df['accountType'] == 2)
    cond2 = (df['trxType'] == 5) & (df['moveType'] == 1) & (df['accountType'] == 2)
    df_filtered = df[cond1 | cond2].copy()

    # ============================
    # NORMALIZAR NOMBRE DE CUENTA
    # ============================
    def normalize_account_name(name: str) -> str:
        if not name:
            return ""

        name = str(name).upper()
        name = re.sub(r'[^A-Z ]', ' ', name)
        name = re.sub(r'\s+', ' ', name).strip()
        return name

    # ============================
    # RESOLVER CUENTA ORIGEN
    # ============================
    def get_account_id(account_name: str):
        if pd.isna(account_name):
            return None

        name = normalize_account_name(account_name)

        if name in ('AHORRO CONECEL', 'AHORRO FLEX', 'CERT APORTA CONECEL'):
            return 4
        if name == 'BANQUITO FERTIZA':
            return 5
        if name == 'BCO PICHINCHA':
            return 2

        return None

    # ============================
    # VALUES
    # ============================
    values_list = []

    for _, row in df_filtered.iterrows():
        account_id = get_account_id(row.get('accountName'))
        if account_id is None:
            continue

        # ----------------------------
        # DESCRIPCIÓN
        # ----------------------------
        title = str(row.get('title') or '')
        remark = str(row.get('remark') or '')
        description = f"{title} {remark}"
        description = re.sub(r'\s+', ' ', description.replace('\n', ' ').replace('\r', ' ')).strip()
        description = description.replace("'", "''")

        # ----------------------------
        # FECHA (FORMATO MySQL)
        # ----------------------------
        moved_at = row.get('movedAt')
        if pd.isna(moved_at):
            continue

        date_str = pd.to_datetime(moved_at).strftime('%Y-%m-%d %H:%M:%S')

        # ----------------------------
        # MONTO
        # ----------------------------
        try:
            amount = abs(float(row.get('amount', 0)))
        except Exception:
            continue

        values_list.append(
            f"(NULL,'transfer',{amount},'{date_str}',"
            f"'{description}',1,{account_id},2,NULL)"
        )

    if not values_list:
        return ""

    # ============================
    # SQL FINAL
    # ============================
    sql_withdrawals = (
        "INSERT INTO transactions "
        "(id,type,amount,date,description,user_id,account_id,to_account_id,category_id)\n"
        "VALUES\n"
        + ",\n".join(values_list)
        + ";"
    )

    return sql_withdrawals
