import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION, CONTRACTS_VERSION } from '../index.js';

describe('@radiology/engine smoke', () => {
  it('exports ENGINE_VERSION', () => {
    expect(ENGINE_VERSION).toBe('0.0.0');
    expect(CONTRACTS_VERSION).toBe('0.0.0');
  });
});
