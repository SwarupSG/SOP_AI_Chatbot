import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { indexAcronyms, getAcronymStats } from '@/lib/chroma';

// GET - Get acronym statistics
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

    const stats = await getAcronymStats();

    return NextResponse.json({
      success: true,
      ...stats,
    });
  } catch (error: any) {
    console.error('Get acronym stats error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get acronym stats' },
      { status: 500 }
    );
  }
}

// POST - Re-index acronyms from CSV
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
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log('[ADMIN] Starting acronym re-indexing...');
    
    const count = await indexAcronyms();

    return NextResponse.json({
      success: true,
      indexed: count,
      message: `Successfully indexed ${count} acronyms`,
    });
  } catch (error: any) {
    console.error('Index acronyms error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to index acronyms' },
      { status: 500 }
    );
  }
}
