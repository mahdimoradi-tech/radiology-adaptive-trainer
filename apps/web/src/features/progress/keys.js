/**
 * TanStack Query key factories for progress queries
 */
export const progressKeys = {
  all: ['progress'],
  resident: () => ['progress', 'resident'],
  adminUser: (userId) => ['progress', 'admin', userId],
};
