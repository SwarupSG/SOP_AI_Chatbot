# SOP Parsing and Retrieval System - Detailed Review

## Executive Summary

The system is failing to retrieve relevant information from SOP documents despite the information being present. The query "How to Check status in MFU?" returns a 14% confidence response stating insufficient information, even though the document "How to change bank details in CAN.docx" contains a clear section with this exact information.

## Problem Analysis

### Current Issue
- **Query**: "How to Check status in MFU?"
- **Expected Answer**: "Go to Tracker → Go to CAN Tracker → Search via date or CAN number and check registration status"
- **Actual Result**: "Based solely on the provided context, there is not enough information..." (14% confidence)
- **Root Cause**: Information exists but is not being retrieved or matched properly

## Detailed Findings

### 1. Word Document Parsing Issues

#### Current Implementation (`parse-sop.ts`, lines 129-203)

**Problems Identified:**

1. **Heading Detection Heuristic is Too Restrictive** (Line 159)
   ```typescript
   if (trimmed.length < 100 && !trimmed.endsWith('.') && !trimmed.endsWith('!') && !trimmed.endsWith('?')) {
   ```
   - **Issue**: Headings ending with "?" are NOT detected as headings
   - **Impact**: "How to Check status in MFU?" would NOT be identified as a section heading
   - **Result**: Content gets merged into previous section or lost

2. **No Numbered List Detection**
   - The parsing doesn't recognize numbered lists (1., 2., 3.) as section markers
   - "1. Go to Tracker" would be treated as regular content, not a heading

3. **Paragraph Splitting is Too Simple**
   - Uses `text.split(/\n\s*\n/)` which may not handle Word document formatting correctly
   - Doesn't account for Word's actual structure (headings, lists, tables)

4. **HTML Structure Not Utilized**
   - Line 142 extracts HTML but never uses it
   - HTML contains semantic structure (h1, h2, lists) that could improve parsing

5. **Content Chunking Strategy**
   - Creates one entry per "section" but sections may be too large or too small
   - No minimum/maximum chunk size enforcement
   - No overlap between chunks for better retrieval

#### Test Results
When parsing "How to change bank details in CAN.docx":
- Only 3 entries were created
- "How to Check status in MFU?" section is parsed as "Go to CAN Tracker" (Entry 3)
- Content preview shows: "Search via date or CAN number and check registration status"
- **The information IS parsed, but the title doesn't match the query**

### 2. Embedding and Retrieval Issues

#### Current Implementation (`chroma.ts`, lines 371-480)

**Problems Identified:**

1. **Query Embedding Mismatch**
   - Query: "How to Check status in MFU?"
   - Document title: "Go to CAN Tracker"
   - These are semantically similar but the embeddings might not capture this well
   - The query focuses on "check status" while the title focuses on "go to tracker"

2. **Limited Context Retrieval** (Line 397)
   ```typescript
   nResults: 5, // Get top 5 most relevant SOPs
   ```
   - Only retrieves top 5 results
   - If the relevant chunk isn't in top 5, it's lost
   - No re-ranking or expansion

3. **No Query Expansion**
   - Doesn't expand "MFU" to "Mutual Fund Unit" or "CAN" to "Consolidated Account Number"
   - Doesn't generate alternative phrasings of the query

4. **Distance-Based Confidence** (Lines 415-418)
   - Uses simple distance-to-confidence conversion
   - Doesn't account for partial matches or semantic similarity
   - May give low confidence even when information exists

5. **No Metadata Filtering**
   - Doesn't use metadata (title, category, section) to improve retrieval
   - Could filter by category or boost results with matching keywords

### 3. LLM Prompt and Context Issues

#### Current Implementation (`chroma.ts`, lines 430-437)

**Problems Identified:**

1. **Context May Be Too Large or Too Small**
   - If retrieved chunks are too large, relevant info gets diluted
   - If chunks are too small, context is insufficient

2. **No Explicit Instruction to Search All Sections**
   - Prompt doesn't instruct LLM to look for related sections
   - LLM might give up too easily if exact match isn't found

3. **Confidence Calculation Issues** (Lines 226-326)
   - Self-assessment method is unreliable
   - Heuristic-based fallback may incorrectly flag valid answers as uncertain
   - The phrase "doesn't contain enough information" triggers low confidence (line 321)

### 4. Chunking Strategy Issues

**Current Approach:**
- One entry per "section" based on heading detection
- No size limits
- No overlap

**Problems:**
1. **Variable Chunk Sizes**: Some chunks may be 50 words, others 500 words
2. **No Overlap**: If a section boundary splits related content, retrieval fails
3. **No Hierarchical Structure**: Doesn't preserve parent-child relationships (e.g., "How to Check status in MFU?" under "How to change bank details in CAN")

## Recommendations

### Priority 1: Fix Word Document Parsing

#### 1.1 Improve Heading Detection
```typescript
// Enhanced heading detection
function isHeading(text: string, index: number, allParagraphs: string[]): boolean {
  const trimmed = text.trim();
  
  // Check for numbered lists (1., 2., etc.)
  if (/^\d+\.\s+/.test(trimmed)) return true;
  
  // Check for bullet points
  if (/^[•\-\*]\s+/.test(trimmed)) return true;
  
  // Check for short lines (potential headings)
  if (trimmed.length < 150 && trimmed.length > 3) {
    // Check if next paragraph is longer (heading followed by content)
    if (index < allParagraphs.length - 1) {
      const nextPara = allParagraphs[index + 1].trim();
      if (nextPara.length > trimmed.length * 2) return true;
    }
    // Allow question marks in headings
    if (!trimmed.endsWith('.') && trimmed.length < 100) return true;
  }
  
  // Check for common heading patterns
  const headingPatterns = [
    /^How to/i,
    /^Steps? to/i,
    /^Procedure/i,
    /^Process/i,
    /^Guide/i,
  ];
  if (headingPatterns.some(p => p.test(trimmed))) return true;
  
  return false;
}
```

#### 1.2 Use HTML Structure from Mammoth
```typescript
// Extract structured content from HTML
const htmlResult = await mammoth.convertToHtml({ path: filePath });
const html = htmlResult.value;

// Parse HTML to extract headings (h1, h2, h3, etc.)
// This is more reliable than text heuristics
```

#### 1.3 Implement Better Section Splitting
- Use HTML headings (h1-h6) when available
- Fall back to text heuristics only if HTML parsing fails
- Preserve hierarchical structure (parent sections)

#### 1.4 Add Content Normalization
- Normalize "MFU" → "Mutual Fund Unit" in both queries and documents
- Normalize "CAN" → "Consolidated Account Number"
- Create a synonym dictionary for domain-specific terms

### Priority 2: Improve Chunking Strategy

#### 2.1 Implement Smart Chunking
```typescript
interface Chunk {
  content: string;
  title: string;
  parentTitle?: string;
  metadata: {
    startIndex: number;
    endIndex: number;
    wordCount: number;
  };
}

function createSmartChunks(entries: SOPEntry[]): Chunk[] {
  const chunks: Chunk[] = [];
  const MAX_CHUNK_SIZE = 500; // words
  const OVERLAP_SIZE = 50; // words
  
  entries.forEach(entry => {
    const words = entry.content.split(/\s+/);
    
    if (words.length <= MAX_CHUNK_SIZE) {
      // Small enough, use as-is
      chunks.push({
        content: entry.content,
        title: entry.title || 'Untitled',
        metadata: { /* ... */ }
      });
    } else {
      // Split into multiple chunks with overlap
      for (let i = 0; i < words.length; i += MAX_CHUNK_SIZE - OVERLAP_SIZE) {
        const chunkWords = words.slice(i, i + MAX_CHUNK_SIZE);
        chunks.push({
          content: chunkWords.join(' '),
          title: `${entry.title} (Part ${Math.floor(i / MAX_CHUNK_SIZE) + 1})`,
          parentTitle: entry.title,
          metadata: { /* ... */ }
        });
      }
    }
  });
  
  return chunks;
}
```

#### 2.2 Add Hierarchical Metadata
- Store parent-child relationships
- Include section numbers and hierarchy levels
- Enable filtering by document structure

### Priority 3: Enhance Retrieval System

#### 3.1 Implement Query Expansion
```typescript
const DOMAIN_SYNONYMS = {
  'MFU': ['Mutual Fund Unit', 'MF Unit', 'MFU'],
  'CAN': ['Consolidated Account Number', 'CAN Number', 'CAN'],
  'status': ['registration status', 'check status', 'verify status'],
  'tracker': ['CAN Tracker', 'tracker', 'status tracker'],
};

function expandQuery(query: string): string[] {
  const variations = [query];
  
  // Replace synonyms
  Object.entries(DOMAIN_SYNONYMS).forEach(([key, synonyms]) => {
    if (query.includes(key)) {
      synonyms.forEach(syn => {
        variations.push(query.replace(key, syn));
      });
    }
  });
  
  return variations;
}
```

#### 3.2 Implement Hybrid Search
- Combine semantic search (embeddings) with keyword search
- Boost results that match query keywords in title/metadata
- Use BM25 or TF-IDF for keyword matching

#### 3.3 Increase Retrieval Count
```typescript
nResults: 10, // Increase from 5 to 10
```

#### 3.4 Add Re-ranking
- Re-rank results using cross-encoder or keyword matching
- Boost results where query terms appear in title
- Use metadata to improve ranking

### Priority 4: Improve LLM Prompting

#### 4.1 Enhanced Prompt
```typescript
const prompt = `You are a helpful assistant that answers questions about Standard Operating Procedures (SOPs).

Context from SOP documents:
${context}

Question: ${question}

Instructions:
1. Carefully review ALL provided context sections
2. Look for information that directly answers the question, even if phrased differently
3. If you find related information (e.g., "check status" might be under "tracker" or "verification"), include it
4. If the question asks "How to X", look for step-by-step procedures
5. If information exists but uses different terminology, still provide the answer
6. Only say "not enough information" if you've thoroughly searched all context and found nothing relevant

Provide a clear, step-by-step answer based on the SOP context above.`;
```

#### 4.2 Add Context Summarization
- Before sending to LLM, summarize what each retrieved chunk contains
- Help LLM understand if relevant info exists even if not exact match

### Priority 5: Add Debugging and Monitoring

#### 5.1 Log Retrieval Results
```typescript
console.log('[RETRIEVAL DEBUG]');
console.log('Query:', question);
console.log('Top 5 retrieved titles:', metadatas.map(m => m.title));
console.log('Distances:', distances);
console.log('Content previews:', relevantDocs.map(d => d.substring(0, 100)));
```

#### 5.2 Add Query Analysis
- Log which chunks were retrieved for each query
- Track confidence scores and their components
- Identify patterns in failed queries

#### 5.3 Create Test Suite
- Create test queries for each SOP document
- Verify that expected answers are retrieved
- Run regression tests after changes

### Priority 6: Optimize for Scale (25-30 SOPs)

#### 6.1 Implement Document-Level Filtering
- Allow filtering by document/category before embedding search
- Reduce search space for domain-specific queries

#### 6.2 Add Caching
- Cache embeddings for common queries
- Cache parsed document structures

#### 6.3 Optimize Batch Processing
- Current batch size is 10 (line 550)
- Consider increasing for faster indexing
- Add progress tracking for large document sets

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)
1. ✅ Fix heading detection to include question marks
2. ✅ Improve section splitting using HTML structure
3. ✅ Add query expansion for domain terms
4. ✅ Increase retrieval count to 10
5. ✅ Enhance LLM prompt

### Phase 2: Chunking Improvements (Week 2)
1. ✅ Implement smart chunking with size limits
2. ✅ Add chunk overlap
3. ✅ Preserve hierarchical structure
4. ✅ Add metadata for better filtering

### Phase 3: Advanced Retrieval (Week 3)
1. ✅ Implement hybrid search (semantic + keyword)
2. ✅ Add re-ranking based on metadata
3. ✅ Implement query expansion
4. ✅ Add synonym dictionary

### Phase 4: Monitoring and Optimization (Week 4)
1. ✅ Add comprehensive logging
2. ✅ Create test suite
3. ✅ Performance optimization
4. ✅ Documentation updates

## Testing Strategy

### Unit Tests
- Test heading detection with various formats
- Test chunking with different document sizes
- Test query expansion

### Integration Tests
- Test end-to-end query flow
- Verify retrieval for known queries
- Test with all 3 current SOPs

### Regression Tests
- Maintain test cases for each SOP
- Run after each change
- Track confidence scores over time

## Expected Improvements

After implementing these changes:

1. **Retrieval Accuracy**: Should improve from ~60% to >90% for known queries
2. **Confidence Scores**: Should be more accurate, reducing false negatives
3. **Query Matching**: Should handle variations in phrasing better
4. **Scalability**: Should handle 25-30 SOPs efficiently
5. **User Experience**: Users should get accurate answers more consistently

## Risk Assessment

### Low Risk
- Increasing retrieval count (nResults: 5 → 10)
- Improving prompts
- Adding logging

### Medium Risk
- Changing chunking strategy (may require re-indexing)
- Modifying heading detection (may change existing entries)

### High Risk
- Major changes to embedding/retrieval logic
- Changing database schema

**Mitigation**: Implement changes incrementally, test thoroughly, maintain backward compatibility where possible.

## Conclusion

The current system has several issues that prevent it from finding relevant information even when it exists in the documents. The primary issues are:

1. **Word document parsing** doesn't properly identify headings, especially those ending with "?"
2. **Chunking strategy** doesn't optimize for retrieval
3. **Query matching** doesn't account for semantic variations
4. **Retrieval system** is too limited (only top 5, no re-ranking)

By implementing the recommended changes, especially the critical fixes in Phase 1, the system should be able to correctly answer "How to Check status in MFU?" and similar queries with high confidence.

