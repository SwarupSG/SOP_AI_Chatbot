'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

interface UnansweredQuestion {
  id: number;
  question: string;
  status: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  userName: string | null;
  userEmail: string | null;
}

export default function UnansweredTable() {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [rebuilding, setRebuilding] = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const res = await fetch('/api/unanswered');
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Failed to load unanswered questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAnswered = async (id: number) => {
    try {
      const res = await fetch('/api/unanswered', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'answered', notes }),
      });

      if (res.ok) {
        setEditingId(null);
        setNotes('');
        loadQuestions();
      }
    } catch (error) {
      console.error('Failed to update question:', error);
    }
  };

  const handleRebuildIndex = async () => {
    setRebuilding(true);
    try {
      const res = await fetch('/api/rebuild-index', {
        method: 'POST',
      });

      if (res.ok) {
        alert('Index rebuild initiated (placeholder)');
      }
    } catch (error) {
      console.error('Failed to rebuild index:', error);
    } finally {
      setRebuilding(false);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    setExporting(format);
    try {
      const res = await fetch(`/api/unanswered/export?format=${format}`);
      
      if (!res.ok) {
        throw new Error('Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = res.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') || `unanswered-questions.${format}`
        : `unanswered-questions.${format}`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed. Please try again.`);
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <Button onClick={handleRebuildIndex} disabled={rebuilding}>
          {rebuilding ? 'Rebuilding...' : 'Rebuild SOP Index'}
        </Button>
      </div>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Unanswered Questions</h2>
          {questions.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('csv')}
                disabled={exporting !== null}
              >
                {exporting === 'csv' ? (
                  <>Loading...</>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Download CSV
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('xlsx')}
                disabled={exporting !== null}
              >
                {exporting === 'xlsx' ? (
                  <>Loading...</>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Download Excel
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        {questions.length === 0 ? (
          <p className="text-muted-foreground">No unanswered questions</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-md">{q.question}</TableCell>
                  <TableCell>
                    {q.userName || q.userEmail || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    {new Date(q.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        q.status === 'answered'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {q.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {editingId === q.id ? (
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes..."
                        className="w-48"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {q.notes || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === q.id ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleMarkAnswered(q.id)}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(null);
                            setNotes('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setEditingId(q.id);
                          setNotes(q.notes || '');
                        }}
                      >
                        Mark Answered
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

