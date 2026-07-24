'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import RightSidebar from "@/components/RightSidebar";
import Feed from "@/components/Feed";
import FeedSkeleton from "@/components/skeletons/FeedSkeleton";
import { fetcher } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/lib/useTranslation';
import { FeedItem } from '@/types';

interface HomeClientProps {
  // Server-rendered first page of the for-you feed (null if the server-side fetch failed
  // or the visitor has no session) — handed to SWR as fallbackData so first paint already
  // has content instead of a spinner.
  initialFeed: FeedItem[] | null;
}

export default function HomeClient({ initialFeed }: HomeClientProps) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'for-you' | 'following'>('for-you');

  const feedKey = activeTab === 'following' ? '/feed/following/' : '/feed/for-you/';
  const { data: posts, error, isLoading, mutate } = useSWR<FeedItem[]>(feedKey, fetcher, {
    fallbackData: activeTab === 'for-you' && initialFeed ? initialFeed : undefined,
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
      <Navbar />

      <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Hidden on mobile/tablet */}
          <div className="hidden lg:block col-span-3">
            <LeftSidebar />
          </div>

          {/* Main Feed - Full width on mobile, 6 cols on desktop */}
          <div className="col-span-12 lg:col-span-6">
            {user ? (
              <div className="flex border-b border-zinc-800 mb-6">
                <button
                  onClick={() => setActiveTab('for-you')}
                  className={`flex-1 py-3 text-center font-bold text-sm transition-colors relative ${
                    activeTab === 'for-you' && !error ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t('forYou')}
                  {activeTab === 'for-you' && !error && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('following')}
                  className={`flex-1 py-3 text-center font-bold text-sm transition-colors relative ${
                    activeTab === 'following' && !error ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t('following')}
                  {activeTab === 'following' && !error && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-emerald-500 rounded-full" />
                  )}
                </button>
              </div>
            ) : (
              <div className="py-3 text-sm font-bold text-zinc-400 border-b border-zinc-800 mb-6">{t('exploreFeed')}</div>
            )}

            {isLoading && !posts ? (
              <FeedSkeleton />
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-8 my-6 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl text-center shadow-xl backdrop-blur-sm animate-in fade-in duration-300">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-full mb-4 text-red-500 animate-pulse">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{t('somethingWentWrong')}</h3>
                <p className="text-zinc-400 text-sm max-w-sm mb-6 leading-relaxed">
                  {t('failedToLoadFeed') || 'Failed to load feed. Please try again later.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => mutate()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-950/20 active:scale-95 cursor-pointer"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>{t('tryAgain')}</span>
                  </button>
                </div>
              </div>
            ) : (
              <Feed initialItems={posts ?? []} />
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
