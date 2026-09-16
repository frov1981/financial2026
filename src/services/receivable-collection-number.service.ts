import { AppDataSource } from "../config/typeorm.datasource"
import { ReceivableCollection } from "../entities/ReceivableCollection.entity"

/* =========================================================
Obtener siguiente número de cobro para una Cuenta por Cobrar
========================================================= */

export const getNextReceivableCollectionNumber = async (receivable_id: number): Promise<number> => {

  const last_collection = await AppDataSource
    .getRepository(ReceivableCollection)
    .createQueryBuilder('p')
    .where('p.receivable_id = :receivable_id', { receivable_id })
    .andWhere('p.collection_number > 0')
    .orderBy('p.collection_number', 'DESC')
    .getOne()

  if (!last_collection?.collection_number) return 1

  return last_collection.collection_number + 1
}
