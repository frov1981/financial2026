export const getSqlErrorMessage = (err: any): string => {
    if (err?.code === 'ER_ROW_IS_REFERENCED_2' || err?.errno === 1451
    ) {
        return 'El registro no puede eliminarse porque pertenece a una referencia de integridad.'
    }
    return ''
}
