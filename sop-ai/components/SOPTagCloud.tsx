'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface Keyword {
  text: string;
  value: number;
}

interface SOPTagCloudProps {
  onKeywordClick?: (keyword: string) => void;
}

export default function SOPTagCloud({ onKeywordClick }: SOPTagCloudProps) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKeywords();
  }, []);

  const loadKeywords = async () => {
    try {
      const res = await fetch('/api/keywords');
      if (res.ok) {
        const data = await res.json();
        setKeywords(data.keywords || []);
      }
    } catch (error) {
      console.error('Failed to load keywords:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeywordClick = (keyword: string) => {
    if (onKeywordClick) {
      onKeywordClick(keyword);
    }
  };

  const getSizeClass = (value: number, maxValue: number) => {
    const ratio = value / maxValue;
    if (ratio > 0.7) return 'text-lg px-4 py-2';
    if (ratio > 0.4) return 'text-base px-3 py-1.5';
    return 'text-sm px-2.5 py-1';
  };

  const getColorClass = (index: number) => {
    const colors = [
      'bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300',
      'bg-green-100 text-green-800 hover:bg-green-200 border-green-300',
      'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300',
      'bg-purple-100 text-purple-800 hover:bg-purple-200 border-purple-300',
      'bg-pink-100 text-pink-800 hover:bg-pink-200 border-pink-300',
      'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-300',
      'bg-teal-100 text-teal-800 hover:bg-teal-200 border-teal-300',
      'bg-rose-100 text-rose-800 hover:bg-rose-200 border-rose-300',
    ];
    return colors[index % colors.length];
  };

  if (loading) {
    return (
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (keywords.length === 0) {
    return null;
  }

  const maxValue = Math.max(...keywords.map(k => k.value));

  return (
    <div className="w-full max-w-2xl space-y-3">
      <p className="text-sm font-medium text-muted-foreground text-center">
        Explore SOP Topics
      </p>
      <div className="flex flex-wrap gap-2 justify-center p-4 bg-muted/30 rounded-lg border border-border/50">
        {keywords.map((keyword, idx) => (
          <button
            key={idx}
            onClick={() => handleKeywordClick(keyword.text)}
            className={`
              ${getSizeClass(keyword.value, maxValue)}
              ${getColorClass(idx)}
              rounded-full font-medium
              transition-all duration-200
              hover:scale-110 hover:shadow-md
              active:scale-95
              border
              cursor-pointer
              select-none
            `}
            title={`${keyword.text}: ${keyword.value} entries`}
          >
            {keyword.text}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Click on any topic to search
      </p>
    </div>
  );
}
