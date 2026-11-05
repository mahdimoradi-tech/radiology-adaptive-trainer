import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QuizPage } from '../QuizPage.jsx';
import '../../../i18n/index.js';

describe('QuizPage Data Leak Guard (Security & Privacy)', () => {
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
    'chestxray14_',
  ];

  it('guarantees zero leakage of ground truth, buckets, difficulty, or source metadata in HTML and attributes', async () => {
    // Realistic public session fixture as returned by GET /api/sessions/:id
    const realisticPublicSession = {
      id: 'sess-secure-777',
      index: 2,
      kind: 'adaptive',
      status: 'in_progress',
      size: 45,
      startedAt: '2026-11-05T08:00:00.000Z',
      finishedAt: null,
      answeredCount: 1,
      questions: [
        {
          no: 1,
          imageUrl: '/api/images/a1b2c3d4e5f67890/file',
          answered: true,
          answer: 'covid19',
        },
        {
          no: 2,
          imageUrl: '/api/images/f9e8d7c6b5a43210/file',
          answered: false,
          answer: null,
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: realisticPublicSession }),
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/app/tests/sess-secure-777?q=1']}>
          <Routes>
            <Route path="/app/tests/:sessionId" element={<QuizPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/سؤال ۱:/i)).toBeInTheDocument();
    });

    // 1. Check full rendered HTML for forbidden terms
    const html = container.innerHTML;
    for (const term of forbiddenTerms) {
      expect(html, `Forbidden metadata term found in HTML: ${term}`).not.toContain(term);
    }

    // 2. Deep check all elements and their attributes
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

    // 3. Check image src attributes: must be opaque /api/images/:publicId/file, never contain class names
    const images = container.querySelectorAll('img');
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      const src = img.getAttribute('src') || '';
      expect(src).toMatch(/^\/api\/images\/[a-f0-9]+\/file$/);
      expect(src).not.toContain('covid');
      expect(src).not.toContain('pneumonia');
      expect(src).not.toContain('normal');
    }
  });
});
