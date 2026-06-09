'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import Feed from "@/components/Feed";
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeed = async () => {
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
    };

    fetchFeed();
  }, [activeTab]);

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
            {user && (
              <div className="flex border-b border-zinc-800 mb-4">
                <button
                  onClick={() => setActiveTab('for-you')}
                  className={`flex-1 py-3 text-center font-bold text-sm transition-colors relative ${
                    activeTab === 'for-you' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  For You
                  {activeTab === 'for-you' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('following')}
                  className={`flex-1 py-3 text-center font-bold text-sm transition-colors relative ${
                    activeTab === 'following' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Following
                  {activeTab === 'following' && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-500 rounded-full" />
                  )}
                </button>
              </div>
            )}
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-center">
                {error}
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
