'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
import useSWR from 'swr';
import api, { fetcher } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import { useToast } from '@/context/ToastContext';
import { trackEvent } from '@/lib/analytics';
import { getImageUrl, formatHandle, isUnreachableForImageOptimizer } from '@/lib/utils';
import { User } from '@/types';

interface WhoToFollowRailProps {
    // 'vertical' mirrors RightSidebar's other widgets (stacked rows, narrow column).
    // 'horizontal' is the scrollable card rail — used inline in the Following empty state,
    // where there's a full feed-column's width to work with.
    layout?: 'vertical' | 'horizontal';
    limit?: number;
    className?: string;
}

export default function WhoToFollowRail({ layout = 'vertical', limit = 6, className = '' }: WhoToFollowRailProps) {
    const { user } = useAuth();
    const { t } = useTranslation();
    const toast = useToast();
    const scrollRef = useRef<HTMLDivElement>(null);

    const key = user ? `/users/suggested/?limit=${limit}` : null;
    const { data, isLoading } = useSWR<User[]>(key, fetcher, {
        dedupingInterval: 5 * 60 * 1000,
        revalidateOnFocus: false,
    });

    const [followedIds, setFollowedIds] = useState<Set<number>>(new Set());

    // A real toggle — same pattern as FollowersFollowingModal's handleFollowToggle. Cards
    // stay in the rail after following (no auto-removal): clicking again genuinely unfollows
    // and the button reverts to "Follow".
    const handleFollowToggle = async (target: User) => {
        const wasFollowed = followedIds.has(target.id);
        setFollowedIds(prev => {
            const next = new Set(prev);
            if (wasFollowed) next.delete(target.id); else next.add(target.id);
            return next;
        });
        try {
            if (wasFollowed) {
                await api.post(`/users/${target.username}/unfollow/`);
            } else {
                await api.post(`/users/${target.username}/follow/`);
                trackEvent('follow', { target_type: 'user' });
            }
        } catch (error) {
            console.error('Failed to toggle follow:', error);
            toast.error(t('somethingWentWrong'));
            setFollowedIds(prev => {
                const next = new Set(prev);
                if (wasFollowed) next.add(target.id); else next.delete(target.id);
                return next;
            });
        }
    };

    const scrollByAmount = (dx: number) => {
        scrollRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
    };

    // Nothing to show once loaded empty (everyone's already followed, or a cold Postgres
    // with too few users) — no point rendering an empty widget/rail.
    if (!user || (!isLoading && (!data || data.length === 0))) return null;

    const users = data ?? [];

    const userCard = (target: User, compact: boolean) => {
        const isFollowed = followedIds.has(target.id);
        return (
            <div
                key={target.id}
                className={compact
                    ? 'flex items-center gap-3'
                    : 'flex-shrink-0 w-40 flex flex-col items-center text-center bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 snap-start'}
            >
                <Link href={`/${target.username}`} className={compact ? 'flex items-center gap-3 flex-1 min-w-0' : 'flex flex-col items-center gap-2'}>
                    <div className={compact ? 'h-10 w-10 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0' : 'h-16 w-16 rounded-full overflow-hidden bg-zinc-800'}>
                        <Image
                            src={getImageUrl(target.avatar, target.username)}
                            alt={target.username}
                            width={compact ? 40 : 64}
                            height={compact ? 40 : 64}
                            unoptimized={isUnreachableForImageOptimizer(getImageUrl(target.avatar, target.username))}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className={compact ? 'min-w-0' : 'w-full'}>
                        <p className="font-bold text-white text-sm truncate">{target.real_name || target.username}</p>
                        <p className="text-zinc-500 text-xs truncate">{formatHandle(target.username)}</p>
                    </div>
                </Link>
                <button
                    onClick={() => handleFollowToggle(target)}
                    className={`${compact ? '' : 'mt-3 w-full'} flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        isFollowed
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-red-500/10 hover:text-red-400'
                            : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                >
                    {isFollowed ? t('unfollow') : t('follow')}
                </button>
            </div>
        );
    };

    if (layout === 'vertical') {
        return (
            <div className={`bg-zinc-900 rounded-2xl border border-zinc-800 p-4 flex-shrink-0 ${className}`}>
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-emerald-500" />
                    {t('whoToFollow')}
                </h2>
                <div className="flex flex-col gap-4">
                    {users.map(u => userCard(u, true))}
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-emerald-500" />
                    {t('whoToFollow')}
                </h2>
                <div className="hidden sm:flex gap-1">
                    <button
                        onClick={() => scrollByAmount(-320)}
                        className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => scrollByAmount(320)}
                        className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 transition-colors"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent pb-2"
            >
                {users.map(u => userCard(u, false))}
            </div>
        </div>
    );
}
