# Batch 2 notes (T06, T07, T08a, T08b)

## Why T08 became T08a + T08b
The real Gemini quota (gemini-3.8-flash: 5 RPM, 250k TPM, 20 RPD) makes the original plan (about 1800 calls) impossible. T08a analyses a fixed set of 120 images in batches of 6 over about 3 quota days; T08b generates questions from the passed analyses in about 1 quota day.

## Recommended order
T06 (UI, no quota) -> T07 (LLM core, 2-3 requests) -> T08a (gate day, then run daily while you work) -> T08b. While the T08a daily runs happen, do T08b steps 1-2, 4-7 against fixtures, then run generation when the analysis is finished.

## Quota calendar (all counted per Pacific day)
T07: smoke 1 + pregeneration 1. T08a: gate 2, then about 38 over 3 days. T08b: about 8-13 in 1 day. Daily budget in env: 16 (20 minus a reserve of 4).

## Rules that did not change
Solo mode, JavaScript only, no label leakage to residents, no secrets in chat or git, merge commits only, AI review in a fresh chat before every merge.
