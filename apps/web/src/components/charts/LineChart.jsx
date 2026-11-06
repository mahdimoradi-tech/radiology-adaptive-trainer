import { useTranslation } from 'react-i18next';
import { fmt } from '../../lib/format.js';

export const SERIES_STYLES = [
  {
    stroke: '#2563eb', // Blue
    strokeDasharray: 'none',
    marker: 'circle',
    dashName: 'solid',
  },
  {
    stroke: '#d97706', // Amber
    strokeDasharray: '6 4',
    marker: 'rect',
    dashName: 'dashed',
  },
  {
    stroke: '#10b981', // Emerald
    strokeDasharray: '2 3',
    marker: 'triangle',
    dashName: 'dotted',
  },
  {
    stroke: '#8b5cf6', // Violet
    strokeDasharray: '8 4 2 4',
    marker: 'diamond',
    dashName: 'dash-dot',
  },
];

/**
 * Render point marker icon based on style shape
 * @param {string} marker
 * @param {number} cx
 * @param {number} cy
 * @param {string} color
 */
function renderMarker(marker, cx, cy, color, key) {
  switch (marker) {
    case 'rect':
      return (
        <rect
          key={key}
          x={cx - 3.5}
          y={cy - 3.5}
          width={7}
          height={7}
          fill={color}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      );
    case 'triangle':
      return (
        <polygon
          key={key}
          points={`${cx},${cy - 4.5} ${cx - 4},${cy + 3.5} ${cx + 4},${cy + 3.5}`}
          fill={color}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      );
    case 'diamond':
      return (
        <polygon
          key={key}
          points={`${cx},${cy - 4.5} ${cx + 4},${cy} ${cx},${cy + 4.5} ${cx - 4},${cy}`}
          fill={color}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
      );
    case 'circle':
    default:
      return (
        <circle key={key} cx={cx} cy={cy} r={4} fill={color} stroke="#ffffff" strokeWidth="1.5" />
      );
  }
}

/**
 * Accessible SVG Line Chart component with LTR time-axis, custom dash patterns,
 * threshold line, and tabular fallback.
 *
 * @param {Object} props
 * @param {Array<{ id: string, label: string, points: Array<{ x: number|string, y: number }> }>} props.series
 * @param {[number, number]} [props.yDomain=[0, 1]]
 * @param {number} [props.threshold]
 * @param {string} props.ariaLabel
 * @param {string} [props.xLabel]
 */
export function LineChart({ series = [], yDomain = [0, 1], threshold, ariaLabel, xLabel }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'fa';

  // Extract all distinct x coordinates across series
  const xValues = Array.from(
    new Set((series || []).flatMap((s) => (s.points || []).map((p) => p.x))),
  );

  if (!series || series.length === 0 || xValues.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
        <p>{t('charts.noData', 'داده‌ای برای نمایش نمودار وجود ندارد.')}</p>
      </div>
    );
  }

  // SVG canvas dimensions
  const width = 600;
  const height = 280;
  const pad = { top: 30, right: 35, bottom: 45, left: 55 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const [yMin, yMax] = yDomain;

  /**
   * Map X value to pixel coordinate
   * @param {number|string} xVal
   */
  const getX = (xVal) => {
    const idx = xValues.indexOf(xVal);
    if (idx === -1) return pad.left;
    if (xValues.length === 1) return pad.left + innerW / 2;
    return pad.left + (idx / (xValues.length - 1)) * innerW;
  };

  /**
   * Map Y value to pixel coordinate
   * @param {number} yVal
   */
  const getY = (yVal) => {
    const clamped = Math.max(yMin, Math.min(yMax, yVal));
    return pad.top + innerH - ((clamped - yMin) / (yMax - yMin)) * innerH;
  };

  // Y-axis grid ticks (0%, 25%, 50%, 75%, 100%)
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].filter((tick) => tick >= yMin && tick <= yMax);

  const thresholdY =
    typeof threshold === 'number' && threshold >= yMin && threshold <= yMax
      ? getY(threshold)
      : null;

  return (
    <div className="w-full space-y-4">
      {/* SVG Canvas in strictly LTR direction */}
      <div
        dir="ltr"
        className="w-full overflow-x-auto rounded-lg bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-800"
      >
        <svg
          role="img"
          aria-label={ariaLabel}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-72 select-none"
        >
          {/* Background Grid Lines & Y Ticks */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={`ytick-${tick}`}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + innerW}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  className="dark:stroke-slate-800"
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                  className="font-mono dark:fill-slate-400"
                >
                  {fmt.percent(tick, 'en', 0)}
                </text>
              </g>
            );
          })}

          {/* Threshold Line (if provided) */}
          {thresholdY !== null && (
            <g data-testid="threshold-line">
              <line
                x1={pad.left}
                y1={thresholdY}
                x2={pad.left + innerW}
                y2={thresholdY}
                stroke="#dc2626"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
              <text
                x={pad.left + innerW - 6}
                y={thresholdY - 6}
                textAnchor="end"
                fontSize="11"
                fill="#dc2626"
                fontWeight="600"
              >
                {t('charts.thresholdLabel', 'آستانه تسلط ({{pct}})', {
                  pct: fmt.percent(threshold, lang, 0),
                  defaultValue: `Mastery (${fmt.percent(threshold, 'en', 0)})`,
                })}
              </text>
            </g>
          )}

          {/* X Axis & Ticks */}
          <line
            x1={pad.left}
            y1={pad.top + innerH}
            x2={pad.left + innerW}
            y2={pad.top + innerH}
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          {xValues.map((xVal) => {
            const x = getX(xVal);
            return (
              <g key={`xtick-${xVal}`}>
                <line
                  x1={x}
                  y1={pad.top + innerH}
                  x2={x}
                  y2={pad.top + innerH + 5}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y={pad.top + innerH + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                  className="dark:fill-slate-400"
                >
                  {typeof xVal === 'number' ? fmt.number(xVal, lang) : String(xVal)}
                </text>
              </g>
            );
          })}

          {/* Series Lines & Point Markers */}
          {series.map((s, idx) => {
            const style = SERIES_STYLES[idx % SERIES_STYLES.length];
            const sortedPoints = [...(s.points || [])].sort((a, b) => {
              const idxA = xValues.indexOf(a.x);
              const idxB = xValues.indexOf(b.x);
              return idxA - idxB;
            });

            if (sortedPoints.length === 0) return null;

            const pathD = sortedPoints.reduce((acc, pt, pIdx) => {
              const cx = getX(pt.x);
              const cy = getY(pt.y);
              return pIdx === 0 ? `M ${cx} ${cy}` : `${acc} L ${cx} ${cy}`;
            }, '');

            return (
              <g key={s.id || idx} data-testid={`series-group-${s.id}`}>
                {/* Connecting Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth="2.5"
                  strokeDasharray={style.strokeDasharray}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Point Markers */}
                {sortedPoints.map((pt, pIdx) => {
                  const cx = getX(pt.x);
                  const cy = getY(pt.y);
                  return renderMarker(style.marker, cx, cy, style.stroke, `pt-${s.id}-${pIdx}`);
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Accessible Text Legend (Color + Dash Pattern + Symbol + Label) */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-700 dark:text-slate-300">
        {series.map((s, idx) => {
          const style = SERIES_STYLES[idx % SERIES_STYLES.length];
          return (
            <div
              key={s.id || idx}
              className="inline-flex items-center gap-2"
              data-testid={`legend-item-${s.id}`}
            >
              <svg width="24" height="12" viewBox="0 0 24 12" className="overflow-visible">
                <line
                  x1="0"
                  y1="6"
                  x2="24"
                  y2="6"
                  stroke={style.stroke}
                  strokeWidth="2.5"
                  strokeDasharray={style.strokeDasharray}
                />
                {renderMarker(style.marker, 12, 6, style.stroke, `legend-marker-${s.id}`)}
              </svg>
              <span className="font-medium">{s.label}</span>
              <span className="text-[10px] text-slate-400">({style.dashName})</span>
            </div>
          );
        })}
      </div>

      {/* Accessible Tabular Fallback */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs text-start border-collapse">
          <caption className="sr-only">{ariaLabel} - داده‌های جدول</caption>
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200">
            <tr>
              <th
                scope="col"
                className="px-3 py-2 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
              >
                {xLabel || t('charts.sessionCol', 'جلسه')}
              </th>
              {series.map((s) => (
                <th
                  key={s.id}
                  scope="col"
                  className="px-3 py-2 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                >
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {xValues.map((xVal) => (
              <tr key={`row-${xVal}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="px-3 py-2 text-slate-900 dark:text-slate-100 font-medium">
                  {typeof xVal === 'number' ? fmt.number(xVal, lang) : String(xVal)}
                </td>
                {series.map((s) => {
                  const pt = (s.points || []).find((p) => p.x === xVal);
                  return (
                    <td
                      key={`cell-${s.id}-${xVal}`}
                      className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300"
                    >
                      {pt && typeof pt.y === 'number' ? fmt.percent(pt.y, lang, 1) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
