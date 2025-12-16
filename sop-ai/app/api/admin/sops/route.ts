import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db, indexedSOPs } from '@/lib/db';
import { count } from 'drizzle-orm';

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
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        // Get count of total indexed entries
        // Since indexedSOPs stores file-level info with entryCount, we sum entryCount
        const allSops = await db.select().from(indexedSOPs);
        const totalCount = allSops.reduce((sum, sop) => sum + sop.entryCount, 0);

        return NextResponse.json({
            count: totalCount
        });
    } catch (error) {
        console.error('Error fetching SOP stats:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
