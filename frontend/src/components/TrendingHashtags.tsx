'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import api from '@/lib/api';
import { formatCount } from '@/lib/utils';
import { useTranslation } from '@/lib/useTranslation';

interface TrendingHashtag {
    tag: string;
    count: number;
}

export default function TrendingHashtags() {
    const { t } = useTranslation();
    const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);

    useEffect(() => {
        api.get('/explore/trending-hashtags/')
            .then(res => setHashtags(res.data.results || []))
            .catch(() => setHashtags([]));
    }, []);

    if (hashtags.length === 0) return null;

    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                {t('trendingHashtags')}
            </h2>
            <div className="flex flex-col divide-y divide-zinc-800/60">
                {hashtags.map(({ tag, count }) => (
                    <Link
                        key={tag}
                        href={`/explore?hashtag=${tag}`}
                        className="group block -mx-4 px-4 py-2.5 hover:bg-zinc-800/50 transition-colors"
                    >
                        <p className="text-sm font-bold text-emerald-500 group-hover:text-emerald-400 transition-colors">
                            {`#${tag}`}
                        </p>
                        <p className="text-xs text-zinc-500">
                            {t('postsCount').replace('{count}', formatCount(count))}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
