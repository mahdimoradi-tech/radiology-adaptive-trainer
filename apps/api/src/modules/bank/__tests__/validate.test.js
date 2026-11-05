import { describe, it, expect } from 'vitest';
import {
  validateQuestionCandidate,
  computeStableId,
  normalizeTextForComparison,
  calculatePersianLetterRatio,
  hasDigit,
  hasPercent,
  hasClassNameInStem,
} from '../validate.js';

describe('Bank Validation (validate.js)', () => {
  const goodFindingContext = {
    image: { id: 'img_cov_1', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'medium' },
    consensus: {
      patterns: ['ground_glass'],
      distribution: 'peripheral',
      laterality: 'bilateral',
      zones: ['lower'],
    },
    kbSlugs: ['covid-vs-pneumonia-distribution'],
  };

  const goodFindingCandidate = {
    type: 'finding',
    stem: 'کدام الگوی پاتولوژیک بارز در کلیشه قفسه سینه بیمار مشاهده می‌شود؟',
    options: [
      { text: 'کدورت شیشه‌مات', key: 'ground_glass' },
      { text: 'تراکم تک‌لوب', key: 'consolidation' },
      { text: 'هوابرونکوگرام', key: 'air_bronchograms' },
      { text: 'ریه شفاف طبیعی', key: 'clear_lungs' },
    ],
    correctIndex: 0,
    rationale: 'کدورت شیشه‌مات نشانه اولیه است.',
    kbRef: null,
    tags: ['finding', 'ground_glass'],
  };

  const goodDistributionContext = {
    image: { id: 'img_pneu_1', trueClass: 'pneumonia', confusedWith: 'normal', bucket: 'easy' },
    consensus: {
      patterns: ['consolidation'],
      distribution: 'focal_lobar',
      laterality: 'right',
      zones: ['middle'],
    },
    kbSlugs: ['pneumonia-vs-normal-focal'],
  };

  const goodDistributionCandidate = {
    type: 'distribution',
    stem: 'توزیع آناتومیک ضایعه مشهود در کدام دسته قرار می‌گیرد؟',
    options: [
      { text: 'درگیری کانونی لوبی', key: 'focal_lobar' },
      { text: 'درگیری محیطی دوطرفه', key: 'peripheral' },
      { text: 'درگیری منتشر ریوی', key: 'diffuse' },
      { text: 'درگیری نافی مرکزی', key: 'central_perihilar' },
    ],
    correctIndex: 0,
    rationale: 'تراکم به صورت موضعی در یک لوب دیده می‌شود.',
    kbRef: null,
    tags: ['distribution', 'focal_lobar'],
  };

  const goodDifferentialContext = {
    image: { id: 'img_diff_1', trueClass: 'covid19', confusedWith: 'pneumonia', bucket: 'hard' },
    consensus: {
      patterns: ['ground_glass', 'opacity'],
      distribution: 'peripheral',
      laterality: 'bilateral',
      zones: ['lower'],
    },
    kbSlugs: ['covid-vs-pneumonia-distribution', 'covid-vs-pneumonia-features'],
  };

  const goodDifferentialCandidate = {
    type: 'differential',
    stem: 'کدام نما در سی‌تی یا کلیشه سینه، تشخیص کووید را در مقایسه با پنومونی باکتریایی تقویت می‌کند؟',
    options: [
      { text: 'کدورتهای محیطی و دوطرفه تحتانی', key: null },
      { text: 'تراکم یک‌طرفه با افیوژن پلورال بارز', key: null },
      { text: 'کاویتاسیون سریع در بافت پارانشیم', key: null },
      { text: 'بزرگ‌شدگی بارز غدد لنفاوی ناف ریه', key: null },
    ],
    correctIndex: 0,
    rationale: 'بر اساس راهنمای بالینی، نمای دوطرفه محیطی به نفع عفونت ویروسی است.',
    kbRef: 'covid-vs-pneumonia-distribution',
    tags: ['differential'],
  };

  describe('Happy path validations', () => {
    it('passes for a valid finding question', () => {
      const res = validateQuestionCandidate(goodFindingCandidate, goodFindingContext);
      expect(res.valid).toBe(true);
      expect(res.reasons).toEqual([]);
    });

    it('passes for a valid distribution question', () => {
      const res = validateQuestionCandidate(goodDistributionCandidate, goodDistributionContext);
      expect(res.valid).toBe(true);
      expect(res.reasons).toEqual([]);
    });

    it('passes for a valid differential question', () => {
      const res = validateQuestionCandidate(goodDifferentialCandidate, goodDifferentialContext);
      expect(res.valid).toBe(true);
      expect(res.reasons).toEqual([]);
    });
  });

  describe('Schema and structure checks', () => {
    it('fails with SCHEMA_INVALID on missing or invalid fields', () => {
      expect(validateQuestionCandidate(null).reasons).toContain('SCHEMA_INVALID');
      expect(validateQuestionCandidate({}).reasons).toContain('SCHEMA_INVALID');
      expect(
        validateQuestionCandidate({
          ...goodFindingCandidate,
          options: goodFindingCandidate.options.slice(0, 3),
        }).reasons,
      ).toContain('SCHEMA_INVALID');
      expect(
        validateQuestionCandidate({
          ...goodFindingCandidate,
          correctIndex: 5,
        }).reasons,
      ).toContain('SCHEMA_INVALID');
    });

    it('fails with STEM_EMPTY when stem is blank', () => {
      const res = validateQuestionCandidate(
        { ...goodFindingCandidate, stem: '   ' },
        goodFindingContext,
      );
      expect(res.valid).toBe(false);
      expect(res.reasons).toContain('STEM_EMPTY');
    });

    it('fails with RATIONALE_TOO_LONG when rationale exceeds 300 characters', () => {
      const res = validateQuestionCandidate(
        { ...goodFindingCandidate, rationale: 'الف'.repeat(301) },
        goodFindingContext,
      );
      expect(res.valid).toBe(false);
      expect(res.reasons).toContain('RATIONALE_TOO_LONG');
    });
  });

  describe('Content restrictions (digits, %, language, class names)', () => {
    it('fails with HAS_PERCENT if stem, options or rationale contains % or ٪', () => {
      const res1 = validateQuestionCandidate(
        { ...goodFindingCandidate, stem: 'در ۸۰% بیماران چه دیده می‌شود؟' },
        goodFindingContext,
      );
      expect(res1.reasons).toContain('HAS_PERCENT');

      const res2 = validateQuestionCandidate(
        {
          ...goodFindingCandidate,
          rationale: 'میزان شیوع ۵۰٪ گزارش شده است.',
        },
        goodFindingContext,
      );
      expect(res2.reasons).toContain('HAS_PERCENT');
    });

    it('fails with HAS_DIGIT if ASCII or Persian/Arabic digits are present', () => {
      const res1 = validateQuestionCandidate(
        { ...goodFindingCandidate, stem: 'در لوب 2 ریه چه دیده می‌شود؟' },
        goodFindingContext,
      );
      expect(res1.reasons).toContain('HAS_DIGIT');

      const res2 = validateQuestionCandidate(
        {
          ...goodFindingCandidate,
          options: [
            { text: 'گزینه شماره ۱', key: 'ground_glass' },
            goodFindingCandidate.options[1],
            goodFindingCandidate.options[2],
            goodFindingCandidate.options[3],
          ],
        },
        goodFindingContext,
      );
      expect(res2.reasons).toContain('HAS_DIGIT');
    });

    it('fails with NOT_PERSIAN if Persian character ratio is below 60%', () => {
      const res = validateQuestionCandidate(
        { ...goodFindingCandidate, stem: 'Which pathological pattern is visible on CXR?' },
        goodFindingContext,
      );
      expect(res.reasons).toContain('NOT_PERSIAN');
    });

    it('fails with CLASS_NAME_IN_STEM if finding/distribution stem mentions disease names', () => {
      const resCovid = validateQuestionCandidate(
        {
          ...goodFindingCandidate,
          stem: 'در بیمار مبتلا به کووید کدام یافته مشهود است؟',
        },
        goodFindingContext,
      );
      expect(resCovid.reasons).toContain('CLASS_NAME_IN_STEM');

      const resPneumonia = validateQuestionCandidate(
        {
          ...goodDistributionCandidate,
          stem: 'در پنومونی حاد توزیع ضایعه چگونه است؟',
        },
        goodDistributionContext,
      );
      expect(resPneumonia.reasons).toContain('CLASS_NAME_IN_STEM');

      // Differential stem CAN mention disease names because it compares them!
      const resDiff = validateQuestionCandidate(goodDifferentialCandidate, goodDifferentialContext);
      expect(resDiff.reasons).not.toContain('CLASS_NAME_IN_STEM');
    });

    it('fails with DUPLICATE_OPTIONS if two options normalize to the same text', () => {
      const res = validateQuestionCandidate(
        {
          ...goodFindingCandidate,
          options: [
            { text: 'کدورت شیشه‌مات', key: 'ground_glass' },
            { text: 'کدورت شیشه مات', key: 'opacity' }, // duplicate after space/zwnj norm
            goodFindingCandidate.options[2],
            goodFindingCandidate.options[3],
          ],
        },
        goodFindingContext,
      );
      expect(res.reasons).toContain('DUPLICATE_OPTIONS');
    });
  });

  describe('Tied-keys validation rules', () => {
    it('fails finding if option keys are duplicate or not in PATTERN_VALUES', () => {
      const res = validateQuestionCandidate(
        {
          ...goodFindingCandidate,
          options: [
            { text: 'گزینه الف', key: 'ground_glass' },
            { text: 'گزینه ب', key: 'ground_glass' }, // duplicate key
            { text: 'گزینه ج', key: 'air_bronchograms' },
            { text: 'گزینه د', key: 'clear_lungs' },
          ],
        },
        goodFindingContext,
      );
      expect(res.reasons).toContain('TIED_KEY_INVALID');
    });

    it('fails finding if more than 1 option key is in consensus patterns', () => {
      const contextWith2Patterns = {
        ...goodFindingContext,
        consensus: { patterns: ['ground_glass', 'consolidation'] },
      };
      // goodFindingCandidate options have both ground_glass and consolidation!
      const res = validateQuestionCandidate(goodFindingCandidate, contextWith2Patterns);
      expect(res.reasons).toContain('TIED_KEY_INVALID');
    });

    it('fails finding if correctIndex does not match the consensus pattern option', () => {
      const res = validateQuestionCandidate(
        {
          ...goodFindingCandidate,
          correctIndex: 1, // points to consolidation, but consensus is ground_glass!
        },
        goodFindingContext,
      );
      expect(res.reasons).toContain('TIED_KEY_INVALID');
    });

    it('fails distribution if consensus distribution is missing or none', () => {
      const res = validateQuestionCandidate(goodDistributionCandidate, {
        ...goodDistributionContext,
        consensus: { distribution: 'none' },
      });
      expect(res.reasons).toContain('TIED_KEY_INVALID');
    });

    it('fails distribution if correctIndex points to wrong distribution option', () => {
      const res = validateQuestionCandidate(
        {
          ...goodDistributionCandidate,
          correctIndex: 2, // points to diffuse, but consensus is focal_lobar
        },
        goodDistributionContext,
      );
      expect(res.reasons).toContain('TIED_KEY_INVALID');
    });

    it('fails differential if options have non-null keys or kbRef is invalid', () => {
      const resKey = validateQuestionCandidate(
        {
          ...goodDifferentialCandidate,
          options: [
            { text: 'گزینه یک', key: 'ground_glass' }, // key must be null for differential
            goodDifferentialCandidate.options[1],
            goodDifferentialCandidate.options[2],
            goodDifferentialCandidate.options[3],
          ],
        },
        goodDifferentialContext,
      );
      expect(resKey.reasons).toContain('TIED_KEY_INVALID');

      const resKb = validateQuestionCandidate(
        {
          ...goodDifferentialCandidate,
          kbRef: 'non-existent-kb-slug',
        },
        goodDifferentialContext,
      );
      expect(resKb.reasons).toContain('TIED_KEY_INVALID');
    });
  });

  describe('Helper utilities', () => {
    it('computes deterministic stableId', () => {
      const id1 = computeStableId({
        imageId: 'img1',
        type: 'finding',
        promptVersion: 'v1',
        slot: 0,
      });
      const id2 = computeStableId({
        imageId: 'img1',
        type: 'finding',
        promptVersion: 'v1',
        slot: 0,
      });
      const id3 = computeStableId({
        imageId: 'img1',
        type: 'finding',
        promptVersion: 'v1',
        slot: 1,
      });

      expect(id1).toHaveLength(40);
      expect(id1).toBe(id2);
      expect(id1).not.toBe(id3);
    });

    it('normalizes Persian text correctly', () => {
      expect(normalizeTextForComparison('كَدورَتِ ریَوی')).toBe('کدورت ریوی');
      expect(normalizeTextForComparison('شیشه‌مات')).toBe('شیشه مات');
    });

    it('detects digits and percentages accurately', () => {
      expect(hasDigit('تعداد 5 مورد')).toBe(true);
      expect(hasDigit('تعداد ۵ مورد')).toBe(true);
      expect(hasDigit('بدون عدد')).toBe(false);

      expect(hasPercent('10%')).toBe(true);
      expect(hasPercent('۱۰٪')).toBe(true);
      expect(hasPercent('بدون درصد')).toBe(false);
    });

    it('calculates Persian letter ratio', () => {
      expect(calculatePersianLetterRatio('تست کامل فارسی')).toBe(1);
      expect(calculatePersianLetterRatio('CXR')).toBe(0);
      expect(calculatePersianLetterRatio('تصویر CXR ریه')).toBeGreaterThan(0.6);
    });

    it('detects class names in stems', () => {
      expect(hasClassNameInStem('در کووید-۱۹ چه دیده می‌شود؟')).toBe(true);
      expect(hasClassNameInStem('علائم ذات‌الریه چیست؟')).toBe(true);
      expect(hasClassNameInStem('آیا ریه نرمال است؟')).toBe(true);
      expect(hasClassNameInStem('کدام الگوی پاتولوژیک مشهود است؟')).toBe(false);
    });
  });
});
