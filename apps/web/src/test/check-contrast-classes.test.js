import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  scanContrastFileContent,
  runContrastScan,
  FORBIDDEN_CONTRAST_PATTERNS,
} from '../../../../scripts/check-low-contrast.js';

describe('Low-Contrast Class Checker (scripts/check-low-contrast.js)', () => {
  it('has mandatory forbidden contrast pattern definitions', () => {
    expect(FORBIDDEN_CONTRAST_PATTERNS).toHaveLength(2);
  });

  it('detects low-contrast text utility classes (e.g. text-slate-400, text-gray-300)', () => {
    const fixture = `
      <div className="text-slate-400">Low contrast</div>
      <span className="text-gray-300">Too light</span>
      <p className="text-zinc-400">Hard to read</p>
    `;
    const violations = scanContrastFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(3);
    expect(violations[0].line).toBe(2);
    expect(violations[1].line).toBe(3);
    expect(violations[2].line).toBe(4);
  });

  it('detects low-contrast placeholder utility classes', () => {
    const fixture = `
      <input className="placeholder:text-slate-400" />
      <input className="placeholder:text-rose-300" />
    `;
    const violations = scanContrastFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(2);
    expect(violations[0].line).toBe(2);
    expect(violations[1].line).toBe(3);
  });

  it('honors contrast-ok comment and bypasses intentional exceptions', () => {
    const fixture = `
      <div className="text-slate-400" /> /* contrast-ok: intentional watermark */
      <span className="text-slate-400" />
    `;
    const violations = scanContrastFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(3);
  });

  it('verifies apps/web/src production source files have zero low-contrast violations', () => {
    const webSrcDir = path.resolve('apps/web/src');
    const violations = runContrastScan(webSrcDir);

    expect(violations).toEqual([]);
  });
});
