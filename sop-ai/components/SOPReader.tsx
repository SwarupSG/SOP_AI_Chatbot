
"use client";

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Wrench } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SOPStep {
    order: number;
    task: string;
    role: string;
    tools: string;
    template: string;
}

interface SOPDocument {
    id: string;
    title: string;
    category: string;
    steps: SOPStep[];
    content: string;
}

export function SOPReader({ sopId }: { sopId: string | null }) {
    const [sop, setSop] = useState<SOPDocument | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sopId) return;

        async function fetchSOP() {
            try {
                setLoading(true);
                setError(null);
                const res = await fetch(`/api/sops/content?id=${sopId}`);
                if (!res.ok) throw new Error('Failed to load SOP');
                const data = await res.json();
                setSop(data);
            } catch (e) {
                setError('Could not load SOP content');
            } finally {
                setLoading(false);
            }
        }
        fetchSOP();
    }, [sopId]);

    if (!sopId) {
        return (
            <div className="h-full flex items-center justify-center text-muted-foreground p-8 text-center bg-gray-50/50 rounded-lg border-2 border-dashed">
                <div>
                    <h3 className="text-lg font-medium mb-2">Select an SOP to read</h3>
                    <p className="text-sm">Use the "Browse Topics" sidebar to choose a procedure.</p>
                </div>
            </div>
        );
    }

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (error) return <div className="text-red-500 p-8 text-center">{error}</div>;
    if (!sop) return null;

    return (
        <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
                {/* Header */}
                <div className="mb-8 border-b pb-4">
                    <Badge variant="secondary" className="mb-2">{sop.category}</Badge>
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900">{sop.title}</h1>
                </div>

                {/* Steps */}
                <div className="space-y-6">
                    {sop.steps.map((step) => (
                        <Card key={step.order} className="border-l-4 border-l-primary/20 hover:border-l-primary transition-colors">
                            <CardHeader className="py-3 px-4 flex flex-row items-center gap-4 space-y-0 bg-muted/20">
                                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                    {step.order}
                                </div>
                                <div className="flex-1">
                                    {/* Simplified Header for step if needed, currently empty to save space */}
                                </div>
                                {step.role && (
                                    <Badge variant="outline" className="flex items-center gap-1 font-normal text-xs text-muted-foreground bg-background">
                                        <User className="h-3 w-3" /> {step.role}
                                    </Badge>
                                )}
                            </CardHeader>
                            <CardContent className="pt-4 pb-4 px-4 pl-16">
                                <p className="text-base font-medium mb-3">{step.task}</p>

                                <div className="flex flex-wrap gap-3">
                                    {step.tools && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-blue-50/50 px-2 py-1 rounded">
                                            <Wrench className="h-3 w-3" />
                                            <span className="font-semibold">Tools:</span> {step.tools}
                                        </div>
                                    )}
                                    {step.template && (
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-yellow-50/50 px-2 py-1 rounded">
                                            <span className="font-semibold">Note/Template:</span> {step.template}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Footer Content (Raw content fallback if mixed) */}
                {!sop.steps.length && (
                    <div className="prose max-w-none p-4 bg-muted/50 rounded-lg whitespace-pre-wrap font-mono text-sm">
                        {sop.content}
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}
