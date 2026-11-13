import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { EducationPage } from '../EducationPage.jsx';
import '../../../i18n/index.js';

describe('EducationPage', () => {
  let fetchSpy;

  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  function renderPage() {
    return render(
      <MemoryRouter>
        <EducationPage />
      </MemoryRouter>,
    );
  }

  it('renders without making any API or network calls', () => {
    renderPage();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders main page title, subtitle, and medical disclaimer banner', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'راهنمای آموزشی و چرخه یادگیری' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/آشنایی با ساختار آموزش تطبیقی/)).toBeInTheDocument();

    // Disclaimer alert
    expect(screen.getByText('هدف سامانه و سلب مسئولیت پزشکی')).toBeInTheDocument();
    expect(
      screen.getByText(/این پلتفرم صرفاً یک ابزار کمک‌آموزشی مبتنی بر وب/),
    ).toBeInTheDocument();
  });

  it('renders all four stages of the adaptive learning cycle', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 2, name: 'چرخه یادگیری انطباقی چگونه کار می‌کند؟' }),
    ).toBeInTheDocument();
    expect(screen.getByText('۱. سنجش اولیه و آزمون')).toBeInTheDocument();
    expect(screen.getByText('۲. استخراج الگوی خطا')).toBeInTheDocument();
    expect(screen.getByText('۳. بازتخصیص هوشمند وزن‌ها')).toBeInTheDocument();
    expect(screen.getByText('۴. تمرین و تسلط تشخیصی')).toBeInTheDocument();
  });

  it('renders definitions for confusion metrics (False Positive and False Negative)', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 2, name: 'راهنمای تفسیر شاخص‌های خطا در کارنامه' }),
    ).toBeInTheDocument();
    expect(screen.getByText('خطای مثبت کاذب (False Positive - FP)')).toBeInTheDocument();
    expect(screen.getByText('خطای منفی کاذب (False Negative - FN)')).toBeInTheDocument();
    expect(
      screen.getByText(/تشخیص اشتباه کووید-۱۹ برای یک رادیوگرافی کاملاً طبیعی/),
    ).toBeInTheDocument();
    expect(screen.getByText(/ندیدن ارتشاح ذات‌الریه و طبیعی دانستن کلیشه/)).toBeInTheDocument();
  });

  it('renders grounded radiological findings for the three diagnostic classes without leaking codebase paths', () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 2, name: 'نشانه‌های رادیولوژیک رده‌های تشخیصی' }),
    ).toBeInTheDocument();

    // 3 classes
    expect(screen.getByText('کووید-۱۹ (COVID-19)')).toBeInTheDocument();
    expect(screen.getByText('ذات‌الریه (Pneumonia)')).toBeInTheDocument();
    expect(screen.getByText('طبیعی (Normal)')).toBeInTheDocument();

    // Grounded knowledge snippets
    expect(
      screen.getByText(/کدورت‌های دوطرفه آلوئولار، اغلب با برتری محیطی و در لوب‌های تحتانی/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /پنومونی باکتریال معمولاً با تثبیت فوکال لوبار یا سگمنتال همراه با برونکوگرام هوایی/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/زوایای دنده‌ای-دیافراگمی \(کوستوفرنیک\) تیز و مشخص/),
    ).toBeInTheDocument();

    // Codebase file paths should not be displayed to users
    expect(screen.queryByText(/apps\/api\/src\/modules/)).not.toBeInTheDocument();
  });

  it('renders localized badges and English titles without leaking Persian strings in en mode', async () => {
    const { default: i18n } = await import('../../../i18n/index.js');
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    try {
      renderPage();

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Initial Assessment')).toBeInTheDocument();
      expect(screen.getByText('False Positive')).toBeInTheDocument();
      expect(screen.getByText('False Negative')).toBeInTheDocument();
      expect(screen.getAllByText('Diagnostic Class').length).toBe(3);

      // No hardcoded Persian strings in en mode
      expect(screen.queryByText('مثبت کاذب')).not.toBeInTheDocument();
      expect(screen.queryByText('منفی کاذب')).not.toBeInTheDocument();
      expect(screen.queryByText('سنجش نخست')).not.toBeInTheDocument();
    } finally {
      await act(async () => {
        await i18n.changeLanguage('fa');
      });
    }
  });
});
