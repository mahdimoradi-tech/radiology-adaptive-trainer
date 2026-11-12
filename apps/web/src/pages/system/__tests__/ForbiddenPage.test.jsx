import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ForbiddenPage } from '../ForbiddenPage.jsx';
import '../../../i18n/index.js';

function renderWithClient(ui, { user = null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(['me'], user);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ForbiddenPage', () => {
  it('links back to /instructor when user has instructor role (BUG-005)', () => {
    renderWithClient(<ForbiddenPage />, { user: { id: 'u1', role: 'instructor' } });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/instructor');
  });

  it('links back to /app when user has resident role', () => {
    renderWithClient(<ForbiddenPage />, { user: { id: 'u2', role: 'resident' } });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/app');
  });

  it('links back to /auth/login when user is unauthenticated', () => {
    renderWithClient(<ForbiddenPage />, { user: null });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/auth/login');
  });
});
