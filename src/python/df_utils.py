import pandas as pd

def get_column_widths(df: pd.DataFrame, padding: int = 5) -> list[int]:
    widths = []

    for col in df.columns:
        max_len = len(col)

        for value in df[col]:
            if pd.notna(value):
                max_len = max(max_len, len(str(value)))

        widths.append(max_len + padding)

    return widths


def write_df_to_txt(df: pd.DataFrame, widths: list[int], file_path: str) -> None:
    if df.empty or not widths:
        print("⚠️ DataFrame vacío o anchos inválidos")
        return

    with open(file_path, "w", encoding="utf-8") as f:

        # Header
        for col, w in zip(df.columns, widths):
            f.write(col.ljust(w))
        f.write("\n")

        # Separador
        for w in widths:
            f.write("-" * w)
        f.write("\n")

        # Filas
        for _, row in df.iterrows():
            for value, w in zip(row, widths):
                text = "" if pd.isna(value) else str(value)
                f.write(text.ljust(w))
            f.write("\n")

    print("✅ TXT escrito correctamente:", file_path)

def sql_safe_text(value):
    if pd.isna(value):
        return ""

    text = str(value)

    # Normalizar saltos de línea a \n escapado
    text = (
        text
        .replace("\r\n", "\\n")
        .replace("\r", "\\n")
        .replace("\n", "\\n")
    )

    # Escapar comillas simples para SQL
    text = text.replace("'", "''")

    return text

def normalize_loan_name(name):
    if not name:
        return ""

    text = str(name).strip()

    text = (
        text
        .replace("(PAGOS)", "")
        .replace("(INTERES)", "")
        .replace("(INTERÉS)", "")
    )

    return text.strip()
