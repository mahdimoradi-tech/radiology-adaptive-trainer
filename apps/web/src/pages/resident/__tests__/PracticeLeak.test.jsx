import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { PracticeSetPage } from '../PracticeSetPage.jsx';
import '../../../i18n/index.js';

describe('PracticeSetPage Data Leak Guard (Security & Zero Label Leakage)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const forbiddenTerms = [
    'trueClass',
    'bucket',
    'difficulty',
    'confusedWith',
    'cohen_',
    'kermany_',
    'figure1_',
    'catalogId',
    'secret_rationale_premature',
  ];

  it('guarantees zero leakage of ground truth, buckets, source datasets or premature rationales', async () => {
    // Malicious server payload that erroneously contains forbidden metadata
    const leakyPracticeSet = {
      id: 'set-leak-check-999',
      status: 'in_progress',
      size: 2,
      answeredCount: 0,
      correctCount: 0,
      createdAt: '2026-11-07T10:00:00.000Z',
      // Erroneous server leaks
      trueClass: 'covid19',
      bucket: 'easy',
      difficulty: 0.12,
      confusedWith: 'pneumonia',
      source: 'cohen_dataset',
      catalogId: 'cohen_image_123',
      questions: [
        {
          no: 1,
          type: 'finding',
          stem: 'کدام یافته پاتولوژیک در کلیشه رادیوگرافی دیده می‌شود؟',
          options: ['گزینه ۱', 'گزینه ۲', 'گزینه ۳', 'گزینه ۴'],
          imageUrl: '/api/images/a1b2c3d4e5f67890/file',
          answered: false,
          // Erroneous un-stripped fields
          trueClass: 'covid19',
          bucket: 'easy',
          rationale: 'secret_rationale_premature',
          catalogId: 'kermany_img_001',
        },
        {
          no: 2,
          type: 'distribution',
          stem: 'سوال دوم',
          options: ['الف', 'ب', 'ج', 'د'],
          imageUrl: '/api/images/1234567890abcdef/file',
          answered: false,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: leakyPracticeSet }),
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/practice/set-leak-check-999']}>
          <Routes>
            <Route path="/app/practice/:setId" element={<PracticeSetPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/کدام یافته پاتولوژیک/i)).toBeInTheDocument();
    });

    const html = container.innerHTML;
    for (const term of forbiddenTerms) {
      expect(html, `Forbidden term found in DOM: "${term}"`).not.toContain(term);
    }

    // Check all attributes on all rendered elements
    const allElements = container.querySelectorAll('*');
    for (const el of allElements) {
      for (const attr of el.attributes) {
        for (const term of forbiddenTerms) {
          expect(
            attr.value,
            `Forbidden metadata term found in attribute ${attr.name}="${attr.value}" on <${el.tagName}>`,
          ).not.toContain(term);
        }
      }
    }

    // Image alt text must be generic, never revealing true class
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('alt')).not.toContain('covid');
    expect(img.getAttribute('alt')).not.toContain('pneumonia');
    expect(img.getAttribute('alt')).not.toContain('normal');
  });
});
