import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InstructorReviewPage } from '../InstructorReviewPage.jsx';
import * as bankApi from '../../../features/bank/api.js';
import '../../../i18n/index.js';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <InstructorReviewPage />
    </QueryClientProvider>,
  );
}

describe('InstructorReviewPage Integration', () => {
  const mockQuestions = [
    {
      id: 'q-1',
      stableId: 'stable_1',
      imageId: 'img_1',
      type: 'finding',
      pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
      bucket: 'medium',
      stem: 'سؤال اول: کدام یافته دیده می‌شود؟',
      options: [
        { text: 'شیشه‌مات', key: 'ground_glass' },
        { text: 'تراکم', key: 'consolidation' },
        { text: 'هوابرونکوگرام', key: 'air_bronchograms' },
        { text: 'شفاف', key: 'clear_lungs' },
      ],
      correctIndex: 0,
      rationale: 'توضیحات اول',
      kbRef: null,
      tags: [],
      status: 'pending_review',
      edited: false,
      imageUrl: '/api/images/pub1/file',
      history: [],
    },
    {
      id: 'q-2',
      stableId: 'stable_2',
      imageId: 'img_2',
      type: 'distribution',
      pair: { trueClass: 'pneumonia', confusedWith: 'normal' },
      bucket: 'easy',
      stem: 'سؤال دوم: توزیع ضایعه چیست؟',
      options: [
        { text: 'محیطی', key: 'peripheral' },
        { text: 'مرکزی', key: 'central_perihilar' },
        { text: 'منتشر', key: 'diffuse' },
        { text: 'لوبی', key: 'focal_lobar' },
      ],
      correctIndex: 3,
      rationale: 'توضیحات دوم',
      kbRef: null,
      tags: [],
      status: 'pending_review',
      edited: false,
      imageUrl: '/api/images/pub2/file',
      history: [],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(bankApi, 'getBankQuestions').mockResolvedValue({
      items: mockQuestions,
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    vi.spyOn(bankApi, 'getBankStats').mockResolvedValue({
      countsByStatus: { pending_review: 2, approved: 0, rejected: 0, total: 2 },
      countsByType: { finding: 1, distribution: 1, differential: 0 },
      countsByPair: { 'covid19:pneumonia': 1, 'pneumonia:normal': 1 },
    });
    vi.spyOn(bankApi, 'approveQuestion').mockResolvedValue({
      ...mockQuestions[0],
      status: 'approved',
    });
    vi.spyOn(bankApi, 'rejectQuestion').mockResolvedValue({
      ...mockQuestions[0],
      status: 'rejected',
    });
    vi.spyOn(bankApi, 'editQuestion').mockResolvedValue({
      ...mockQuestions[0],
      edited: true,
    });
  });

  it('renders page header, stats strip, questions list, and detail view for first question', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('سؤال اول: کدام یافته دیده می‌شود؟')).toBeDefined();
    });

    expect(screen.getByText('سؤال دوم: توزیع ضایعه چیست؟')).toBeDefined();
    expect(screen.getByText('بازبینی توسط مدرس (غیر بالینی)')).toBeDefined();
  });

  it('approves currently selected question and advances to next item', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('سؤال اول: کدام یافته دیده می‌شود؟')).toBeDefined();
    });

    // Click Approve button
    const approveBtn = screen.getByText('تأیید');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(bankApi.approveQuestion).toHaveBeenCalledWith('q-1', { note: undefined });
    });

    // Detail pane should advance to question 2
    await waitFor(() => {
      expect(screen.getByText('توضیحات دوم')).toBeDefined();
    });
  });

  it('handles keyboard shortcuts (J advances, K retreats, A approves)', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('سؤال اول: کدام یافته دیده می‌شود؟')).toBeDefined();
    });

    // Initially question 1 is selected
    expect(screen.getByText('توضیحات اول')).toBeDefined();

    // Press 'j' to navigate to next question
    fireEvent.keyDown(window, { key: 'j' });
    await waitFor(() => {
      expect(screen.getByText('توضیحات دوم')).toBeDefined();
    });

    // Press 'k' to navigate back to previous question
    fireEvent.keyDown(window, { key: 'k' });
    await waitFor(() => {
      expect(screen.getByText('توضیحات اول')).toBeDefined();
    });

    // Press 'a' to approve question 1
    fireEvent.keyDown(window, { key: 'a' });
    await waitFor(() => {
      expect(bankApi.approveQuestion).toHaveBeenCalledWith('q-1', { note: undefined });
    });
  });

  it('verifies that no bulk controls exist on the entire review page', async () => {
    const { container } = renderPage();

    await waitFor(() => {
      expect(screen.getByText('سؤال اول: کدام یافته دیده می‌شود؟')).toBeDefined();
    });

    // No checkbox anywhere on the review page
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });
});
