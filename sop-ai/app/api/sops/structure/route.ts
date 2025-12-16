import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface SOPTask {
    title: string;
    id: string;
}

interface SOPCategory {
    category: string;
    tasks: SOPTask[];
}

interface SOPFile {
    fileName: string;
    categories: SOPCategory[];
}

export async function GET() {
    try {
        const dataPath = path.join(process.cwd(), 'sop_data', 'sop-entries.json');

        if (!fs.existsSync(dataPath)) {
            return NextResponse.json([], { status: 200 });
        }

        const fileContent = fs.readFileSync(dataPath, 'utf-8');
        const sops = JSON.parse(fileContent);

        // Group by sourceFile -> category
        const fileMap = new Map<string, Map<string, SOPTask[]>>();

        sops.forEach((sop: any) => {
            const fileName = sop.sourceFile || 'Unknown File';
            const cat = sop.category || 'General';

            if (!fileMap.has(fileName)) {
                fileMap.set(fileName, new Map());
            }

            const catMap = fileMap.get(fileName)!;
            if (!catMap.has(cat)) {
                catMap.set(cat, []);
            }

            catMap.get(cat)?.push({
                title: sop.title,
                id: sop.id
            });
        });

        const structure: SOPFile[] = [];

        fileMap.forEach((catMap, fileName) => {
            const categories: SOPCategory[] = [];

            catMap.forEach((tasks, category) => {
                categories.push({ category, tasks });
            });

            structure.push({ fileName, categories });
        });

        return NextResponse.json(structure);

    } catch (error) {
        console.error('Error fetching SOP structure:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
