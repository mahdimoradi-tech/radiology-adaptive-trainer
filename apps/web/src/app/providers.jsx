import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDirection } from '../lib/direction.js';
import '../i18n/index.js';

function DirectionEnforcer({ children }) {
  useDirection();
  return children;
}

/**
 * Root providers wrapper configuring TanStack Query and i18n RTL direction syncing
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function AppProviders({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DirectionEnforcer>{children}</DirectionEnforcer>
    </QueryClientProvider>
  );
}
