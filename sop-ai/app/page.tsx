'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatBox from '@/components/ChatBox';
import SOPsSidebar from '@/components/SOPsSidebar';
import { SOPReader } from '@/components/SOPReader';
import { Button } from '@/components/ui/button';
import { Loader2, User, Settings, LogOut, Sparkles, X } from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSOPId, setSelectedSOPId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();

    // Listen for custom event from Sidebar
    const handleTrigger = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.sopId) {
        setSelectedSOPId(detail.sopId);
      }
    };
    window.addEventListener('trigger-question', handleTrigger);
    return () => window.removeEventListener('trigger-question', handleTrigger);
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Loading SOP Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur shadow-sm shrink-0">
        <div className="w-full px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">SOP Knowledge Base</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User Controls */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {user?.name || user?.email}
              </span>
            </div>
            {user?.role === 'admin' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin')}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Admin
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar Overlay */}
      <SOPsSidebar />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left/Center Pane: Reader */}
        <div className={`flex-1 overflow-hidden transition-all duration-300 ${selectedSOPId ? 'border-r' : 'flex items-center justify-center'}`}>
          {selectedSOPId ? (
            <div className="h-full flex flex-col relative bg-white">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-4 z-10 hover:bg-muted"
                onClick={() => setSelectedSOPId(null)}
                title="Close Reader"
              >
                <X className="h-4 w-4" />
              </Button>
              <SOPReader sopId={selectedSOPId} />
            </div>
          ) : (
            <div className="text-center p-10 max-w-lg hidden md:block opacity-50">
              <h2 className="text-2xl font-bold mb-4">Welcome to the Knowledge Base</h2>
              <p className="text-muted-foreground">Select a topic from the sidebar to read the full SOP, or ask a question on the right.</p>
            </div>
          )}
        </div>

        {/* Right Pane: Chat */}
        {/* If Reader is open, Chat takes 400px fixed. If closed, Chat takes large width centered (default). 
            Actually, let's keep Chat on the right always, but if Reader is closed, Chat is centered.
            Wait, if user just wants AI, they want Chat centered.
            Implementation: If sopId is null -> Chat is centered max-w-4xl.
            If sopId is set -> Chat is sidebar style (w-[400px]).
        */}
        <div className={`${selectedSOPId ? 'w-[400px] border-l bg-gray-50/50' : 'flex-1'} flex flex-col transition-all duration-300`}>
          <div className={`${selectedSOPId ? 'p-0 h-full' : 'max-w-4xl mx-auto w-full py-6'}`}>
            <ChatBox activeSopId={selectedSOPId} />
          </div>
        </div>

      </div>
    </div>
  );
}
