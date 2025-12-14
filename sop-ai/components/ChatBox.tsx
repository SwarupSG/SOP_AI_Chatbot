'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Send, Copy, Check, Sparkles, AlertCircle } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  confidence?: number;
  timestamp: Date;
}

interface Question {
  id: number;
  question: string;
  answer: string;
  confidence: number;
  createdAt: Date;
}

const SUGGESTED_QUESTIONS = [
  "How do I process a client refund?",
  "What is the procedure for handling SIP orders?",
  "How do I update bank details?",
  "What are the steps for processing a transaction?",
];

export default function ChatBox() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<Question[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadRecentQuestions();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

    const userQuestion = question.trim();
    setQuestion('');
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userQuestion,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    setLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userQuestion }),
      });

      if (!res.ok) {
        throw new Error('Failed to get answer');
      }

      const data = await res.json();
      
      // Add assistant message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.answer,
        confidence: data.confidence,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      loadRecentQuestions();
    } catch (error) {
      console.error('Error asking question:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedQuestion = (suggestedQ: string) => {
    setQuestion(suggestedQ);
    inputRef.current?.focus();
  };

  const handleRecentQuestion = (recentQ: Question) => {
    setQuestion(recentQ.question);
    inputRef.current?.focus();
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatConfidence = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    if (percentage >= 70) return { text: `${percentage}%`, color: 'text-green-600', bg: 'bg-green-50' };
    if (percentage >= 40) return { text: `${percentage}%`, color: 'text-yellow-600', bg: 'bg-yellow-50' };
    return { text: `${percentage}%`, color: 'text-red-600', bg: 'bg-red-50' };
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6 px-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">SOP Assistant</h1>
        </div>
        <p className="text-muted-foreground text-sm">Ask questions about your company's Standard Operating Procedures</p>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 mb-4 space-y-4">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
            <div className="rounded-full bg-primary/10 p-6">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Welcome to SOP Assistant</h2>
              <p className="text-muted-foreground text-sm max-w-md">
                I'm here to help you find answers from your company's Standard Operating Procedures. 
                Try asking a question or select one of the suggestions below.
              </p>
            </div>
            
            {/* Suggested Questions */}
            <div className="w-full max-w-2xl space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Suggested questions:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    className="justify-start text-left h-auto py-3 px-4 hover:bg-accent hover:border-primary/50 transition-colors"
                    onClick={() => handleSuggestedQuestion(q)}
                  >
                    <span className="text-sm">{q}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Recent Questions */}
            {recentQuestions.length > 0 && (
              <div className="w-full max-w-2xl space-y-3 mt-8">
                <p className="text-sm font-medium text-muted-foreground">Recent questions:</p>
                <div className="space-y-2">
                  {recentQuestions.slice(0, 3).map((q) => (
                    <Card
                      key={q.id}
                      className="p-3 hover:bg-accent cursor-pointer transition-colors"
                      onClick={() => handleRecentQuestion(q)}
                    >
                      <p className="text-sm font-medium">{q.question}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{q.answer}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] md:max-w-[70%] rounded-lg px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {message.type === 'assistant' && (
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium">SOP Assistant</span>
                  </div>
                  {message.confidence !== undefined && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${formatConfidence(message.confidence).bg} ${formatConfidence(message.confidence).color}`}
                    >
                      {formatConfidence(message.confidence).text} confidence
                    </span>
                  )}
                </div>
              )}
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              {message.type === 'assistant' && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => copyToClipboard(message.content, message.id)}
                  >
                    {copiedId === message.id ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              )}
              {message.type === 'assistant' && message.confidence !== undefined && message.confidence < 0.3 && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <div className="flex items-start gap-2 text-xs text-amber-600">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>This answer has been logged for review due to low confidence.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-background px-4 py-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Ask a question about SOPs..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button 
            type="submit" 
            disabled={loading || !question.trim()}
            size="icon"
            className="shrink-0"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

