# Implementation Prompt: Dynamic Suggested Questions

## Task Overview
Replace the hardcoded suggested questions in the ChatBox component with two dynamic approaches:
1. **Generate from Indexed SOPs** - Extract common topics/categories from indexed SOP documents
2. **AI-Generated Contextual Suggestions** - Use the LLM to generate relevant question suggestions based on available SOPs

---

## Feature 1: Generate Suggested Questions from Indexed SOPs

### Requirements

#### User Story
As a user, I want to see suggested questions based on the actual SOPs that are indexed in the system, so I can discover what topics are available and ask relevant questions.

#### Technical Requirements

1. **Backend API Endpoint:**
   - Create: `/api/suggested-questions` (GET)
   - Extract categories/topics from indexed SOPs
   - Generate question templates based on SOP structure
   - Return array of suggested questions (4-6 questions)

2. **Data Source:**
   - Query `indexedSOPs` table from database
   - Extract categories from SOP metadata
   - Analyze SOP titles/sections to identify common topics
   - Use existing SOP structure (Tasks, Who, Tools, etc. from Excel format)

3. **Question Generation Logic:**
   - Extract unique categories from indexed SOPs
   - For each category, generate questions like:
     - "How do I [action] for [category]?"
     - "What is the procedure for [category]?"
     - "How do I handle [category] [action]?"
   - Prioritize categories with most entries
   - Limit to 4-6 questions

4. **Frontend Integration:**
   - Replace hardcoded `SUGGESTED_QUESTIONS` constant
   - Fetch from API on component mount
   - Show loading state while fetching
   - Fallback to default questions if API fails

#### Technical Implementation Details

**Backend (`/api/suggested-questions/route.ts`):**
```typescript
// Pseudo-code structure
1. Query indexedSOPs table for all SOPs
2. Extract categories from SOP metadata
3. Count frequency of each category
4. Get top 4-6 categories
5. For each category, generate question templates:
   - "How do I process [category]?"
   - "What is the procedure for [category]?"
   - "How do I handle [category] transactions?"
6. Return array of suggested questions
```

**Data Extraction:**
- Query `indexedSOPs` table (already exists in `lib/db.ts`)
- Extract `category` field from each SOP
- May also need to query ChromaDB metadata for more detailed topic extraction
- Consider SOP titles/sections for better question generation

**Question Templates:**
- Use common question patterns:
  - "How do I [verb] [category]?"
  - "What is the procedure for [category]?"
  - "How do I handle [category] [specific action]?"
  - "What are the steps for [category]?"

**Frontend Changes:**
- Remove hardcoded `SUGGESTED_QUESTIONS` constant
- Add state: `const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])`
- Fetch on mount: `useEffect(() => { loadSuggestedQuestions() }, [])`
- Show loading skeleton while fetching
- Fallback to default questions if fetch fails

#### Acceptance Criteria
- [ ] API endpoint returns questions based on indexed SOPs
- [ ] Questions are generated from actual SOP categories
- [ ] Returns 4-6 relevant questions
- [ ] Frontend displays fetched questions
- [ ] Loading state shown during fetch
- [ ] Fallback to default questions if API fails
- [ ] Questions update when new SOPs are indexed

---

## Feature 2: AI-Generated Contextual Suggestions

### Requirements

#### User Story
As a user, I want to see AI-generated question suggestions that are contextually relevant to the available SOPs, so I can discover what I can ask about.

#### Technical Requirements

1. **Backend API Endpoint:**
   - Extend: `/api/suggested-questions` (GET)
   - Add query parameter: `?type=ai` or separate endpoint
   - Use Ollama LLM (qwen2.5:3b) to generate questions
   - Provide context about available SOPs to the LLM
   - Return AI-generated questions

2. **AI Prompt Engineering:**
   - Provide LLM with:
     - List of indexed SOP categories
     - Sample SOP titles/sections
     - Instruction to generate helpful questions
   - Prompt example:
     ```
     "Based on the following Standard Operating Procedures categories: [list],
     generate 4-6 helpful questions that users might ask about these procedures.
     Make questions natural, specific, and actionable."
     ```

3. **Context Gathering:**
   - Query indexed SOPs for categories
   - Extract sample titles/sections
   - Get summary of available SOP topics
   - Pass this context to LLM

4. **Frontend Integration:**
   - Add toggle or separate section for "AI Suggestions"
   - Fetch AI suggestions on demand or alongside SOP-based suggestions
   - Show loading indicator during AI generation
   - Cache AI suggestions to avoid repeated API calls

#### Technical Implementation Details

**Backend (`/api/suggested-questions/route.ts`):**
```typescript
// Pseudo-code structure
1. Query indexedSOPs for categories and titles
2. Build context string with SOP information
3. Create prompt for LLM:
   - "Generate 4-6 questions users might ask about these SOPs: [context]"
4. Call Ollama API (qwen2.5:3b) with prompt
5. Parse LLM response to extract questions
6. Return array of questions
```

**LLM Integration:**
- Use existing Ollama setup (already configured)
- Call Ollama API similar to how `querySOPs` works
- Use `qwen2.5:3b` model (already available)
- Set appropriate temperature for consistent results

**Prompt Template:**
```
You are a helpful assistant for a Standard Operating Procedures (SOP) system.

The following SOP categories and topics are available:
{categories_list}

Based on these available SOPs, generate 4-6 natural, specific, and actionable questions that users might ask. 
Each question should:
- Be clear and specific
- Relate to the available SOP topics
- Use natural language
- Be actionable (something a user would actually ask)

Format your response as a JSON array of question strings.
```

**Response Parsing:**
- LLM may return JSON or plain text
- Parse response to extract questions
- Validate question format
- Fallback if parsing fails

**Frontend Changes:**
- Add state for AI suggestions: `const [aiSuggestions, setAiSuggestions] = useState<string[]>([])`
- Add loading state: `const [loadingAi, setLoadingAi] = useState(false)`
- Add button/toggle: "Get AI Suggestions" or show both types
- Fetch AI suggestions on button click or automatically
- Display AI suggestions alongside or instead of SOP-based suggestions

#### Caching Strategy
- Cache AI suggestions in component state
- Cache for session duration (don't regenerate on every render)
- Optionally cache in localStorage for persistence
- Regenerate when new SOPs are indexed

#### Acceptance Criteria
- [ ] API endpoint generates questions using AI
- [ ] Questions are contextually relevant to indexed SOPs
- [ ] Returns 4-6 natural, actionable questions
- [ ] Frontend displays AI-generated questions
- [ ] Loading state shown during AI generation
- [ ] Error handling if AI generation fails
- [ ] Questions are cached to avoid repeated API calls
- [ ] Questions update when new SOPs are indexed

---

## Combined Implementation Approach

### Option A: Hybrid (Recommended)
- Show SOP-based suggestions by default (fast, no AI cost)
- Add "Get AI Suggestions" button for AI-generated questions
- User can toggle between both types

### Option B: Combined
- Fetch both types simultaneously
- Display SOP-based questions first
- Show AI suggestions when ready
- Merge or show separately

### Option C: Smart Default
- Use SOP-based suggestions as primary
- Use AI suggestions as fallback if SOP-based are insufficient
- Or use AI to enhance SOP-based questions

---

## Technical Implementation Details

### File Structure

```
sop-ai/
├── app/
│   └── api/
│       └── suggested-questions/
│           └── route.ts (NEW)
├── components/
│   └── ChatBox.tsx (MODIFY)
└── lib/
    └── chroma.ts (may need helper functions)
```

### Dependencies

**Already Available:**
- ✅ Ollama client (for AI generation)
- ✅ Database access (drizzle-orm)
- ✅ indexedSOPs table

**May Need:**
- None - all dependencies exist

### API Endpoint Design

**Endpoint:** `/api/suggested-questions`

**Query Parameters:**
- `type`: `'sop' | 'ai' | 'both'` (default: 'both')
- `count`: number (default: 4-6)

**Response Format:**
```json
{
  "sopBased": [
    "How do I process a client refund?",
    "What is the procedure for handling SIP orders?"
  ],
  "aiGenerated": [
    "How do I update bank details for a client?",
    "What are the steps for processing a transaction?"
  ],
  "source": "sop" | "ai" | "both"
}
```

### Error Handling

- If SOP-based generation fails → fallback to hardcoded defaults
- If AI generation fails → show only SOP-based suggestions
- If both fail → show hardcoded defaults
- Show user-friendly error messages

### Performance Considerations

1. **SOP-Based Suggestions:**
   - Fast (database query only)
   - Cache in component state
   - Refresh when SOPs are indexed

2. **AI Suggestions:**
   - Slower (LLM API call)
   - Cache aggressively (session/localStorage)
   - Show loading indicator
   - Consider debouncing if user can regenerate

---

## Implementation Steps

### Step 1: Create API Endpoint
1. Create `/api/suggested-questions/route.ts`
2. Implement SOP-based question generation
3. Query indexedSOPs table
4. Extract categories and generate questions
5. Test with existing SOPs

### Step 2: Add AI Generation
1. Add Ollama integration to endpoint
2. Create prompt template
3. Call Ollama API
4. Parse and validate response
5. Test AI generation

### Step 3: Update Frontend
1. Remove hardcoded `SUGGESTED_QUESTIONS`
2. Add state for dynamic suggestions
3. Fetch from API on mount
4. Add loading states
5. Add error handling
6. Test with both types

### Step 4: Add UI Enhancements
1. Add "Refresh Suggestions" button (optional)
2. Add "Get AI Suggestions" toggle (optional)
3. Show source indicator (optional)
4. Improve loading UX

### Step 5: Testing
1. Test with no SOPs indexed
2. Test with single SOP category
3. Test with multiple categories
4. Test AI generation
5. Test error scenarios
6. Test caching behavior

---

## Code Examples

### Backend: SOP-Based Question Generation

```typescript
// app/api/suggested-questions/route.ts
import { db, indexedSOPs } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  // Get indexed SOPs
  const sops = await db.select().from(indexedSOPs);
  
  // Extract unique categories
  const categories = [...new Set(sops.map(s => s.category).filter(Boolean))];
  
  // Generate questions from categories
  const questions = categories.slice(0, 6).map(category => {
    const templates = [
      `How do I process ${category}?`,
      `What is the procedure for ${category}?`,
      `How do I handle ${category} transactions?`,
      `What are the steps for ${category}?`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  });
  
  return NextResponse.json({ questions });
}
```

### Backend: AI-Generated Questions

```typescript
// Add to same route.ts
async function generateAISuggestions(categories: string[]): Promise<string[]> {
  const context = categories.join(', ');
  const prompt = `Based on these SOP categories: ${context}, generate 4-6 natural questions users might ask. Return as JSON array.`;
  
  // Call Ollama (similar to querySOPs in chroma.ts)
  const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:3b',
      prompt: prompt,
      stream: false,
    }),
  });
  
  const data = await response.json();
  // Parse response and extract questions
  // ...
}
```

### Frontend: Dynamic Loading

```typescript
// components/ChatBox.tsx
const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
const [loadingSuggestions, setLoadingSuggestions] = useState(true);

useEffect(() => {
  loadSuggestedQuestions();
}, []);

const loadSuggestedQuestions = async () => {
  try {
    setLoadingSuggestions(true);
    const res = await fetch('/api/suggested-questions?type=sop');
    if (res.ok) {
      const data = await res.json();
      setSuggestedQuestions(data.questions || []);
    } else {
      // Fallback to defaults
      setSuggestedQuestions(DEFAULT_QUESTIONS);
    }
  } catch (error) {
    setSuggestedQuestions(DEFAULT_QUESTIONS);
  } finally {
    setLoadingSuggestions(false);
  }
};
```

---

## Acceptance Criteria Summary

### Feature 1: SOP-Based Suggestions
- [ ] Questions generated from indexed SOP categories
- [ ] Returns 4-6 relevant questions
- [ ] Fast response (database query only)
- [ ] Updates when SOPs are indexed
- [ ] Fallback to defaults if no SOPs

### Feature 2: AI-Generated Suggestions
- [ ] Questions generated using LLM
- [ ] Context-aware (based on available SOPs)
- [ ] Natural, actionable questions
- [ ] Cached to avoid repeated calls
- [ ] Error handling for AI failures

### Combined
- [ ] Both types available
- [ ] User can access both
- [ ] Smooth loading experience
- [ ] Proper error handling
- [ ] No breaking changes to existing UI

---

## Testing Checklist

1. **SOP-Based Suggestions:**
   - [ ] Test with no SOPs indexed
   - [ ] Test with single category
   - [ ] Test with multiple categories
   - [ ] Test question generation logic
   - [ ] Test fallback behavior

2. **AI Suggestions:**
   - [ ] Test AI generation
   - [ ] Test prompt formatting
   - [ ] Test response parsing
   - [ ] Test error handling
   - [ ] Test caching

3. **Frontend:**
   - [ ] Test loading states
   - [ ] Test error states
   - [ ] Test question display
   - [ ] Test click handlers
   - [ ] Test fallback behavior

4. **Integration:**
   - [ ] Test both features together
   - [ ] Test when SOPs are updated
   - [ ] Test performance
   - [ ] Test edge cases

---

## Notes

- **Ollama Integration**: Use existing Ollama setup from `lib/chroma.ts` as reference
- **Database**: Use existing `indexedSOPs` table structure
- **Caching**: Consider caching AI suggestions for better UX
- **Performance**: SOP-based suggestions should be fast; AI suggestions may take 2-5 seconds
- **Fallbacks**: Always have fallback to default questions for reliability

---

## Success Criteria

✅ Questions are dynamically generated from indexed SOPs  
✅ AI generates contextually relevant suggestions  
✅ Fast loading for SOP-based suggestions  
✅ Smooth UX with loading indicators  
✅ Proper error handling and fallbacks  
✅ No breaking changes to existing functionality  

Good luck with the implementation! 🚀

