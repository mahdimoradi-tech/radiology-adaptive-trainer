import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ResidentHomePage } from '../resident/ResidentHomePage.jsx';
import { InstructorHomePage } from '../instructor/InstructorHomePage.jsx';
import '../../i18n/index.js';

function renderWithClient(ui, user) {
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

describe('Home Page Shells', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ResidentHomePage', () => {
    it('renders 4 cards matching the dashboard design and enables test actions for T06', () => {
      const mockResident = { id: 'r1', displayName: 'دکتر مرادی', role: 'resident' };
      renderWithClient(<ResidentHomePage />, mockResident);

      expect(screen.getByText(/خوش آمدید، دکتر مرادی/)).toBeInTheDocument();

      // Check the 4 cards
      const startTestBtn = screen.getByRole('button', { name: 'شروع آزمون' });
      expect(startTestBtn).not.toBeDisabled();
      expect(screen.getByRole('link', { name: /شروع آزمون/i })).toHaveAttribute(
        'href',
        '/app/tests',
      );

      expect(screen.getByRole('heading', { name: 'بازبینی آزمون‌ها' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'آموزش' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'اطلاعات کاربری' })).toBeInTheDocument();
    });
  });

  describe('InstructorHomePage', () => {
    it('renders 3 instructor cards for review, residents, and catalog', () => {
      const mockInstructor = { id: 'i1', displayName: 'دکتر استاد', role: 'instructor' };
      renderWithClient(<InstructorHomePage />, mockInstructor);

      expect(screen.getByText(/پنل استاد — دکتر استاد/)).toBeInTheDocument();

      expect(screen.getByText('بازبینی سؤال‌های هوش مصنوعی')).toBeInTheDocument();
      expect(screen.getByText('کارنامه رزیدنت‌ها')).toBeInTheDocument();
      expect(screen.getByText('کاتالوگ و سختی تصاویر')).toBeInTheDocument();
    });
  });
});
