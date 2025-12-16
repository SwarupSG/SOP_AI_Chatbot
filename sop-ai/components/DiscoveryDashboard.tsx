"use client";

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, ArrowRight, Layers, FileSpreadsheet } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Types matching the API response
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

interface DiscoveryDashboardProps {
    onSelectTopic: (topic: string) => void;
}

export function DiscoveryDashboard({ onSelectTopic }: DiscoveryDashboardProps) {
    const [data, setData] = useState<SOPFile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStructure() {
            try {
                const response = await fetch('/api/sops/structure');
                if (response.ok) {
                    const jsonData = await response.json();
                    if (Array.isArray(jsonData)) setData(jsonData);
                }
            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setLoading(false);
            }
        }
        fetchStructure();
    }, []);

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    // Flatten categories for display, or show files?
    // User asked for "Explore Topics". Grouping by Category (Sheet) seems most logical for "Topics".
    // We can show a card for each Category.

    const allCategories: { category: string; fileName: string; tasks: SOPTask[] }[] = [];
    data.forEach(file => {
        file.categories.forEach(cat => {
            allCategories.push({
                category: cat.category,
                fileName: file.fileName,
                tasks: cat.tasks
            });
        });
    });

    return (
        <div className="w-full max-w-4xl space-y-6">
            <div className="text-center space-y-2">
                <h2 className="text-lg font-semibold tracking-tight">Explore Knowledge Base</h2>
                <p className="text-sm text-muted-foreground">Select a category to see available procedures</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allCategories.map((cat, idx) => (
                    <Card key={idx} className="hover:shadow-md transition-shadow border-muted/60">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" />
                                        {cat.category}
                                    </CardTitle>
                                    <CardDescription className="text-xs flex items-center gap-1">
                                        <FileSpreadsheet className="h-3 w-3" />
                                        {cat.fileName}
                                    </CardDescription>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                    {cat.tasks.length} SOPs
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {cat.tasks.slice(0, 3).map((task, tIdx) => (
                                    <Button
                                        key={tIdx}
                                        variant="outline"
                                        size="sm"
                                        className="text-xs h-auto py-1.5 px-3 whitespace-normal text-left justify-start"
                                        onClick={() => onSelectTopic(task.title)}
                                    >
                                        <FileText className="h-3 w-3 mr-1.5 shrink-0 opacity-70" />
                                        <span className="line-clamp-1">{task.title}</span>
                                    </Button>
                                ))}
                                {cat.tasks.length > 3 && (
                                    <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2 text-muted-foreground">
                                        +{cat.tasks.length - 3} more
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
