
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';

export interface SOPStep {
  order: number;
  task: string;
  role: string;
  tools: string;
  template: string;
}

export interface SOPDocument {
  id: string;
  title: string;
  category: string;
  sourceFile: string;
  steps: SOPStep[];
  content: string; // Flattened content for vector search linkage
}

// Convert "I", "A", "1" columns to semantics
function cleanStr(val: any): string {
  return String(val || '').trim();
}

export function parseSOPExcel(filePath: string): SOPDocument[] {
  console.log(`Reading Excel file: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const documents: SOPDocument[] = [];
  const fileName = path.basename(filePath);

  workbook.SheetNames.forEach((sheetName) => {
    console.log(`Processing sheet: ${sheetName}`);
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    let currentCategory = sheetName; // Default category
    let currentSOP: SOPDocument | null = null;

    // Find header row index to identify columns
    let headerRowIndex = -1;
    let colMap = { sn: -1, task: -1, who: -1, tool: -1, template: -1 };

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i];
      if (!row) continue;
      const rowStr = row.map(c => cleanStr(c).toLowerCase());

      if (rowStr.some(c => c.includes('tasks') || c.includes('what'))) {
        headerRowIndex = i;
        rowStr.forEach((cell, idx) => {
          if (cell.includes('s n') || cell === 'sn') colMap.sn = idx;
          if (cell.includes('task') || cell.includes('what')) colMap.task = idx;
          if (cell.includes('who')) colMap.who = idx;
          if (cell.includes('tool')) colMap.tool = idx;
          if (cell.includes('template') || cell.includes('nfp')) colMap.template = idx;
        });
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.warn(`Could not find headers in sheet ${sheetName}`);
      return;
    }

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const snVal = cleanStr(row[colMap.sn]);
      const taskVal = cleanStr(row[colMap.task]);

      // Logic to detect type
      // Type I: Category Header (e.g. "MF Transaction Process")
      if (snVal === 'I') {
        currentCategory = taskVal || currentCategory;
        currentSOP = null; // Reset current SOP
        continue;
      }

      // Type A: SOP Title (e.g. "MF Transactions Process - Lumpsum")
      if (snVal === 'A' || (snVal && isNaN(Number(snVal)) && taskVal)) {
        // New SOP
        const title = taskVal;
        // Generate clean ID
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const newDoc: SOPDocument = {
          id,
          title,
          category: currentCategory,
          sourceFile: fileName,
          steps: [],
          content: '' // Will fill later
        };
        documents.push(newDoc);
        currentSOP = newDoc;
        continue;
      }

      // Type Number: Step (e.g. "1", "2")
      // Also capture purely empty SN if looks like a step continuation? 
      // For safety, assume if it has a number OR currentSOP exists and task is present
      const stepNum = parseInt(snVal);
      if (currentSOP && (!isNaN(stepNum) || (taskVal && !snVal))) {
        if (taskVal) {
          currentSOP.steps.push({
            order: isNaN(stepNum) ? currentSOP.steps.length + 1 : stepNum,
            task: taskVal,
            role: cleanStr(row[colMap.who]),
            tools: cleanStr(row[colMap.tool]),
            template: cleanStr(row[colMap.template])
          });
        }
      }
    }

    // Finalize content strings
    documents.forEach(doc => {
      doc.content = doc.steps.map(s =>
        `${s.order}. ${s.task} (Role: ${s.role}) [Tools: ${s.tools}]`
      ).join('\n');
    });
  });

  return documents;
}

export async function parseSOPWord(filePath: string): Promise<SOPDocument[]> {
  console.log(`Reading Word document: ${filePath}`);
  const fileBuffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  const text = result.value;
  const fileName = path.basename(filePath);

  // Very basic parsing for Word docs as they are unstructured
  // Treat whole doc as one SOP for now, unless we see clear headers
  const id = fileName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return [{
    id,
    title: fileName.replace(/\.docx?$/, ''),
    category: 'General', // TODO: infer from folder?
    sourceFile: fileName,
    steps: [{
      order: 1,
      task: text,
      role: 'Unknown',
      tools: '',
      template: ''
    }],
    content: text
  }];
}

// Wrapper for compatibility/directory logic
export async function parseSOPFile(filePath: string): Promise<SOPDocument[]> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext.includes('xls')) return parseSOPExcel(filePath);
  if (ext.includes('doc')) return await parseSOPWord(filePath);
  return [];
}

export async function parseSOPDirectory(dirPath: string): Promise<SOPDocument[]> {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath);
  const docs: SOPDocument[] = [];

  for (const f of files) {
    if (['.xlsx', '.xls', '.docx'].includes(path.extname(f).toLowerCase())) {
      try {
        const results = await parseSOPFile(path.join(dirPath, f));
        docs.push(...results);
      } catch (e) {
        console.error(`Failed to parse ${f}`, e);
      }
    }
  }
  return docs;
}
