import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { computePublicId } from '../publicId.js';
import { seedCatalog } from '../seed.js';
import { ImageModel } from '../model.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Catalog Public ID and Seeder', () => {
  let testDb;
  const testSalt = 'super-secret-salt-with-32-characters-12345';
  const fixturePath = resolve(__dirname, 'fixture-catalog.json');

  const fixtureEntries = [
    {
      id: 'kermany_01',
      imageId: 'kermany_01',
      filename: 'kermany_01.jpg',
      trueClass: 'normal',
      source: 'kermany',
      difficulty: 0.2,
      bucket: 'easy',
      confusedWith: 'pneumonia',
    },
    {
      id: 'kermany_02',
      imageId: 'kermany_02',
      filename: 'kermany_02.jpg',
      trueClass: 'normal',
      source: 'kermany',
      difficulty: 0.5,
      bucket: 'medium',
      confusedWith: 'pneumonia',
    },
    {
      id: 'cohen_01',
      imageId: 'cohen_01',
      filename: 'cohen_01.jpeg',
      trueClass: 'covid19',
      source: 'cohen',
      difficulty: 0.1,
      bucket: 'easy',
      confusedWith: 'pneumonia',
    },
    {
      id: 'cohen_02',
      imageId: 'cohen_02',
      filename: 'cohen_02.jpeg',
      trueClass: 'covid19',
      source: 'cohen',
      difficulty: 0.8,
      bucket: 'hard',
      confusedWith: 'normal',
    },
    {
      id: 'kermany_03',
      imageId: 'kermany_03',
      filename: 'kermany_03.jpg',
      trueClass: 'pneumonia',
      source: 'kermany',
      difficulty: 0.3,
      bucket: 'easy',
      confusedWith: 'normal',
    },
    {
      id: 'kermany_04',
      imageId: 'kermany_04',
      filename: 'kermany_04.jpg',
      trueClass: 'pneumonia',
      source: 'kermany',
      difficulty: 0.7,
      bucket: 'hard',
      confusedWith: 'covid19',
    },
  ];

  beforeAll(async () => {
    testDb = await setupTestDb();
    writeFileSync(fixturePath, JSON.stringify(fixtureEntries, null, 2), 'utf8');
  });

  afterAll(async () => {
    try {
      unlinkSync(fixturePath);
    } catch {
      // Ignore if file doesn't exist
    }
    if (testDb) {
      await testDb.teardown();
    }
  });

  describe('computePublicId', () => {
    it('produces deterministic 20-character hexadecimal public IDs', () => {
      const pub1 = computePublicId('kermany_01', testSalt);
      const pub2 = computePublicId('kermany_01', testSalt);

      expect(pub1).toBe(pub2);
      expect(pub1).toHaveLength(20);
      expect(/^[0-9a-f]{20}$/.test(pub1)).toBe(true);
    });

    it('generates different public IDs when salt differs', () => {
      const pub1 = computePublicId('kermany_01', testSalt);
      const pub2 = computePublicId('kermany_01', 'another-salt-string-with-16-chars');

      expect(pub1).not.toBe(pub2);
    });

    it('throws error when salt is shorter than 16 characters or ID is empty', () => {
      expect(() => computePublicId('kermany_01', 'short')).toThrow();
      expect(() => computePublicId('', testSalt)).toThrow();
    });
  });

  describe('seedCatalog', () => {
    it('seeds the fixture catalog and computes public IDs in database', async () => {
      const result = await seedCatalog({
        filePath: fixturePath,
        salt: testSalt,
      });

      expect(result.total).toBe(6);
      expect(result.upsertedCount).toBe(6);
      expect(result.matchedCount).toBe(0);

      const count = await ImageModel.countDocuments();
      expect(count).toBe(6);

      const doc = await ImageModel.findById('kermany_01').lean();
      expect(doc).toBeDefined();
      expect(doc.publicId).toBe(computePublicId('kermany_01', testSalt));
      expect(doc.trueClass).toBe('normal');

      // Check pool health warnings: fixture has < 6 per bucket
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('covid19 x easy'))).toBe(true);
    });

    it('is strictly idempotent on repeated runs', async () => {
      const secondRun = await seedCatalog({
        filePath: fixturePath,
        salt: testSalt,
      });

      expect(secondRun.total).toBe(6);
      expect(secondRun.upsertedCount).toBe(0);
      expect(secondRun.matchedCount).toBe(6);
      expect(secondRun.modifiedCount).toBe(0);
    });

    it('prunes obsolete entries when prune is true', async () => {
      // Write smaller fixture with 5 entries (omit kermany_04)
      const subset = fixtureEntries.slice(0, 5);
      writeFileSync(fixturePath, JSON.stringify(subset, null, 2), 'utf8');

      const pruneResult = await seedCatalog({
        filePath: fixturePath,
        prune: true,
        salt: testSalt,
      });

      expect(pruneResult.deletedCount).toBe(1);
      const remainingCount = await ImageModel.countDocuments();
      expect(remainingCount).toBe(5);

      const deletedDoc = await ImageModel.findById('kermany_04');
      expect(deletedDoc).toBeNull();
    });

    it('rejects invalid catalog files with validation errors', async () => {
      const invalidPath = resolve(__dirname, 'invalid-catalog.json');
      writeFileSync(
        invalidPath,
        JSON.stringify([{ id: 'duplicate' }, { id: 'duplicate' }]),
        'utf8',
      );

      try {
        await expect(seedCatalog({ filePath: invalidPath, salt: testSalt })).rejects.toThrow(
          /Catalog validation failed/,
        );
      } finally {
        unlinkSync(invalidPath);
      }
    });
  });
});
