# Eval results: v1-rag

- Provider: `google`
- Model: `gemini-3.5-flash-lite`
- Temperature: 0
- Thinking: minimal
- Date: 2026-10-22T09:53:34.548Z
- System prompt hash: `6cb3c29d5be149bfb89711ce5709594583468a7ce9ddbc6d87de8199a9dd7eeb`
- Pricing: https://ai.google.dev/gemini-api/docs/rate-limits (lookup 2026-10-22)
- Runs per task: 3
- Context: `rag` (top-k 3)
- Docs path: `docs/src/content/docs`
- Docs corpus hash: `50cb7410a9b56472f205e3da0fe06417b451e314e66b99f30d1cba59f995b28f`
- Overall (errors excluded): **24/30**
- Errors (excluded from pass rate): **0**
- Tokens: 17148 in / 362 out / 0 thinking
- Estimated cost: $0.000000

| Task | Consistency (passes/scored) | Errors |
|------|-----------------------------|--------|
| T1 | 3/3 | 0 |
| T2 | 3/3 | 0 |
| T3 | 3/3 | 0 |
| T4 | 3/3 | 0 |
| T5 | 0/3 | 0 |
| T6 | 3/3 | 0 |
| T7 | 3/3 | 0 |
| T8 | 0/3 | 0 |
| T9 | 3/3 | 0 |
| T10 | 3/3 | 0 |

## Attempts

| Task | Run | Outcome | Finish | Input | Output | Thinking | Retries | Reason |
|------|-----|---------|--------|-------|--------|----------|---------|--------|
| T1 | 1 | pass | STOP | 646 | 11 |  | 0 |  |
| T1 | 2 | pass | STOP | 646 | 11 |  | 0 |  |
| T1 | 3 | pass | STOP | 646 | 11 |  | 0 |  |
| T2 | 1 | pass | STOP | 547 | 13 |  | 0 |  |
| T2 | 2 | pass | STOP | 547 | 13 |  | 0 |  |
| T2 | 3 | pass | STOP | 547 | 13 |  | 0 |  |
| T3 | 1 | pass | STOP | 557 | 14 |  | 0 |  |
| T3 | 2 | pass | STOP | 557 | 14 |  | 0 |  |
| T3 | 3 | pass | STOP | 557 | 14 |  | 0 |  |
| T4 | 1 | pass | STOP | 615 | 20 |  | 0 |  |
| T4 | 2 | pass | STOP | 615 | 20 |  | 0 |  |
| T4 | 3 | pass | STOP | 615 | 20 |  | 0 |  |
| T5 | 1 | fail | STOP | 587 | 20 |  | 0 | parsed.timeoutMs: expected 2000, got 2 |
| T5 | 2 | fail | STOP | 587 | 20 |  | 0 | parsed.timeoutMs: expected 2000, got 2 |
| T5 | 3 | fail | STOP | 587 | 20 |  | 0 | parsed.timeoutMs: expected 2000, got 2 |
| T6 | 1 | pass | STOP | 552 | 10 |  | 0 |  |
| T6 | 2 | pass | STOP | 552 | 10 |  | 0 |  |
| T6 | 3 | pass | STOP | 552 | 10 |  | 0 |  |
| T7 | 1 | pass | STOP | 611 | 5 |  | 0 |  |
| T7 | 2 | pass | STOP | 611 | 6 |  | 0 |  |
| T7 | 3 | pass | STOP | 611 | 6 |  | 0 |  |
| T8 | 1 | fail | STOP | 371 | 6 |  | 0 | answer: expected 1, got 2 |
| T8 | 2 | fail | STOP | 371 | 6 |  | 0 | answer: expected 1, got 2 |
| T8 | 3 | fail | STOP | 371 | 6 |  | 0 | answer: expected 1, got 2 |
| T9 | 1 | pass | STOP | 731 | 5 |  | 0 |  |
| T9 | 2 | pass | STOP | 731 | 5 |  | 0 |  |
| T9 | 3 | pass | STOP | 731 | 5 |  | 0 |  |
| T10 | 1 | pass | STOP | 499 | 16 |  | 0 |  |
| T10 | 2 | pass | STOP | 499 | 16 |  | 0 |  |
| T10 | 3 | pass | STOP | 499 | 16 |  | 0 |  |
