import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../i18n/index.js';
import { LineChart } from '../LineChart.jsx';

describe('LineChart Component (apps/web/src/components/charts/LineChart.jsx)', () => {
  const mockSeries = [
    {
      id: 'covid19',
      label: 'کووید-۱۹',
      points: [
        { x: 1, y: 0.4 },
        { x: 2, y: 0.55 },
        { x: 3, y: 0.7 },
        { x: 4, y: 0.85 },
      ],
    },
    {
      id: 'pneumonia',
      label: 'پنومونی',
      points: [
        { x: 1, y: 0.35 },
        { x: 2, y: 0.5 },
        { x: 3, y: 0.65 },
        { x: 4, y: 0.8 },
      ],
    },
    {
      id: 'normal',
      label: 'نرمال',
      points: [
        { x: 1, y: 0.7 },
        { x: 2, y: 0.75 },
        { x: 3, y: 0.8 },
        { x: 4, y: 0.9 },
      ],
    },
  ];

  it('renders SVG with role="img", dir="ltr", and ariaLabel', () => {
    render(<LineChart series={mockSeries} threshold={0.8} ariaLabel="روند دقت به تفکیک بیماری" />);

    const svg = screen.getByRole('img', { name: 'روند دقت به تفکیک بیماری' });
    expect(svg).toBeInTheDocument();
    expect(svg.closest('div')).toHaveAttribute('dir', 'ltr');
  });

  it('renders all N series groups with distinct styles and text legends', () => {
    render(<LineChart series={mockSeries} threshold={0.8} ariaLabel="روند دقت آزمون‌ها" />);

    // 3 series groups rendered
    expect(screen.getByTestId('series-group-covid19')).toBeInTheDocument();
    expect(screen.getByTestId('series-group-pneumonia')).toBeInTheDocument();
    expect(screen.getByTestId('series-group-normal')).toBeInTheDocument();

    // 3 legend items
    expect(screen.getByTestId('legend-item-covid19')).toHaveTextContent('کووید-۱۹');
    expect(screen.getByTestId('legend-item-pneumonia')).toHaveTextContent('پنومونی');
    expect(screen.getByTestId('legend-item-normal')).toHaveTextContent('نرمال');
  });

  it('renders threshold line when threshold prop is passed', () => {
    const { rerender } = render(
      <LineChart series={mockSeries} threshold={0.8} ariaLabel="با آستانه" />,
    );
    expect(screen.getByTestId('threshold-line')).toBeInTheDocument();

    // Rerender without threshold
    rerender(<LineChart series={mockSeries} ariaLabel="بدون آستانه" />);
    expect(screen.queryByTestId('threshold-line')).not.toBeInTheDocument();
  });

  it('renders accessible fallback table with all rows and values', () => {
    render(<LineChart series={mockSeries} threshold={0.8} ariaLabel="جدول روند دقت" />);

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // 4 rows in tbody (sessions 1 to 4)
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(4);
  });

  it('handles empty series and missing points gracefully without crashing', () => {
    const { rerender } = render(<LineChart series={[]} ariaLabel="خالی" />);
    expect(screen.getByText(/داده‌ای برای نمایش نمودار وجود ندارد/)).toBeInTheDocument();

    rerender(<LineChart series={[{ id: 'c1', label: 'C1', points: [] }]} ariaLabel="نقاط خالی" />);
    expect(screen.getByText(/داده‌ای برای نمایش نمودار وجود ندارد/)).toBeInTheDocument();
  });
});
