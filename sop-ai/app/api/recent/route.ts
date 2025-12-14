import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db, recentQuestions } from '@/lib/db';
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
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const questions = await db
      .select()
      .from(recentQuestions)
      .where(eq(recentQuestions.userId, user.id))
      .orderBy(desc(recentQuestions.createdAt))
      .limit(10);

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Recent questions error:', error);
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
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Delete all recent questions for this user
    await db
      .delete(recentQuestions)
      .where(eq(recentQuestions.userId, user.id));

    return NextResponse.json({ success: true, message: 'Chat history cleared' });
  } catch (error) {
    console.error('Clear recent questions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

