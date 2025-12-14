import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db, unansweredQuestions, users } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';

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
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const questions = await db
      .select({
        id: unansweredQuestions.id,
        question: unansweredQuestions.question,
        status: unansweredQuestions.status,
        notes: unansweredQuestions.notes,
        createdAt: unansweredQuestions.createdAt,
        updatedAt: unansweredQuestions.updatedAt,
        userId: unansweredQuestions.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(unansweredQuestions)
      .leftJoin(users, eq(unansweredQuestions.userId, users.id))
      .orderBy(desc(unansweredQuestions.createdAt));

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Unanswered questions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { id, status, notes } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    await db
      .update(unansweredQuestions)
      .set({
        status: status || 'answered',
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(unansweredQuestions.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update unanswered question error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Question ID is required' },
        { status: 400 }
      );
    }

    const questionId = parseInt(id, 10);
    if (isNaN(questionId)) {
      return NextResponse.json(
        { error: 'Invalid question ID' },
        { status: 400 }
      );
    }

    // Delete the question
    await db
      .delete(unansweredQuestions)
      .where(eq(unansweredQuestions.id, questionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete unanswered question error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

