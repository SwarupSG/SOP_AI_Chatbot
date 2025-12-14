# Question Validation Improvement

## Problem

Predefined questions were being generated without validation, resulting in questions that only achieved 38% confidence instead of the required >80% confidence threshold.

## Solution

Implemented a **validation step** that tests each generated question against the RAG system to ensure it meets the >80% confidence requirement before storing it.

## Changes Made

### 1. Confidence Validation

- **Before**: Questions were generated and stored without testing
- **After**: Each question is tested using `querySOPs()` to get actual confidence score
- **Threshold**: Only questions with ≥80% confidence are stored

### 2. Improved Question Generation Strategy

**Three-tier approach:**

1. **Structure-Based Extraction** (Primary)
   - Extracts questions directly from document structure
   - Uses exact task titles and procedures from documents
   - More likely to yield high confidence as they match document content exactly

2. **AI Generation** (Secondary)
   - Improved prompt to focus on specific, concrete questions
   - Uses exact terminology from documents
   - Targets step-by-step procedures

3. **Additional Generation** (Fallback)
   - Generates more questions if validation fails
   - Uses document structure to create specific questions

### 3. Validation Process

```typescript
for (const question of allQuestions) {
  const result = await querySOPs(question);
  if (result.confidence >= 0.8) {
    validatedQuestions.push(question);
  }
}
```

### 4. Improved Prompt

**Key improvements:**
- Emphasizes using EXACT terminology from documents
- Focuses on SPECIFIC, CONCRETE procedures
- Avoids vague or general questions
- Provides good/bad examples

## Example

**Before (38% confidence):**
- "How do I ensure a client's KYC is valid and updated?"
  - Too vague, covers multiple procedures

**After (targeting >80% confidence):**
- "What is the process for validating client KYC documents?"
- "Who is responsible for ensuring KYC is updated?"
- "What tool is used for KYC validation?"

## Performance Impact

- **Additional API calls**: Each question is tested (adds ~2-5 seconds per question)
- **Indexing time**: Slightly longer, but ensures quality
- **Result**: Only high-confidence questions are stored

## Configuration

The confidence threshold is set to **0.8 (80%)** and can be adjusted in:
```typescript
const MIN_CONFIDENCE = 0.8; // In question-generator.ts
```

## Next Steps

1. Re-index documents to regenerate questions with validation
2. All stored questions will have been tested and validated
3. Users will see only high-confidence questions in the dropdown

