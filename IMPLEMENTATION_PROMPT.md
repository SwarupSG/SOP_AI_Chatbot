# Implementation Prompt: High Priority UX Features

## Task Overview
Implement two critical UX features for the SOP AI Assistant admin dashboard:
1. **File Upload Interface** for adding new SOPs
2. **Export Functionality** for downloading unanswered questions as CSV/Excel

---

## Feature 1: File Upload Interface for Adding SOPs

### Requirements

#### User Story
As an admin, I want to upload SOP files (Excel/Word) through the web interface so I can add new SOPs without using the command line.

#### Technical Requirements

1. **UI Components Needed:**
   - Add a new section in Admin Dashboard (`/admin` page) above or below the Unanswered Questions table
   - File upload area with:
     - Drag-and-drop zone
     - File browser button
     - Support for multiple file selection
     - File type validation (`.xlsx`, `.xls`, `.docx`, `.doc` only)
     - File size limit display (e.g., "Max 50MB per file")
     - List of selected files before upload
     - Remove file option before upload

2. **Backend API Endpoint:**
   - Create: `/api/sops/upload` (POST)
   - Accept multipart/form-data
   - Validate file types and sizes
   - Store uploaded files temporarily (or process directly)
   - Call existing `rebuildIndex()` function with uploaded file path(s)
   - Return progress/status

3. **Progress Indicator:**
   - Show upload progress bar
   - Display processing status:
     - "Uploading..."
     - "Processing file..."
     - "Generating embeddings..."
     - "Indexing complete!"
   - Handle errors gracefully with user-friendly messages

4. **Integration:**
   - After successful upload, refresh the SOPs sidebar data
   - Show success notification
   - Optionally show how many entries were indexed

#### Technical Implementation Details

**Frontend:**
- Use React state for file management
- Use `FormData` for file upload
- Use `fetch` API with progress tracking (or show loading state)
- Integrate with existing `UnansweredTable` component location
- Use shadcn/ui components (Button, Card, Input if needed)
- Add lucide-react icons (Upload, FileText, X for remove)

**Backend:**
- Use Next.js API route handler
- Use `formidable` or Next.js built-in file handling
- Validate file types: `['.xlsx', '.xls', '.docx', '.doc']`
- Set file size limit (e.g., 50MB)
- Store files temporarily in `/tmp` or process in memory
- Call `rebuildIndex(filePath)` from `lib/chroma.ts`
- Handle errors and return appropriate status codes

**File Structure:**
```
sop-ai/
├── app/
│   └── api/
│       └── sops/
│           └── upload/
│               └── route.ts (NEW)
├── components/
│   └── SOPUpload.tsx (NEW)
└── app/
    └── admin/
        └── page.tsx (MODIFY - add SOPUpload component)
```

#### Acceptance Criteria
- [ ] Admin can drag and drop SOP files onto upload area
- [ ] Admin can click button to browse and select files
- [ ] Only Excel (.xlsx, .xls) and Word (.docx, .doc) files are accepted
- [ ] Invalid file types show clear error message
- [ ] Upload progress is visible during file transfer
- [ ] Processing status is shown during indexing
- [ ] Success message appears after completion
- [ ] Error messages are user-friendly
- [ ] Multiple files can be selected and uploaded
- [ ] SOPs sidebar refreshes to show new indexed files

---

## Feature 2: Export Unanswered Questions to CSV/Excel

### Requirements

#### User Story
As an admin, I want to download unanswered questions as CSV or Excel files so I can review them offline, share with team, or import into other tools.

#### Technical Requirements

1. **UI Components Needed:**
   - Add export buttons in Admin Dashboard near "Unanswered Questions" heading
   - Buttons: "Download as CSV" and "Download as Excel"
   - Use icons (Download, FileSpreadsheet, FileText)
   - Show loading state during export generation
   - Optional: Filter dropdown before export (status, date range)

2. **Backend API Endpoint:**
   - Create: `/api/unanswered/export` (GET)
   - Query parameters:
     - `format`: 'csv' | 'xlsx' (required)
     - `status`: 'pending' | 'answered' | 'all' (optional, default: 'all')
     - `startDate`: ISO date string (optional)
     - `endDate`: ISO date string (optional)
   - Fetch data from existing `/api/unanswered` logic
   - Generate CSV or Excel file
   - Return file as download response

3. **File Format:**
   - **CSV columns:**
     - ID, Question, User Name, User Email, Status, Notes, Created At, Updated At
   - **Excel columns:** Same as CSV
   - Include header row
   - Format dates as readable strings
   - Handle special characters in CSV (proper escaping)

4. **User Experience:**
   - Click button → File downloads automatically
   - Filename format: `unanswered-questions-YYYY-MM-DD.csv` or `.xlsx`
   - Show brief loading indicator during generation
   - Handle errors gracefully

#### Technical Implementation Details

**Frontend:**
- Add export buttons next to "Unanswered Questions" heading
- Use `fetch` to call export endpoint
- Create blob URL and trigger download
- Show loading spinner on button during export
- Use lucide-react icons (Download, FileSpreadsheet)

**Backend:**
- Use existing `xlsx` package (already in dependencies)
- For CSV: Use simple string concatenation or `papaparse` (may need to add)
- Reuse data fetching logic from `/api/unanswered`
- Set proper headers:
  - `Content-Type: text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `Content-Disposition: attachment; filename="..."`

**File Structure:**
```
sop-ai/
├── app/
│   └── api/
│       └── unanswered/
│           └── export/
│               └── route.ts (NEW)
└── components/
    └── UnansweredTable.tsx (MODIFY - add export buttons)
```

#### CSV Generation Example:
```typescript
// Simple CSV generation
const csvRows = [
  ['ID', 'Question', 'User Name', 'User Email', 'Status', 'Notes', 'Created At', 'Updated At'],
  ...questions.map(q => [
    q.id,
    `"${q.question.replace(/"/g, '""')}"`, // Escape quotes
    q.userName || '',
    q.userEmail || '',
    q.status,
    q.notes ? `"${q.notes.replace(/"/g, '""')}"` : '',
    new Date(q.createdAt).toISOString(),
    new Date(q.updatedAt).toISOString()
  ])
];
const csv = csvRows.map(row => row.join(',')).join('\n');
```

#### Excel Generation Example:
```typescript
import * as XLSX from 'xlsx';

const worksheet = XLSX.utils.json_to_sheet(questions.map(q => ({
  ID: q.id,
  Question: q.question,
  'User Name': q.userName || '',
  'User Email': q.userEmail || '',
  Status: q.status,
  Notes: q.notes || '',
  'Created At': new Date(q.createdAt).toISOString(),
  'Updated At': new Date(q.updatedAt).toISOString()
})));

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Unanswered Questions');
const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
```

#### Acceptance Criteria
- [ ] "Download as CSV" button downloads CSV file
- [ ] "Download as Excel" button downloads XLSX file
- [ ] File contains all columns: ID, Question, User Name, User Email, Status, Notes, Created At, Updated At
- [ ] Filename includes current date
- [ ] CSV properly escapes special characters (quotes, commas)
- [ ] Excel file opens correctly in Excel/LibreOffice
- [ ] Loading state shown during export
- [ ] Error handling for failed exports
- [ ] All unanswered questions included (or filtered if filters implemented)

---

## Implementation Guidelines

### Code Style
- Follow existing code patterns in the codebase
- Use TypeScript with proper types
- Use existing shadcn/ui components
- Use lucide-react for icons (consistent with existing code)
- Follow existing error handling patterns

### Testing Checklist
- [ ] Test file upload with valid Excel file
- [ ] Test file upload with valid Word file
- [ ] Test file upload with invalid file type (should reject)
- [ ] Test file upload with file too large (should reject)
- [ ] Test multiple file upload
- [ ] Test CSV export downloads correctly
- [ ] Test Excel export downloads correctly
- [ ] Test export with no unanswered questions
- [ ] Test error handling for both features
- [ ] Verify admin-only access (non-admins can't access)

### Dependencies
- `xlsx` - Already installed ✅
- May need to add `formidable` or use Next.js built-in file handling
- May need to add `papaparse` for CSV (optional, can use simple string concatenation)

### Security Considerations
- Verify admin role before allowing upload/export
- Validate file types server-side (not just client-side)
- Limit file size to prevent DoS
- Sanitize file names
- Store uploaded files securely (temporary location, clean up after processing)

### Error Messages
Make error messages user-friendly:
- "Invalid file type. Please upload Excel (.xlsx, .xls) or Word (.docx, .doc) files only."
- "File too large. Maximum size is 50MB."
- "Upload failed. Please try again."
- "Indexing failed. Please check the file format and try again."
- "Export failed. Please try again."

---

## Implementation Order

1. **Start with Feature 2 (Export)** - Simpler, good warm-up
   - Create export API endpoint
   - Add export buttons to UnansweredTable
   - Test CSV and Excel generation

2. **Then implement Feature 1 (Upload)** - More complex
   - Create upload API endpoint
   - Create SOPUpload component
   - Integrate into admin page
   - Add progress indicators
   - Test file upload and indexing

---

## Success Criteria

Both features should:
- ✅ Work seamlessly with existing codebase
- ✅ Follow existing design patterns and UI style
- ✅ Handle errors gracefully
- ✅ Provide clear user feedback
- ✅ Be accessible only to admin users
- ✅ Not break existing functionality

---

## Notes for Implementation

- The existing `rebuildIndex()` function in `lib/chroma.ts` accepts an optional `sopFilePath` parameter
- The existing `/api/unanswered` endpoint already returns all the data needed for export
- The `xlsx` package is already in dependencies, so Excel export is straightforward
- File upload will need to handle temporary file storage - consider using `/tmp` directory or processing in memory
- Consider adding file size validation (e.g., 50MB max per file)
- For progress tracking, you may need to implement WebSocket or polling, or use a simpler approach with status messages

---

## Reference Files

- Admin Dashboard: `sop-ai/app/admin/page.tsx`
- Unanswered Table: `sop-ai/components/UnansweredTable.tsx`
- Rebuild Index API: `sop-ai/app/api/rebuild-index/route.ts`
- Unanswered API: `sop-ai/app/api/unanswered/route.ts`
- Chroma Index Function: `sop-ai/lib/chroma.ts` (rebuildIndex function)
- Parse SOP Script: `sop-ai/scripts/parse-sop.ts`

Good luck with the implementation! 🚀



