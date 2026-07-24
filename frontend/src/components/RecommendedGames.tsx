import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useTranslation } from '@/lib/useTranslation';
import GameCarousel, { CarouselGame } from '@/components/GameCarousel';

interface RecommendedGamesProps {
    username?: string;
}

export default function RecommendedGames({ username }: RecommendedGamesProps) {
    const { t } = useTranslation();
    const key = username ? `/users/${username}/recommended-games/` : null;
    // dedupingInterval mirrors the backend's own 600s cache TTL (see UserViewSet.recommended_games)
    // — SWR's cache supersedes the old hand-rolled localStorage cache entirely.
    const { data, isLoading, isValidating, mutate } = useSWR<CarouselGame[]>(key, fetcher, {
        dedupingInterval: 10 * 60 * 1000,
        revalidateOnFocus: false,
    });

    const handleRefresh = () => {
        if (!key) return;
        // ?refresh=1 bypasses the backend's cache too, so "refresh" actually gets a new
        // random sample instead of replaying the same cached response for up to 10 minutes.
        mutate(fetcher(`${key}?refresh=1`), { revalidate: false });
    };

    return (
        <div className="mt-6">
            <GameCarousel
                title={t('youMightLikeThese')}
                games={data ?? []}
                loading={isLoading}
                loadingLabel={t('loadingRecommendations')}
                onRefresh={handleRefresh}
                isRefreshing={isValidating}
                showMoreHref={username ? `/${username}/recommended` : undefined}
                showMoreLabel={t('showMore')}
            />
        </div>
    );
}
