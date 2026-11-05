import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ReviewPage } from '../ReviewPage.jsx';
import '../../../i18n/index.js';

function renderReview(
  sessionId = 'rev-1',
  initialEntry = `/app/reports/${sessionId}/review`,
  extra = null,
) {
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
          <Route path="/app/reports/:sessionId/review" element={<ReviewPage extra={extra} />} />
          <Route path="/app/tests/:sessionId" element={<div data-testid="quiz-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReviewPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockReport = {
    sessionId: 'rev-1',
    index: 1,
    kind: 'baseline',
    size: 3,
    answeredCount: 2,
    unansweredCount: 1,
    review: [
      {
        no: 1,
        imageUrl: '/api/images/img-1/file',
        trueClass: 'covid19',
        answer: 'covid19',
        correct: true,
        bucket: 'easy',
        difficulty: 0.12,
      },
      {
        no: 2,
        imageUrl: '/api/images/img-2/file',
        trueClass: 'pneumonia',
        answer: 'covid19',
        correct: false,
        bucket: 'medium',
        difficulty: 0.45,
      },
      {
        no: 3,
        imageUrl: '/api/images/img-3/file',
        trueClass: 'normal',
        answer: null,
        correct: null,
        bucket: 'hard',
        difficulty: 0.88,
      },
    ],
  };

  it('renders question review with correct and user answers', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockReport }),
    });

    renderReview('rev-1', '/app/reports/rev-1/review?q=1');

    await waitFor(() => {
      expect(screen.getByText(/سؤال ۱: درست/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/پاسخ شما:/i)).toBeInTheDocument();
    expect(screen.getByText(/پاسخ صحیح:/i)).toBeInTheDocument();
    expect(screen.getByText(/آسان/i)).toBeInTheDocument();
  });

  it('filters by incorrect questions and updates navigator view', async () => {
    const user = userEvent.setup();

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockReport }),
    });

    renderReview('rev-1', '/app/reports/rev-1/review?q=1');

    await waitFor(() => {
      expect(screen.getByText(/سؤال ۱: درست/i)).toBeInTheDocument();
    });

    // Click filter for incorrect
    const incorrectFilterBtn = screen.getByRole('button', { name: /فقط غلط‌ها/i });
    await user.click(incorrectFilterBtn);

    // Question 2 should automatically become active
    await waitFor(() => {
      expect(screen.getByText(/سؤال ۲: نادرست/i)).toBeInTheDocument();
    });
  });

  it('renders optional extra slot when provided', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockReport }),
    });

    const extraElement = <div data-testid="llm-feedback-slot">تحلیل هوش مصنوعی</div>;
    renderReview('rev-1', '/app/reports/rev-1/review?q=1', extraElement);

    await waitFor(() => {
      expect(screen.getByTestId('llm-feedback-slot')).toBeInTheDocument();
    });
    expect(screen.getByText('تحلیل هوش مصنوعی')).toBeInTheDocument();
  });

  it('redirects to quiz if session is not finished (409 SESSION_NOT_FINISHED)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: { code: 'SESSION_NOT_FINISHED', message: 'In progress' },
      }),
    });

    renderReview('rev-unfinished');

    await waitFor(() => {
      expect(screen.getByTestId('quiz-page')).toBeInTheDocument();
    });
  });
});
