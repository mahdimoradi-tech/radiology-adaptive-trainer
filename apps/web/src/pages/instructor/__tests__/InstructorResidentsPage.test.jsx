import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { InstructorResidentsPage } from '../InstructorResidentsPage.jsx';
import * as api from '../../../features/residents/api.js';
import '../../../i18n/index.js';

function renderResidentsPage(initialEntry = '/instructor/residents') {
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
          <Route path="/instructor/residents" element={<InstructorResidentsPage />} />
          <Route
            path="/instructor/residents/:userId"
            element={<div data-testid="resident-detail-view">Resident Detail View</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const mockResidentsList = {
  items: [
    {
      id: 'res-1',
      displayName: 'دکتر علی محمدی',
      email: 'dr.ali@hospital.test',
      sessionsFinished: 4,
      lastAccuracy: 0.78,
      lastActiveAt: '2026-11-05T14:30:00Z',
      createdAt: '2026-10-25T08:00:00Z',
    },
    {
      id: 'res-2',
      displayName: 'دکتر سارا رضایی',
      email: 'dr.sara@hospital.test',
      sessionsFinished: 1,
      lastAccuracy: 0.52,
      lastActiveAt: '2026-11-04T12:00:00Z',
      createdAt: '2026-10-26T09:00:00Z',
    },
  ],
  meta: {
    total: 25,
    page: 1,
    pageSize: 10,
    totalPages: 3,
  },
};

describe('InstructorResidentsPage (apps/web/src/pages/instructor/InstructorResidentsPage.jsx)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading spinner while residents data is being fetched', () => {
    vi.spyOn(api, 'getAdminResidents').mockReturnValue(new Promise(() => {}));
    renderResidentsPage();

    expect(screen.getByTestId('residents-loading')).toBeInTheDocument();
  });

  it('renders error state with retry button on query failure', async () => {
    vi.spyOn(api, 'getAdminResidents').mockRejectedValue(new Error('Server error'));
    renderResidentsPage();

    await waitFor(() => {
      expect(screen.getByTestId('residents-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('renders empty message when no residents are found', async () => {
    vi.spyOn(api, 'getAdminResidents').mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
    });

    renderResidentsPage();

    await waitFor(() => {
      expect(screen.getByTestId('residents-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('هیچ دستیاری یافت نشد.')).toBeInTheDocument();
  });

  it('renders residents table and navigates to detail page on row click', async () => {
    vi.spyOn(api, 'getAdminResidents').mockResolvedValue(mockResidentsList);
    renderResidentsPage();

    await waitFor(() => {
      expect(screen.getByTestId('residents-table')).toBeInTheDocument();
    });

    // Check residents rendered
    expect(screen.getByText('دکتر علی محمدی')).toBeInTheDocument();
    expect(screen.getByText('dr.ali@hospital.test')).toBeInTheDocument();
    expect(screen.getByText('دکتر سارا رضایی')).toBeInTheDocument();

    // Click on row to navigate
    const row = screen.getByTestId('resident-row-res-1');
    fireEvent.click(row);

    expect(screen.getByTestId('resident-detail-view')).toBeInTheDocument();
  });

  it('renders pagination controls and triggers page change', async () => {
    const spy = vi.spyOn(api, 'getAdminResidents').mockResolvedValue(mockResidentsList);
    renderResidentsPage();

    await waitFor(() => {
      expect(screen.getByTestId('pagination-next')).toBeInTheDocument();
    });

    const nextBtn = screen.getByTestId('pagination-next');
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);

    expect(spy).toHaveBeenCalledWith({ page: 2, pageSize: 10 });
  });
});
