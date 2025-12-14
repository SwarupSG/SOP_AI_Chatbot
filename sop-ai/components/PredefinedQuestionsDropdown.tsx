'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Question {
  id: number;
  question: string;
  category: string | null;
  sourceFile: string;
}

interface QuestionGroup {
  sourceFile: string;
  fileName: string;
  questions: Question[];
  count: number;
}

interface PredefinedQuestionsData {
  questions: QuestionGroup[];
  total: number;
}

interface PredefinedQuestionsDropdownProps {
  onSelectQuestion: (question: string) => void;
}

export default function PredefinedQuestionsDropdown({
  onSelectQuestion,
}: PredefinedQuestionsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PredefinedQuestionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    loadQuestions();
    
    // Listen for SOPs update event
    const handleSOPsUpdate = () => {
      loadQuestions();
    };
    
    window.addEventListener('sops-updated', handleSOPsUpdate);
    return () => {
      window.removeEventListener('sops-updated', handleSOPsUpdate);
    };
  }, []);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      const searchParam = searchValue ? `?search=${encodeURIComponent(searchValue)}` : '';
      const res = await fetch(`/api/predefined-questions${searchParam}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to load predefined questions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      loadQuestions();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleSelect = (question: string) => {
    onSelectQuestion(question);
    setOpen(false);
    setSearchValue('');
  };

  const allQuestions = data?.questions.flatMap((group) => 
    group.questions.map((q) => ({ ...q, fileName: group.fileName }))
  ) || [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Browse predefined questions</span>
            <span className="sm:hidden">Browse questions</span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search predefined questions..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading questions...
              </div>
            ) : allQuestions.length === 0 ? (
              <CommandEmpty>
                {searchValue
                  ? 'No questions found matching your search.'
                  : 'No predefined questions available. Questions will be generated when documents are indexed.'}
              </CommandEmpty>
            ) : (
              <>
                {data?.questions.map((group) => (
                  <CommandGroup
                    key={group.sourceFile}
                    heading={
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{group.fileName}</span>
                        <span className="text-xs text-muted-foreground">
                          {group.count} {group.count === 1 ? 'question' : 'questions'}
                        </span>
                      </div>
                    }
                  >
                    {group.questions.map((question) => (
                      <CommandItem
                        key={question.id}
                        value={question.question}
                        onSelect={() => handleSelect(question.question)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            false && 'opacity-100'
                          )}
                        />
                        <span className="flex-1">{question.question}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

