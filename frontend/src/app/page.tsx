'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import Feed from "@/components/Feed";
import api from '@/lib/api';

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await api.get('/posts/');
        setPosts(response.data);
      } catch (err) {
        console.error('Failed to fetch posts:', err);
        setError('Failed to load posts. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

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
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-center">
                {error}
              </div>
            ) : (
              <Feed initialPosts={posts} />
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
