import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db, indexedSOPs } from '@/lib/db';

interface Keyword {
  text: string;
  value: number;
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

    // Get all indexed SOPs
    let sops: any[] = [];
    try {
      sops = await db.select().from(indexedSOPs);
    } catch (error: any) {
      // Table might not exist yet
      if (error.message?.includes('no such table')) {
        return NextResponse.json({ keywords: [] });
      }
      throw error;
    }

    if (sops.length === 0) {
      return NextResponse.json({ keywords: [] });
    }

    // Count categories and create keywords
    const categoryMap = new Map<string, number>();
    sops.forEach((sop) => {
      const category = sop.category || 'General';
      // Use entry count as weight
      categoryMap.set(
        category,
        (categoryMap.get(category) || 0) + sop.entryCount
      );
    });

    // Convert to keyword format and sort by value
    const keywords: Keyword[] = Array.from(categoryMap.entries())
      .map(([text, value]) => ({
        text,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 30); // Top 30 keywords

    return NextResponse.json({ keywords });
  } catch (error) {
    console.error('Error fetching keywords:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
