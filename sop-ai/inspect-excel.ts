
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

function inspectExcel() {
    const filePath = path.join(process.cwd(), 'data', 'S4_-_SOPs_-_MF_Transactions.xlsx');

    try {
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return;
        }

        const fileBuffer = fs.readFileSync(filePath);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        console.log(`Detected Sheets: ${workbook.SheetNames.join(', ')}`);

        // Inspect first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Array of arrays

        console.log(`\n--- Inspecting contents of sheet: ${firstSheetName} ---`);
        // Print first 5 rows
        jsonData.slice(0, 10).forEach((row, i) => {
            console.log(`Row ${i}:`, JSON.stringify(row));
        });

    } catch (error) {
        console.error('Error inspecting Excel:', error);
    }
}

inspectExcel();
