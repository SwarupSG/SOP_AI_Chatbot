# Interactive Word Cloud Implementation Plan

## Overview
Create an interactive word cloud visualization on the chat page that displays main keywords/topics from indexed SOP files. Users can click keywords to populate the input field or trigger searches.

---

## Approach & Strategy

### 1. **Data Source Options**

#### Option A: Categories from Database (Recommended - Fastest)
- Extract categories from `indexedSOPs` table
- Use entry counts as weights
- Pros: Fast, already available, structured data
- Cons: Limited to predefined categories

#### Option B: Keywords from ChromaDB Metadata
- Query ChromaDB for all metadata
- Extract titles, categories, sections
- Tokenize and count keywords
- Pros: More comprehensive, includes all indexed content
- Cons: Requires ChromaDB query, more processing

#### Option C: Hybrid Approach (Best)
- Primary: Categories from database (fast, structured)
- Secondary: Extract keywords from SOP titles/sections
- Combine both for richer visualization
- Pros: Best of both worlds
- Cons: Slightly more complex

### 2. **Word Cloud Library Options**

#### Option A: `react-wordcloud2` (Recommended)
- Simple React wrapper for wordcloud.js
- Good performance
- Easy to customize
- Install: `npm install react-wordcloud2`

#### Option B: `react-wordcloud`
- Another popular option
- More features
- Install: `npm install react-wordcloud`

#### Option C: `d3-cloud` (Custom Implementation)
- Most flexible
- Requires more code
- Best for custom requirements

**Recommendation: `react-wordcloud2`** - Best balance of simplicity and features

### 3. **Placement & UX**

#### Location Options:
1. **Welcome Screen** (When no messages) - Recommended
   - Below suggested questions
   - Above recent questions
   - Shows when user first arrives

2. **Sidebar Section**
   - Always visible
   - Collapsible section
   - Doesn't interfere with chat

3. **Below Input Field**
   - Always visible
   - Quick access
   - May clutter interface

**Recommendation: Welcome Screen** - Most discoverable, doesn't clutter active chat

### 4. **Interaction Design**

- **Hover**: Show tooltip with keyword info (count, category)
- **Click**: Populate input field with keyword or question template
- **Visual Feedback**: Highlight on hover, scale on click
- **Color Coding**: Different colors for different categories
- **Size**: Based on frequency/importance

---

## Implementation Steps

### Step 1: Create API Endpoint

**File:** `sop-ai/app/api/keywords/route.ts`

```typescript
// GET /api/keywords
// Returns keywords with weights for word cloud

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db, indexedSOPs } from '@/lib/db';
import { getChromaClient } from '@/lib/chroma';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get categories from indexed SOPs
    const sops = await db.select().from(indexedSOPs);
    
    // Count categories
    const categoryMap = new Map<string, number>();
    sops.forEach((sop) => {
      const category = sop.category || 'General';
      categoryMap.set(
        category, 
        (categoryMap.get(category) || 0) + sop.entryCount
      );
    });

    // Convert to word cloud format
    const keywords = Array.from(categoryMap.entries())
      .map(([text, value]) => ({
        text,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 30); // Top 30 keywords

    // Optionally: Extract keywords from ChromaDB metadata
    // This would give more granular keywords
    const chromaKeywords = await extractKeywordsFromChromaDB();
    
    // Combine and deduplicate
    const allKeywords = combineKeywords(keywords, chromaKeywords);

    return NextResponse.json({ keywords: allKeywords });
  } catch (error) {
    console.error('Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function extractKeywordsFromChromaDB() {
  // Query ChromaDB for metadata
  // Extract titles, categories, sections
  // Tokenize and count
  // Return top keywords
}
```

### Step 2: Install Word Cloud Library

```bash
npm install react-wordcloud2
# or
npm install react-wordcloud
```

### Step 3: Create Word Cloud Component

**File:** `sop-ai/components/SOPWordCloud.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import WordCloud from 'react-wordcloud2';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface Keyword {
  text: string;
  value: number;
}

interface SOPWordCloudProps {
  onKeywordClick?: (keyword: string) => void;
}

export default function SOPWordCloud({ onKeywordClick }: SOPWordCloudProps) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    try {
      const res = await fetch('/api/keywords');
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
      }
    } catch (error) {
      console.error('Failed to load keywords:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWordClick = (word: any) => {
    if (onKeywordClick) {
      onKeywordClick(word.text);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  if (keywords.length === 0) {
    return null;
  }

  const options = {
    rotations: 2,
    rotationSteps: 2,
    fontSizes: [20, 60] as [number, number],
    colors: [
      '#3b82f6', // blue
      '#10b981', // green
      '#f59e0b', // amber
      '#ef4444', // red
      '#8b5cf6', // purple
      '#ec4899', // pink
    ],
    enableTooltip: true,
    deterministic: false,
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Explore SOP Topics</h3>
      <div className="h-64 flex items-center justify-center">
        <WordCloud
          data={keywords}
          options={options}
          callbacks={{
            onWordClick: handleWordClick,
            getWordTooltip: (word: any) => 
              `${word.text}: ${word.value} entries`,
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Click on any keyword to search
      </p>
    </Card>
  );
}
```

### Step 4: Integrate into ChatBox

**File:** `sop-ai/components/ChatBox.tsx`

Add to welcome screen section:

```typescript
import SOPWordCloud from './SOPWordCloud';

// In the welcome screen section, after suggested questions:
<SOPWordCloud onKeywordClick={handleKeywordClick} />

const handleKeywordClick = (keyword: string) => {
  // Option 1: Populate input with keyword
  setQuestion(keyword);
  inputRef.current?.focus();
  
  // Option 2: Auto-submit a question
  // setQuestion(`Tell me about ${keyword}`);
  // handleSubmit(new Event('submit'));
};
```

### Step 5: Enhanced Keyword Extraction (Optional)

For richer keywords, extract from ChromaDB:

```typescript
async function extractKeywordsFromChromaDB(): Promise<Keyword[]> {
  try {
    const client = getChromaClient();
    const collection = await client.getCollection({ name: 'sop-documents' });
    
    // Get all documents with metadata
    const results = await collection.get({
      include: ['metadatas'],
    });
    
    // Extract keywords from metadata
    const keywordMap = new Map<string, number>();
    
    results.metadatas?.forEach((metadata: any) => {
      // Extract from title
      if (metadata.title) {
        const words = tokenize(metadata.title);
        words.forEach(word => {
          keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
        });
      }
      
      // Extract from category
      if (metadata.category) {
        keywordMap.set(
          metadata.category, 
          (keywordMap.get(metadata.category) || 0) + 1
        );
      }
      
      // Extract from section
      if (metadata.section) {
        const words = tokenize(metadata.section);
        words.forEach(word => {
          keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
        });
      }
    });
    
    // Filter common words, return top keywords
    return Array.from(keywordMap.entries())
      .filter(([word]) => word.length > 3) // Filter short words
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 30);
  } catch (error) {
    console.error('Error extracting keywords from ChromaDB:', error);
    return [];
  }
}

function tokenize(text: string): string[] {
  // Simple tokenization - split by spaces, remove special chars
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);
}
```

---

## Alternative: Simpler Tag Cloud (No Library)

If you want to avoid external dependencies, create a simple tag cloud:

```typescript
'use client';

export default function SimpleTagCloud({ keywords, onKeywordClick }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center p-4">
      {keywords.map((keyword, idx) => (
        <button
          key={idx}
          onClick={() => onKeywordClick(keyword.text)}
          className={`
            px-3 py-1 rounded-full text-sm font-medium
            transition-all hover:scale-110
            ${getSizeClass(keyword.value)}
            ${getColorClass(idx)}
          `}
        >
          {keyword.text}
        </button>
      ))}
    </div>
  );
}

function getSizeClass(value: number) {
  if (value > 50) return 'text-lg';
  if (value > 20) return 'text-base';
  return 'text-sm';
}

function getColorClass(index: number) {
  const colors = [
    'bg-blue-100 text-blue-800 hover:bg-blue-200',
    'bg-green-100 text-green-800 hover:bg-green-200',
    'bg-amber-100 text-amber-800 hover:bg-amber-200',
    'bg-purple-100 text-purple-800 hover:bg-purple-200',
    'bg-pink-100 text-pink-800 hover:bg-pink-200',
  ];
  return colors[index % colors.length];
}
```

---

## Recommended Implementation Order

1. **Phase 1: Basic Word Cloud (Categories)**
   - Create API endpoint with categories from database
   - Install react-wordcloud2
   - Create basic component
   - Integrate into welcome screen
   - Add click handler

2. **Phase 2: Enhanced Keywords**
   - Add ChromaDB keyword extraction
   - Combine categories + keywords
   - Improve tokenization
   - Filter common words

3. **Phase 3: Polish**
   - Add tooltips
   - Improve styling
   - Add animations
   - Responsive design
   - Loading states

---

## UX Considerations

1. **Performance**
   - Cache keywords (localStorage or component state)
   - Only fetch when needed
   - Show loading state

2. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - High contrast colors

3. **Responsive Design**
   - Smaller word cloud on mobile
   - Horizontal scroll if needed
   - Touch-friendly click targets

4. **Visual Design**
   - Match existing design system
   - Use theme colors
   - Smooth animations
   - Clear hover states

---

## Dependencies

```json
{
  "dependencies": {
    "react-wordcloud2": "^1.0.8"
    // or
    "react-wordcloud": "^1.2.7"
  }
}
```

---

## File Structure

```
sop-ai/
├── app/
│   └── api/
│       └── keywords/
│           └── route.ts (NEW)
├── components/
│   ├── SOPWordCloud.tsx (NEW)
│   └── ChatBox.tsx (MODIFY)
└── package.json (MODIFY - add dependency)
```

---

## Success Criteria

- [ ] Word cloud displays keywords from indexed SOPs
- [ ] Keywords are sized by frequency/importance
- [ ] Clicking keyword populates input or triggers search
- [ ] Visual feedback on hover/click
- [ ] Responsive design
- [ ] Fast loading (< 1 second)
- [ ] Works on mobile devices
- [ ] Matches existing design system

---

## Alternative: Simple Tag Cloud (No External Library)

If you prefer not to add dependencies, I can create a simple tag cloud component using pure CSS and React. This would:
- Use flexbox for layout
- Size tags based on frequency
- Color code by category
- Still be interactive and clickable
- No external dependencies

Would you like me to implement the word cloud with a library, or create a simple tag cloud without dependencies?
