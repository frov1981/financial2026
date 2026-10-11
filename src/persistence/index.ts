import 'dotenv/config'
import { createFirebasePersistenceAdapter } from './firebase-persistence.adapter'
import { PersistenceAdapter } from './persistence.adapter'
import { localPersistenceAdapter } from './local-persistence.adapter'

export type PersistenceProviderName = 'local' | 'firebase'

function configuredProvider(): PersistenceProviderName {
  const provider = process.env.PERSISTENCE_PROVIDER || 'local'
  if (provider !== 'local' && provider !== 'firebase') {
    throw new Error('PERSISTENCE_PROVIDER debe ser local o firebase')
  }
  return provider
}

export const persistenceProvider = configuredProvider()
export const persistenceAdapter: PersistenceAdapter = persistenceProvider === 'firebase'
  ? createFirebasePersistenceAdapter()
  : localPersistenceAdapter
