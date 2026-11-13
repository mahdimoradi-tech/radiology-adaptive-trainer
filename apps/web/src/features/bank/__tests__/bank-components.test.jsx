import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BankStatsStrip } from '../BankStatsStrip.jsx';
import { BankFilterBar } from '../BankFilterBar.jsx';
import { BankQuestionList } from '../BankQuestionList.jsx';
import { BankQuestionDetail } from '../BankQuestionDetail.jsx';
import * as bankApi from '../api.js';
import '../../../i18n/index.js';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Bank UI Components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockQuestion = {
    id: 'q-100',
    stableId: 'stable_100',
    imageId: 'img_cov_1',
    type: 'finding',
    pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
    bucket: 'hard',
    stem: 'کدام یافته پاتولوژیک اولیه در نمای رادیوگرافی مشهود است؟',
    options: [
      { text: 'کدورت شیشه‌مات', key: 'ground_glass' },
      { text: 'تراکم ریوی', key: 'consolidation' },
      { text: 'هوابرونکوگرام', key: 'air_bronchograms' },
      { text: 'ریه شفاف طبیعی', key: 'clear_lungs' },
    ],
    correctIndex: 0,
    rationale: 'کدورت شیشه‌مات نشانه کلیدی است.',
    kbRef: 'covid-vs-pneumonia-features',
    tags: ['finding'],
    status: 'pending_review',
    edited: false,
    imageUrl: '/api/images/pub_123/file',
    analysisSummary: {
      consensus: {
        patterns: ['ground_glass'],
        distribution: 'peripheral',
      },
      certaintyA: 'high',
      certaintyB: 'medium',
    },
    history: [
      {
        action: 'created',
        by: 'system',
        at: new Date().toISOString(),
      },
    ],
  };

  it('renders BankStatsStrip with pending, approved and rejected counts', async () => {
    vi.spyOn(bankApi, 'getBankStats').mockResolvedValue({
      countsByStatus: { pending_review: 5, approved: 10, rejected: 2, total: 17 },
      countsByType: { finding: 10, distribution: 5, differential: 2 },
      countsByPair: {},
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <BankStatsStrip />
      </Wrapper>,
    );

    expect(await screen.findByText('در انتظار')).toBeDefined();
    expect(screen.getByText('تأیید شده')).toBeDefined();
    expect(screen.getByText('رد شده')).toBeDefined();
    expect(screen.getByText('مجموع')).toBeDefined();
  });

  it('renders BankFilterBar and triggers filter changes', () => {
    const onFilterChange = vi.fn();
    render(
      <BankFilterBar filters={{ status: 'pending_review' }} onFilterChange={onFilterChange} />,
    );

    expect(screen.getByText('در انتظار بازبینی')).toBeDefined();
    expect(screen.getByText('تأیید شده')).toBeDefined();

    // Click on 'تأیید شده'
    fireEvent.click(screen.getByText('تأیید شده'));
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'approved', page: 1 }),
    );
  });

  it('renders BankQuestionList with question cards and type badge', () => {
    const onSelect = vi.fn();
    render(<BankQuestionList questions={[mockQuestion]} selectedId="q-100" onSelect={onSelect} />);

    expect(screen.getByText('یافته پاتولوژیک')).toBeDefined();
    expect(screen.getByText('covid19')).toBeDefined();
    expect(screen.getByText(mockQuestion.stem)).toBeDefined();

    // Click item triggers onSelect
    fireEvent.click(screen.getByText(mockQuestion.stem));
    expect(onSelect).toHaveBeenCalledWith('q-100');
  });

  it('renders BankQuestionDetail with honest labeling badge, consensus, and options', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onEdit = vi.fn();

    render(
      <BankQuestionDetail
        question={mockQuestion}
        onApprove={onApprove}
        onReject={onReject}
        onEdit={onEdit}
        isActionLoading={false}
      />,
    );

    // Honest labeling badge
    expect(screen.getByText('بازبینی توسط مدرس (غیر بالینی)')).toBeDefined();

    // Options rendering
    expect(screen.getByText('کدورت شیشه‌مات')).toBeDefined();
    expect(screen.getByText('پاسخ صحیح')).toBeDefined();
    expect(screen.getByText('تراکم ریوی')).toBeDefined();

    // Consensus summary
    expect(screen.getByText('اجماع تحلیل هوش مصنوعی')).toBeDefined();

    // Draft KB badge
    expect(screen.getByText('پیش‌نویس')).toBeDefined();

    // Approve action
    fireEvent.click(screen.getByText('تأیید'));
    expect(onApprove).toHaveBeenCalled();
  });

  it('opens edit form in BankQuestionDetail and cancels cleanly', () => {
    render(
      <BankQuestionDetail
        question={mockQuestion}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    // Click edit button
    fireEvent.click(screen.getByText('ویرایش'));

    // Edit form elements appear
    expect(
      screen.getByText('با ذخیره ویرایش، وضعیت سؤال مجدداً «در انتظار بازبینی» خواهد شد.'),
    ).toBeDefined();
    expect(screen.getByText('انصراف')).toBeDefined();
    expect(screen.getByText('ذخیره ویرایش')).toBeDefined();

    // Click cancel
    fireEvent.click(screen.getByText('انصراف'));

    // Returns to view mode
    expect(screen.getByText('بازبینی توسط مدرس (غیر بالینی)')).toBeDefined();
  });

  it('verifies that no bulk controls (multi-select / select all) exist in the list', () => {
    const { container } = render(
      <BankQuestionList questions={[mockQuestion]} selectedId="q-100" onSelect={vi.fn()} />,
    );

    // No checkboxes in list
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('renders English option letters (A, B, C, D) and labels in en mode', async () => {
    const { default: i18n } = await import('../../../i18n/index.js');
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    try {
      render(
        <BankQuestionDetail
          question={{ ...mockQuestion, edited: true }}
          onApprove={vi.fn()}
          onReject={vi.fn()}
          onEdit={vi.fn()}
        />,
      );

      // Verify edited badge in English
      expect(screen.getByText('Edited')).toBeInTheDocument();
      expect(screen.getByText('Distribution:')).toBeInTheDocument();
      expect(screen.getByText(/Model certainty:/)).toBeInTheDocument();

      // Open edit form
      fireEvent.click(screen.getByText('Edit'));

      // Check option letters A, B, C, D in English mode
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('C')).toBeInTheDocument();
      expect(screen.getByText('D')).toBeInTheDocument();
      expect(screen.queryByText('الف')).not.toBeInTheDocument();
    } finally {
      await act(async () => {
        await i18n.changeLanguage('fa');
      });
    }
  });
});
