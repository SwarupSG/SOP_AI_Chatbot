"use client";

import { useEffect, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Loader2 } from "lucide-react";

// Types matching the new API response
interface SOPTask {
    title: string;
    id: string;
}
interface SOPCategory {
    category: string;
    tasks: SOPTask[];
}
interface SOPFile {
    fileName: string;
    categories: SOPCategory[];
}

interface TopicExplorerProps {
    onSelectTopic: (topic: string, id?: string) => void;
}

export function TopicExplorer({ onSelectTopic }: TopicExplorerProps) {
    const [data, setData] = useState<SOPFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterText, setFilterText] = useState('');

    useEffect(() => {
        async function fetchStructure() {
            try {
                const response = await fetch('/api/sops/structure');
                if (!response.ok) throw new Error('Failed to load SOPs');
                const jsonData = await response.json();
                if (Array.isArray(jsonData)) {
                    setData(jsonData);
                }
            } catch (err) {
                setError('Failed to load topics');
            } finally {
                setLoading(false);
            }
        }
        fetchStructure();
    }, []);

    // Filter logic for 3-level hierarchy
    const filteredData = data.map(file => {
        const filteredCategories = file.categories.map(cat => ({
            ...cat,
            tasks: cat.tasks.filter(task =>
                task.title.toLowerCase().includes(filterText.toLowerCase())
            )
        })).filter(cat => cat.tasks.length > 0);

        return {
            ...file,
            categories: filteredCategories
        };
    }).filter(file => file.categories.length > 0);

    if (loading) {
        return <div className="flex justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    if (error) {
        return <div className="text-sm text-red-500 p-4">{error}</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-150px)]">
            <div className="p-2">
                <input
                    type="text"
                    placeholder="Search topics..."
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                />
            </div>
            <ScrollArea className="flex-1 pr-4">
                <Accordion type="single" collapsible className="w-full">
                    {filteredData.map((file, fileIndex) => (
                        <AccordionItem key={fileIndex} value={`file-${fileIndex}`}>
                            <AccordionTrigger className="text-sm font-semibold hover:no-underline px-2 bg-muted/20 hover:bg-muted/40 rounded-sm mb-1">
                                <div className="flex flex-col items-start text-left w-full">
                                    <span className="break-all">{file.fileName}</span>
                                    <span className="text-xs text-muted-foreground font-normal">
                                        {file.categories.reduce((acc, c) => acc + c.tasks.length, 0)} SOPs
                                    </span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-2">
                                <div className="pl-2 border-l ml-2 space-y-4 pt-2">
                                    {file.categories.map((category, catIndex) => (
                                        <div key={catIndex}>
                                            <h4 className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">{category.category}</h4>
                                            <div className="flex flex-col space-y-0.5">
                                                {category.tasks.map((task, taskIndex) => (
                                                    <Button
                                                        key={taskIndex}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="justify-start h-auto py-1.5 px-2 text-xs text-foreground hover:text-primary whitespace-normal text-left"
                                                        onClick={() => onSelectTopic(task.title, task.id)}
                                                    >
                                                        <FileText className="h-3 w-3 mr-2 flex-shrink-0" />
                                                        <span>{task.title}</span>
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}

                    {filteredData.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground p-4">
                            No topics found matching "{filterText}"
                        </div>
                    )}
                </Accordion>
            </ScrollArea>
        </div>
    );
}
