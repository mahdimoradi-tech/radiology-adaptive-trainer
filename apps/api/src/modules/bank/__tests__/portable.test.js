import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { QuestionBankModel } from '../model.js';
import { ImageModel } from '../../catalog/model.js';
import { exportBankApproved, importBankApproved } from '../portable.js';

describe('Question Bank Portable Export and Import', () => {
  let testDb;
  const tempExportPath = path.resolve(process.cwd(), 'apps/api/seed/temp-test-bank.json');

  beforeAll(async () => {
    testDb = await setupTestDb();
    await QuestionBankModel.syncIndexes();
    await ImageModel.syncIndexes();
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(tempExportPath)) {
        fs.unlinkSync(tempExportPath);
      }
    } catch {
      // Ignore cleanup error
    }
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
  });

  it('export contains ONLY approved items and completely excludes pending_review and rejected items', async () => {
    // 1. Approved item
    await QuestionBankModel.create({
      stableId: 'approved_111111111111111111111111111111111',
      imageId: 'img_app_1',
      type: 'finding',
      pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
      bucket: 'easy',
      stem: 'سؤال تأیید شده؟',
      options: [
        { text: 'گزینه یک', key: 'ground_glass' },
        { text: 'گزینه دو', key: 'consolidation' },
        { text: 'گزینه سه', key: 'air_bronchograms' },
        { text: 'گزینه چهار', key: 'clear_lungs' },
      ],
      correctIndex: 0,
      rationale: 'توضیحات تأیید شده',
      status: 'approved',
      source: { model: 'gemini-3.8-flash', promptVersion: 'v1' },
      reviewedBy: 'Dr. Test',
      reviewedAt: new Date(),
    });

    // 2. Pending review item
    await QuestionBankModel.create({
      stableId: 'pending_222222222222222222222222222222222',
      imageId: 'img_pend_2',
      type: 'finding',
      pair: { trueClass: 'pneumonia', confusedWith: 'normal' },
      bucket: 'medium',
      stem: 'سؤال در انتظار؟',
      options: [
        { text: 'گزینه یک', key: 'consolidation' },
        { text: 'گزینه دو', key: 'opacity' },
        { text: 'گزینه سه', key: 'air_bronchograms' },
        { text: 'گزینه چهار', key: 'clear_lungs' },
      ],
      correctIndex: 0,
      rationale: 'توضیحات در انتظار',
      status: 'pending_review',
      source: { model: 'gemini-3.8-flash', promptVersion: 'v1' },
    });

    // 3. Rejected item
    await QuestionBankModel.create({
      stableId: 'rejected_33333333333333333333333333333333',
      imageId: 'img_rej_3',
      type: 'distribution',
      pair: { trueClass: 'normal', confusedWith: 'pneumonia' },
      bucket: 'hard',
      stem: 'سؤال رد شده؟',
      options: [
        { text: 'گزینه یک', key: 'diffuse' },
        { text: 'گزینه دو', key: 'peripheral' },
        { text: 'گزینه سه', key: 'central_perihilar' },
        { text: 'گزینه چهار', key: 'focal_lobar' },
      ],
      correctIndex: 0,
      rationale: 'توضیحات رد شده',
      status: 'rejected',
      source: { model: 'gemini-3.8-flash', promptVersion: 'v1' },
    });

    const exportResult = await exportBankApproved({ outFile: tempExportPath });
    expect(exportResult.count).toBe(1);

    const fileContent = JSON.parse(fs.readFileSync(tempExportPath, 'utf8'));
    expect(fileContent).toHaveLength(1);
    expect(fileContent[0].stableId).toBe('approved_111111111111111111111111111111111');
    expect(fileContent[0].status).toBe('approved');
    expect(fileContent[0]._id).toBeUndefined();
    expect(fileContent[0].__v).toBeUndefined();
  });

  it('import is an upsert that loads items and skips items whose imageId is not in catalog', async () => {
    // Seed catalog with only image "img_app_1"
    await ImageModel.create({
      _id: 'img_app_1',
      publicId: 'pub_img_app_1234567890',
      filename: 'img_app_1.jpg',
      trueClass: 'covid19',
      confusedWith: 'pneumonia',
      difficulty: 0.2,
      bucket: 'easy',
      source: 'cohen',
    });

    const seedItems = [
      // Valid item whose image exists in catalog
      {
        stableId: 'imported_stable_id_1',
        imageId: 'img_app_1',
        type: 'finding',
        pair: { trueClass: 'covid19', confusedWith: 'pneumonia' },
        bucket: 'easy',
        stem: 'سؤال وارد شده اول؟',
        options: [
          { text: 'گزینه الف', key: 'ground_glass' },
          { text: 'گزینه ب', key: 'consolidation' },
          { text: 'گزینه ج', key: 'air_bronchograms' },
          { text: 'گزینه د', key: 'clear_lungs' },
        ],
        correctIndex: 0,
        rationale: 'توضیحات وارد شده',
        kbRef: null,
        tags: ['imported'],
        source: { model: 'gemini-3.8-flash', promptVersion: 'v1' },
      },
      // Item whose image does NOT exist in catalog -> must be skipped
      {
        stableId: 'imported_stable_id_missing_img',
        imageId: 'non_existent_image_id',
        type: 'finding',
        pair: { trueClass: 'pneumonia', confusedWith: 'normal' },
        bucket: 'medium',
        stem: 'سؤال تصویر ناموجود؟',
        options: [
          { text: 'الف', key: 'opacity' },
          { text: 'ب', key: 'consolidation' },
          { text: 'ج', key: 'air_bronchograms' },
          { text: 'د', key: 'clear_lungs' },
        ],
        correctIndex: 0,
        rationale: 'توضیحات تصویر ناموجود',
        source: { model: 'gemini-3.8-flash', promptVersion: 'v1' },
      },
    ];

    fs.writeFileSync(tempExportPath, JSON.stringify(seedItems), 'utf8');

    const importResult = await importBankApproved({ inFile: tempExportPath });
    expect(importResult.totalRead).toBe(2);
    expect(importResult.imported).toBe(1);
    expect(importResult.skipped).toBe(1);

    const savedDoc = await QuestionBankModel.findOne({ stableId: 'imported_stable_id_1' });
    expect(savedDoc).toBeDefined();
    expect(savedDoc.status).toBe('approved');
    expect(savedDoc.stem).toBe('سؤال وارد شده اول؟');

    // Verify missing image item was not saved
    const missingDoc = await QuestionBankModel.findOne({
      stableId: 'imported_stable_id_missing_img',
    });
    expect(missingDoc).toBeNull();

    // Re-importing is an upsert (idempotent, does not duplicate)
    const reimportResult = await importBankApproved({ inFile: tempExportPath });
    expect(reimportResult.imported).toBe(1);
    const totalCount = await QuestionBankModel.countDocuments();
    expect(totalCount).toBe(1);
  });
});
