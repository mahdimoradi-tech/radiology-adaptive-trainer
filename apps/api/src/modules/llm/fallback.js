/**
 * Deterministic fallback templates for explanations and narrative reports
 */

/**
 * 6 confusion pair fallback templates strictly derived from the knowledge base.
 * @type {Record<string, Record<string, { whatToLookFor: string[], whyConfused: string, tip: string }>>}
 */
const PAIR_FALLBACKS = {
  fa: {
    'covid19:pneumonia': {
      whatToLookFor: ['کدورت‌های دوطرفه، محیطی و شیشه‌مات در نواحی تحتانی ریه'],
      whyConfused: 'تداخل و شباهت ظاهری زیاد بین درگیری‌های ریوی ویروسی و پنومونی',
      tip: 'تثبیت فوکال لوبار با برونکوگرام هوایی بیشتر شاخص پنومونی باکتریال است',
    },
    'covid19:normal': {
      whatToLookFor: ['مات‌شدگی‌های بسیار خفیف در حاشیه‌ها یا قاعده ریه‌ها'],
      whyConfused: 'در مراحل اولیه بیماری کووید-۱۹ رادیوگرافی می‌تواند طبیعی باشد',
      tip: 'رادیوگرافی نرمال به هیچ عنوان ردکننده عفونت فعال کووید-۱۹ نیست',
    },
    'pneumonia:covid19': {
      whatToLookFor: ['تثبیت فوکال لوبار یا سگمنتال همراه با برونکوگرام هوایی'],
      whyConfused: 'الگوی بینابینی پنومونی ویروسی شباهت زیادی به کووید-۱۹ دارد',
      tip: 'به دنبال تثبیت‌های موضعی یک‌طرفه با برونکوگرام هوایی بگردید',
    },
    'pneumonia:normal': {
      whatToLookFor: ['کدورت‌های ظریف رتروکاردیال، پری‌هیلار یا پشت دیافراگم'],
      whyConfused: 'پنومونی خفیف در مراحل اول می‌تواند با بافت طبیعی اشتباه شود',
      tip: 'زوایای کوستوفرنیک و نواحی مخفی پشت قلب را به دقت وارسی کنید',
    },
    'normal:covid19': {
      whatToLookFor: ['فیلدهای ریوی شفاف و عدم وجود کدورت‌های محیطی و قاعده‌ای'],
      whyConfused: 'مارکینگ‌های برونکووواسکولار طبیعی ممکن است شبیه کدورت به نظر برسند',
      tip: 'به تقارن عروق ریوی و شفافیت زاویه‌های قفسه سینه توجه فرمایید',
    },
    'normal:pneumonia': {
      whatToLookFor: ['زوایای تیز دنده‌ای-دیافراگمی و کانتور شفاف مدیاستن و قلب'],
      whyConfused: 'دم ناکافی یا چرخش بیمار می‌تواند کدورت کاذب ریوی ایجاد کند',
      tip: 'تکنیک دم عمیق و تقارن استخوان‌های ترقوه را پیش از قضاوت بررسی کنید',
    },
  },
  en: {
    'covid19:pneumonia': {
      whatToLookFor: ['Bilateral peripheral lower-zone ground-glass opacities'],
      whyConfused: 'Substantial radiological overlap between viral presentations',
      tip: 'Focal lobar consolidation with air bronchograms favors bacterial etiology',
    },
    'covid19:normal': {
      whatToLookFor: ['Subtle peripheral or basal haziness and ground-glass areas'],
      whyConfused: 'Early stage COVID-19 chest radiographs can be completely normal',
      tip: 'A normal radiograph does not exclude active infection in early days',
    },
    'pneumonia:covid19': {
      whatToLookFor: ['Focal lobar or segmental consolidation with air bronchograms'],
      whyConfused: 'Patchy viral or atypical infiltrates mimic peripheral opacities',
      tip: 'Identify unilateral dense consolidation and parapneumonic effusion',
    },
    'pneumonia:normal': {
      whatToLookFor: ['Subtle retrocardiac, perihilar, or retrodiaphragmatic opacities'],
      whyConfused: 'Mild early consolidation hidden behind normal mediastinal shadows',
      tip: 'Carefully inspect the retrocardiac area and sharp costophrenic angles',
    },
    'normal:covid19': {
      whatToLookFor: ['Clear lung fields and absence of peripheral ground-glass shadows'],
      whyConfused: 'Normal bronchovascular markings may be misinterpreted as haze',
      tip: 'Check bilateral symmetry and gradual tapering of normal vessels',
    },
    'normal:pneumonia': {
      whatToLookFor: ['Sharp costophrenic angles and distinct cardiac borders'],
      whyConfused: 'Poor inspiration or patient rotation can mimic patchy opacity',
      tip: 'Verify adequate inspiration by counting visible anterior ribs',
    },
  },
};

/**
 * Returns deterministic fallback explanation for a confusion pair.
 *
 * @param {string} trueClass
 * @param {string} userAnswer
 * @param {'fa'|'en'} [lang='fa']
 * @returns {{ trueClass: string, userAnswer: string, whatToLookFor: string[], whyConfused: string, tip: string }}
 */
export function getExplanationFallback(trueClass, userAnswer, lang = 'fa') {
  const langKey = lang === 'en' ? 'en' : 'fa';
  const pairKey = `${trueClass}:${userAnswer}`;
  const dict = PAIR_FALLBACKS[langKey] || PAIR_FALLBACKS.fa;
  const fallback = dict[pairKey] || {
    whatToLookFor: [
      langKey === 'fa'
        ? 'بررسی الگوهای تشخیصی کلیدی و توزیع درگیری در فیلدهای ریه'
        : 'Examine key diagnostic patterns and opacity distribution',
    ],
    whyConfused:
      langKey === 'fa'
        ? 'شباهت نماهای رادیولوژیک در مراحل مختلف بیماری یا کیفیت تصویربرداری'
        : 'Overlapping radiological appearances and imaging technique factors',
    tip:
      langKey === 'fa'
        ? 'بررسی زوایای کوستوفرنیک، حاشیه‌های محیطی و مقایسه دوطرفه'
        : 'Check costophrenic angles, peripheral margins, and bilateral symmetry',
  };

  return {
    trueClass,
    userAnswer,
    ...fallback,
  };
}

/**
 * Builds a deterministic narrative report using exact integer statistics.
 *
 * @param {Object} stats
 * @param {'fa'|'en'} [lang='fa']
 * @returns {{ overview: string, strengths: string[], weaknesses: string[], patterns: string[], recommendations: string[] }}
 */
export function getNarrativeFallback(stats, lang = 'fa') {
  const isFa = lang !== 'en';
  const accuracy = Math.round(stats.overallAccuracyPercent ?? 0);
  const total = stats.totalQuestions ?? 0;
  const correct = stats.correctCount ?? 0;

  let trendDesc = isFa ? 'پایدار' : 'stable';
  if (stats.trend === 'improving') trendDesc = isFa ? 'رو به رشد' : 'improving';
  if (stats.trend === 'declining') trendDesc = isFa ? 'نیازمند توجه' : 'declining';

  const overview = isFa
    ? `در این آزمون از مجموع ${total} سوال به ${correct} مورد پاسخ صحیح دادید. دقت کلی شما ${accuracy} واحد بود و روند عملکرد ${trendDesc} ارزیابی شد.`
    : `In this test you answered ${correct} out of ${total} questions correctly. Your overall accuracy was ${accuracy} and the performance trend was ${trendDesc}.`;

  const strengths = [];
  const weaknesses = [];
  const patterns = [];

  // Identify strengths and weaknesses from classMetrics if present
  if (Array.isArray(stats.classMetrics)) {
    for (const cm of stats.classMetrics) {
      const clsAcc = Math.round(cm.accuracyPercent ?? 0);
      if (clsAcc >= 70 && strengths.length < 3) {
        strengths.push(
          isFa
            ? `عملکرد مطلوب در کلاس ${cm.classId} با دقت ${clsAcc}`
            : `Strong performance in ${cm.classId} with accuracy ${clsAcc}`,
        );
      } else if (clsAcc < 60 && weaknesses.length < 3) {
        weaknesses.push(
          isFa
            ? `نیاز به تمرین بیشتر در کلاس ${cm.classId} با دقت ${clsAcc}`
            : `Needs further practice in ${cm.classId} with accuracy ${clsAcc}`,
        );
      }
    }
  }

  if (strengths.length === 0) {
    strengths.push(
      isFa
        ? `دقت کلی ثبت‌شده ${accuracy} در کل آزمون`
        : `Overall recorded accuracy was ${accuracy} in the test`,
    );
  }

  if (weaknesses.length === 0) {
    weaknesses.push(
      isFa
        ? 'پاسخ‌های نادرست پراکنده در برخی تصاویر دشوار'
        : 'Scattered errors across select challenging images',
    );
  }

  if (Array.isArray(stats.topConfusions) && stats.topConfusions.length > 0) {
    const top = stats.topConfusions[0];
    patterns.push(
      isFa
        ? `بیشترین جفت اشتباه تشخیص ${top.trueClass} به جای ${top.userAnswer} با ${top.count} مورد`
        : `Top confusion was ${top.trueClass} mistaken for ${top.userAnswer} with count ${top.count}`,
    );
  } else {
    patterns.push(
      isFa
        ? 'الگوی خطای متمرکزی در این آزمون ثبت نشد'
        : 'No concentrated confusion pattern observed in this session',
    );
  }

  const recommendations = isFa
    ? [
        'مرور بخش‌های تشخیصی متناظر در پایگاه دانش آموزشی',
        'دقت ویژه به زوایای دنده‌ای و نواحی مخفی در تصاویر نرمال',
        'انجام آزمون انطباقی بعدی برای سنجش روند یادگیری',
      ]
    : [
        'Review the corresponding diagnostic sections in the knowledge base',
        'Pay special attention to costophrenic angles and hidden zones',
        'Complete the next adaptive session to track learning progress',
      ];

  return {
    overview,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    patterns: patterns.slice(0, 3),
    recommendations,
  };
}
