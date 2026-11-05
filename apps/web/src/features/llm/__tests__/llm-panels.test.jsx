import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LlmPanel } from '../LlmPanel.jsx';
import { NarrativePanel } from '../NarrativePanel.jsx';
import { QuestionExplanationPanel } from '../QuestionExplanationPanel.jsx';
import '../../../i18n/index.js';

function renderWithQuery(ui) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('LLM UI Panels', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('LlmPanel', () => {
    it('renders title, educational disclaimer and source badge for fallback', () => {
      renderWithQuery(
        <LlmPanel title="تحلیل تست" source="fallback" reviewed={true}>
          <p>متن تحلیل تستی</p>
        </LlmPanel>,
      );

      expect(screen.getByText('تحلیل تست')).toBeInTheDocument();
      expect(screen.getByText('متن تحلیل تستی')).toBeInTheDocument();
      expect(screen.getByText('قالب ثابت')).toBeInTheDocument();
      expect(screen.getByText(/این سامانه فقط برای آموزش است/)).toBeInTheDocument();
    });

    it('renders source badge for llm and draft badge when reviewed=false', () => {
      renderWithQuery(
        <LlmPanel source="llm" reviewed={false}>
          <p>محتوای هوش مصنوعی</p>
        </LlmPanel>,
      );

      expect(screen.getByText(/تولید شده با هوش مصنوعی/)).toBeInTheDocument();
      expect(screen.getByText('پیش‌نویس')).toBeInTheDocument();
    });

    it('renders source badge for cache', () => {
      renderWithQuery(
        <LlmPanel source="cache" reviewed={true}>
          <p>محتوای کش‌شده</p>
        </LlmPanel>,
      );

      expect(screen.getByText('ذخیره‌شده')).toBeInTheDocument();
      expect(screen.queryByText('پیش‌نویس')).not.toBeInTheDocument();
    });

    it('renders skeleton pulse while isLoading=true', () => {
      const { container } = renderWithQuery(
        <LlmPanel isLoading={true}>
          <p>نباید نشان داده شود</p>
        </LlmPanel>,
      );

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
      expect(screen.queryByText('نباید نشان داده شود')).not.toBeInTheDocument();
    });
  });

  describe('NarrativePanel', () => {
    it('fetches and renders narrative content', async () => {
      const mockNarrativeResponse = {
        source: 'llm',
        reviewed: false,
        narrative: {
          overview: 'خلاصه عملکرد آموزشی کاربر در آزمون اول.',
          strengths: ['مهارت بالا در تصاویر نرمال'],
          weaknesses: ['دشواری در تفکیک کووید و پنومونی'],
          patterns: ['گرایش به خطای منفی کاذب'],
          recommendations: [
            'توصیه ۱: مرور تصاویر شیشه‌مات',
            'توصیه ۲: دقت به زاویه دنده‌ای',
            'توصیه ۳: تکرار آزمون تطبیقی',
          ],
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockNarrativeResponse,
      });

      renderWithQuery(<NarrativePanel sessionId="sess-123" />);

      await waitFor(() => {
        expect(screen.getByText('خلاصه عملکرد آموزشی کاربر در آزمون اول.')).toBeInTheDocument();
      });

      expect(screen.getByText('مهارت بالا در تصاویر نرمال')).toBeInTheDocument();
      expect(screen.getByText('دشواری در تفکیک کووید و پنومونی')).toBeInTheDocument();
      expect(screen.getByText('گرایش به خطای منفی کاذب')).toBeInTheDocument();
      expect(screen.getByText('توصیه ۱: مرور تصاویر شیشه‌مات')).toBeInTheDocument();
      expect(screen.getByText('توصیه ۲: دقت به زاویه دنده‌ای')).toBeInTheDocument();
      expect(screen.getByText('توصیه ۳: تکرار آزمون تطبیقی')).toBeInTheDocument();
    });
  });

  describe('QuestionExplanationPanel', () => {
    it('fetches and renders explanation for a specific wrong question number', async () => {
      const mockExplanationsResponse = {
        source: 'cache',
        reviewed: false,
        items: [
          {
            no: 3,
            trueClass: 'covid19',
            userAnswer: 'pneumonia',
            whatToLookFor: ['کدورت‌های دوطرفه و حاشیه‌ای'],
            whyConfused: 'شباهت ظاهری با پنومونی ویروسی',
            tip: 'تثبیت لوبار را با دقت بیشتری چک کنید',
          },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockExplanationsResponse,
      });

      renderWithQuery(<QuestionExplanationPanel sessionId="sess-123" questionNo={3} />);

      await waitFor(() => {
        expect(screen.getByText('کدورت‌های دوطرفه و حاشیه‌ای')).toBeInTheDocument();
      });

      expect(screen.getByText('شباهت ظاهری با پنومونی ویروسی')).toBeInTheDocument();
      expect(screen.getByText('تثبیت لوبار را با دقت بیشتری چک کنید')).toBeInTheDocument();
    });

    it('returns null when question has no error explanation (correct answer)', async () => {
      const mockExplanationsResponse = {
        source: 'cache',
        reviewed: false,
        items: [],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockExplanationsResponse,
      });

      const { container } = renderWithQuery(
        <QuestionExplanationPanel sessionId="sess-123" questionNo={1} />,
      );

      await waitFor(() => {
        expect(container.firstChild).toBeNull();
      });
    });
  });
});
