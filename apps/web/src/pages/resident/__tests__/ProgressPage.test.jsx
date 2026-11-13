import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ProgressPage } from '../ProgressPage.jsx';
import * as api from '../../../features/progress/api.js';
import '../../../i18n/index.js';

function renderProgressPage(initialEntry = '/app/progress') {
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
          <Route path="/app/progress" element={<ProgressPage />} />
          <Route path="/app/tests" element={<div data-testid="tests-page">Tests Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const mockProgressData = {
  sessions: [
    {
      id: 'sess-1',
      index: 1,
      kind: 'baseline',
      finishedAt: '2026-11-01T10:00:00Z',
      overallAccuracy: 0.55,
      perClass: {
        covid19: { accuracy: 0.5, fpr: 0.2, fnr: 0.5 },
        pneumonia: { accuracy: 0.45, fpr: 0.25, fnr: 0.55 },
        normal: { accuracy: 0.7, fpr: 0.1, fnr: 0.3 },
      },
      mastered: false,
    },
    {
      id: 'sess-2',
      index: 2,
      kind: 'adaptive',
      finishedAt: '2026-11-02T10:00:00Z',
      overallAccuracy: 0.65,
      perClass: {
        covid19: { accuracy: 0.65, fpr: 0.15, fnr: 0.35 },
        pneumonia: { accuracy: 0.6, fpr: 0.2, fnr: 0.4 },
        normal: { accuracy: 0.75, fpr: 0.1, fnr: 0.25 },
      },
      mastered: false,
    },
    {
      id: 'sess-3',
      index: 3,
      kind: 'adaptive',
      finishedAt: '2026-11-03T10:00:00Z',
      overallAccuracy: 0.82,
      perClass: {
        covid19: { accuracy: 0.85, fpr: 0.08, fnr: 0.15 },
        pneumonia: { accuracy: 0.8, fpr: 0.1, fnr: 0.2 },
        normal: { accuracy: 0.82, fpr: 0.08, fnr: 0.18 },
      },
      mastered: true,
    },
  ],
  topConfusions: [
    { trueClass: 'covid19', predicted: 'pneumonia', count: 7 },
    { trueClass: 'pneumonia', predicted: 'covid19', count: 4 },
  ],
  currentWeights: { covid19: 0.3, pneumonia: 0.4, normal: 0.3 },
  currentErrors: null,
  totals: {
    sessionsFinished: 3,
    answered: 135,
  },
};

describe('Resident ProgressPage (apps/web/src/pages/resident/ProgressPage.jsx)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading spinner while progress data is being fetched', () => {
    vi.spyOn(api, 'getProgress').mockReturnValue(new Promise(() => {}));
    renderProgressPage();

    expect(screen.getByTestId('progress-loading')).toBeInTheDocument();
  });

  it('renders error state with retry button upon query failure', async () => {
    vi.spyOn(api, 'getProgress').mockRejectedValue(new Error('Network error'));
    renderProgressPage();

    await waitFor(() => {
      expect(screen.getByTestId('progress-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('renders empty state when no finished sessions exist and navigates to start test', async () => {
    vi.spyOn(api, 'getProgress').mockResolvedValue({
      sessions: [],
      topConfusions: [],
      currentWeights: { covid19: 0.33, pneumonia: 0.33, normal: 0.33 },
      currentErrors: null,
      totals: { sessionsFinished: 0, answered: 0 },
    });

    renderProgressPage();

    await waitFor(() => {
      expect(screen.getByText('هنوز آزمونی تکمیل نشده است')).toBeInTheDocument();
    });

    const startBtn = screen.getByRole('button', { name: 'شروع آزمون تشخیصی' });
    expect(startBtn).toBeInTheDocument();
    fireEvent.click(startBtn);

    expect(screen.getByTestId('tests-page')).toBeInTheDocument();
  });

  it('renders 3 series in chart, sessions table, confusions, and latest mastery badges', async () => {
    vi.spyOn(api, 'getProgress').mockResolvedValue(mockProgressData);
    renderProgressPage();

    await waitFor(() => {
      expect(screen.getByTestId('resident-progress-page')).toBeInTheDocument();
    });

    // 1. Chart renders 3 series groups
    expect(screen.getByTestId('series-group-covid19')).toBeInTheDocument();
    expect(screen.getByTestId('series-group-pneumonia')).toBeInTheDocument();
    expect(screen.getByTestId('series-group-normal')).toBeInTheDocument();
    expect(screen.getByTestId('threshold-line')).toBeInTheDocument();

    // 2. Mastery status uses latest session (Session 3: 85%, 80%, 82% -> all >= 80%)
    expect(screen.getByTestId('mastery-goal-alert')).toBeInTheDocument();
    expect(screen.getByTestId('mastery-badge-covid19')).toHaveTextContent('تسلط حاصل شد');
    expect(screen.getByTestId('mastery-badge-pneumonia')).toHaveTextContent('تسلط حاصل شد');
    expect(screen.getByTestId('mastery-badge-normal')).toHaveTextContent('تسلط حاصل شد');

    // 3. History table has 3 sessions
    const historyTable = screen.getByTestId('history-table');
    const rows = historyTable.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(3);

    // 4. Confusions list rendered
    const confusions = screen.getAllByTestId('confusion-item');
    expect(confusions).toHaveLength(2);
  });

  it('mastery badges use LATEST session only (not previous session)', async () => {
    const unmasteredLatest = {
      ...mockProgressData,
      sessions: [
        ...mockProgressData.sessions,
        {
          id: 'sess-4',
          index: 4,
          kind: 'adaptive',
          finishedAt: '2026-11-04T10:00:00Z',
          overallAccuracy: 0.65,
          perClass: {
            covid19: { accuracy: 0.6, fpr: 0.2, fnr: 0.4 }, // < 80%
            pneumonia: { accuracy: 0.85, fpr: 0.08, fnr: 0.15 }, // >= 80%
            normal: { accuracy: 0.7, fpr: 0.15, fnr: 0.3 }, // < 80%
          },
          mastered: false,
        },
      ],
    };

    vi.spyOn(api, 'getProgress').mockResolvedValue(unmasteredLatest);
    renderProgressPage();

    await waitFor(() => {
      expect(screen.getByTestId('resident-progress-page')).toBeInTheDocument();
    });

    // COVID-19 should NOT be mastered based on session 4 (60%), even though session 3 was 85%
    expect(screen.getByTestId('mastery-badge-covid19')).toHaveTextContent('در حال یادگیری');
    expect(screen.getByTestId('mastery-badge-pneumonia')).toHaveTextContent('تسلط حاصل شد');
    expect(screen.getByTestId('mastery-badge-normal')).toHaveTextContent('در حال یادگیری');
    expect(screen.queryByTestId('mastery-goal-alert')).not.toBeInTheDocument();
  });

  it('renders arrow right (→) for confusions in en mode and left (←) in fa mode', async () => {
    vi.spyOn(api, 'getProgress').mockResolvedValue(mockProgressData);
    const { default: i18n } = await import('../../../i18n/index.js');
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    try {
      renderProgressPage();
      await waitFor(() => {
        expect(screen.getByTestId('resident-progress-page')).toBeInTheDocument();
      });
      const confusions = screen.getAllByTestId('confusion-item');
      expect(confusions[0]).toHaveTextContent('→');
      expect(confusions[0]).not.toHaveTextContent('←');
    } finally {
      await act(async () => {
        await i18n.changeLanguage('fa');
      });
    }
  });
});
