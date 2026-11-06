import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QuizPage } from '../QuizPage.jsx';
import '../../../i18n/index.js';

function renderQuiz(sessionId = 's-123', initialEntry = `/app/tests/${sessionId}`) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/app/tests/:sessionId" element={<QuizPage />} />
          <Route path="/app/reports/:sessionId" element={<div data-testid="report-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('QuizPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockSession = {
    id: 's-123',
    index: 1,
    kind: 'baseline',
    status: 'in_progress',
    size: 3,
    answeredCount: 1,
    questions: [
      {
        no: 1,
        imageUrl: '/api/images/pub-1/file',
        answered: true,
        answer: 'covid19',
      },
      {
        no: 2,
        imageUrl: '/api/images/pub-2/file',
        answered: false,
        answer: null,
      },
      {
        no: 3,
        imageUrl: '/api/images/pub-3/file',
        answered: false,
        answer: null,
      },
    ],
  };

  it('renders question and resumes to first unanswered question if ?q is absent', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockSession }),
    });

    renderQuiz('s-123', '/app/tests/s-123');

    // First unanswered question is question 2
    await waitFor(() => {
      expect(screen.getByText(/سؤال ۲:/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('radio', { name: /کووید-۱۹/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /ذات‌الریه/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /سالم/i })).not.toBeChecked();
  });

  it('navigates questions and reflects answered status in navigator', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (options?.method === 'PUT') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            data: { no: 2, answered: true, answer: 'pneumonia' },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockSession }),
      };
    });

    renderQuiz('s-123', '/app/tests/s-123?q=2');

    await waitFor(() => {
      expect(screen.getByText(/سؤال ۲:/i)).toBeInTheDocument();
    });

    const pneumoniaRadio = screen.getByRole('radio', { name: /ذات‌الریه/i });
    await user.click(pneumoniaRadio);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/sessions/s-123/questions/2/answer',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"answer":"pneumonia"'),
        }),
      );
    });
  });

  it('supports keyboard 1/2/3 for selecting answers', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (options?.method === 'PUT') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            data: { no: 3, answered: true, answer: 'normal' },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockSession }),
      };
    });

    renderQuiz('s-123', '/app/tests/s-123?q=3');

    await waitFor(() => {
      expect(screen.getByText(/سؤال ۳:/i)).toBeInTheDocument();
    });

    // Press keyboard '3' for normal
    await user.keyboard('3');

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/sessions/s-123/questions/3/answer',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"answer":"normal"'),
        }),
      );
    });
  });

  it('restores previous choice and displays error if PUT fails', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (options?.method === 'PUT') {
        return {
          ok: false,
          status: 500,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: { code: 'INTERNAL_ERROR', message: 'Failed to record answer' },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockSession }),
      };
    });

    renderQuiz('s-123', '/app/tests/s-123?q=2');

    await waitFor(() => {
      expect(screen.getByText(/سؤال ۲:/i)).toBeInTheDocument();
    });

    const covidRadio = screen.getByRole('radio', { name: /کووید-۱۹/i });
    await user.click(covidRadio);

    await waitFor(() => {
      expect(screen.getByText(/خطا در ثبت پاسخ/i)).toBeInTheDocument();
    });
  });

  it('redirects to report if PUT returns 409 SESSION_NOT_IN_PROGRESS', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation(async (url, options) => {
      if (options?.method === 'PUT') {
        return {
          ok: false,
          status: 409,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: {
              code: 'SESSION_NOT_IN_PROGRESS',
              message: 'Session is already finished',
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockSession }),
      };
    });

    renderQuiz('s-123', '/app/tests/s-123?q=2');

    await waitFor(() => {
      expect(screen.getByText(/سؤال ۲:/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('radio', { name: /کووید-۱۹/i }));

    await waitFor(() => {
      expect(screen.getByTestId('report-page')).toBeInTheDocument();
    });
  });

  it('redirects to report if opened session is already finished', async () => {
    const finishedSession = {
      ...mockSession,
      status: 'finished',
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: finishedSession }),
    });

    renderQuiz('s-123', '/app/tests/s-123');

    await waitFor(() => {
      expect(screen.getByTestId('report-page')).toBeInTheDocument();
    });
  });

  it('submits finish with application/json header and redirects to report', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      if (url.includes('/finish')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            data: { sessionId: 's-123', overall: { accuracy: 1 } },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockSession }),
      };
    });

    renderQuiz('s-123', '/app/tests/s-123?q=1');

    await waitFor(() => {
      expect(screen.getByText(/سؤال ۱:/i)).toBeInTheDocument();
    });

    // Open finish dialog
    const openFinishBtn = screen.getByRole('button', { name: /ثبت نهایی و خروج/i });
    await user.click(openFinishBtn);

    // Dialog is visible
    expect(screen.getByText(/تأیید ثبت نهایی آزمون/i)).toBeInTheDocument();

    // Confirm submission
    const confirmBtn = screen.getByRole('button', { name: /^ثبت نهایی$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        '/api/sessions/s-123/finish',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({}),
        }),
      );
      expect(screen.getByTestId('report-page')).toBeInTheDocument();
    });
  });

  it('displays translated error alert when finish fails with an ApiError', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      if (url.includes('/finish')) {
        return {
          ok: false,
          status: 415,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: {
              code: 'UNSUPPORTED_MEDIA_TYPE',
              message: 'Content-Type must be application/json',
            },
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockSession }),
      };
    });

    renderQuiz('s-123', '/app/tests/s-123?q=1');

    await waitFor(() => {
      expect(screen.getByText(/سؤال ۱:/i)).toBeInTheDocument();
    });

    const openFinishBtn = screen.getByRole('button', { name: /ثبت نهایی و خروج/i });
    await user.click(openFinishBtn);

    const confirmBtn = screen.getByRole('button', { name: /^ثبت نهایی$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByText(/درخواست نامعتبر بود/i)).toBeInTheDocument();
    });
  });
});
