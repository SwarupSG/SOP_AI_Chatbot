# LLM Confidence Factors Implementation

## Overview

The confidence score now combines **two factors**:
1. **Retrieval Confidence** (60% weight) - Based on vector similarity
2. **LLM Confidence** (40% weight) - Based on LLM self-assessment and answer quality

## Implementation Details

### 1. LLM Self-Assessment

After generating an answer, the system asks the LLM to rate its own confidence:

```typescript
const assessmentPrompt = `On a scale of 0.0 to 1.0, how confident should the assistant be in this answer?
Consider:
- How well the answer addresses the question
- How well the context supports the answer
- Whether the answer is complete and accurate
- Whether there are any uncertainties or gaps`;
```

The LLM returns a confidence score (0.0 to 1.0), which is normalized and used.

### 2. Heuristic Analysis (Fallback)

If self-assessment fails or is unavailable, the system analyzes the answer text:

**High Confidence Indicators:**
- "according to", "based on", "the procedure is", "you should", "you must"

**Low Confidence Indicators:**
- "I'm not sure", "I don't know", "unclear", "uncertain", "may not", "might not"

**Adjustments:**
- Very short answers (< 50 chars) → confidence reduced by 10%
- Explicit uncertainty statements → confidence set to 0.3

### 3. Combined Confidence Formula

```typescript
const RETRIEVAL_WEIGHT = 0.6;  // 60%
const LLM_WEIGHT = 0.4;        // 40%

combinedConfidence = (retrievalConfidence × 0.6) + (llmConfidence × 0.4)
```

## Configuration

You can adjust the weights via environment variables:

```bash
# In .env or environment
RETRIEVAL_WEIGHT=0.7  # 70% weight on retrieval
LLM_WEIGHT=0.3        # 30% weight on LLM
```

## Benefits

1. **More Accurate**: Considers both retrieval quality AND answer quality
2. **Self-Aware**: LLM evaluates its own confidence
3. **Robust**: Falls back to heuristics if self-assessment fails
4. **Configurable**: Weights can be adjusted based on your needs

## Performance Impact

- **Additional LLM Call**: Adds ~2-5 seconds for self-assessment
- **Caching**: Could be cached per question/answer pair
- **Optional**: Could be disabled for faster responses

## Example Flow

1. User asks: "How do I process a refund?"
2. **Retrieval**: Finds relevant SOPs → retrieval confidence = 0.6 (60%)
3. **LLM**: Generates answer → self-assesses → LLM confidence = 0.75 (75%)
4. **Combined**: (0.6 × 0.6) + (0.75 × 0.4) = 0.66 (66%)
5. **Result**: 66% confidence displayed to user

## Code Location

- **Main function**: `lib/chroma.ts` → `querySOPs()`
- **LLM confidence**: `lib/chroma.ts` → `calculateLLMConfidence()`
- **Heuristic analysis**: `lib/chroma.ts` → `analyzeAnswerConfidence()`




