import { AppDataSource } from '../../config/typeorm.datasource'
import { LoanGroup } from '../../entities/LoanGroup.entity'
import { AuthRequest } from '../../types/auth-request'

export const getActiveParentLoansByUser = async (
    auth_req: AuthRequest
): Promise<LoanGroup[]> => {
    const repo = AppDataSource.getRepository(LoanGroup)

    return await repo.find({
        where: {
            user: { id: auth_req.user.id },
            is_active: true
        },
        order: { name: 'ASC' }
    })
}
