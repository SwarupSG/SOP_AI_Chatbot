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
import { Download, FileSpreadsheet, FileText, Trash2 } from 'lucide-react';

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
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/unanswered?id=${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadQuestions();
      } else {
        const errorData = await res.json();
        alert(`Failed to delete question: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to delete question:', error);
      alert('Failed to delete question. Please try again.');
    } finally {
      setDeletingId(null);
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
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[300px]">Question</TableHead>
                <TableHead className="whitespace-nowrap">User</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="max-w-md min-w-[300px] break-words whitespace-normal align-top">
                    <p className="text-sm break-words">{q.question}</p>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    {q.userName || q.userEmail || 'Unknown'}
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="align-top">
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
                  <TableCell className="align-top">
                    {editingId === q.id ? (
                      <Input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes..."
                        className="w-48"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground break-words">
                        {q.notes || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
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
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setEditingId(q.id);
                            setNotes(q.notes || '');
                          }}
                        >
                          Mark Answered
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteQuestion(q.id)}
                          disabled={deletingId === q.id}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {deletingId === q.id ? (
                            <>Deleting...</>
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

