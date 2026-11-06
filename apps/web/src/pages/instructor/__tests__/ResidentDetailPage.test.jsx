import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ResidentDetailPage } from '../ResidentDetailPage.jsx';
import * as api from '../../../features/progress/api.js';
import '../../../i18n/index.js';

function renderDetailPage(userId = 'res-1', initialEntry = `/instructor/residents/${userId}`) {
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
          <Route
            path="/instructor/residents"
            element={<div data-testid="residents-list">Residents List</div>}
          />
          <Route path="/instructor/residents/:userId" element={<ResidentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const mockResidentProgress = {
  sessions: [
    {
      id: 'sess-10',
      index: 1,
      kind: 'baseline',
      finishedAt: '2026-11-02T10:00:00Z',
      overallAccuracy: 0.6,
      perClass: {
        covid19: { accuracy: 0.6, fpr: 0.2, fnr: 0.4 },
        pneumonia: { accuracy: 0.55, fpr: 0.2, fnr: 0.45 },
        normal: { accuracy: 0.65, fpr: 0.15, fnr: 0.35 },
      },
      mastered: false,
    },
    {
      id: 'sess-11',
      index: 2,
      kind: 'adaptive',
      finishedAt: '2026-11-03T10:00:00Z',
      overallAccuracy: 0.75,
      perClass: {
        covid19: { accuracy: 0.75, fpr: 0.12, fnr: 0.25 },
        pneumonia: { accuracy: 0.7, fpr: 0.15, fnr: 0.3 },
        normal: { accuracy: 0.8, fpr: 0.1, fnr: 0.2 },
      },
      mastered: false,
    },
  ],
  topConfusions: [{ trueClass: 'pneumonia', predicted: 'covid19', count: 5 }],
  currentWeights: { covid19: 0.35, pneumonia: 0.4, normal: 0.25 },
  currentErrors: null,
  totals: {
    sessionsFinished: 2,
    answered: 90,
  },
};

describe('ResidentDetailPage (apps/web/src/pages/instructor/ResidentDetailPage.jsx)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading spinner while progress data is being loaded', () => {
    vi.spyOn(api, 'getAdminUserProgress').mockReturnValue(new Promise(() => {}));
    renderDetailPage('res-1');

    expect(screen.getByTestId('resident-detail-loading')).toBeInTheDocument();
  });

  it('renders error state when user is not found or id is invalid', async () => {
    vi.spyOn(api, 'getAdminUserProgress').mockRejectedValue(new Error('User not found'));
    renderDetailPage('res-invalid');

    await waitFor(() => {
      expect(screen.getByTestId('resident-detail-error')).toBeInTheDocument();
    });
    expect(screen.getByText('دستیار مورد نظر یافت نشد.')).toBeInTheDocument();
    expect(screen.getByText('User not found')).toBeInTheDocument();
  });

  it('renders resident progress trajectory using ProgressView in instructor mode', async () => {
    vi.spyOn(api, 'getAdminUserProgress').mockResolvedValue(mockResidentProgress);
    renderDetailPage('res-1');

    await waitFor(() => {
      expect(screen.getByTestId('resident-detail-page')).toBeInTheDocument();
    });

    // Check header and breadcrumb
    expect(screen.getByText('res-1')).toBeInTheDocument();

    // Check ProgressView elements rendered
    expect(screen.getByTestId('progress-view')).toBeInTheDocument();
    expect(screen.getByTestId('series-group-covid19')).toBeInTheDocument();
    expect(screen.getByTestId('history-table')).toBeInTheDocument();
    expect(screen.getByTestId('top-confusions-list')).toBeInTheDocument();
  });
});
