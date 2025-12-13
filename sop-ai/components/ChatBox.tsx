'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

interface Question {
  id: number;
  question: string;
  answer: string;
  confidence: number;
  createdAt: Date;
}

export default function ChatBox() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [recentQuestions, setRecentQuestions] = useState<Question[]>([]);

  useEffect(() => {
    loadRecentQuestions();
  }, []);

  const loadRecentQuestions = async () => {
    try {
      const res = await fetch('/api/recent');
      if (res.ok) {
        const data = await res.json();
        setRecentQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Failed to load recent questions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setAnswer(null);
    setConfidence(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await res.json();
      setAnswer(data.answer);
      setConfidence(data.confidence);
      setQuestion('');
      loadRecentQuestions();
    } catch (error) {
      console.error('Error asking question:', error);
      setAnswer('Error: Could not get answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-6 gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">SOP Assistant</h1>
        <p className="text-muted-foreground">Ask questions about your company's Standard Operating Procedures</p>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder="Ask SOP Assistant (e.g., 'How do I handle client refunds?')"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !question.trim()}>
            {loading ? 'Asking...' : 'Ask'}
          </Button>
        </form>
      </Card>

      {answer && (
        <Card className="p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Answer</h2>
              {confidence !== null && (
                <span className="text-sm text-muted-foreground">
                  Confidence: {Math.round(confidence * 100)}%
                </span>
              )}
            </div>
            <p className="text-sm">{answer}</p>
            {confidence !== null && confidence < 0.3 && (
              <p className="text-xs text-amber-600 mt-2">
                This question has been logged for review as confidence is low.
              </p>
            )}
          </div>
        </Card>
      )}

      {recentQuestions.length > 0 && (
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Recent Questions</h2>
          <div className="space-y-3">
            {recentQuestions.map((q) => (
              <div key={q.id} className="border-b pb-3 last:border-0">
                <p className="font-medium text-sm mb-1">{q.question}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{q.answer}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(q.createdAt).toLocaleString()} • Confidence: {q.confidence}%
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

