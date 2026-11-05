/**
 * @fileoverview Prompt A builder for the T08a image analysis pipeline.
 *
 * Rules:
 *   - The prompt text MUST NOT contain any dataset label, source name, file name,
 *     or catalog id. Labels appear ONLY inside vocabulary lists for predictedClass.
 *   - The vocabulary lists are spelled out explicitly so the model has no need to
 *     guess or invent values.
 *   - Images are sent as original JPEG bytes (base64-encoded).
 *   - Each image is preceded by a text label "Image k:" (1-based).
 *   - Prompt version: v1 (bump on any semantic change to this file).
 *
 * This module exports a pure function: no I/O, no DB, no network.
 */

import { z } from 'zod';
import { BatchAnalysisResponseSchema } from '@radiology/contracts';

export const PROMPT_VERSION = 'v1';

// JSON Schema derived from the Zod contract — sent with response_format.
// We compute it once at module load.
export const RESPONSE_JSON_SCHEMA = z.toJSONSchema(BatchAnalysisResponseSchema);

/**
 * System instruction for Prompt A.
 * Written as a radiology teaching assistant role with structured output guidance.
 */
export const SYSTEM_INSTRUCTION_A = `You are a radiology teaching assistant that analyses chest X-ray images for educational purposes.
You will receive a batch of chest X-ray images, each preceded by a text label "Image k:".
For EVERY image, return one result object with the fields described below.
Use ONLY the allowed vocabulary values listed; never invent new values.
Never reveal the image order hint (the "Image k:" label) in your analysis beyond using the index field.
This is an educational exercise; your output is NOT used for clinical diagnosis or treatment.`;

/**
 * Build the multimodal input array for Prompt A.
 *
 * Input array format (Interactions API):
 *   [ { type: 'text', text: 'Image 1:' },
 *     { type: 'image', data: '<base64>', mime_type: 'image/jpeg' },
 *     { type: 'text', text: 'Image 2:' },
 *     { type: 'image', data: '<base64>', mime_type: 'image/jpeg' },
 *     ...,
 *     { type: 'text', text: '<instruction>' } ]
 *
 * @param {Array<{ imageId: string, jpegBase64: string }>} images
 *   Images in the order to send (1-based index matches the result.index field).
 * @returns {Array<{ type: string, text?: string, data?: string, mime_type?: string }>}
 */
export function buildPromptAInput(images) {
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
    text: buildPromptAText(images.length),
  });

  return parts;
}

/**
 * The instructional text appended after all images.
 * @param {number} n - Number of images in this batch
 * @returns {string}
 */
export function buildPromptAText(n) {
  return `Analyse each of the ${n} chest X-ray images above.

Return a JSON object with a "results" array containing exactly ${n} objects, one per image, in the SAME order as the images (index 1 through ${n}).

Each result object must have these fields with ONLY the listed allowed values:

- index (integer 1 to ${n}): position of the image in this batch
- imageQuality (string): one of ["ok", "poor", "not_cxr"]
- predictedClass (string): one of ["covid19", "pneumonia", "normal"]
- certainty (string): one of ["low", "medium", "high"]
- laterality (string): one of ["bilateral", "left", "right", "none"]
- zones (array of strings, may be empty): subset of ["upper", "middle", "lower"]
- patterns (array of strings, may be empty): subset of ["clear_lungs", "opacity", "consolidation", "ground_glass", "air_bronchograms", "interstitial", "pleural_thickening", "pleural_effusion", "hyperinflation"]
- distribution (string): one of ["peripheral", "central_perihilar", "diffuse", "focal_lobar", "none"]

Important rules:
- Analyse each image independently; do not let one image influence another.
- If the image is of poor quality or is not a chest X-ray, set imageQuality accordingly and still provide your best estimates for the other fields.
- For normal-appearing lungs, set patterns to ["clear_lungs"] and predictedClass to "normal".
- Do NOT include any field not listed above.
- Do NOT include image file names, source information, or any text outside the JSON object.`;
}
