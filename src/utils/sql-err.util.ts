// utils/sql-error.util.ts
export const getSqlErrorMessage = (err: any): string => {
    // MySQL / MariaDB - Foreign key constraint
    if (
        err?.code === 'ER_ROW_IS_REFERENCED_2' ||
        err?.errno === 1451
    ) {
        return 'El registro no puede eliminarse porque pertenece a una referencia de integridad.'
    }

    return ''
}
