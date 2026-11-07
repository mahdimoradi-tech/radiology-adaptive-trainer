/**
 * TanStack Query key factories for catalog queries
 */
export const catalogKeys = {
  all: ['catalog'],
  stats: () => ['catalog', 'stats'],
  list: (params) => ['catalog', 'images', params],
};
