'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import UnansweredTable from '@/components/UnansweredTable';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isIndexingSOPs, setIsIndexingSOPs] = useState(false);
  const [isIndexingAcronyms, setIsIndexingAcronyms] = useState(false);
  const [acronymStats, setAcronymStats] = useState<{ total: number; byCategory: Record<string, number> } | null>(null);
  const [sopStats, setSopStats] = useState<{ count: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchStats();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user.role !== 'admin') {
          router.push('/');
          return;
        }
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

  const fetchStats = async () => {
    try {
      // Fetch acronym stats
      const acronymRes = await fetch('/api/admin/acronyms');
      if (acronymRes.ok) {
        const data = await acronymRes.json();
        setAcronymStats(data);
      }
      
      // Fetch SOP stats
      const sopRes = await fetch('/api/admin/sops');
      if (sopRes.ok) {
        const data = await sopRes.json();
        setSopStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleRebuildSOPIndex = async () => {
    if (!confirm('This will rebuild the entire SOP index. Continue?')) return;
    
    setIsIndexingSOPs(true);
    try {
      const res = await fetch('/api/rebuild-index', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully initiated SOP index rebuild. ${data.message || ''}`);
        fetchStats();
      } else {
        alert(`Error: ${data.error || 'Failed to rebuild index'}`);
      }
    } catch (error) {
      alert('Failed to rebuild SOP index');
    } finally {
      setIsIndexingSOPs(false);
    }
  };

  const handleReindexAcronyms = async () => {
    setIsIndexingAcronyms(true);
    try {
      const res = await fetch('/api/admin/acronyms', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully indexed ${data.indexed} acronyms`);
        fetchStats();
      } else {
        alert(`Error: ${data.error || 'Failed to index acronyms'}`);
      }
    } catch (error) {
      alert('Failed to re-index acronyms');
    } finally {
      setIsIndexingAcronyms(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.name || user?.email}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/')}
            >
              Chat
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
      {/* Index Management Section */}
      <div className="max-w-7xl mx-auto p-6 pb-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* SOP Index Card */}
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="font-semibold mb-2">SOP Index</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {sopStats ? `${sopStats.count} documents indexed` : 'Loading...'}
            </p>
            <Button 
              onClick={handleRebuildSOPIndex} 
              disabled={isIndexingSOPs}
              variant="outline"
              className="w-full"
            >
              {isIndexingSOPs ? 'Rebuilding...' : 'Rebuild SOP Index'}
            </Button>
          </div>
          
          {/* Acronym Index Card */}
          <div className="border rounded-lg p-4 bg-white">
            <h3 className="font-semibold mb-2">Acronym Reference</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {acronymStats ? `${acronymStats.total} acronyms indexed` : 'Loading...'}
            </p>
            <Button 
              onClick={handleReindexAcronyms} 
              disabled={isIndexingAcronyms}
              variant="outline"
              className="w-full"
            >
              {isIndexingAcronyms ? 'Indexing...' : 'Re-index Acronyms'}
            </Button>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto p-6">
        <UnansweredTable />
      </div>
    </div>
  );
}

