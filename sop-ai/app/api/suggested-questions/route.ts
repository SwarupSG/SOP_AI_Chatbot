import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db, indexedSOPs } from '@/lib/db';
import { getLLMResponse } from '@/lib/chroma';

const DEFAULT_QUESTIONS = [
  "How do I process a client refund?",
  "What is the procedure for handling SIP orders?",
  "How do I update bank details?",
  "What are the steps for processing a transaction?",
];

// Question templates for SOP-based generation
const QUESTION_TEMPLATES = [
  (category: string) => `How do I process ${category}?`,
  (category: string) => `What is the procedure for ${category}?`,
  (category: string) => `How do I handle ${category} transactions?`,
  (category: string) => `What are the steps for ${category}?`,
  (category: string) => `How do I manage ${category}?`,
  (category: string) => `What is the process for ${category}?`,
];

async function generateSOPBasedQuestions(): Promise<string[]> {
  try {
    // Get all indexed SOPs
    const sops = await db.select().from(indexedSOPs);

    if (sops.length === 0) {
      return DEFAULT_QUESTIONS;
    }

    // Extract unique categories
    const categoryMap = new Map<string, number>();
    sops.forEach((sop) => {
      const category = sop.category || 'General';
      categoryMap.set(category, (categoryMap.get(category) || 0) + sop.entryCount);
    });

    // Sort categories by entry count (most entries first)
    const sortedCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category)
      .slice(0, 6); // Get top 6 categories

    if (sortedCategories.length === 0) {
      return DEFAULT_QUESTIONS;
    }

    // Generate questions from categories
    const questions: string[] = [];
    const usedTemplates = new Set<number>();

    for (const category of sortedCategories) {
      if (questions.length >= 6) break;

      // Try to use different templates
      let templateIndex = Math.floor(Math.random() * QUESTION_TEMPLATES.length);
      let attempts = 0;
      while (usedTemplates.has(templateIndex) && attempts < QUESTION_TEMPLATES.length) {
        templateIndex = (templateIndex + 1) % QUESTION_TEMPLATES.length;
        attempts++;
      }
      usedTemplates.add(templateIndex);

      const question = QUESTION_TEMPLATES[templateIndex](category);
      questions.push(question);
    }

    // Fill remaining slots with random templates if needed
    while (questions.length < 4 && sortedCategories.length > 0) {
      const category = sortedCategories[Math.floor(Math.random() * sortedCategories.length)];
      const templateIndex = Math.floor(Math.random() * QUESTION_TEMPLATES.length);
      const question = QUESTION_TEMPLATES[templateIndex](category);
      if (!questions.includes(question)) {
        questions.push(question);
      }
    }

    return questions.length > 0 ? questions : DEFAULT_QUESTIONS;
  } catch (error) {
    console.error('Error generating SOP-based questions:', error);
    return DEFAULT_QUESTIONS;
  }
}

async function generateAISuggestions(): Promise<string[]> {
  try {
    // Get indexed SOPs for context
    const sops = await db.select().from(indexedSOPs);

    if (sops.length === 0) {
      return DEFAULT_QUESTIONS;
    }

    // Extract categories and create context
    const categories = [...new Set(sops.map((s) => s.category).filter(Boolean))];
    const categoryList = categories.join(', ');

    // Get sample file names
    const fileNames = sops
      .map((s) => s.sourceFile.split('/').pop())
      .filter(Boolean)
      .slice(0, 5)
      .join(', ');

    const prompt = `You are a helpful assistant for a Standard Operating Procedures (SOP) system.

The following SOP categories are available: ${categoryList}

Sample SOP files: ${fileNames}

Based on these available SOPs, generate 4-6 natural, specific, and actionable questions that users might ask about these procedures. Each question should:
- Be clear and specific
- Relate to the available SOP topics
- Use natural language
- Be actionable (something a user would actually ask)
- Be different from each other

Return ONLY a JSON array of question strings, nothing else. Example format:
["How do I process a client refund?", "What is the procedure for handling SIP orders?"]`;

    const response = await getLLMResponse(prompt);

    // Try to parse JSON from response
    let questions: string[] = [];

    // Look for JSON array in response
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        questions = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // If JSON parsing fails, try to extract questions manually
        questions = extractQuestionsFromText(response);
      }
    } else {
      // Extract questions from plain text
      questions = extractQuestionsFromText(response);
    }

    // Validate and clean questions
    questions = questions
      .filter((q) => q && typeof q === 'string' && q.trim().length > 10)
      .map((q) => q.trim().replace(/^["']|["']$/g, ''))
      .slice(0, 6);

    // Fallback if we don't have enough questions
    if (questions.length < 4) {
      const sopBased = await generateSOPBasedQuestions();
      return [...questions, ...sopBased].slice(0, 6);
    }

    return questions;
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
    // Fallback to SOP-based questions
    return generateSOPBasedQuestions();
  }
}

function extractQuestionsFromText(text: string): string[] {
  // Try to extract questions (lines that end with ?)
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const questions = lines
    .filter((line) => line.endsWith('?') || line.match(/^\d+[\.\)]\s*.*\?/))
    .map((line) => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter((q) => q.length > 10);

  return questions.length > 0 ? questions : [];
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'sop'; // 'sop', 'ai', or 'both'

    if (type === 'ai') {
      const aiQuestions = await generateAISuggestions();
      return NextResponse.json({
        questions: aiQuestions,
        source: 'ai',
      });
    } else if (type === 'both') {
      const [sopQuestions, aiQuestions] = await Promise.all([
        generateSOPBasedQuestions(),
        generateAISuggestions(),
      ]);
      return NextResponse.json({
        sopBased: sopQuestions,
        aiGenerated: aiQuestions,
        source: 'both',
      });
    } else {
      // Default: SOP-based
      const sopQuestions = await generateSOPBasedQuestions();
      return NextResponse.json({
        questions: sopQuestions,
        source: 'sop',
      });
    }
  } catch (error) {
    console.error('Error in suggested-questions endpoint:', error);
    return NextResponse.json(
      {
        questions: DEFAULT_QUESTIONS,
        source: 'default',
        error: 'Failed to generate suggestions',
      },
      { status: 200 } // Return 200 with defaults instead of error
    );
  }
}




