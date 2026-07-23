import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/useTranslation';
import GameCarousel, { CarouselGame } from '@/components/GameCarousel';

interface RecommendedGamesProps {
    username?: string;
}

export default function RecommendedGames({ username }: RecommendedGamesProps) {
    const { t } = useTranslation();
    const [games, setGames] = useState<CarouselGame[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const fetchGames = async (forceRefresh = false) => {
        if (!username) {
            setLoading(false);
            return;
        }
        try {
            const cacheKey = `recommended_games_${username}_all`;
            if (!forceRefresh) {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        const cachedGames = parsed.games || parsed; // Fallback for old cache format
                        const timestamp = parsed.timestamp || 0;
                        const isExpired = Date.now() - timestamp > 1000 * 60 * 60; // 1 hour expiration

                        // Only use cache if it actually contains games and is not expired
                        if (!isExpired && cachedGames && cachedGames.length > 0) {
                            // Check if all covers are null (legacy cache), force refresh if so
                            const hasCovers = cachedGames.some((g: any) => g.cover_image !== null);
                            if (hasCovers || cachedGames.length === 0) {
                                setGames(cachedGames);
                                setLoading(false);
                                return;
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse cached games', e);
                    }
                }
            }
            if (forceRefresh) setIsRefreshing(true);
            const res = await api.get(`/users/${username}/recommended-games/`);
            setGames(res.data);

            // Save in the new standardized format shared with the RecommendedGamesPage
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                games: res.data
            }));
        } catch (err) {
            console.error("Failed to fetch recommended games", err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        fetchGames();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [username]);

    return (
        <div className="mt-6">
            <GameCarousel
                title={t('youMightLikeThese')}
                games={games}
                loading={loading}
                loadingLabel={t('loadingRecommendations')}
                onRefresh={() => fetchGames(true)}
                isRefreshing={isRefreshing}
                showMoreHref={username ? `/${username}/recommended` : undefined}
                showMoreLabel={t('showMore')}
            />
        </div>
    );
}
