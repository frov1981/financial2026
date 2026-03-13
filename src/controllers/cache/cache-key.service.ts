export const cacheKeys = {
  accountsByUser: (user_id: number) => `accounts_user_${user_id}`,
  categoriesByUser: (user_id: number) => `categories_user_${user_id}`,
  categoryGroupByUser: (user_id: number) => `category_group_user_${user_id}`,
}
