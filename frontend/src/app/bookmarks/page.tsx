'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import Feed from "@/components/Feed";
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Bookmark } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import { FeedItem } from '@/types';

export default function BookmarksPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If not authenticated, redirect
    if (!user && !loading) {
       router.push('/login');
       return;
    }

    const fetchBookmarks = async () => {
      try {
        const res = await api.get('/bookmarks/');
        const bookmarkedItems = res.data.map((b: any) => {
            if (b.post_details) return { ...b.post_details, type: 'post' };
            if (b.review_details) return { ...b.review_details, type: 'review' };
            // Since we don't have NewsCard in Feed currently, we might just pass news if Feed supports it
            // or just render posts and reviews
            if (b.news_details) return { ...b.news_details, type: 'news' };
            return null;
        }).filter(Boolean);

        setItems(bookmarkedItems);
      } catch (err) {
        console.error('Failed to fetch bookmarks:', err);
        setError(t('failedToLoadBookmarks'));
      } finally {
        setLoading(false);
      }
    };

    if (user) {
        fetchBookmarks();
    }
  }, [user, router]);

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
            <div className="mb-4 flex items-center gap-3 pb-4 border-b border-zinc-800">
                <Bookmark className="h-6 w-6 text-emerald-500" />
                <h1 className="text-2xl font-bold">{t('bookmarks')}</h1>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-center">
                {error}
              </div>
            ) : items.length === 0 ? (
                <div className="text-center text-zinc-500 py-12 bg-zinc-900/50 rounded-2xl border border-zinc-800">
                    <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>{t('noBookmarksYet')}</p>
                </div>
            ) : (
              <Feed initialItems={items} hideComposer={true} />
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
