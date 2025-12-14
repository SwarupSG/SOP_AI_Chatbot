import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { rebuildIndex } from '@/lib/chroma';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.docx', '.doc'];
const UPLOAD_DIR = join(process.cwd(), 'uploads');

// Ensure upload directory exists
async function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

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

    await ensureUploadDir();

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const uploadedFiles: string[] = [];
    const errors: string[] = [];

    // Validate and save files
    for (const file of files) {
      // Validate file type
      const fileName = file.name;
      const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
      
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`${fileName}: Invalid file type. Only Excel (.xlsx, .xls) and Word (.docx, .doc) files are allowed.`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${fileName}: File too large. Maximum size is 50MB.`);
        continue;
      }

      // Sanitize filename
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = join(UPLOAD_DIR, `${Date.now()}-${sanitizedFileName}`);

      try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);
        uploadedFiles.push(filePath);
      } catch (error) {
        errors.push(`${fileName}: Failed to save file.`);
        console.error(`Error saving file ${fileName}:`, error);
      }
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json(
        { 
          error: 'No files were uploaded successfully.',
          details: errors 
        },
        { status: 400 }
      );
    }

    // Rebuild index with all files (default + template_sample + uploaded)
    // This will include the newly uploaded files
    try {
      await rebuildIndex();
      // Note: rebuildIndex processes all files including uploads directory
    } catch (error: any) {
      return NextResponse.json(
        { 
          error: 'Indexing failed',
          details: error.message,
          uploadedFiles: uploadedFiles.map(f => f.split('/').pop())
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully uploaded and indexed ${uploadedFiles.length} file(s)`,
      uploadedFiles: uploadedFiles.map(f => f.split('/').pop()),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed. Please try again.', details: error.message },
      { status: 500 }
    );
  }
}

