import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db, unansweredQuestions, users } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import * as XLSX from 'xlsx';

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'csv'; // 'csv' or 'xlsx'
    const status = searchParams.get('status') || 'all'; // 'pending', 'answered', 'all'

    // Fetch questions
    let query = db
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
      .leftJoin(users, eq(unansweredQuestions.userId, users.id));

    // Apply status filter
    if (status !== 'all') {
      query = query.where(eq(unansweredQuestions.status, status)) as any;
    }

    const questions = await query.orderBy(desc(unansweredQuestions.createdAt));

    // Format data for export
    const exportData = questions.map((q) => ({
      ID: q.id,
      Question: q.question,
      'User Name': q.userName || '',
      'User Email': q.userEmail || '',
      Status: q.status,
      Notes: q.notes || '',
      'Created At': q.createdAt ? new Date(q.createdAt).toISOString() : '',
      'Updated At': q.updatedAt ? new Date(q.updatedAt).toISOString() : '',
    }));

    if (format === 'csv') {
      // Generate CSV
      const csvRows = [
        ['ID', 'Question', 'User Name', 'User Email', 'Status', 'Notes', 'Created At', 'Updated At'],
        ...exportData.map((q) => [
          q.ID,
          `"${String(q.Question).replace(/"/g, '""')}"`, // Escape quotes
          `"${String(q['User Name']).replace(/"/g, '""')}"`,
          `"${String(q['User Email']).replace(/"/g, '""')}"`,
          q.Status,
          q.Notes ? `"${String(q.Notes).replace(/"/g, '""')}"` : '',
          q['Created At'],
          q['Updated At'],
        ]),
      ];

      const csv = csvRows.map((row) => row.join(',')).join('\n');

      const filename = `unanswered-questions-${new Date().toISOString().split('T')[0]}.csv`;

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else if (format === 'xlsx') {
      // Generate Excel
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Unanswered Questions');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      const filename = `unanswered-questions-${new Date().toISOString().split('T')[0]}.xlsx`;

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid format. Use "csv" or "xlsx"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}




