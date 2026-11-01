import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '../LoginPage.jsx';
import { RegisterPage } from '../RegisterPage.jsx';
import '../../../i18n/index.js';

function renderWithProviders(ui, { initialEntries = ['/login'], queryClient = null } = {}) {
  const client =
    queryClient ||
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Auth Pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('LoginPage', () => {
    it('shows client-side validation error on empty submit', async () => {
      renderWithProviders(<LoginPage />);

      fireEvent.click(screen.getByRole('button', { name: 'ورود به سامانه' }));

      await waitFor(() => {
        expect(screen.getByText(/Invalid email address|Email/i)).toBeInTheDocument();
      });
    });

    it('shows localized error alert on INVALID_CREDENTIALS response from API', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          },
        }),
      });

      renderWithProviders(<LoginPage />);

      fireEvent.change(screen.getByLabelText('ایمیل'), {
        target: { value: 'resident@example.com' },
      });
      fireEvent.change(screen.getByLabelText('گذرواژه'), {
        target: { value: 'wrongpass123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ورود به سامانه' }));

      await waitFor(() => {
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('ایمیل یا گذرواژه درست نیست.');
      });
    });

    it('redirects resident to /app on successful login', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: {
            user: {
              id: 'u1',
              email: 'resident@example.com',
              displayName: 'کارآموز یک',
              role: 'resident',
            },
          },
        }),
      });

      renderWithProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<div>پنل کارآموز</div>} />
        </Routes>,
      );

      fireEvent.change(screen.getByLabelText('ایمیل'), {
        target: { value: 'resident@example.com' },
      });
      fireEvent.change(screen.getByLabelText('گذرواژه'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ورود به سامانه' }));

      await waitFor(() => {
        expect(screen.getByText('پنل کارآموز')).toBeInTheDocument();
      });
    });

    it('redirects instructor to /instructor on successful login', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: {
            user: {
              id: 'u2',
              email: 'instructor@example.com',
              displayName: 'استاد محترم',
              role: 'instructor',
            },
          },
        }),
      });

      renderWithProviders(
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/instructor" element={<div>پنل استاد</div>} />
        </Routes>,
      );

      fireEvent.change(screen.getByLabelText('ایمیل'), {
        target: { value: 'instructor@example.com' },
      });
      fireEvent.change(screen.getByLabelText('گذرواژه'), {
        target: { value: 'password123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ورود به سامانه' }));

      await waitFor(() => {
        expect(screen.getByText('پنل استاد')).toBeInTheDocument();
      });
    });
  });

  describe('RegisterPage', () => {
    it('validates client fields and shows error when password is too short', async () => {
      renderWithProviders(<RegisterPage />, { initialEntries: ['/register'] });

      fireEvent.change(screen.getByLabelText('نام نمایشی'), {
        target: { value: 'علی' },
      });
      fireEvent.change(screen.getByLabelText('ایمیل'), {
        target: { value: 'ali@example.com' },
      });
      fireEvent.change(screen.getByLabelText('گذرواژه'), {
        target: { value: '123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'ایجاد حساب' }));

      await waitFor(() => {
        expect(screen.getByText(/Password must be between 8 and 72 bytes/i)).toBeInTheDocument();
      });
    });
  });
});
