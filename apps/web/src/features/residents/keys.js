/**
 * TanStack Query key factories for instructor residents queries
 */
export const residentKeys = {
  all: ['admin', 'residents'],
  list: (params) => ['admin', 'residents', 'list', params],
  detail: (userId) => ['admin', 'residents', 'detail', userId],
};
