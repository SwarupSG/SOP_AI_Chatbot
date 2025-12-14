# Confidence Score Calculation Logic

## Current Implementation (Updated with LLM Confidence)

The confidence score is calculated in `lib/chroma.ts` in the `querySOPs()` function using a **hybrid approach** that combines retrieval confidence with LLM confidence.

### Step-by-Step Process

#### Part 1: Retrieval Confidence (60% weight)

1. **Vector Similarity Search**
   - User's question is converted to an embedding using Ollama's `nomic-embed-text` model
   - ChromaDB performs a similarity search and returns the top 5 most similar SOP entries
   - Each result includes a **distance** value (vector distance metric)

2. **Distance Extraction**
   ```typescript
   const distances = results.distances?.[0] || [];
   ```
   - Extracts distance values for all retrieved results
   - Distance represents how "far" the question embedding is from each SOP entry embedding
   - **Lower distance = Higher similarity**

3. **Average Distance Calculation**
   ```typescript
   const avgDistance = distances.length > 0 
     ? distances.filter((d): d is number => d != null).reduce((a, b) => a + b, 0) / distances.length
     : 1;
   ```
   - Calculates the **average distance** across all top 5 results
   - Filters out null/undefined values
   - Defaults to 1 (maximum distance) if no results

4. **Retrieval Confidence Conversion**
   ```typescript
   const retrievalConfidence = Math.max(0, Math.min(1, 1 - avgDistance));
   ```
   - Converts distance to confidence: `confidence = 1 - avgDistance`
   - Clamps the result between 0 and 1
   - **Formula**: Lower average distance → Higher confidence

#### Part 2: LLM Confidence (40% weight)

5. **LLM Self-Assessment**
   - After generating the answer, the LLM is asked to rate its own confidence
   - Prompt: "On a scale of 0.0 to 1.0, how confident should the assistant be in this answer?"
   - LLM returns a confidence score based on:
     - How well the answer addresses the question
     - How well the context supports the answer
     - Whether the answer is complete and accurate
     - Whether there are uncertainties or gaps

6. **Heuristic Analysis (Fallback)**
   - If self-assessment fails, analyzes the answer text for uncertainty indicators:
     - **High confidence phrases**: "according to", "based on", "the procedure is", "you should"
     - **Low confidence phrases**: "I'm not sure", "unclear", "uncertain", "may not", "might not"
   - Adjusts confidence based on:
     - Presence of uncertainty phrases
     - Answer length (very short answers = lower confidence)
     - Explicit uncertainty statements

#### Part 3: Combined Confidence

7. **Weighted Combination**
   ```typescript
   const RETRIEVAL_WEIGHT = 0.6;  // 60%
   const LLM_WEIGHT = 0.4;        // 40%
   const combinedConfidence = (retrievalConfidence * RETRIEVAL_WEIGHT) + (llmConfidence * LLM_WEIGHT);
   ```
   - Combines both confidence scores with weights
   - **60% retrieval confidence** + **40% LLM confidence**
   - Final confidence reflects both retrieval quality and answer quality

### Current Assumptions

The code assumes **cosine distance** where:
- `distance = 0` → Perfect match (identical vectors) → `confidence = 1.0` (100%)
- `distance = 1` → Orthogonal (completely different) → `confidence = 0.0` (0%)
- `distance = 0.5` → Moderate similarity → `confidence = 0.5` (50%)

### Example Calculation (With LLM Confidence)

**Scenario**: User asks "How do I process a refund?"

#### Step 1: Retrieval Confidence
1. **ChromaDB returns 5 results with distances:**
   - Result 1: distance = 0.2 (very similar)
   - Result 2: distance = 0.3 (similar)
   - Result 3: distance = 0.4 (moderately similar)
   - Result 4: distance = 0.5 (somewhat similar)
   - Result 5: distance = 0.6 (less similar)

2. **Calculate average:**
   ```
   avgDistance = (0.2 + 0.3 + 0.4 + 0.5 + 0.6) / 5 = 0.4
   ```

3. **Convert to retrieval confidence:**
   ```
   retrievalConfidence = 1 - 0.4 = 0.6 (60%)
   ```

#### Step 2: LLM Confidence
4. **LLM generates answer and self-assesses:**
   - LLM returns confidence score: 0.75 (75%)
   - Or heuristic analysis detects high confidence phrases → 0.8 (80%)
   ```
   llmConfidence = 0.75 (75%)
   ```

#### Step 3: Combined Confidence
5. **Weighted combination:**
   ```
   combinedConfidence = (0.6 × 0.6) + (0.75 × 0.4)
                      = 0.36 + 0.30
                      = 0.66 (66%)
   ```

**Final confidence: 66%** (combines both retrieval quality and answer quality)

### Current Thresholds

- **High Confidence**: ≥ 0.7 (70%) - Green indicator
- **Medium Confidence**: 0.4 - 0.69 (40-69%) - Yellow indicator
- **Low Confidence**: < 0.4 (< 40%) - Red indicator
- **Auto-log Threshold**: < 0.3 (30%) - Automatically logged to unanswered questions

## Current Implementation Status

✅ **Retrieval Confidence**: Implemented (60% weight)  
✅ **LLM Confidence**: Implemented (40% weight)  
✅ **Self-Assessment**: Implemented with fallback to heuristics  
✅ **Combined Scoring**: Weighted combination of both factors

## Limitations & Considerations

1. **Distance Metric Assumption**
   - Assumes cosine distance (0-1 range)
   - ChromaDB might use different metrics (Euclidean, etc.)
   - Different metrics have different ranges

2. **Simple Averaging**
   - Averages all 5 results equally
   - Doesn't weight by rank (top result should matter more)
   - Doesn't consider result count (fewer results might indicate lower confidence)

3. **LLM Self-Assessment**
   - Requires additional LLM API call (adds latency)
   - May not always be accurate (LLM might over/under-estimate)
   - Falls back to heuristics if self-assessment fails

## Potential Improvements

### Option 1: Weighted Average (Recommended)
```typescript
// Weight top results more heavily
const weights = [0.4, 0.3, 0.15, 0.1, 0.05]; // Top result = 40% weight
const weightedDistance = distances.reduce((sum, dist, idx) => 
  sum + (dist * (weights[idx] || 0)), 0
);
const confidence = Math.max(0, Math.min(1, 1 - weightedDistance));
```

### Option 2: Use Top Result Only
```typescript
// Use only the best match
const topDistance = distances[0] || 1;
const confidence = Math.max(0, Math.min(1, 1 - topDistance));
```

### Option 3: Normalize Based on Result Count
```typescript
// Adjust confidence if fewer results found
const resultCount = distances.length;
const avgDistance = distances.reduce((a, b) => a + b, 0) / resultCount;
const confidence = Math.max(0, Math.min(1, (1 - avgDistance) * (resultCount / 5)));
```

### Option 4: Hybrid Approach
```typescript
// Combine retrieval confidence with result quality
const topDistance = distances[0] || 1;
const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
const resultCount = distances.length;

// Weighted combination
const retrievalConfidence = 1 - avgDistance;
const topMatchConfidence = 1 - topDistance;
const coverageConfidence = resultCount / 5; // How many results found

const confidence = (
  retrievalConfidence * 0.4 +
  topMatchConfidence * 0.4 +
  coverageConfidence * 0.2
);
```

## Current Code Location

**File**: `sop-ai/lib/chroma.ts`  
**Function**: `querySOPs()`  
**Lines**: 282-287

```typescript
// Calculate confidence based on similarity (lower distance = higher confidence)
// Convert distance to confidence (assuming cosine distance, 0 = identical, 1 = orthogonal)
const avgDistance = distances.length > 0 
  ? distances.filter((d): d is number => d != null).reduce((a, b) => a + b, 0) / distances.length
  : 1;
const confidence = Math.max(0, Math.min(1, 1 - avgDistance));
```

## Usage in Application

1. **Display**: Shown as percentage in chat UI (e.g., "60% confidence")
2. **Color Coding**: 
   - Green (≥70%): High confidence
   - Yellow (40-69%): Medium confidence
   - Red (<40%): Low confidence
3. **Auto-logging**: Questions with <30% confidence are automatically logged to unanswered questions for admin review

