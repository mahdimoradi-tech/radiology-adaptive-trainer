import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDb } from '../../../../test/helpers/testDb.js';
import { QuestionBankModel, QuestionGenAttemptModel } from '../model.js';
import { AnalysisValidationModel } from '../../analysis/model.js';
import { ImageModel } from '../../catalog/model.js';
import { LlmUsage } from '../../llm/budget.js';
import { FakeProvider } from '../../llm/fake.provider.js';
import { planCandidateQuestionTypes, chunkIntoBatches, generateQuestions } from '../generate.js';

describe('Question Generation Service (generate.js)', () => {
  let testDb;

  beforeAll(async () => {
    testDb = await setupTestDb();
    await QuestionBankModel.syncIndexes();
    await QuestionGenAttemptModel.syncIndexes();
    await AnalysisValidationModel.syncIndexes();
    await ImageModel.syncIndexes();
    await LlmUsage.syncIndexes();
  });

  afterAll(async () => {
    if (testDb) {
      await testDb.teardown();
    }
  });

  beforeEach(async () => {
    await testDb.clearCollections();
  });

  describe('planCandidateQuestionTypes', () => {
    it('always assigns finding, assigns distribution for diseases with distribution, and differentials capped at max', () => {
      const candidates = [
        // Candidate 1: covid with peripheral distribution -> finding + distribution
        {
          image: { id: 'img_1', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'hard' },
          consensus: { patterns: ['ground_glass'], distribution: 'peripheral' },
        },
        // Candidate 2: covid without distribution -> finding + differential
        {
          image: { id: 'img_2', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'medium' },
          consensus: { patterns: ['opacity'], distribution: 'none' },
        },
        // Candidate 3: normal (no distribution) -> finding + differential
        {
          image: { id: 'img_3', trueClass: 'normal', confusedWith: 'pneumonia', bucket: 'easy' },
          consensus: { patterns: ['clear_lungs'], distribution: 'none' },
        },
      ];

      const planned = planCandidateQuestionTypes({ candidates, maxDifferentialPerPair: 2 });
      expect(planned[0].requiredTypes).toEqual(['finding', 'distribution']);
      expect(planned[1].requiredTypes).toEqual(['finding', 'differential']);
      expect(planned[2].requiredTypes).toEqual(['finding', 'differential']);
    });

    it('enforces differential cap per ordered pair', () => {
      const candidates = [
        {
          image: { id: 'c1', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'easy' },
          consensus: { patterns: ['ground_glass'], distribution: 'none' },
        },
        {
          image: { id: 'c2', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'easy' },
          consensus: { patterns: ['ground_glass'], distribution: 'none' },
        },
        {
          image: { id: 'c3', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'easy' },
          consensus: { patterns: ['ground_glass'], distribution: 'none' },
        },
      ];

      // Cap at 2 differentials for covid19:pneumonia
      const planned = planCandidateQuestionTypes({ candidates, maxDifferentialPerPair: 2 });
      expect(planned[0].requiredTypes).toEqual(['finding', 'differential']);
      expect(planned[1].requiredTypes).toEqual(['finding', 'differential']);
      expect(planned[2].requiredTypes).toEqual(['finding']); // Capped!
    });
  });

  describe('chunkIntoBatches', () => {
    it('splits items into expected chunk sizes', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = chunkIntoBatches(items, 4);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(4);
      expect(chunks[1]).toHaveLength(4);
      expect(chunks[2]).toHaveLength(2);
    });
  });

  describe('generateQuestions execution', () => {
    it('runs in dryRun mode without writing to DB or consuming budget', async () => {
      const candidates = [
        {
          image: { id: 'dry_1', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'medium' },
          consensus: { patterns: ['ground_glass'], distribution: 'peripheral' },
        },
      ];

      const summary = await generateQuestions({
        provider: new FakeProvider(),
        dryRun: true,
        candidateItems: candidates,
      });

      expect(summary.exitReason).toBe('COMPLETED');
      expect(summary.requestsMade).toBe(1);
      expect(summary.itemsCreated.total).toBe(2); // finding + distribution
      expect(summary.itemsCreated.byType.finding).toBe(1);
      expect(summary.itemsCreated.byType.distribution).toBe(1);

      // Verify no DB writes in dry-run
      const count = await QuestionBankModel.countDocuments();
      expect(count).toBe(0);
    });

    it('generates valid items, writes to QuestionBank, and rejects invalid ones into QuestionGenAttempt', async () => {
      const candidates = [
        {
          image: { id: 'cand_1', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'hard' },
          consensus: { patterns: ['ground_glass'], distribution: 'peripheral' },
        },
      ];

      const fake = new FakeProvider();
      fake.enqueue({
        items: [
          {
            imageIndex: 0,
            questions: [
              // Valid finding question
              {
                type: 'finding',
                stem: 'کدام یافته پاتولوژیک اولیه در رادیوگرافی مشهود است؟',
                options: [
                  { text: 'کدورت شیشه‌مات', key: 'ground_glass' },
                  { text: 'تراکم لوبی', key: 'consolidation' },
                  { text: 'هوابرونکوگرام', key: 'air_bronchograms' },
                  { text: 'ریه شفاف طبیعی', key: 'clear_lungs' },
                ],
                correctIndex: 0,
                rationale: 'کدورت شیشه‌مات مشخصه اصلی است.',
                kbRef: null,
                tags: ['finding'],
              },
              // Invalid question (contains a digit '123')
              {
                type: 'distribution',
                stem: 'توزیع ضایعه 123 چگونه است؟',
                options: [
                  { text: 'درگیری محیطی', key: 'peripheral' },
                  { text: 'درگیری مرکزی', key: 'central_perihilar' },
                  { text: 'درگیری منتشر', key: 'diffuse' },
                  { text: 'درگیری لوبی', key: 'focal_lobar' },
                ],
                correctIndex: 0,
                rationale: 'توزیع محیطی است.',
                kbRef: null,
                tags: ['distribution'],
              },
            ],
          },
        ],
      });

      const summary = await generateQuestions({
        provider: fake,
        dryRun: false,
        candidateItems: candidates,
        delayMs: 0,
      });

      expect(summary.itemsCreated.total).toBe(1);
      expect(summary.itemsCreated.byType.finding).toBe(1);
      expect(summary.attemptsRejected.total).toBe(1);
      expect(summary.attemptsRejected.byReason.HAS_DIGIT).toBe(1);

      // Verify DB records
      const savedQuestions = await QuestionBankModel.find();
      expect(savedQuestions).toHaveLength(1);
      expect(savedQuestions[0].status).toBe('pending_review');
      expect(savedQuestions[0].type).toBe('finding');
      expect(savedQuestions[0].pair.trueClass).toBe('covid19');

      const savedAttempts = await QuestionGenAttemptModel.find();
      expect(savedAttempts).toHaveLength(1);
      expect(savedAttempts[0].reasons).toContain('HAS_DIGIT');
    });

    it('is completely idempotent (second run processes 0 candidate images)', async () => {
      // Seed validation and image
      await AnalysisValidationModel.create({
        imageId: 'img_idem_1',
        promptVersion: 'v1',
        status: 'auto_passed',
        datasetLabel: 'covid19',
        consensus: { patterns: ['ground_glass'], distribution: 'peripheral' },
      });
      await ImageModel.create({
        _id: 'img_idem_1',
        publicId: 'pub_idem_1234567890',
        filename: 'test.jpg',
        trueClass: 'covid19',
        confusedWith: 'pneumonia',
        difficulty: 0.5,
        bucket: 'medium',
        source: 'cohen',
      });

      const fake = new FakeProvider();
      fake.enqueue({
        items: [
          {
            imageIndex: 0,
            questions: [
              {
                type: 'finding',
                stem: 'کدام یافته پاتولوژیک اولیه در رادیوگرافی دیده می‌شود؟',
                options: [
                  { text: 'کدورت شیشه‌مات', key: 'ground_glass' },
                  { text: 'تراکم ریوی', key: 'consolidation' },
                  { text: 'هوابرونکوگرام', key: 'air_bronchograms' },
                  { text: 'ریه شفاف طبیعی', key: 'clear_lungs' },
                ],
                correctIndex: 0,
                rationale: 'کدورت شیشه‌مات دیده می‌شود.',
                kbRef: null,
                tags: ['finding'],
              },
            ],
          },
        ],
      });

      // First run: processes image and creates question
      const run1 = await generateQuestions({
        provider: fake,
        promptVersion: 'v1',
        delayMs: 0,
      });
      expect(run1.itemsCreated.total).toBe(1);

      // Second run: image is already in QuestionBank for promptVersion v1 -> skips!
      const run2 = await generateQuestions({
        provider: fake,
        promptVersion: 'v1',
        delayMs: 0,
      });
      expect(run2.exitReason).toBe('NO_CANDIDATES');
      expect(run2.requestsMade).toBe(0);
      expect(run2.itemsCreated.total).toBe(0);
    });

    it('halts and exits with MAX_REQUESTS_REACHED when request cap is hit', async () => {
      const candidates = [
        {
          image: { id: 'cap_1', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'easy' },
          consensus: { patterns: ['ground_glass'], distribution: 'none' },
        },
        {
          image: { id: 'cap_2', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'easy' },
          consensus: { patterns: ['ground_glass'], distribution: 'none' },
        },
      ];

      const fake = new FakeProvider();
      fake.enqueue({
        items: [{ imageIndex: 0, questions: [] }],
      });

      // Set maxRequests = 1 and batchSize = 1
      const summary = await generateQuestions({
        provider: fake,
        candidateItems: candidates,
        batchSize: 1,
        maxRequests: 1,
        delayMs: 0,
      });

      expect(summary.requestsMade).toBe(1);
      expect(summary.exitReason).toBe('MAX_REQUESTS_REACHED');
    });
  });
});
