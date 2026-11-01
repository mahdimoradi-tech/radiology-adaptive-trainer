import { describe, it, expect } from 'vitest';
import { scanFileContent, FORBIDDEN_PATTERNS } from '../../../../scripts/check-rtl-classes.js';

describe('RTL Class Checker (scripts/check-rtl-classes.js)', () => {
  it('has 5 mandatory forbidden pattern categories', () => {
    expect(FORBIDDEN_PATTERNS).toHaveLength(5);
  });

  it('detects physical margin and padding classes (ml, mr, pl, pr)', () => {
    const fixture = `
      <div className="ml-4 text-slate-800">Hello</div>
      <div className="mr-auto">World</div>
      <span className="pl-[10px]">Padded</span>
      <p className="pr-px">Right pad</p>
    `;
    const violations = scanFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(4);
    expect(violations[0].line).toBe(2);
    expect(violations[1].line).toBe(3);
    expect(violations[2].line).toBe(4);
    expect(violations[3].line).toBe(5);
  });

  it('detects physical positioning classes (left, right)', () => {
    const fixture = `
      <div className="left-0 absolute">Left positioned</div>
      <div className="right-full">Right positioned</div>
    `;
    const violations = scanFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(2);
  });

  it('detects physical text alignment (text-left, text-right)', () => {
    const fixture = `
      <p className="text-left">Left aligned</p>
      <h2 className="text-right">Right aligned</h2>
    `;
    const violations = scanFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(2);
  });

  it('detects physical rounded and border classes', () => {
    const fixture = `
      <div className="rounded-l-md border-r">Border</div>
      <div className="border-l-2">Left border</div>
    `;
    const violations = scanFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(2);
  });

  it('detects physical float classes', () => {
    const fixture = `
      <div className="float-left">Floated</div>
      <div className="float-right">Floated</div>
    `;
    const violations = scanFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(2);
  });

  it('detects horizontal flip classes (scale-x-)', () => {
    const fixture = `
      <img className="scale-x-[-1]" src="xray.jpg" />
      <div className="scale-x-100">Flipped</div>
    `;
    const violations = scanFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(2);
  });

  it('honors rtl-ok comment and bypasses violations on the same line', () => {
    const fixture = `
      <ChevronIcon className="rtl:rotate-180 scale-x-[-1]" /> /* rtl-ok: flipped directional icon */
      <div className="text-left" /> /* rtl-ok: code block must stay LTR */
      <div className="ml-4" />
    `;
    const violations = scanFileContent(fixture, 'fixture.jsx');
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(4);
  });
});
