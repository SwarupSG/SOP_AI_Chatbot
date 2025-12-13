import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { querySOPs } from '@/lib/chroma';
import { db, unansweredQuestions, recentQuestions } from '@/lib/db';

export async function POST(request: NextRequest) {
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

    const { question } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Query SOPs using RAG (Ollama + ChromaDB)
    const result = await querySOPs(question);

    // Save to recent questions
    await db.insert(recentQuestions).values({
      question,
      answer: result.answer,
      userId: user.id,
      confidence: Math.round(result.confidence * 100),
    });

    // If confidence is low, log to unanswered questions
    if (result.confidence < 0.3) {
      await db.insert(unansweredQuestions).values({
        question,
        userId: user.id,
        status: 'pending',
      });
    }

    return NextResponse.json({
      answer: result.answer,
      confidence: result.confidence,
      sources: result.sources,
    });
  } catch (error) {
    console.error('Ask error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

