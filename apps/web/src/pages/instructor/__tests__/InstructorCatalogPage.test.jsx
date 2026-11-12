import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { InstructorCatalogPage } from '../InstructorCatalogPage.jsx';
import * as api from '../../../features/catalog/api.js';
import '../../../i18n/index.js';

describe('InstructorCatalogPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockStats = {
    total: 1177,
    byClass: { covid19: 177, pneumonia: 500, normal: 500 },
    byBucket: { easy: 785, medium: 182, hard: 210 },
    byClassBucket: {
      covid19: { easy: 172, medium: 2, hard: 3 },
      pneumonia: { easy: 201, medium: 134, hard: 165 },
      normal: { easy: 412, medium: 46, hard: 42 },
    },
    bySource: {
      kermany: 1000,
      cohen: 142,
      figure1: 35,
    },
  };

  const mockImagesResult = {
    items: [
      {
        id: 'cohen_1a2b3c4d5e6f',
        filename: 'covid_scan_001.jpg',
        trueClass: 'covid19',
        source: 'cohen',
        difficulty: 0.125,
        bucket: 'easy',
        confusedWith: 'pneumonia',
        publicId: 'pub_covid_001',
        url: '/api/images/pub_covid_001/file',
      },
      {
        id: 'kermany_9z8y7x6w5v4u',
        filename: 'pneumonia_scan_042.jpeg',
        trueClass: 'pneumonia',
        source: 'kermany',
        difficulty: 0.742,
        bucket: 'hard',
        confusedWith: 'covid19',
        publicId: 'pub_pneu_042',
        url: '/api/images/pub_pneu_042/file',
      },
    ],
    meta: {
      total: 1177,
      page: 1,
      pageSize: 20,
      totalPages: 59,
    },
  };

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <InstructorCatalogPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders stats grid, distribution tables, and ADR 0005 bias notice', async () => {
    vi.spyOn(api, 'getCatalogStats').mockResolvedValue(mockStats);
    vi.spyOn(api, 'getCatalogImages').mockResolvedValue(mockImagesResult);

    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'پایش کاتالوگ تصاویر و درجه سختی' }),
    ).toBeInTheDocument();

    // Technical Note on Data Bias
    expect(screen.getByText('یادداشت فنی سوگیری داده و منابع')).toBeInTheDocument();
    expect(
      screen.getByText(/تمامی ۱۷۷ تصویر کووید-۱۹ از مجموعه‌های بزرگسالان/),
    ).toBeInTheDocument();

    // Stats Grid
    await waitFor(() => {
      expect(screen.getByText('توزیع رده بر اساس سطح سختی')).toBeInTheDocument();
      expect(screen.getByText('توزیع منابع داده')).toBeInTheDocument();
    });

    // Sources listed
    expect(screen.getAllByText('kermany').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('cohen').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('figure1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders images table with thumbnails, metadata, and badges', async () => {
    vi.spyOn(api, 'getCatalogStats').mockResolvedValue(mockStats);
    vi.spyOn(api, 'getCatalogImages').mockResolvedValue(mockImagesResult);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('covid_scan_001.jpg')).toBeInTheDocument();
      expect(screen.getByText('pneumonia_scan_042.jpeg')).toBeInTheDocument();
    });

    expect(screen.getByText('cohen_1a2b3c4d5e6f')).toBeInTheDocument();
    expect(screen.getByText('kermany_9z8y7x6w5v4u')).toBeInTheDocument();
    expect(screen.getByText('0.125')).toBeInTheDocument();
    expect(screen.getByText('0.742')).toBeInTheDocument();
  });

  it('applies filters and refetches images with updated filter parameters', async () => {
    vi.spyOn(api, 'getCatalogStats').mockResolvedValue(mockStats);
    const getImagesSpy = vi.spyOn(api, 'getCatalogImages').mockResolvedValue(mockImagesResult);

    renderPage();

    await waitFor(() => {
      expect(getImagesSpy).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        trueClass: undefined,
        bucket: undefined,
        source: undefined,
      });
    });

    // Filter by trueClass
    const classSelect = screen.getByLabelText(/رده تشخیصی/);
    fireEvent.change(classSelect, { target: { value: 'covid19' } });

    await waitFor(() => {
      expect(getImagesSpy).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        trueClass: 'covid19',
        bucket: undefined,
        source: undefined,
      });
    });

    // Filter by bucket
    const bucketSelect = screen.getByLabelText(/سطح سختی/);
    fireEvent.change(bucketSelect, { target: { value: 'hard' } });

    await waitFor(() => {
      expect(getImagesSpy).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        trueClass: 'covid19',
        bucket: 'hard',
        source: undefined,
      });
    });
  });

  it('handles pagination next and previous buttons', async () => {
    vi.spyOn(api, 'getCatalogStats').mockResolvedValue(mockStats);
    const getImagesSpy = vi.spyOn(api, 'getCatalogImages').mockResolvedValue(mockImagesResult);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'صفحه بعد' })).toBeInTheDocument();
    });

    const nextBtn = screen.getByRole('button', { name: 'صفحه بعد' });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(getImagesSpy).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
        trueClass: undefined,
        bucket: undefined,
        source: undefined,
      });
    });
  });

  it('renders empty state when no images match filters', async () => {
    vi.spyOn(api, 'getCatalogStats').mockResolvedValue(mockStats);
    vi.spyOn(api, 'getCatalogImages').mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, pageSize: 20, totalPages: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('هیچ تصویری با معیارهای انتخابی یافت نشد.')).toBeInTheDocument();
    });
  });

  it('renders error alert with retry button when stats or images fail to load', async () => {
    vi.spyOn(api, 'getCatalogStats').mockRejectedValue(new Error('Network error'));
    vi.spyOn(api, 'getCatalogImages').mockRejectedValue(new Error('Images error'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('خطا در دریافت آمار کاتالوگ.')).toBeInTheDocument();
      expect(screen.getByText('خطا در دریافت تصاویر کاتالوگ.')).toBeInTheDocument();
    });

    const retryButtons = screen.getAllByRole('button', { name: 'تلاش دوباره' });
    expect(retryButtons.length).toBeGreaterThanOrEqual(1);
  });
});
