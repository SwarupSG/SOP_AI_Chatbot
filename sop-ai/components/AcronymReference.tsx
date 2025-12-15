'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Acronym {
  abbreviation: string;
  fullForm: string;
  category: string;
}

interface AcronymReferenceProps {
  acronyms?: Acronym[];
  showSearch?: boolean;
  maxHeight?: string;
}

export function AcronymReference({ 
  acronyms: propAcronyms, 
  showSearch = true,
  maxHeight = '400px'
}: AcronymReferenceProps) {
  const [acronyms, setAcronyms] = useState<Acronym[]>(propAcronyms || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(!propAcronyms);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propAcronyms) {
      setAcronyms(propAcronyms);
      setLoading(false);
      return;
    }

    // Fetch acronyms from API if not provided as props
    async function fetchAcronyms() {
      try {
        const response = await fetch('/api/admin/acronyms');
        if (!response.ok) {
          throw new Error('Failed to fetch acronyms');
        }
        const data = await response.json();
        // The API returns stats, not the full list
        // This component works best when acronyms are passed as props
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }

    fetchAcronyms();
  }, [propAcronyms]);

  const filteredAcronyms = acronyms.filter(acronym => {
    const term = searchTerm.toLowerCase();
    return (
      acronym.abbreviation.toLowerCase().includes(term) ||
      acronym.fullForm.toLowerCase().includes(term) ||
      acronym.category.toLowerCase().includes(term)
    );
  });

  // Group by category
  const groupedAcronyms = filteredAcronyms.reduce((acc, acronym) => {
    const category = acronym.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(acronym);
    return acc;
  }, {} as Record<string, Acronym[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span className="ml-2 text-sm text-muted-foreground">Loading acronyms...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-500">
        Error loading acronyms: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search acronyms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      <div 
        className="overflow-auto border rounded-md"
        style={{ maxHeight }}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px] font-semibold">Acronym</TableHead>
              <TableHead className="font-semibold">Full Form</TableHead>
              <TableHead className="w-[180px] font-semibold">Category</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAcronyms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {searchTerm ? 'No acronyms match your search' : 'No acronyms loaded'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAcronyms.map((acronym, index) => (
                <TableRow key={`${acronym.abbreviation}-${index}`}>
                  <TableCell className="font-mono font-semibold text-primary">
                    {acronym.abbreviation}
                  </TableCell>
                  <TableCell>{acronym.fullForm}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {acronym.category}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {filteredAcronyms.length} of {acronyms.length} acronyms
        {Object.keys(groupedAcronyms).length > 0 && (
          <span> across {Object.keys(groupedAcronyms).length} categories</span>
        )}
      </div>
    </div>
  );
}

// Compact inline version for use in chat/responses
export function AcronymBadge({ acronym }: { acronym: Acronym }) {
  return (
    <span 
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm"
      title={`${acronym.abbreviation}: ${acronym.fullForm}`}
    >
      <span className="font-semibold">{acronym.abbreviation}</span>
      <span className="text-muted-foreground">({acronym.fullForm})</span>
    </span>
  );
}

export default AcronymReference;
