# Predefined Questions Feature

## Overview

This feature automatically generates predefined questions for each indexed SOP document. These questions are designed to yield high-confidence answers (>80%) and are displayed in a searchable dropdown menu in the chat interface.

## How It Works

### 1. Question Generation (During Indexing)

When documents are indexed via `rebuildIndex()`:

1. **Document Analysis**: For each source file, the system:
   - Extracts document content and structure
   - Identifies key topics, procedures, and tasks
   - Analyzes document categories

2. **AI-Powered Generation**: Uses LLM (qwen2.5:3b) to generate 5-8 questions per document:
   - Questions are specific and actionable
   - Designed to target procedures in the document
   - Formatted as natural language questions users would ask
   - Optimized for high-confidence answers

3. **Fallback Strategy**: If AI generation fails:
   - Extracts task titles/headings from document
   - Generates questions using templates:
     - "How do I [task]?"
     - "What is the procedure for [task]?"
     - "What are the steps to [task]?"

4. **Storage**: Questions are stored in `predefined_questions` table:
   - Linked to source file
   - Includes category information
   - Timestamped for tracking

### 2. Searchable Dropdown UI

**Location**: Above the chat input field

**Features**:
- **Search**: Type to filter questions in real-time
- **Grouped by Document**: Questions organized by source file
- **Question Count**: Shows number of questions per document
- **One-Click Selection**: Clicking a question auto-fills the input
- **Auto-refresh**: Updates when new documents are indexed

### 3. API Endpoint

**Endpoint**: `/api/predefined-questions` (GET)

**Query Parameters**:
- `search`: Filter questions by text (optional)
- `sourceFile`: Filter by specific file (optional)

**Response**:
```json
{
  "questions": [
    {
      "sourceFile": "/path/to/file.docx",
      "fileName": "file.docx",
      "questions": [
        {
          "id": 1,
          "question": "How do I process a refund?",
          "category": "Transactions",
          "sourceFile": "/path/to/file.docx"
        }
      ],
      "count": 5
    }
  ],
  "total": 25
}
```

## Database Schema

**Table**: `predefined_questions`

```sql
CREATE TABLE predefined_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file TEXT NOT NULL,
  question TEXT NOT NULL,
  category TEXT,
  created_at INTEGER NOT NULL
);
```

## User Flow

1. User opens chat interface
2. Sees "Browse predefined questions" button above input
3. Clicks button → Dropdown opens
4. Types to search → Questions filter in real-time
5. Sees questions grouped by document
6. Clicks a question → Auto-fills input field
7. User can edit or submit directly
8. System answers with high confidence (>80% target)

## Benefits

- **Discoverability**: Users can see what questions are available
- **High Confidence**: Questions designed for >80% confidence answers
- **Time Saving**: No need to type common questions
- **Document-Specific**: Questions tailored to each document's content
- **Searchable**: Easy to find relevant questions

## Configuration

Questions are automatically generated during indexing. To regenerate:

1. Re-index documents: Admin Dashboard → "Rebuild SOP Index"
2. Questions will be regenerated for all indexed documents

## Technical Details

**Question Generation**:
- Uses LLM to analyze document content
- Generates 5-8 questions per document
- Validates question quality and format
- Falls back to template-based generation if needed

**Performance**:
- Questions generated during indexing (one-time cost)
- Dropdown loads instantly (database query)
- Search is debounced (300ms) for smooth UX

## Files Modified/Created

- `lib/db.ts` - Added `predefinedQuestions` table
- `lib/init-db.ts` - Added table creation
- `lib/question-generator.ts` - NEW: Question generation logic
- `lib/chroma.ts` - Integrated question generation into indexing
- `app/api/predefined-questions/route.ts` - NEW: API endpoint
- `components/PredefinedQuestionsDropdown.tsx` - NEW: UI component
- `components/ChatBox.tsx` - Integrated dropdown

## Next Steps

After indexing documents, predefined questions will be available in the dropdown. Users can browse and select questions for high-confidence answers!

