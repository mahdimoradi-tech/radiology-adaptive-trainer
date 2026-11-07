/**
 * Query key factory for targeted practice queries
 */
export const practiceKeys = {
  all: ['practice'],
  lists: () => [...practiceKeys.all, 'list'],
  list: (params) => [...practiceKeys.lists(), params],
  details: () => [...practiceKeys.all, 'detail'],
  detail: (id) => [...practiceKeys.details(), id],
};
