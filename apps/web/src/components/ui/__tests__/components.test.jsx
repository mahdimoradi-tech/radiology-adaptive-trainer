import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Button,
  Input,
  Select,
  Field,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Alert,
  Badge,
  EmptyState,
  Spinner,
  XrayImage,
} from '../index.js';

describe('UI Kit Components', () => {
  describe('Button', () => {
    it('renders text and fires onClick', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>کلیک کنید</Button>);
      const btn = screen.getByRole('button', { name: 'کلیک کنید' });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('disables button and displays loading state when isLoading is true', () => {
      render(<Button isLoading>در حال ارسال</Button>);
      const btn = screen.getByRole('button', { name: 'در حال ارسال' });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Input', () => {
    it('renders input with standard attributes', () => {
      render(<Input id="test-email" name="email" type="email" placeholder="test@example.com" />);
      const input = screen.getByPlaceholderText('test@example.com');
      expect(input).toHaveAttribute('type', 'email');
      expect(input).toHaveAttribute('id', 'test-email');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('applies error state and aria-invalid when error prop is provided', () => {
      render(<Input id="test-pwd" error="خطای گذرواژه" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'test-pwd-error');
      expect(input.className).toContain('border-rose-400');
    });
  });

  describe('Select', () => {
    it('renders select with options and handles selection change', () => {
      const handleChange = vi.fn();
      render(
        <Select id="test-select" value="opt1" onChange={handleChange}>
          <option value="opt1">گزینه یک</option>
          <option value="opt2">گزینه دو</option>
        </Select>,
      );
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(select.className).toContain('appearance-none');
      expect(select.className).toContain('pe-10');
      fireEvent.change(select, { target: { value: 'opt2' } });
      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('renders select with error styling and aria attributes', () => {
      render(
        <Select id="test-select-err" error="انتخاب نامعتبر">
          <option value="1">یک</option>
        </Select>,
      );
      const select = screen.getByRole('combobox');
      expect(select).toHaveAttribute('aria-invalid', 'true');
      expect(select.className).toContain('border-rose-400');
    });
  });

  describe('Field', () => {
    it('renders label, child input, and error message', () => {
      render(
        <Field id="username" label="نام کاربری" error="نام کاربری اجباری است">
          <Input id="username" />
        </Field>,
      );
      expect(screen.getByText('نام کاربری')).toBeInTheDocument();
      const errorMsg = screen.getByRole('alert');
      expect(errorMsg).toHaveTextContent('نام کاربری اجباری است');
    });

    it('renders hint message when there is no error', () => {
      render(
        <Field id="username" label="نام کاربری" hint="حداقل ۳ حرف">
          <Input id="username" />
        </Field>,
      );
      expect(screen.getByText('حداقل ۳ حرف')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Card', () => {
    it('renders structured card content', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>عنوان کارت</CardTitle>
          </CardHeader>
          <CardContent>
            <p>محتوای کارت</p>
          </CardContent>
        </Card>,
      );
      expect(screen.getByText('عنوان کارت')).toBeInTheDocument();
      expect(screen.getByText('محتوای کارت')).toBeInTheDocument();
    });
  });

  describe('Alert', () => {
    it('renders alert with accessible role and title', () => {
      render(
        <Alert variant="error" title="خطای مهم">
          متن پیام خطا
        </Alert>,
      );
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('خطای مهم')).toBeInTheDocument();
      expect(screen.getByText('متن پیام خطا')).toBeInTheDocument();
    });

    it('renders danger variant mapped to rose styling', () => {
      render(<Alert variant="danger">هشدار خطر</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('bg-rose-50');
      expect(alert.className).toContain('border-rose-200');
    });
  });

  describe('Badge', () => {
    it('renders variant badge', () => {
      render(<Badge variant="success">فعال</Badge>);
      const badge = screen.getByText('فعال');
      expect(badge.className).toContain('bg-emerald-100');
    });

    it('renders primary and neutral variants correctly', () => {
      render(
        <div>
          <Badge variant="primary">اصلی</Badge>
          <Badge variant="neutral">خنثی</Badge>
        </div>,
      );
      expect(screen.getByText('اصلی').className).toContain('bg-sky-100');
      expect(screen.getByText('خنثی').className).toContain('bg-slate-100');
    });
  });

  describe('EmptyState', () => {
    it('renders title, description, and optional action', () => {
      render(
        <EmptyState
          title="داده‌ای یافت نشد"
          description="توضیحات تکمیلی برای راهنمایی کاربر"
          action={<button>اقدام جدید</button>}
        />,
      );
      expect(screen.getByText('داده‌ای یافت نشد')).toBeInTheDocument();
      expect(screen.getByText('توضیحات تکمیلی برای راهنمایی کاربر')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'اقدام جدید' })).toBeInTheDocument();
    });
  });

  describe('Spinner', () => {
    it('renders with role status and accessible label', () => {
      render(<Spinner label="بارگذاری اطلاعات" />);
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(screen.getByText('بارگذاری اطلاعات')).toBeInTheDocument();
    });
  });

  describe('XrayImage', () => {
    it('enforces dir="ltr" on the container and lazy loading on the image', () => {
      render(<XrayImage src="/api/images/abc/file" alt="رادیوگرافی قفسه سینه" />);
      const container = screen.getByTestId('xray-container');
      expect(container).toHaveAttribute('dir', 'ltr');

      const img = screen.getByRole('img', { name: 'رادیوگرافی قفسه سینه' });
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('decoding', 'async');
      expect(img).toHaveAttribute('src', '/api/images/abc/file');

      // Verify NO transform or rtl classes are applied
      expect(img.className).not.toMatch(/\b(scale|rotate|transform|rtl:)/);
      expect(container.className).not.toMatch(/\b(scale|rotate|transform|rtl:)/);
    });

    it('renders accessible fallback message on error', () => {
      render(
        <XrayImage
          src="/api/images/invalid/file"
          alt="تصویر خراب"
          fallbackText="عدم امکان بارگذاری تصویر"
        />,
      );
      const img = screen.getByRole('img', { name: 'تصویر خراب' });
      fireEvent.error(img);

      expect(screen.getByText('عدم امکان بارگذاری تصویر')).toBeInTheDocument();
    });
  });
});
