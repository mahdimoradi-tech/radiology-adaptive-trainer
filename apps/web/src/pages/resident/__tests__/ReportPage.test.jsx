import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ReportPage } from '../ReportPage.jsx';
import '../../../i18n/index.js';

function renderReport(sessionId = 'rep-1', initialEntry = `/app/reports/${sessionId}`) {
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
          <Route path="/app/reports/:sessionId" element={<ReportPage />} />
          <Route path="/app/tests/:sessionId" element={<div data-testid="quiz-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockReport = {
    sessionId: 'rep-1',
    index: 1,
    kind: 'baseline',
    size: 60,
    answeredCount: 60,
    unansweredCount: 0,
    overall: {
      correct: 48,
      total: 60,
      accuracy: 0.8,
    },
    confusion: {
      covid19: { covid19: 18, pneumonia: 2, normal: 0 },
      pneumonia: { covid19: 4, pneumonia: 14, normal: 2 },
      normal: { covid19: 1, pneumonia: 3, normal: 16 },
    },
    perClass: {
      covid19: {
        tp: 18,
        fp: 5,
        fn: 2,
        tn: 35,
        accuracy: 0.9,
        precision: 0.78,
        recall: 0.9,
        f1: 0.84,
        fpr: 0.125,
        fnr: 0.1,
      },
      pneumonia: {
        tp: 14,
        fp: 5,
        fn: 6,
        tn: 35,
        accuracy: 0.7,
        precision: 0.74,
        recall: 0.7,
        f1: 0.72,
        fpr: 0.125,
        fnr: 0.3,
      },
      normal: {
        tp: 16,
        fp: 2,
        fn: 4,
        tn: 38,
        accuracy: 0.8,
        precision: 0.89,
        recall: 0.8,
        f1: 0.84,
        fpr: 0.05,
        fnr: 0.2,
      },
    },
    byClassBucket: {
      covid19: {
        easy: { correct: 8, incorrect: 0 },
        medium: { correct: 6, incorrect: 1 },
        hard: { correct: 4, incorrect: 1 },
      },
      pneumonia: {
        easy: { correct: 7, incorrect: 1 },
        medium: { correct: 5, incorrect: 2 },
        hard: { correct: 2, incorrect: 3 },
      },
      normal: {
        easy: { correct: 8, incorrect: 0 },
        medium: { correct: 5, incorrect: 2 },
        hard: { correct: 3, incorrect: 2 },
      },
    },
    mastered: false,
    perClassMastered: {
      covid19: true,
      pneumonia: false,
      normal: false,
    },
    plan: {
      classCounts: { covid19: 20, pneumonia: 20, normal: 20 },
      bucketCounts: {
        covid19: { easy: 8, medium: 7, hard: 5 },
        pneumonia: { easy: 8, medium: 7, hard: 5 },
        normal: { easy: 8, medium: 7, hard: 5 },
      },
      weights: { covid19: 0.33, pneumonia: 0.33, normal: 0.34 },
      errors: null,
      shortfalls: [
        { classId: 'covid19', bucket: 'hard', requested: 5, available: 1, shortfall: 4 },
      ],
      deficit: 4,
    },
    review: [],
  };

  it('renders report summary, confusion matrix, metrics table, and plan explanation', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: mockReport }),
    });

    const { container } = renderReport('rep-1');

    await waitFor(() => {
      expect(screen.getByText(/کارنامه آزمون شماره ۱/i)).toBeInTheDocument();
    });

    // Summary accuracy
    expect(screen.getAllByText(/۸۰٫۰٪/).length).toBeGreaterThan(0);

    // Confusion matrix diagonal check
    expect(screen.getByText(/کلاس واقعی \/ پاسخ شما/i)).toBeInTheDocument();

    // Per-class band label check: covid19 mastered -> «خوب (به هدف رسیده‌اید)»
    expect(screen.getAllByText(/خوب \(به هدف رسیده‌اید\)/i).length).toBeGreaterThan(0);

    // Plan card for baseline
    expect(screen.getByText(/این یک آزمون تشخیصی پایه و متوازن/i)).toBeInTheDocument();

    // PRIVACY CHECK: shortfalls must never be visible to residents!
    expect(container.innerHTML).not.toContain('shortfall');
    expect(container.innerHTML).not.toContain('deficit');
  });

  it('displays adaptive plan weights when kind is adaptive', async () => {
    const adaptiveReport = {
      ...mockReport,
      kind: 'adaptive',
      index: 2,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: adaptiveReport }),
    });

    renderReport('rep-2');

    await waitFor(() => {
      expect(screen.getByText(/کارنامه آزمون شماره ۲/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/این آزمون به صورت تطبیقی و متناسب با نقاط ضعف/i)).toBeInTheDocument();
  });

  it('renders zero answered state when no questions were answered', async () => {
    const zeroReport = {
      ...mockReport,
      answeredCount: 0,
      unansweredCount: 60,
      overall: { correct: 0, total: 0, accuracy: 0 },
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: zeroReport }),
    });

    renderReport('rep-zero');

    await waitFor(() => {
      expect(screen.getByText(/هیچ سؤالی در این آزمون پاسخ داده نشده است/i)).toBeInTheDocument();
    });

    // Confusion matrix table should be hidden
    expect(screen.queryByText(/کلاس واقعی \/ پاسخ شما/i)).not.toBeInTheDocument();
  });

  it('redirects to quiz if session is not finished (409 SESSION_NOT_FINISHED)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        error: {
          code: 'SESSION_NOT_FINISHED',
          message: 'Session has not been finished yet',
        },
      }),
    });

    renderReport('rep-in-progress');

    await waitFor(() => {
      expect(screen.getByTestId('quiz-page')).toBeInTheDocument();
    });
  });
});
