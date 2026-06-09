'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import Feed from "@/components/Feed";
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Home() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = activeTab === 'following' ? '/feed/following/' : '/feed/for-you/';
      const res = await api.get(endpoint);
      setPosts(res.data);
    } catch (err) {
      console.error('Failed to fetch feed:', err);
      setError('Failed to load feed. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleTriggerTestError = () => {
    setError('TEST_ERROR');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
      <Navbar />

      <main className="container mx-auto px-4 pt-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Hidden on mobile/tablet */}
          <div className="hidden lg:block col-span-3">
            <LeftSidebar />
          </div>

          {/* Main Feed - Full width on mobile, 6 cols on desktop */}
          <div className="col-span-12 lg:col-span-6">
            <div className="flex items-center justify-between border-b border-zinc-800 mb-6 pr-2">
              {user ? (
                <div className="flex flex-1">
                  <button
                    onClick={() => { setError(null); setActiveTab('for-you'); }}
                    className={`flex-1 py-3 text-center font-bold text-sm transition-colors relative ${
                      activeTab === 'for-you' && !error ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    For You
                    {activeTab === 'for-you' && !error && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-500 rounded-full" />
                    )}
                  </button>
                  <button
                    onClick={() => { setError(null); setActiveTab('following'); }}
                    className={`flex-1 py-3 text-center font-bold text-sm transition-colors relative ${
                      activeTab === 'following' && !error ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Following
                    {activeTab === 'following' && !error && (
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-500 rounded-full" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="py-3 text-sm font-bold text-zinc-400">Explore Feed</div>
              )}
              
              <button
                onClick={handleTriggerTestError}
                className="text-[10px] text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-red-500/25 px-2 py-1 rounded transition-all active:scale-95 cursor-pointer font-medium"
                title="Simulate a feed loading error to test the interface"
              >
                Simulate Error
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-8 my-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-center shadow-xl backdrop-blur-sm animate-in fade-in duration-300">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full mb-4 text-red-500 animate-pulse">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Something Went Wrong</h3>
                <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">
                  {error === 'TEST_ERROR' 
                    ? "This is a simulated test error. You can click 'Try Again' below to reload the actual feed." 
                    : error}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={fetchFeed}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-950/20 active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Try Again</span>
                  </button>
                  <button
                    onClick={handleTriggerTestError}
                    className="px-5 py-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 font-semibold rounded-xl transition-all border border-zinc-700/40 active:scale-95 cursor-pointer"
                  >
                    Simulate Again
                  </button>
                </div>
              </div>
            ) : (
              <Feed initialItems={posts} />
            )}
          </div>

          {/* Right Sidebar - Hidden on mobile/tablet */}
          <div className="hidden lg:block col-span-3">
            <RightSidebar />
          </div>
        </div>
      </main>
    </div>
  );
}
