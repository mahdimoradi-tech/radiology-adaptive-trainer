import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CatalogEntrySchema,
  CatalogFileSchema,
  ImagePublicSchema,
  CatalogImageAdminSchema,
  CatalogStatsSchema,
} from '../catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Catalog contracts', () => {
  const validEntry = {
    id: 'kermany_f9ddce356c7b',
    imageId: 'kermany_f9ddce356c7b',
    filename: 'kermany_f9ddce356c7b.jpg',
    trueClass: 'normal',
    source: 'kermany',
    difficulty: 0.6199,
    bucket: 'medium',
    confusedWith: 'pneumonia',
  };

  describe('CatalogEntrySchema', () => {
    it('accepts valid catalog entry with matching imageId', () => {
      expect(CatalogEntrySchema.safeParse(validEntry).success).toBe(true);
    });

    it('accepts valid catalog entry when imageId is omitted', () => {
      const { imageId: _, ...entryWithoutImageId } = validEntry;
      expect(CatalogEntrySchema.safeParse(entryWithoutImageId).success).toBe(true);
    });

    it('rejects catalog entry when imageId differs from id', () => {
      const mismatched = { ...validEntry, imageId: 'different_id' };
      const result = CatalogEntrySchema.safeParse(mismatched);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('If imageId is provided, it must match id');
    });

    it('rejects invalid filenames (path traversal, wrong extension)', () => {
      expect(
        CatalogEntrySchema.safeParse({ ...validEntry, filename: '../secret.jpg' }).success,
      ).toBe(false);
      expect(CatalogEntrySchema.safeParse({ ...validEntry, filename: 'image.png' }).success).toBe(
        false,
      );
      expect(
        CatalogEntrySchema.safeParse({ ...validEntry, filename: 'folder/img.jpeg' }).success,
      ).toBe(false);
    });

    it('rejects invalid class or bucket names', () => {
      expect(CatalogEntrySchema.safeParse({ ...validEntry, trueClass: 'unknown' }).success).toBe(
        false,
      );
      expect(CatalogEntrySchema.safeParse({ ...validEntry, bucket: 'extreme' }).success).toBe(
        false,
      );
    });
  });

  describe('CatalogFileSchema', () => {
    it('accepts valid non-empty array of catalog entries', () => {
      const list = [validEntry];
      expect(CatalogFileSchema.safeParse(list).success).toBe(true);
    });

    it('rejects empty catalog array', () => {
      expect(CatalogFileSchema.safeParse([]).success).toBe(false);
    });

    it('rejects catalog array containing duplicate IDs', () => {
      const duplicateList = [validEntry, { ...validEntry, filename: 'kermany_second.jpg' }];
      const result = CatalogFileSchema.safeParse(duplicateList);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('Catalog contains duplicate image IDs');
    });

    it('successfully validates the real repository catalog.json artifact', () => {
      const catalogPath = resolve(__dirname, '../../../../ml/artifacts/catalog.json');
      const rawData = JSON.parse(readFileSync(catalogPath, 'utf8'));
      const parsed = CatalogFileSchema.parse(rawData);
      expect(parsed.length).toBe(1177);
    });
  });

  describe('ImagePublicSchema', () => {
    it('validates public image structure with opaque publicId and URL', () => {
      const publicImage = {
        id: 'a8b7c9d0e1f2a3b4c5d6',
        url: '/api/images/a8b7c9d0e1f2a3b4c5d6/file',
      };
      expect(ImagePublicSchema.safeParse(publicImage).success).toBe(true);
    });
  });

  describe('CatalogImageAdminSchema', () => {
    it('validates full administrator image payload', () => {
      const adminImage = {
        id: 'cohen_100_1',
        filename: 'cohen_100_1.jpeg',
        trueClass: 'covid19',
        source: 'cohen',
        difficulty: 0.12,
        bucket: 'easy',
        confusedWith: 'pneumonia',
        publicId: 'e4f5a6b7c8d9e0f1a2b3',
        url: '/api/images/e4f5a6b7c8d9e0f1a2b3/file',
      };
      expect(CatalogImageAdminSchema.safeParse(adminImage).success).toBe(true);
    });
  });

  describe('CatalogStatsSchema', () => {
    it('validates aggregated catalog statistics', () => {
      const stats = {
        total: 1177,
        byClass: {
          covid19: 177,
          pneumonia: 500,
          normal: 500,
        },
        byBucket: {
          easy: 785,
          medium: 182,
          hard: 210,
        },
        byClassBucket: {
          covid19: { easy: 172, medium: 2, hard: 3 },
          pneumonia: { easy: 201, medium: 134, hard: 165 },
          normal: { easy: 412, medium: 46, hard: 42 },
        },
        bySource: {
          kermany: 954,
          cohen: 142,
          figure1: 81,
        },
      };
      expect(CatalogStatsSchema.safeParse(stats).success).toBe(true);
    });
  });
});
