export const cacheKeys = {
  categoriesByUser: (user_id: number) => `categories_user_${user_id}`,
  accountsByUser: (user_id: number) => `accounts_user_${user_id}`
}
