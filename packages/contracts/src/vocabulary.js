import { z } from 'zod';

// ---------------------------------------------------------------------------
// Closed vocabulary for chest X-ray image analysis (T08a)
// Every value that the LLM may produce is listed here and validated against
// this list. Nothing outside these lists is accepted.
// ---------------------------------------------------------------------------

/**
 * Laterality of a radiographic finding
 * @typedef {'bilateral' | 'left' | 'right' | 'none'} Laterality
 */
export const LATERALITY_VALUES = /** @type {const} */ (['bilateral', 'left', 'right', 'none']);
export const LateralitySchema = z.enum(LATERALITY_VALUES);

/**
 * Anatomical zones (lung zones) visible on the X-ray
 * @typedef {'upper' | 'middle' | 'lower'} Zone
 */
export const ZONE_VALUES = /** @type {const} */ (['upper', 'middle', 'lower']);
export const ZoneSchema = z.enum(ZONE_VALUES);

/**
 * Radiographic pattern findings
 * @typedef {'clear_lungs' | 'opacity' | 'consolidation' | 'ground_glass' |
 *   'air_bronchograms' | 'interstitial' | 'pleural_thickening' |
 *   'pleural_effusion' | 'hyperinflation'} Pattern
 */
export const PATTERN_VALUES = /** @type {const} */ ([
  'clear_lungs',
  'opacity',
  'consolidation',
  'ground_glass',
  'air_bronchograms',
  'interstitial',
  'pleural_thickening',
  'pleural_effusion',
  'hyperinflation',
]);
export const PatternSchema = z.enum(PATTERN_VALUES);

/**
 * Distribution of a radiographic finding
 * @typedef {'peripheral' | 'central_perihilar' | 'diffuse' | 'focal_lobar' | 'none'} Distribution
 */
export const DISTRIBUTION_VALUES = /** @type {const} */ ([
  'peripheral',
  'central_perihilar',
  'diffuse',
  'focal_lobar',
  'none',
]);
export const DistributionSchema = z.enum(DISTRIBUTION_VALUES);

/**
 * Disease class predicted by the LLM for this image
 * (mirrors ClassId from engine.js — kept separate to avoid cross-dependency)
 * @typedef {'covid19' | 'pneumonia' | 'normal'} AnalysisClass
 */
export const ANALYSIS_CLASS_VALUES = /** @type {const} */ (['covid19', 'pneumonia', 'normal']);
export const AnalysisClassSchema = z.enum(ANALYSIS_CLASS_VALUES);

/**
 * LLM certainty level for the predicted class
 * @typedef {'low' | 'medium' | 'high'} Certainty
 */
export const CERTAINTY_VALUES = /** @type {const} */ (['low', 'medium', 'high']);
export const CertaintySchema = z.enum(CERTAINTY_VALUES);

/**
 * Quality assessment of the X-ray image
 * @typedef {'ok' | 'poor' | 'not_cxr'} ImageQuality
 */
export const IMAGE_QUALITY_VALUES = /** @type {const} */ (['ok', 'poor', 'not_cxr']);
export const ImageQualitySchema = z.enum(IMAGE_QUALITY_VALUES);

// ---------------------------------------------------------------------------
// Per-image analysis result shape (one item in the batch response)
// ---------------------------------------------------------------------------

/**
 * Single image analysis result returned by the LLM for one image in the batch
 * @typedef {Object} ImageAnalysisResult
 * @property {number} index - 1-based position of the image in the request
 * @property {ImageQuality} imageQuality - Quality assessment
 * @property {AnalysisClass} predictedClass - LLM's predicted disease class
 * @property {Certainty} certainty - Confidence level
 * @property {Laterality} laterality - Side of involvement
 * @property {Zone[]} zones - Involved lung zones (may be empty)
 * @property {Pattern[]} patterns - Identified radiographic patterns
 * @property {Distribution} distribution - Pattern distribution
 */
export const ImageAnalysisResultSchema = z.object({
  index: z.number().int().min(1),
  imageQuality: ImageQualitySchema,
  predictedClass: AnalysisClassSchema,
  certainty: CertaintySchema,
  laterality: LateralitySchema,
  zones: z.array(ZoneSchema),
  patterns: z.array(PatternSchema),
  distribution: DistributionSchema,
});

/**
 * Batch analysis response from the LLM: exactly N items, each with a unique
 * index in [1..N]. Validated strictly in the pipeline before storing.
 * @typedef {Object} BatchAnalysisResponse
 * @property {ImageAnalysisResult[]} results
 */
export const BatchAnalysisResponseSchema = z.object({
  results: z.array(ImageAnalysisResultSchema).min(1),
});
