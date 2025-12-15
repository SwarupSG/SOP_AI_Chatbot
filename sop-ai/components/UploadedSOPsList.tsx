'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SOPInfo {
  id: number;
  sourceFile: string;
  category: string | null;
  entryCount: number;
  lastIndexed: Date;
}

interface SOPsData {
  sops: SOPInfo[];
  summary: {
    totalEntries: number;
    totalSources: number;
    categories: Array<{ name: string; count: number }>;
  };
}

export default function UploadedSOPsList() {
  const [data, setData] = useState<SOPsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSOPs();
    
    // Listen for SOPs update event
    const handleSOPsUpdate = () => {
      loadSOPs();
    };
    
    window.addEventListener('sops-updated', handleSOPsUpdate);
    return () => {
      window.removeEventListener('sops-updated', handleSOPsUpdate);
    };
  }, []);

  const loadSOPs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/sops');
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        setError(errorData.error || `Failed to load SOPs (${res.status})`);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading SOPs');
    } finally {
      setLoading(false);
    }
  };

  const formatFileName = (filePath: string) => {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileSource = (filePath: string) => {
    if (filePath.includes('uploads/')) {
      return 'Uploaded';
    } else if (filePath.includes('template_sample/')) {
      return 'Template Sample';
    } else if (filePath.includes('S4_-_SOPs_-_MF_Transactions.xlsx')) {
      return 'Default Excel';
    }
    return 'Other';
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Indexed SOP Files</h2>
          <Button variant="outline" size="sm" onClick={loadSOPs} disabled>
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            Loading...
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Loading SOP files...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Indexed SOP Files</h2>
          <Button variant="outline" size="sm" onClick={loadSOPs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <p className="text-sm text-red-600">{error}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Indexed SOP Files</h2>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.summary.totalSources} file(s) with {data.summary.totalEntries} total entries
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadSOPs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {data && data.sops.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium mb-2">No SOPs Indexed Yet</p>
          <p className="text-xs text-muted-foreground">
            Upload SOP files above or rebuild the index to see files here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.sops.map((sop) => (
            <div
              key={sop.id}
              className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <p className="text-sm font-medium truncate" title={sop.sourceFile}>
                    {formatFileName(sop.sourceFile)}
                  </p>
                  <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">
                    {getFileSource(sop.sourceFile)}
                  </span>
                </div>
                <div className="ml-6 space-y-1">
                  {sop.category && sop.category !== formatFileName(sop.sourceFile) && (
                    <p className="text-xs text-muted-foreground">
                      Category: {sop.category}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono truncate" title={sop.sourceFile}>
                    {sop.sourceFile}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="font-medium">{sop.entryCount} {sop.entryCount === 1 ? 'entry' : 'entries'}</span>
                    <span>•</span>
                    <span>Indexed: {formatDate(sop.lastIndexed)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}




