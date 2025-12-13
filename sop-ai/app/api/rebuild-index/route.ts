import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { rebuildIndex } from '@/lib/chroma';

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

    // Run rebuild in background (don't await to avoid timeout)
    rebuildIndex().catch((error) => {
      console.error('Background index rebuild error:', error);
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Index rebuild initiated. This may take a few minutes. Check server logs for progress.' 
    });
  } catch (error) {
    console.error('Rebuild index error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

