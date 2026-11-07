import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { PracticeHomePage } from '../PracticeHomePage.jsx';
import { PracticeSetPage } from '../PracticeSetPage.jsx';
import '../../../i18n/index.js';

describe('Practice Pages & Workflows (T09b)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function renderWithProviders(ui, initialRoute = '/') {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    );
  }

  describe('PracticeHomePage', () => {
    it('renders list of practice sets and handles empty state', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          data: [
            {
              id: 'set-001',
              status: 'completed',
              size: 10,
              answeredCount: 10,
              correctCount: 8,
              createdAt: '2026-11-07T10:00:00.000Z',
            },
          ],
          meta: { total: 1, page: 1, pageSize: 10, totalPages: 1 },
        }),
      });

      renderWithProviders(
        <Routes>
          <Route path="/app/practice" element={<PracticeHomePage />} />
        </Routes>,
        '/app/practice',
      );

      await waitFor(() => {
        expect(screen.getByText(/مشاهده ست/i)).toBeInTheDocument();
      });
    });

    it('displays NO_HISTORY alert with link to tests upon 409 conflict', async () => {
      globalThis.fetch = vi
        .fn()
        // 1. GET /api/practice
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            data: [],
            meta: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
          }),
        })
        // 2. POST /api/practice -> 409 NO_HISTORY
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: {
              code: 'NO_HISTORY',
              message: 'No finished session history found',
              statusCode: 409,
            },
          }),
        });

      renderWithProviders(
        <Routes>
          <Route path="/app/practice" element={<PracticeHomePage />} />
        </Routes>,
        '/app/practice',
      );

      await waitFor(() => {
        expect(screen.getByText(/شروع تمرین جدید/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/شروع تمرین جدید/i));

      await waitFor(() => {
        expect(
          screen.getByText(/ابتدا باید حداقل یک آزمون جامع را به پایان برسانید/i),
        ).toBeInTheDocument();
      });
      expect(screen.getByRole('link', { name: /مشاهده آزمون‌ها/i })).toBeInTheDocument();
    });

    it('displays PRACTICE_POOL_EXHAUSTED alert upon 409 conflict', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            data: [],
            meta: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            error: {
              code: 'PRACTICE_POOL_EXHAUSTED',
              message: 'No approved practice questions available',
              statusCode: 409,
            },
          }),
        });

      renderWithProviders(
        <Routes>
          <Route path="/app/practice" element={<PracticeHomePage />} />
        </Routes>,
        '/app/practice',
      );

      await waitFor(() => {
        expect(screen.getByText(/شروع تمرین جدید/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/شروع تمرین جدید/i));

      await waitFor(() => {
        expect(screen.getByText(/تمام سؤالات مصوب این بخش را پاسخ داده‌اید/i)).toBeInTheDocument();
      });
    });
  });

  describe('PracticeSetPage', () => {
    it('supports radio selection, submitting answer, and displaying rationale', async () => {
      const mockSet = {
        id: 'set-live-01',
        status: 'in_progress',
        size: 2,
        answeredCount: 0,
        correctCount: 0,
        createdAt: '2026-11-07T10:00:00.000Z',
        questions: [
          {
            no: 1,
            type: 'finding',
            stem: 'کدام یافته در ریه راست مشهود است؟',
            options: ['کدورت آلوئولار', 'نرمال', 'پنوموتوراکس', 'پلورال افیوژن'],
            imageUrl: '/api/images/opaque-test-01/file',
            answered: false,
          },
          {
            no: 2,
            type: 'distribution',
            stem: 'توزیع درگیری چگونه است؟',
            options: ['محیطی', 'مرکزی', 'قاعده‌ای', 'آپیکال'],
            imageUrl: '/api/images/opaque-test-02/file',
            answered: false,
          },
        ],
      };

      globalThis.fetch = vi
        .fn()
        // 1. Initial GET
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ data: mockSet }),
        })
        // 2. PUT answer
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            data: {
              correct: true,
              correctIndex: 0,
              rationale: 'کدورت آلوئولار به دلیل ترشحات عفونی در لوب تحتانی راست شکل گرفته است.',
              completed: false,
            },
          }),
        })
        // 3. Refetch updated set after answer
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            data: {
              ...mockSet,
              answeredCount: 1,
              correctCount: 1,
              questions: [
                {
                  ...mockSet.questions[0],
                  answered: true,
                  answer: {
                    selectedIndex: 0,
                    correct: true,
                    correctIndex: 0,
                    rationale:
                      'کدورت آلوئولار به دلیل ترشحات عفونی در لوب تحتانی راست شکل گرفته است.',
                  },
                },
                mockSet.questions[1],
              ],
            },
          }),
        });

      renderWithProviders(
        <Routes>
          <Route path="/app/practice/:setId" element={<PracticeSetPage />} />
        </Routes>,
        '/app/practice/set-live-01',
      );

      await waitFor(() => {
        expect(screen.getByText(/کدام یافته در ریه راست مشهود است؟/i)).toBeInTheDocument();
      });

      // Submit button should be disabled when nothing is selected
      const submitBtn = screen.getByRole('button', { name: /ثبت پاسخ/i });
      expect(submitBtn).toBeDisabled();

      // Select first option
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(4);
      fireEvent.click(radios[0]);

      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      // Verify rationale and correct indicator appear
      await waitFor(() => {
        expect(screen.getByText(/کدورت آلوئولار به دلیل ترشحات عفونی/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/پاسخ صحیح است/i)).toBeInTheDocument();

      // "Next question" button should appear
      expect(screen.getByRole('button', { name: /سؤال بعدی/i })).toBeInTheDocument();
    });
  });
});
