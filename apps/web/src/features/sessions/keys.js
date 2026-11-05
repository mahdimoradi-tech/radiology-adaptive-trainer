/**
 * Query key factory for the sessions feature
 */
export const sessionKeys = {
  all: /** @type {const} */ (['sessions']),
  lists: () => [...sessionKeys.all, 'list'],
  list: (params) => [...sessionKeys.lists(), params],
  details: () => [...sessionKeys.all, 'detail'],
  detail: (id) => [...sessionKeys.details(), id],
  reports: () => [...sessionKeys.all, 'report'],
  report: (id) => [...sessionKeys.reports(), id],
};
