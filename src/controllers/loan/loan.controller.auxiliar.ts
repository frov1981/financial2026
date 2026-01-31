import { IsNull } from 'typeorm'
import { AppDataSource } from '../../config/datasource'
import { AuthRequest } from '../../types/AuthRequest'
import { Loan } from '../../entities/Loan.entity'

export const getActiveParentLoansByUser = async (
    authReq: AuthRequest
): Promise<Loan[]> => {
    const repo = AppDataSource.getRepository(Loan)

    return await repo.find({
        where: {
            user: { id: authReq.user.id },
            is_active: true,
            parent: IsNull()
        },
        order: { name: 'ASC' }
    })
}
