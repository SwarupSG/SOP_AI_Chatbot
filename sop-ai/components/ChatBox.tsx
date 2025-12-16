'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2, Send, Copy, Check, Sparkles, AlertCircle, Trash2 } from 'lucide-react';
import PredefinedQuestionsDropdown from './PredefinedQuestionsDropdown';
import { DiscoveryDashboard } from './DiscoveryDashboard';

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

const DEFAULT_QUESTIONS = [
  "How do I process a client refund?",
  "What is the procedure for handling SIP orders?",
  "How do I update bank details?",
  "What are the steps for processing a transaction?",
];

interface ChatBoxProps {
  activeSopId?: string | null;
}

export default function ChatBox({ activeSopId }: ChatBoxProps) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<Question[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(DEFAULT_QUESTIONS);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Track if the current question came from a suggestion/preferred source
  const isPreferredRef = useRef(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);

  useEffect(() => {
    loadRecentQuestions();
    loadSuggestedQuestions();
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    // Listen for SOPs update event to refresh suggestions
    const handleSOPsUpdate = () => {
      loadSuggestedQuestions();
    };

    // Listen for sidebar topic selection
    const handleTriggerQuestion = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.question) {
        setQuestion(customEvent.detail.question);
        inputRef.current?.focus();
      }
    };

    window.addEventListener('sops-updated', handleSOPsUpdate);
    window.addEventListener('trigger-question', handleTriggerQuestion);
    return () => {
      window.removeEventListener('sops-updated', handleSOPsUpdate);
      window.removeEventListener('trigger-question', handleTriggerQuestion);
    };
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

  const handleClearHistory = async () => {
    if (!confirm('Are you sure you want to clear your chat history? This action cannot be undone.')) {
      return;
    }

    setClearingHistory(true);
    try {
      const res = await fetch('/api/recent', {
        method: 'DELETE',
      });

      if (res.ok) {
        setRecentQuestions([]);
        setMessages([]);
        alert('Chat history cleared successfully.');
      } else {
        const errorData = await res.json();
        alert(`Failed to clear history: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('Failed to clear history. Please try again.');
    } finally {
      setClearingHistory(false);
    }
  };

  const loadSuggestedQuestions = async () => {
    try {
      setLoadingSuggestions(true);
      const res = await fetch('/api/suggested-questions?type=sop');
      if (res.ok) {
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setSuggestedQuestions(data.questions);
        } else {
          setSuggestedQuestions(DEFAULT_QUESTIONS);
        }
      } else {
        setSuggestedQuestions(DEFAULT_QUESTIONS);
      }
    } catch (error) {
      console.error('Failed to load suggested questions:', error);
      setSuggestedQuestions(DEFAULT_QUESTIONS);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const loadAISuggestions = async () => {
    // Check if already cached
    const cached = localStorage.getItem('ai-suggestions-cache');
    if (cached) {
      try {
        const { questions, timestamp } = JSON.parse(cached);
        // Cache for 1 hour
        if (Date.now() - timestamp < 3600000) {
          setAiSuggestions(questions);
          setShowAiSuggestions(true);
          return;
        }
      } catch (e) {
        // Invalid cache, continue to fetch
      }
    }

    try {
      setLoadingAiSuggestions(true);
      const res = await fetch('/api/suggested-questions?type=ai');
      if (res.ok) {
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setAiSuggestions(data.questions);
          setShowAiSuggestions(true);
          // Cache the results
          localStorage.setItem('ai-suggestions-cache', JSON.stringify({
            questions: data.questions,
            timestamp: Date.now(),
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load AI suggestions:', error);
    } finally {
      setLoadingAiSuggestions(false);
    }
  };

  // ... (keep useEffects)

  const handleSubmit = async (e?: React.FormEvent, overrideQuestion?: string, isPreferredOverride?: boolean) => {
    e?.preventDefault();

    // Determine the question to ask
    const questionToAsk = overrideQuestion || question;
    console.log('[ChatBox] handleSubmit called. Question:', questionToAsk, 'Override:', overrideQuestion, 'Loading:', loading);

    const isPreferred = isPreferredOverride || isPreferredRef.current;

    // Reset preferred flag for next time
    isPreferredRef.current = false;

    if (!questionToAsk.trim() || loading) return;

    const userQuestion = questionToAsk.trim();
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
    console.log('[ChatBox] Messages state updated. Sending fetch request...');

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQuestion,
          sopId: activeSopId,
          isPreferred: isPreferred
        }),
      });

      console.log('[ChatBox] Fetch response received. Status:', res.status);

      if (!res.ok) {
        throw new Error(`Failed to get answer: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      console.log('[ChatBox] API Data received:', data);

      if (!data.answer) {
        console.warn('[ChatBox] Warning: Answer is empty/undefined');
        // Fallback if answer is missing but successful
        data.answer = "I'm sorry, I received an empty response from the server.";
      }

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
    // Auto-submit suggested questions with preferred flag
    handleSubmit(undefined, suggestedQ, true);
  };

  const handleRecentQuestion = (recentQ: Question) => {
    setQuestion(recentQ.question);
    inputRef.current?.focus();
  };

  const handleKeywordClick = (keyword: string) => {
    // Discovery items are also preferred questions (SOP titles)
    const q = `Tell me about ${keyword}`;
    handleSubmit(undefined, q, true);
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
          <div className="flex flex-col items-center justify-center min-h-full text-center space-y-6 py-8 px-2">
            <div className="rounded-full bg-primary/10 p-6 flex-shrink-0">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2 max-w-2xl">
              <h2 className="text-xl font-semibold">Welcome to SOP Assistant</h2>
              <p className="text-muted-foreground text-sm">
                I'm here to help you find answers from your company's Standard Operating Procedures.
                Try asking a question or select one of the suggestions below.
              </p>
            </div>

            {/* Suggested Questions */}
            <div className="w-full max-w-2xl space-y-3 px-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground flex-shrink-0">
                  {showAiSuggestions ? 'AI-Generated Suggestions' : 'Suggested questions:'}
                </p>
                {!showAiSuggestions && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadAISuggestions}
                    disabled={loadingAiSuggestions}
                    className="text-xs flex-shrink-0"
                  >
                    {loadingAiSuggestions ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3 mr-1" />
                        Get AI Suggestions
                      </>
                    )}
                  </Button>
                )}
                {showAiSuggestions && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAiSuggestions(false)}
                    className="text-xs flex-shrink-0"
                  >
                    Show SOP-based
                  </Button>
                )}
              </div>
              {loadingSuggestions && !showAiSuggestions ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-12 bg-muted animate-pulse rounded-lg"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(showAiSuggestions ? aiSuggestions : suggestedQuestions).map((q, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className="justify-start text-left h-auto min-h-[3rem] py-3 px-4 hover:bg-accent hover:border-primary/50 transition-colors break-words whitespace-normal"
                      onClick={() => handleSuggestedQuestion(q)}
                    >
                      <span className="text-sm break-words whitespace-normal text-left w-full">{q}</span>
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Discovery Dashboard */}
            <div className="px-2 w-full">
              <DiscoveryDashboard onSelectTopic={handleKeywordClick} />
            </div>

            {/* Recent Questions */}
            {recentQuestions.length > 0 && (
              <div className="w-full max-w-2xl space-y-3 mt-8 px-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Recent questions:</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearHistory}
                    disabled={clearingHistory}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    {clearingHistory ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear History
                      </>
                    )}
                  </Button>
                </div>
                <div className="space-y-2">
                  {recentQuestions.slice(0, 3).map((q) => (
                    <Card
                      key={q.id}
                      className="p-3 hover:bg-accent cursor-pointer transition-colors break-words"
                      onClick={() => handleRecentQuestion(q)}
                    >
                      <p className="text-sm font-medium break-words">{q.question}</p>
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
              className={`max-w-[80%] md:max-w-[70%] rounded-lg px-4 py-3 ${message.type === 'user'
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
        <div className="mb-2">
          <PredefinedQuestionsDropdown onSelectQuestion={handleSuggestedQuestion} />
        </div>
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

