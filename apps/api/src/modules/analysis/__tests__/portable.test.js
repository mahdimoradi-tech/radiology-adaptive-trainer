import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { ImageAnalysisModel, AnalysisValidationModel, AnalysisBatchModel } from '../model.js';
import { ImageModel } from '../../catalog/model.js';
import {
  validateAllAnalyses,
  exportImageAnalyses,
  importImageAnalyses,
  getAnalysisStatusSummary,
} from '../portable.js';

const TEST_DB = `radiology_test_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const MONGODB_URI = `mongodb://127.0.0.1:27017/${TEST_DB}`;

let tempFile = '';

beforeEach(async () => {
  await mongoose.connect(MONGODB_URI);
  await Promise.all([
    ImageAnalysisModel.deleteMany({}),
    AnalysisValidationModel.deleteMany({}),
    AnalysisBatchModel.deleteMany({}),
    ImageModel.deleteMany({}),
  ]);
  tempFile = path.join(os.tmpdir(), `test-analyses-${randomUUID()}.json`);
});

afterEach(async () => {
  if (tempFile && fs.existsSync(tempFile)) {
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // ignore
    }
  }
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

describe('analysis portable & validation (Test 8)', () => {
  it('validates images and performs export/import round-trip', async () => {
    // 1. Seed two catalog images
    await ImageModel.create([
      {
        _id: 'img-pass',
        publicId: 'pub-pass-1234567890123',
        filename: 'img-pass.jpg',
        trueClass: 'pneumonia',
        source: 'kermany',
        difficulty: 0.2,
        bucket: 'easy',
        confusedWith: 'normal',
      },
      {
        _id: 'img-reject',
        publicId: 'pub-rej-12345678901234',
        filename: 'img-reject.jpg',
        trueClass: 'covid19',
        source: 'cohen',
        difficulty: 0.8,
        bucket: 'hard',
        confusedWith: 'pneumonia',
      },
    ]);

    // 2. Add analyses for img-pass (both runs agree with trueClass)
    await ImageAnalysisModel.create([
      {
        imageId: 'img-pass',
        run: 'A',
        promptVersion: 'v1',
        model: 'gemini-3.8-flash',
        batchId: 'v1-g00-A',
        output: {
          index: 1,
          imageQuality: 'ok',
          predictedClass: 'pneumonia',
          certainty: 'high',
          laterality: 'bilateral',
          zones: ['lower'],
          patterns: ['consolidation'],
          distribution: 'diffuse',
        },
      },
      {
        imageId: 'img-pass',
        run: 'B',
        promptVersion: 'v1',
        model: 'gemini-3.8-flash',
        batchId: 'v1-g00-B',
        output: {
          index: 1,
          imageQuality: 'ok',
          predictedClass: 'pneumonia',
          certainty: 'high',
          laterality: 'bilateral',
          zones: ['lower'],
          patterns: ['consolidation'],
          distribution: 'diffuse',
        },
      },
    ]);

    // 3. Add analyses for img-reject (runs disagree)
    await ImageAnalysisModel.create([
      {
        imageId: 'img-reject',
        run: 'A',
        promptVersion: 'v1',
        model: 'gemini-3.8-flash',
        batchId: 'v1-g00-A',
        output: {
          index: 2,
          imageQuality: 'ok',
          predictedClass: 'covid19',
          certainty: 'medium',
          laterality: 'bilateral',
          zones: ['lower'],
          patterns: ['ground_glass'],
          distribution: 'peripheral',
        },
      },
      {
        imageId: 'img-reject',
        run: 'B',
        promptVersion: 'v1',
        model: 'gemini-3.8-flash',
        batchId: 'v1-g00-B',
        output: {
          index: 2,
          imageQuality: 'ok',
          predictedClass: 'pneumonia', // Disagrees with run A!
          certainty: 'low',
          laterality: 'bilateral',
          zones: ['lower'],
          patterns: ['consolidation'],
          distribution: 'diffuse',
        },
      },
    ]);

    // 4. Run validation
    const valResult = await validateAllAnalyses({ promptVersion: 'v1' });
    expect(valResult.totalValidated).toBe(2);
    expect(valResult.passedCount).toBe(1);
    expect(valResult.rejectedCount).toBe(1);
    expect(valResult.reasonsTally.RUNS_DISAGREE).toBe(1);

    // Verify stored validation docs
    const passDoc = await AnalysisValidationModel.findOne({ imageId: 'img-pass' }).lean();
    expect(passDoc.status).toBe('auto_passed');
    expect(passDoc.reasons).toHaveLength(0);
    expect(passDoc.consensus.patterns).toEqual(['consolidation']);

    const rejDoc = await AnalysisValidationModel.findOne({ imageId: 'img-reject' }).lean();
    expect(rejDoc.status).toBe('auto_rejected');
    expect(rejDoc.reasons).toContain('RUNS_DISAGREE');

    // 5. Export to temp file
    const expResult = await exportImageAnalyses({
      outputPath: tempFile,
      promptVersion: 'v1',
    });
    expect(expResult.exportedCount).toBe(2);
    expect(fs.existsSync(tempFile)).toBe(true);

    const exportedRaw = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    expect(exportedRaw).toHaveLength(2);
    expect(exportedRaw[0].imageId).toBe('img-pass');
    expect(exportedRaw[0].validation.status).toBe('auto_passed');

    // 6. Clear collections
    await ImageAnalysisModel.deleteMany({});
    await AnalysisValidationModel.deleteMany({});
    expect(await ImageAnalysisModel.countDocuments()).toBe(0);
    expect(await AnalysisValidationModel.countDocuments()).toBe(0);

    // 7. Import from temp file
    const impResult = await importImageAnalyses({ inputPath: tempFile });
    expect(impResult.importedCount).toBe(2);

    // 8. Verify round-trip integrity
    expect(await ImageAnalysisModel.countDocuments()).toBe(4); // 2 images × 2 runs
    expect(await AnalysisValidationModel.countDocuments()).toBe(2);

    const importedPass = await AnalysisValidationModel.findOne({ imageId: 'img-pass' }).lean();
    expect(importedPass.status).toBe('auto_passed');
    expect(importedPass.consensus.patterns).toEqual(['consolidation']);

    const importedPassRunA = await ImageAnalysisModel.findOne({
      imageId: 'img-pass',
      run: 'A',
    }).lean();
    expect(importedPassRunA.output.predictedClass).toBe('pneumonia');

    const importedRej = await AnalysisValidationModel.findOne({ imageId: 'img-reject' }).lean();
    expect(importedRej.status).toBe('auto_rejected');
    expect(importedRej.reasons).toContain('RUNS_DISAGREE');
  });

  it('computes status summary with accuracy and class breakdown', async () => {
    // Seed an image and batch
    await ImageModel.create({
      _id: 'img-1',
      publicId: 'pub-test-1234567890123',
      filename: 'img-1.jpg',
      trueClass: 'normal',
      source: 'kermany',
      difficulty: 0.1,
      bucket: 'easy',
      confusedWith: 'pneumonia',
    });

    await AnalysisBatchModel.create({
      _id: 'v1-g00-A',
      batchId: 'v1-g00-A',
      group: 0,
      run: 'A',
      imageIds: ['img-1'],
      status: 'done',
      model: 'gemini-3.8-flash',
      promptVersion: 'v1',
    });

    await ImageAnalysisModel.create({
      imageId: 'img-1',
      run: 'A',
      promptVersion: 'v1',
      model: 'gemini-3.8-flash',
      batchId: 'v1-g00-A',
      output: {
        index: 1,
        imageQuality: 'ok',
        predictedClass: 'normal',
        certainty: 'high',
        laterality: 'none',
        zones: [],
        patterns: ['clear_lungs'],
        distribution: 'none',
      },
    });

    const status = await getAnalysisStatusSummary({
      promptVersion: 'v1',
      budget: 16,
    });

    expect(status.batches.total).toBe(1);
    expect(status.batches.done).toBe(1);
    expect(status.images.distinctCount).toBe(1);
    expect(status.schemaValidRate).toBe(1.0);
    expect(status.runA.accuracy).toBe(1.0);
    expect(status.runA.byClass.normal.correct).toBe(1);
  });
});
