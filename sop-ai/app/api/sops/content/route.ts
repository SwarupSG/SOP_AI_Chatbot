
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sopId = searchParams.get('id');

    if (!sopId) {
        return NextResponse.json({ error: 'SOP ID is required' }, { status: 400 });
    }

    try {
        const dataPath = path.join(process.cwd(), 'sop_data', 'sop-entries.json');

        if (!fs.existsSync(dataPath)) {
            return NextResponse.json({ error: 'SOP index not found. Please run indexing.' }, { status: 404 });
        }

        const fileContent = fs.readFileSync(dataPath, 'utf-8');
        const sops = JSON.parse(fileContent);

        // Find SOP by ID (exact match) or by semantic ID match
        const sop = sops.find((s: any) => s.id === sopId);

        if (!sop) {
            return NextResponse.json({ error: 'SOP not found' }, { status: 404 });
        }

        return NextResponse.json(sop);
    } catch (error) {
        console.error('Error fetching SOP content:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
