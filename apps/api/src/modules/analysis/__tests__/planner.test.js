import { describe, it, expect } from 'vitest';
import { planBatches, runBOrder } from '../planner.js';
import {
  SYSTEM_INSTRUCTION_A,
  buildPromptAInput,
  buildPromptAText,
} from '../prompts/v1/analyze-a.js';
import {
  SYSTEM_INSTRUCTION_B,
  buildPromptBInput,
  buildPromptBText,
} from '../prompts/v1/analyze-b.js';

// ---------------------------------------------------------------------------
// Fixture: 120-entry analysis set (3 classes × 40, with varied sources/buckets)
// ---------------------------------------------------------------------------

function makeAnalysisSet() {
  const entries = [];
  const classes = ['covid19', 'pneumonia', 'normal'];
  const buckets = ['easy', 'medium', 'hard'];
  let id = 0;
  for (const cls of classes) {
    for (let i = 0; i < 40; i++) {
      entries.push({
        imageId: `img-${id++}`,
        trueClass: cls,
        bucket: buckets[i % 3],
        source: i % 2 === 0 ? 'cohen' : 'kermany',
        stratum: `${cls}:${buckets[i % 3]}`,
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Test 2a: Every image in exactly one batch per run
// ---------------------------------------------------------------------------

describe('planBatches — coverage', () => {
  it('every imageId appears in exactly one run-A batch', () => {
    const set = makeAnalysisSet();
    const plans = planBatches(set);
    const batchesA = plans.filter((p) => p.run === 'A');
    const idsA = batchesA.flatMap((p) => p.imageIds);
    expect(idsA).toHaveLength(set.length);
    expect(new Set(idsA).size).toBe(set.length);
    // Every source image id is covered
    const sourceIds = new Set(set.map((e) => e.imageId));
    for (const id of idsA) expect(sourceIds.has(id)).toBe(true);
  });

  it('every imageId appears in exactly one run-B batch', () => {
    const set = makeAnalysisSet();
    const plans = planBatches(set);
    const batchesB = plans.filter((p) => p.run === 'B');
    const idsB = batchesB.flatMap((p) => p.imageIds);
    expect(idsB).toHaveLength(set.length);
    expect(new Set(idsB).size).toBe(set.length);
  });

  it('total batches = 2 × ceil(120 / 6) = 40', () => {
    const set = makeAnalysisSet();
    const plans = planBatches(set);
    expect(plans).toHaveLength(40);
    expect(plans.filter((p) => p.run === 'A')).toHaveLength(20);
    expect(plans.filter((p) => p.run === 'B')).toHaveLength(20);
  });

  it('each batch has exactly 6 images (last batch may be smaller)', () => {
    const set = makeAnalysisSet(); // 120 / 6 = exactly 20 groups, all size 6
    const plans = planBatches(set);
    for (const p of plans) expect(p.imageIds.length).toBe(6);
  });

  it('batchId format is correct: v1-g<00>-<run>', () => {
    const plans = planBatches(makeAnalysisSet());
    for (const p of plans) {
      expect(p.batchId).toMatch(/^v1-g\d{2}-[AB]$/);
    }
    // Group indices are 0-based, two-digit padded
    const groups = [...new Set(plans.map((p) => p.group))].sort((a, b) => a - b);
    expect(groups[0]).toBe(0);
    expect(groups[groups.length - 1]).toBe(19);
  });

  it('status and counts are initialized correctly', () => {
    const plans = planBatches(makeAnalysisSet());
    for (const p of plans) {
      expect(p.status).toBe('pending');
      expect(p.attempts).toBe(0);
      expect(p.lastError).toBeNull();
      expect(p.requestedAt).toBeNull();
      expect(p.finishedAt).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Test 2b: Run B order differs from run A
// ---------------------------------------------------------------------------

describe('planBatches — run B order', () => {
  it('run B imageIds differ from run A imageIds for the same group', () => {
    const plans = planBatches(makeAnalysisSet());
    for (let g = 0; g < 20; g++) {
      const a = plans.find((p) => p.group === g && p.run === 'A');
      const b = plans.find((p) => p.group === g && p.run === 'B');
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      // Same set of images
      expect([...a.imageIds].sort()).toEqual([...b.imageIds].sort());
      // Different order (for 6 elements reversed-then-rotated is never identity)
      expect(a.imageIds).not.toEqual(b.imageIds);
    }
  });

  it('runBOrder is deterministic: same input → same output', () => {
    const a = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(runBOrder(a)).toEqual(runBOrder(a));
  });

  it('runBOrder reversed-then-rotated: [a,b,c,d,e,f] → [e,d,c,b,a,f]', () => {
    // reversed: [f,e,d,c,b,a]; rotate left by 1: [e,d,c,b,a,f]
    expect(runBOrder(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual(['e', 'd', 'c', 'b', 'a', 'f']);
  });

  it('runBOrder on empty array returns empty', () => {
    expect(runBOrder([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Test 2c: Batches are class-mixed (no single-class batch when 3 classes exist)
// ---------------------------------------------------------------------------

describe('planBatches — class mixing', () => {
  it('no run-A batch consists of a single class when all 3 classes present', () => {
    const plans = planBatches(makeAnalysisSet());
    const set = makeAnalysisSet();
    const classById = Object.fromEntries(set.map((e) => [e.imageId, e.trueClass]));

    const batchesA = plans.filter((p) => p.run === 'A');
    for (const batch of batchesA) {
      const classes = new Set(batch.imageIds.map((id) => classById[id]));
      // A batch of 6 from 120 items (40 each class) should almost never be single-class.
      // We test the structural guarantee: shuffle disperses classes.
      // If ANY batch is single-class, that is a planning defect.
      expect(classes.size).toBeGreaterThan(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3a: Prompt builders — vocabulary present, no forbidden words
// ---------------------------------------------------------------------------

const FORBIDDEN = ['covid', 'pneumonia', 'normal', 'cohen', 'figure1', 'kermany'];
// Exception: these words ARE allowed inside the vocabulary list for predictedClass
// (but NOT elsewhere, like in the system instruction or as standalone labels).
// The test checks the instructional TEXT ONLY (not the vocabulary list section).
// FORBIDDEN is kept here as documentation of the no-label-leakage contract.
void FORBIDDEN;

describe('buildPromptAText — vocabulary and label rules', () => {
  it('contains the vocabulary for predictedClass', () => {
    const text = buildPromptAText(6);
    expect(text).toContain('"covid19"');
    expect(text).toContain('"pneumonia"');
    expect(text).toContain('"normal"');
  });

  it('contains all 9 pattern values', () => {
    const text = buildPromptAText(6);
    const patterns = [
      'clear_lungs',
      'opacity',
      'consolidation',
      'ground_glass',
      'air_bronchograms',
      'interstitial',
      'pleural_thickening',
      'pleural_effusion',
      'hyperinflation',
    ];
    for (const p of patterns) expect(text).toContain(p);
  });

  it('contains all laterality values', () => {
    const text = buildPromptAText(6);
    for (const v of ['bilateral', 'left', 'right', 'none']) {
      expect(text).toContain(v);
    }
  });

  it('system instruction does not contain label words as standalone hints', () => {
    // System instruction should not start with label words as a diagnosis hint
    const instr = SYSTEM_INSTRUCTION_A;
    // "covid19", "pneumonia", "normal" should not appear as standalone labels
    // (they may appear inside quotes in the vocabulary section — that's in buildPromptAText)
    expect(instr).not.toMatch(/\bcovid19\b/);
    expect(instr).not.toMatch(/\bpneumonia\b/);
    expect(instr).not.toMatch(/\bnormal\b/);
  });

  it('system instruction does not contain source or file name hints', () => {
    const instr = SYSTEM_INSTRUCTION_A;
    for (const word of ['cohen', 'figure1', 'kermany', 'filename', 'catalog']) {
      expect(instr.toLowerCase()).not.toContain(word);
    }
  });

  it('buildPromptAInput creates interleaved text+image parts', () => {
    const images = [
      { imageId: 'img-1', jpegBase64: 'base64data1' },
      { imageId: 'img-2', jpegBase64: 'base64data2' },
    ];
    const parts = buildPromptAInput(images);
    // Format: text, image, text, image, text(instruction)
    expect(parts[0]).toMatchObject({ type: 'text', text: 'Image 1:' });
    expect(parts[1]).toMatchObject({ type: 'image', data: 'base64data1', mime_type: 'image/jpeg' });
    expect(parts[2]).toMatchObject({ type: 'text', text: 'Image 2:' });
    expect(parts[3]).toMatchObject({ type: 'image', data: 'base64data2', mime_type: 'image/jpeg' });
    expect(parts[4].type).toBe('text'); // instruction text
    // imageId must NOT appear in any text part
    for (const part of parts) {
      if (part.text) {
        expect(part.text).not.toContain('img-1');
        expect(part.text).not.toContain('img-2');
      }
    }
  });

  it('buildPromptAInput does not include imageId or source in text parts', () => {
    const images = Array.from({ length: 6 }, (_, i) => ({
      imageId: `catalog-id-${i}`,
      jpegBase64: `base64-${i}`,
    }));
    const parts = buildPromptAInput(images);
    for (const part of parts) {
      if (part.text) {
        expect(part.text).not.toContain('catalog-id');
      }
    }
  });
});

describe('buildPromptBText — vocabulary and label rules', () => {
  it('contains predictedClass vocabulary', () => {
    const text = buildPromptBText(6);
    expect(text).toContain('"covid19"');
    expect(text).toContain('"pneumonia"');
    expect(text).toContain('"normal"');
  });

  it('contains all 9 pattern values', () => {
    const text = buildPromptBText(6);
    const patterns = [
      'clear_lungs',
      'opacity',
      'consolidation',
      'ground_glass',
      'air_bronchograms',
      'interstitial',
      'pleural_thickening',
      'pleural_effusion',
      'hyperinflation',
    ];
    for (const p of patterns) expect(text).toContain(p);
  });

  it('system instruction B does not contain label words as standalone hints', () => {
    const instr = SYSTEM_INSTRUCTION_B;
    expect(instr).not.toMatch(/\bcovid19\b/);
    expect(instr).not.toMatch(/\bpneumonia\b/);
    expect(instr).not.toMatch(/\bnormal\b/);
  });

  it('prompt A and prompt B instructional texts differ', () => {
    expect(buildPromptAText(6)).not.toBe(buildPromptBText(6));
    expect(SYSTEM_INSTRUCTION_A).not.toBe(SYSTEM_INSTRUCTION_B);
  });

  it('buildPromptBInput does not include imageId in text parts', () => {
    const images = Array.from({ length: 6 }, (_, i) => ({
      imageId: `secret-id-${i}`,
      jpegBase64: `b64-${i}`,
    }));
    const parts = buildPromptBInput(images);
    for (const part of parts) {
      if (part.text) {
        expect(part.text).not.toContain('secret-id');
      }
    }
  });
});
