'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';

interface FileWithPreview extends File {
  preview?: string;
}

export default function SOPUpload() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
  ];
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB

  const validateFile = (file: File): string | null => {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowedExts = ['.xlsx', '.xls', '.docx', '.doc'];
    
    if (!allowedExts.includes(ext)) {
      return `Invalid file type. Only Excel (.xlsx, .xls) and Word (.docx, .doc) files are allowed.`;
    }
    
    if (file.size > MAX_SIZE) {
      return `File too large. Maximum size is 50MB.`;
    }
    
    return null;
  };

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: FileWithPreview[] = [];
    const errors: string[] = [];

    Array.from(fileList).forEach((file) => {
      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
      } else {
        newFiles.push(file);
      }
    });

    if (errors.length > 0) {
      setMessage(errors.join('\n'));
      setStatus('error');
    }

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setMessage('Please select at least one file to upload.');
      setStatus('error');
      return;
    }

    setUploading(true);
    setStatus('uploading');
    setMessage('Uploading files...');

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const res = await fetch('/api/sops/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setStatus('processing');
      setMessage('Processing files and generating embeddings...');

      // Wait a bit for processing (in real app, you might poll for status)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setStatus('success');
      setMessage(data.message || `Successfully uploaded and indexed ${files.length} file(s)`);
      setFiles([]);
      
      // Refresh SOPs sidebar if it exists (triggered by page reload or event)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('sops-updated'));
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Upload SOP Files</h2>
      
      {/* Drag and Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:border-gray-400'}
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <p className="text-sm font-medium mb-2">
          Drag and drop SOP files here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Supports Excel (.xlsx, .xls) and Word (.docx, .doc) files
        </p>
        <p className="text-xs text-muted-foreground">
          Maximum file size: 50MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.docx,.doc"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium">Selected Files ({files.length})</h3>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                disabled={uploading}
                className="flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div
          className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
            status === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200'
              : status === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}
        >
          {status === 'error' && <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />}
          <p className="text-sm whitespace-pre-line">{message}</p>
        </div>
      )}

      {/* Upload Button */}
      <div className="mt-4 flex justify-end">
        <Button
          onClick={handleUpload}
          disabled={files.length === 0 || uploading}
        >
          {uploading ? (
            <>Processing...</>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload & Index {files.length > 0 && `(${files.length})`}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

