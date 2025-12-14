import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db, predefinedQuestions } from '@/lib/db';
import { sql } from 'drizzle-orm';

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
    const search = searchParams.get('search') || '';
    const sourceFile = searchParams.get('sourceFile');

    // Build query with filters
    let questions;
    
    if (search && sourceFile) {
      questions = await db
        .select()
        .from(predefinedQuestions)
        .where(
          sql`${predefinedQuestions.question} LIKE ${`%${search}%`} AND ${predefinedQuestions.sourceFile} LIKE ${`%${sourceFile}%`}`
        );
    } else if (search) {
      questions = await db
        .select()
        .from(predefinedQuestions)
        .where(sql`${predefinedQuestions.question} LIKE ${`%${search}%`}`);
    } else if (sourceFile) {
      questions = await db
        .select()
        .from(predefinedQuestions)
        .where(sql`${predefinedQuestions.sourceFile} LIKE ${`%${sourceFile}%`}`);
    } else {
      questions = await db.select().from(predefinedQuestions);
    }

    // Group by source file for better organization
    const grouped = questions.reduce((acc, q) => {
      const file = q.sourceFile;
      if (!acc[file]) {
        acc[file] = [];
      }
      acc[file].push({
        id: q.id,
        question: q.question,
        category: q.category,
        sourceFile: q.sourceFile,
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Convert to array format with file grouping
    const result = Object.entries(grouped).map(([file, questions]) => ({
      sourceFile: file,
      fileName: file.split('/').pop() || file,
      questions,
      count: questions.length,
    }));

    return NextResponse.json({
      questions: result,
      total: questions.length,
    });
  } catch (error) {
    console.error('Error fetching predefined questions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

