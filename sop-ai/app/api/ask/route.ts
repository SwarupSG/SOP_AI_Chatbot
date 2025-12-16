import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { querySOPs } from '@/lib/chroma';
import { db, unansweredQuestions, recentQuestions } from '@/lib/db';
import { validateAcronymsInResponse, expandUnexpandedAcronyms } from '@/lib/validateResponse';
import { checkGrounding, isProperDecline } from '@/lib/groundingCheck';
import { buildRAGContext } from '@/lib/contextBuilder';

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

    const { question, sopId, isPreferred } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Query SOPs using RAG (Ollama + ChromaDB) with optional scope
    const result = await querySOPs(question, sopId);

    // If it's a preferred question (from suggestions/dashboard), trust the result more
    if (isPreferred) {
      // Boost confidence significantly, but cap at 0.99
      // We assume suggested questions are relevant to the content
      result.confidence = Math.max(result.confidence, 0.95);
      console.log('[ASK] Powered by Preferred Question - Confidence Boosted');
    }

    // Step 1: Validate acronym definitions
    const { correctedResponse, corrections } = validateAcronymsInResponse(result.answer);
    if (corrections.length > 0) {
      console.log('[ASK] Acronym corrections:', corrections);
    }

    // Step 2: Expand any unexpanded acronyms
    const expandedResponse = expandUnexpandedAcronyms(correctedResponse);

    // Step 3: Check grounding quality
    // Get context for grounding check
    const ragContext = await buildRAGContext(question);
    const contextForGrounding = ragContext.sopContext.join('\n\n');

    const groundingResult = checkGrounding(expandedResponse, contextForGrounding);
    if (!groundingResult.isGrounded && !isProperDecline(expandedResponse)) {
      console.log('[ASK] Grounding warnings:', groundingResult.warnings);
    }

    // Use expandedResponse as the final answer
    const finalAnswer = expandedResponse;

    // Save to recent questions
    await db.insert(recentQuestions).values({
      question,
      answer: finalAnswer,
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
      answer: finalAnswer,
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

