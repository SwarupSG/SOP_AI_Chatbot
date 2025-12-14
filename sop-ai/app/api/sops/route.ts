import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db, indexedSOPs } from '@/lib/db';
import { desc } from 'drizzle-orm';

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

    // Check if table exists, if not return empty result
    let sops: any[] = [];
    try {
      sops = await db
        .select()
        .from(indexedSOPs)
        .orderBy(desc(indexedSOPs.lastIndexed));
    } catch (error: any) {
      // Table might not exist yet - that's okay, return empty result
      if (error.message?.includes('no such table')) {
        console.log('indexed_sops table does not exist yet');
        return NextResponse.json({
          sops: [],
          summary: {
            totalEntries: 0,
            totalSources: 0,
            categories: [],
          },
        });
      }
      throw error;
    }

    // Calculate totals
    const totalEntries = sops.reduce((sum, sop) => sum + sop.entryCount, 0);
    const totalSources = sops.length;

    // Group by category
    const byCategory = new Map<string, number>();
    sops.forEach((sop) => {
      const category = sop.category || 'General';
      byCategory.set(category, (byCategory.get(category) || 0) + sop.entryCount);
    });

    return NextResponse.json({
      sops,
      summary: {
        totalEntries,
        totalSources,
        categories: Array.from(byCategory.entries()).map(([name, count]) => ({
          name,
          count,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching SOPs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

