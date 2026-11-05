import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FinishDialog } from '../FinishDialog.jsx';
import '../../../i18n/index.js';

describe('FinishDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <FinishDialog isOpen={false} unansweredCount={5} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('displays unanswered warning count when unansweredCount > 0', () => {
    render(
      <FinishDialog isOpen={true} unansweredCount={8} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/۸ سؤال بی‌پاسخ دارید/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ثبت نهایی/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /بازگشت/i })).toBeInTheDocument();
  });

  it('displays all answered message when unansweredCount === 0', () => {
    render(
      <FinishDialog isOpen={true} unansweredCount={0} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.getByText(/تمامی سؤالات پاسخ داده شده‌اند/i)).toBeInTheDocument();
  });

  it('calls onConfirm on confirm click and disables buttons while loading', async () => {
    const user = userEvent.setup();
    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    const { rerender } = render(
      <FinishDialog
        isOpen={true}
        unansweredCount={2}
        isLoading={false}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: /ثبت نهایی/i });
    await user.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);

    // Re-render as loading
    rerender(
      <FinishDialog
        isOpen={true}
        unansweredCount={2}
        isLoading={true}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />,
    );

    expect(screen.getByRole('button', { name: /در حال محاسبه نتایج/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /بازگشت/i })).toBeDisabled();
  });

  it('calls onCancel when pressing Escape key', () => {
    const handleCancel = vi.fn();
    render(
      <FinishDialog
        isOpen={true}
        unansweredCount={3}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});
