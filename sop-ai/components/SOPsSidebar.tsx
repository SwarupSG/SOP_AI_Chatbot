'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ChevronRight, FileText } from 'lucide-react';

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

export default function SOPsSidebar() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SOPsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSOPs();
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="fixed left-4 top-20 z-40 h-12 w-12 p-0 rounded-r-lg rounded-l-none shadow-lg"
          aria-label="View available SOPs"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[400px] sm:w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Available SOPs
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              Loading SOPs...
            </div>
          )}

          {error && (
            <Card className="p-4 bg-red-50 border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </Card>
          )}

          {data && !loading && (
            <>
              {data.summary.totalSources === 0 ? (
                <Card className="p-6 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-2">No SOPs Indexed Yet</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Index SOPs from the admin dashboard to see them here.
                  </p>
                </Card>
              ) : (
                <>
                  {/* Summary Card */}
                  <Card className="p-4 bg-blue-50 border-blue-200">
                    <h3 className="font-semibold text-sm mb-2">Index Summary</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Entries:</span>
                        <span className="font-medium">{data.summary.totalEntries}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sources:</span>
                        <span className="font-medium">{data.summary.totalSources}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Categories:</span>
                        <span className="font-medium">{data.summary.categories.length}</span>
                      </div>
                    </div>
                  </Card>
                </>
              )}

              {/* Categories */}
              {data.summary.categories.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">By Category</h3>
                  <div className="space-y-2">
                    {data.summary.categories.map((cat) => (
                      <Card key={cat.name} className="p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{cat.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {cat.count} {cat.count === 1 ? 'entry' : 'entries'}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Files */}
              {data.sops.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Indexed Files ({data.sops.length})</h3>
                  <div className="space-y-2">
                    {data.sops.map((sop) => (
                      <Card key={sop.id} className="p-3 hover:bg-gray-50 transition-colors">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p 
                                className="text-sm font-medium break-words" 
                                title={sop.sourceFile}
                              >
                                {formatFileName(sop.sourceFile)}
                              </p>
                              {sop.category && sop.category !== formatFileName(sop.sourceFile) && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Category: {sop.category}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1 font-mono truncate" title={sop.sourceFile}>
                                {sop.sourceFile}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                            <span className="font-medium">{sop.entryCount} {sop.entryCount === 1 ? 'entry' : 'entries'}</span>
                            <span>{formatDate(sop.lastIndexed)}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

