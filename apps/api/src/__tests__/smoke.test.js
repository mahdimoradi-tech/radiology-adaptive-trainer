import { describe, it, expect } from 'vitest';

describe('API smoke', () => {
  it('loads node environment', () => {
    expect(process.version).toBeDefined();
  });
});
