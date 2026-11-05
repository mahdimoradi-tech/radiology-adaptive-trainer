# Gemini Notes & Interactions API Reference (`@google/genai` >= 2.3.0)

Verified against `@google/genai@2.32.0` on 2026-11-05.

---

## 1. Client Initialization
```javascript
import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
```
- Client reads `GEMINI_API_KEY` from environment automatically or via explicit options object.
- Model ID default: `gemini-3.8-flash`.

---

## 2. Request Shapes

### 2.1 Text-Only Structured Output
```javascript
import { z } from 'zod';

const jsonSchema = z.toJSONSchema(MyZodSchema);

const interaction = await client.interactions.create({
  model: 'gemini-3.8-flash',
  input: JSON.stringify(inputData), // or plain string
  system_instruction: 'System prompt instructions...',
  response_format: {
    type: 'text',
    mime_type: 'application/json',
    schema: jsonSchema,
  },
});

const outputText = interaction.output_text;
const parsedData = JSON.parse(outputText);
```

### 2.2 Text + Image Multimodal Input
```javascript
const interaction = await client.interactions.create({
  model: 'gemini-3.8-flash',
  input: [
    {
      type: 'text',
      text: 'Analyze this chest X-ray image for pulmonary opacities.',
    },
    {
      type: 'image',
      data: base64EncodedImageString,
      mime_type: 'image/jpeg',
    },
  ],
  system_instruction: 'You are a radiology teaching assistant...',
  response_format: {
    type: 'text',
    mime_type: 'application/json',
    schema: jsonSchema,
  },
});
```

---

## 3. Reading Token Usage
Token usage is populated on `interaction.usage`:
```javascript
const promptTokens = interaction.usage?.total_input_tokens ?? 0;
const responseTokens = interaction.usage?.total_output_tokens ?? 0;
const totalTokens = interaction.usage?.total_tokens ?? 0;
const thoughtTokens = interaction.usage?.total_thought_tokens ?? 0;
```

---

## 4. Quota and HTTP 429 Error Structure
When rate limit or quota is exceeded:
- `error.status === 429`
- `error.code === 'RESOURCE_EXHAUSTED'`
- Message distinctions:
  - **Per-minute quota:** `Quota exceeded for quota metric ... Requests per minute`
  - **Per-day quota:** `Quota exceeded for quota metric ... Requests per day`
- **Backoff Protocol:**
  - On 429: wait 65 seconds and retry once if daily budget remains.
  - On second consecutive 429: set `exhausted = true` in MongoDB for the current Pacific day (`America/Los_Angeles`).

---

## 5. Model Parameters and Generation Configuration (`gemini-3.8-flash`)
- **Do NOT send:** `temperature`, `top_p`, `top_k`, or custom model turns (deprecated or ignored in structured output mode for 3.x).
- **Thinking:** Thinking tokens are automatically handled in Gemini 3.x models.
- **Max inline request size:** Up to 20MB payload limit for direct base64 image parts.
