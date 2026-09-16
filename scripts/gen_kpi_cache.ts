import 'reflect-metadata'
import { AppDataSource } from '../src/config/typeorm.datasource'
import { User } from '../src/entities/User.entity'
import { KpiCacheService } from '../src/services/kpi-cache.service'

async function run() {
  try {
    await AppDataSource.initialize()
    const userRepo = AppDataSource.getRepository(User)
    const users = await userRepo.find()
    for (const u of users) {
      console.log('Rebuilding KPI cache for user', u.id)
      // call private method via any to force full rebuild
      await (KpiCacheService as any).recalculateAllBalanceKPI(u.id, 'UTC')
    }
    console.log('KPI rebuild complete')
    process.exit(0)
  } catch (err) {
    console.error('Error rebuilding KPI cache', err)
    process.exit(1)
  }
}

run()
