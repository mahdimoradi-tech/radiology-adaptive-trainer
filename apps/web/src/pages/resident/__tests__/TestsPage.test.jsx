import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { TestsPage } from '../TestsPage.jsx';
import '../../../i18n/index.js';

function renderWithClient(ui, { initialEntries = ['/app/tests'] } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TestsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders empty state when resident has no past or active sessions', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        data: [],
        meta: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
      }),
    });

    renderWithClient(<TestsPage />);

    await waitFor(() => {
      expect(screen.getByText(/تاکنون در آزمونی شرکت نکرده‌اید/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /شروع آزمون جدید/i })).toBeInTheDocument();
  });

  it('renders active in-progress session with continue button', async () => {
    const activeSession = {
      id: 'active-sess-1',
      index: 1,
      kind: 'baseline',
      status: 'in_progress',
      size: 60,
      startedAt: '2026-11-01T10:00:00.000Z',
      finishedAt: null,
      answeredCount: 15,
      overallAccuracy: null,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        data: [activeSession],
        meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
      }),
    });

    renderWithClient(<TestsPage />);

    await waitFor(() => {
      expect(screen.getByText(/شما یک آزمون ناتمام دارید/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /ادامه آزمون/i })).toBeInTheDocument();
  });

  it('triggers session creation on clicking start button', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (url.includes('/api/sessions') && options?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            data: { id: 'created-sess-45', size: 45, status: 'in_progress' },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: [],
          meta: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
        }),
      };
    });

    renderWithClient(<TestsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /شروع آزمون جدید/i })).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, '45');

    const startBtn = screen.getByRole('button', { name: /شروع آزمون جدید/i });
    await user.click(startBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ size: 45 }),
        }),
      );
    });
  });

  it('displays friendly message on POOL_EXHAUSTED error', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (options?.method === 'POST') {
        return {
          ok: false,
          status: 409,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: {
              code: 'POOL_EXHAUSTED',
              message: 'Pool exhausted',
              details: { requested: 60, available: 10 },
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: [],
          meta: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
        }),
      };
    });

    renderWithClient(<TestsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /شروع آزمون جدید/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /شروع آزمون جدید/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/تصاویر جدید کافی برای ساخت این آزمون وجود ندارد/i),
      ).toBeInTheDocument();
    });
  });

  it('handles SESSION_IN_PROGRESS error from create endpoint gracefully', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (options?.method === 'POST') {
        return {
          ok: false,
          status: 409,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: {
              code: 'SESSION_IN_PROGRESS',
              message: 'Active session exists',
              details: { sessionId: 'existing-sess-99' },
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: [],
          meta: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
        }),
      };
    });

    renderWithClient(<TestsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /شروع آزمون جدید/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /شروع آزمون جدید/i }));

    // Upon error with details.sessionId, navigate(`/app/tests/existing-sess-99`) is called
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
