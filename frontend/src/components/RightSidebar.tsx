import { TrendingUp, ArrowUpRight } from 'lucide-react';

export default function RightSidebar() {
    const trendingNews = [
        {
            id: 1,
            title: "GTA VI Leaks: New Map Details Revealed",
            views: "1.2M views",
            time: "2h ago"
        },
        {
            id: 2,
            title: "Indie Game Awards 2025 Nominees Announced",
            views: "850K views",
            time: "4h ago"
        },
        {
            id: 3,
            title: "Steam Deck 2 Release Date Rumors",
            views: "500K views",
            time: "6h ago"
        },
        {
            id: 4,
            title: "Cyberpunk 2077: New DLC Expansion Teaser",
            views: "2.1M views",
            time: "12h ago"
        }
    ];

    return (
        <div className="hidden lg:block sticky top-20">
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                        Trending News
                    </h2>
                </div>

                <div className="flex flex-col gap-4">
                    {trendingNews.map((news) => (
                        <div key={news.id} className="group cursor-pointer">
                            <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-medium text-zinc-200 group-hover:text-emerald-400 transition-colors line-clamp-2">
                                    {news.title}
                                </h3>
                                <ArrowUpRight className="h-4 w-4 text-zinc-600 group-hover:text-emerald-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-zinc-500">{news.time}</span>
                                <span className="text-zinc-700">•</span>
                                <span className="text-xs text-zinc-500">{news.views}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <button className="w-full mt-4 py-2 text-sm text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all font-medium">
                    Show more
                </button>
            </div>
        </div>
    );
}
