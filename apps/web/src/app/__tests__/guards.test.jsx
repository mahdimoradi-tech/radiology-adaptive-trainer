import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequireAuth } from '../guards/RequireAuth.jsx';
import { RequireRole } from '../guards/RequireRole.jsx';

function renderWithClient(ui, { initialEntries = ['/protected'], user = null } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  queryClient.setQueryData(['me'], user);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Route Guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RequireAuth', () => {
    it('redirects unauthenticated anonymous user to /login', () => {
      renderWithClient(
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div>صفحه محافظت شده</div>} />
          </Route>
          <Route path="/login" element={<div>صفحه ورود</div>} />
        </Routes>,
        { user: null },
      );

      expect(screen.queryByText('صفحه محافظت شده')).not.toBeInTheDocument();
      expect(screen.getByText('صفحه ورود')).toBeInTheDocument();
    });

    it('renders outlet when user is authenticated', () => {
      renderWithClient(
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/protected" element={<div>صفحه محافظت شده</div>} />
          </Route>
        </Routes>,
        { user: { id: 'u1', role: 'resident' } },
      );

      expect(screen.getByText('صفحه محافظت شده')).toBeInTheDocument();
    });
  });

  describe('RequireRole', () => {
    it('blocks resident user from instructor role and redirects to /forbidden', () => {
      renderWithClient(
        <Routes>
          <Route element={<RequireRole allowedRoles={['instructor']} />}>
            <Route path="/instructor-only" element={<div>بخش استاد</div>} />
          </Route>
          <Route path="/forbidden" element={<div>دسترسی غیرمجاز</div>} />
        </Routes>,
        {
          initialEntries: ['/instructor-only'],
          user: { id: 'u1', role: 'resident' },
        },
      );

      expect(screen.queryByText('بخش استاد')).not.toBeInTheDocument();
      expect(screen.getByText('دسترسی غیرمجاز')).toBeInTheDocument();
    });

    it('allows instructor user into instructor role', () => {
      renderWithClient(
        <Routes>
          <Route element={<RequireRole allowedRoles={['instructor']} />}>
            <Route path="/instructor-only" element={<div>بخش استاد</div>} />
          </Route>
          <Route path="/forbidden" element={<div>دسترسی غیرمجاز</div>} />
        </Routes>,
        {
          initialEntries: ['/instructor-only'],
          user: { id: 'u2', role: 'instructor' },
        },
      );

      expect(screen.getByText('بخش استاد')).toBeInTheDocument();
    });

    it('blocks resident trainee from accessing /instructor/residents and /instructor/residents/:userId', () => {
      // 1. Test /instructor/residents
      const { unmount } = renderWithClient(
        <Routes>
          <Route element={<RequireRole allowedRoles={['instructor']} />}>
            <Route path="/instructor/residents" element={<div>فهرست دستیاران استاد</div>} />
            <Route path="/instructor/residents/:userId" element={<div>جزئیات دستیار استاد</div>} />
          </Route>
          <Route path="/forbidden" element={<div>دسترسی غیرمجاز</div>} />
        </Routes>,
        {
          initialEntries: ['/instructor/residents'],
          user: { id: 'resident-user-1', role: 'resident' },
        },
      );

      expect(screen.queryByText('فهرست دستیاران استاد')).not.toBeInTheDocument();
      expect(screen.getByText('دسترسی غیرمجاز')).toBeInTheDocument();
      unmount();

      // 2. Test /instructor/residents/:userId
      renderWithClient(
        <Routes>
          <Route element={<RequireRole allowedRoles={['instructor']} />}>
            <Route path="/instructor/residents" element={<div>فهرست دستیاران استاد</div>} />
            <Route path="/instructor/residents/:userId" element={<div>جزئیات دستیار استاد</div>} />
          </Route>
          <Route path="/forbidden" element={<div>دسترسی غیرمجاز</div>} />
        </Routes>,
        {
          initialEntries: ['/instructor/residents/target-user-99'],
          user: { id: 'resident-user-1', role: 'resident' },
        },
      );

      expect(screen.queryByText('جزئیات دستیار استاد')).not.toBeInTheDocument();
      expect(screen.getByText('دسترسی غیرمجاز')).toBeInTheDocument();
    });
  });
});
