export const bankKeys = {
  all: ['bank'],
  lists: () => [...bankKeys.all, 'list'],
  list: (filters) => [...bankKeys.lists(), filters],
  stats: () => [...bankKeys.all, 'stats'],
  details: () => [...bankKeys.all, 'detail'],
  detail: (id) => [...bankKeys.details(), id],
};
