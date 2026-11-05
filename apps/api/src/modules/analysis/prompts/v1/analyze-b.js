/**
 * @fileoverview Prompt B builder for the T08a image analysis pipeline.
 *
 * Prompt B differs from Prompt A in:
 *   - System instruction wording (passive vs active voice, field-order variation)
 *   - Instructional text structure (fields listed in different order: distribution before zones)
 *   - Explicitly asks for findings BEFORE classification
 *
 * Same hard rules as Prompt A:
 *   - No dataset labels, source names, file names, or catalog ids in the prompt text.
 *   - Labels only inside vocabulary lists for predictedClass.
 *   - Images sent as original JPEG bytes (base64-encoded).
 *   - Prompt version: v1 (bump on any semantic change).
 *
 * This module exports a pure function: no I/O, no DB, no network.
 */

import { z } from 'zod';
import { BatchAnalysisResponseSchema } from '@radiology/contracts';

export const PROMPT_VERSION = 'v1';

export const RESPONSE_JSON_SCHEMA = z.toJSONSchema(BatchAnalysisResponseSchema);

/**
 * System instruction for Prompt B.
 * Different wording from A: emphasises radiological findings first, classification second.
 */
export const SYSTEM_INSTRUCTION_B = `You are an expert in interpreting chest radiographs for educational radiology training.
A batch of chest X-ray images is provided, labelled "Image k:".
For each image, first identify the visible radiological findings, then assign a predicted class.
Use ONLY the fixed vocabulary values given in the instructions; return your analysis as structured JSON.
Your output is used solely for educational purposes and must not be treated as a clinical report.`;

/**
 * Build the multimodal input array for Prompt B.
 * Same structure as Prompt A: interleaved text labels and image parts, then instructions.
 *
 * @param {Array<{ imageId: string, jpegBase64: string }>} images
 * @returns {Array<{ type: string, text?: string, data?: string, mime_type?: string }>}
 */
export function buildPromptBInput(images) {
  /** @type {Array<{ type: string, text?: string, data?: string, mime_type?: string }>} */
  const parts = [];

  for (let i = 0; i < images.length; i++) {
    parts.push({ type: 'text', text: `Image ${i + 1}:` });
    parts.push({
      type: 'image',
      data: images[i].jpegBase64,
      mime_type: 'image/jpeg',
    });
  }

  parts.push({
    type: 'text',
    text: buildPromptBText(images.length),
  });

  return parts;
}

/**
 * The instructional text for Prompt B.
 * Field listing order differs from A (distribution appears before zones).
 * @param {number} n - Number of images in this batch
 * @returns {string}
 */
export function buildPromptBText(n) {
  return `You have been shown ${n} chest X-ray images, each identified by its position label.

For each image, provide a JSON analysis. Return a JSON object with a "results" array of exactly ${n} items (one per image, index 1 to ${n}).

Required fields for each item, using ONLY the allowed values shown:

- index (integer): image position, 1 through ${n}
- imageQuality (string): "ok" | "poor" | "not_cxr"
- patterns (array): visible radiological findings — subset of ["clear_lungs", "opacity", "consolidation", "ground_glass", "air_bronchograms", "interstitial", "pleural_thickening", "pleural_effusion", "hyperinflation"] (may be empty)
- distribution (string): "peripheral" | "central_perihilar" | "diffuse" | "focal_lobar" | "none"
- laterality (string): "bilateral" | "left" | "right" | "none"
- zones (array): affected lung zones — subset of ["upper", "middle", "lower"] (may be empty)
- certainty (string): confidence in your classification — "low" | "medium" | "high"
- predictedClass (string): "covid19" | "pneumonia" | "normal"

Scoring rules:
- Assess each image independently; resist cross-image influence.
- When lungs appear clear, set patterns to ["clear_lungs"] and predictedClass to "normal".
- For poor-quality or non-chest-X-ray images, still complete all fields with your best estimate.
- Output only the JSON object — no extra text, no file names, no source references.`;
}
