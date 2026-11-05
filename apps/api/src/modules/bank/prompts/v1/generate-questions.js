import { PATTERN_VALUES, DISTRIBUTION_VALUES } from '@radiology/contracts';

/**
 * System instruction for question generation
 */
export const SYSTEM_INSTRUCTION = `You are an expert radiology educator creating multiple-choice practice questions in Persian for training radiology residents on chest X-ray interpretation.

NON-NEGOTIABLE CLINICAL AND PEDAGOGICAL RULES:
1. STRICTLY PERSIAN: Output question stems, options, and rationales in Persian. Do NOT use Latin words except standard acronyms like CXR or CT.
2. NO DIGITS AT ALL: Do not include ANY numbers or digits (no 0-9, no ۰-۹, no ٠-٩). Express concepts using words (e.g., دوطرفه, چندگانه, یک لوب, چند کانونی).
3. NO PERCENTAGES: Never use % or ٪.
4. NO CLASS NAMES IN FINDING/DISTRIBUTION STEMS: For 'finding' and 'distribution' questions, NEVER mention disease names (e.g., کووید, ذات‌الریه, پنومونی, نرمال, covid, pneumonia, normal) in the question stem. The resident must identify findings objectively without being given the diagnosis.
5. FOUR UNIQUE OPTIONS: Every question must have exactly 4 distinct options.
6. TIED KEYS FOR FINDING:
   - Options must include a 'key' property.
   - For 'finding', exactly ONE option's key must match the target consensus pattern.
   - The other THREE options' keys must be chosen from the provided distractor pattern keys.
   - correctIndex must point to the target consensus pattern option.
7. TIED KEYS FOR DISTRIBUTION:
   - For 'distribution', exactly ONE option's key must match the target consensus distribution.
   - The other THREE options' keys must be chosen from the provided distractor distribution keys.
   - correctIndex must point to the target consensus distribution option.
8. DIFFERENTIAL QUESTIONS:
   - All 4 options must have key: null.
   - kbRef must be set to the exact slug of the knowledge base snippet supporting the answer.
   - Differential stems MAY mention the two diseases being compared.
9. RATIONALE: Keep rationale concise and under 300 characters.

Return a JSON object conforming exactly to the requested schema.`;

/**
 * Builds the user prompt payload for a batch of images
 * @param {Object} params
 * @param {Array<Object>} params.batch - Array of image specs to generate for
 * @param {Array<Object>} params.kbSnippets - Relevant KB snippets for pairs in this batch
 * @returns {string} JSON string describing the batch requirements
 */
export function buildGenerationPrompt({ batch, kbSnippets = [] }) {
  const images = batch.map((item, idx) => {
    const { image, consensus, requiredTypes } = item;

    // Pattern distractors: all patterns not in consensus
    const consensusPatterns = Array.isArray(consensus.patterns) ? consensus.patterns : [];
    const patternDistractors = PATTERN_VALUES.filter((p) => !consensusPatterns.includes(p));

    // Distribution distractors: all distributions not equal to consensus
    const distDistractors = DISTRIBUTION_VALUES.filter((d) => d !== consensus.distribution);

    return {
      imageIndex: idx,
      imageId: image.id,
      trueClass: image.trueClass,
      confusedWith: image.confusedWith,
      bucket: image.bucket,
      consensus: {
        patterns: consensusPatterns,
        distribution: consensus.distribution || 'none',
        laterality: consensus.laterality || 'none',
        zones: consensus.zones || [],
      },
      requiredTypes,
      vocabularyReference: {
        targetPatterns: consensusPatterns,
        allowedPatternDistractors: patternDistractors,
        targetDistribution: consensus.distribution || null,
        allowedDistributionDistractors: distDistractors,
      },
    };
  });

  const kbContext = kbSnippets.map((kb) => ({
    slug: kb.slug,
    classes: kb.classes,
    content: kb.content,
  }));

  return JSON.stringify(
    {
      instruction:
        'Generate Persian multiple-choice questions for each image according to its requiredTypes.',
      images,
      knowledgeBaseSnippets: kbContext,
    },
    null,
    2,
  );
}
