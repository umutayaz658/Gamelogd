'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import api from '@/lib/api';
import { ExternalLink, Calendar, Newspaper } from 'lucide-react';

interface NewsItem {
    id: number;
    title: string;
    link: string;
    image_url: string | null;
    description: string;
    pub_date: string;
    category: string;
    source_name: string;
    source_icon: string | null;
}

const CATEGORIES = [
    { id: 'all', label: 'All News' },
    { id: 'invest', label: 'Industry & Invest' },
    { id: 'devs', label: 'Development' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'general', label: 'General' },
];

export default function NewsPage() {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('all');

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            try {
                const params = activeCategory === 'all' ? {} : { category: activeCategory };
                const res = await api.get('/news/', { params });
                setNews(res.data);
            } catch (err) {
                console.error("Failed to fetch news:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, [activeCategory]);

    const heroNews = news.slice(0, 3);
    const gridNews = news.slice(3);

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-20">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar - Hidden on mobile/tablet */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-9 space-y-8">

                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <h1 className="text-3xl font-bold flex items-center gap-2">
                                <Newspaper className="text-emerald-500 h-8 w-8" />
                                Game News
                            </h1>
                            <div className="text-sm text-zinc-500">
                                Powered by Gamelogd RSS
                            </div>
                        </div>

                        {/* Hero Section */}
                        {!loading && heroNews.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[400px]">
                                {/* Main Hero */}
                                <div className="md:col-span-2 relative group rounded-2xl overflow-hidden border border-zinc-800">
                                    <img
                                        src={heroNews[0].image_url || "/placeholder-news.jpg"}
                                        alt={heroNews[0].title}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent p-6 flex flex-col justify-end">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                                {heroNews[0].category}
                                            </span>
                                            <span className="text-zinc-300 text-xs flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(heroNews[0].pub_date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <a href={heroNews[0].link} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
                                            <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-2 line-clamp-2">
                                                {heroNews[0].title}
                                            </h2>
                                        </a>
                                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                                            {heroNews[0].source_icon && <img src={heroNews[0].source_icon} className="w-4 h-4 rounded-full" />}
                                            <span>{heroNews[0].source_name}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Side Hero Stack */}
                                <div className="grid grid-rows-2 gap-6 h-full">
                                    {heroNews.slice(1, 3).map((item) => (
                                        <div key={item.id} className="relative group rounded-2xl overflow-hidden border border-zinc-800">
                                            <img
                                                src={item.image_url || "/placeholder-news.jpg"}
                                                alt={item.title}
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent p-4 flex flex-col justify-end">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-zinc-800 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase border border-zinc-700">
                                                        {item.category}
                                                    </span>
                                                </div>
                                                <a href={item.link} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 transition-colors">
                                                    <h3 className="text-lg font-bold leading-tight mb-1 line-clamp-2">
                                                        {item.title}
                                                    </h3>
                                                </a>
                                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                    <span>{item.source_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Category Tabs */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-zinc-800">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`
                                        px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                                        ${activeCategory === cat.id
                                            ? 'bg-white text-black'
                                            : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}
                                    `}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>

                        {/* News Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <span className="loading-spinner text-emerald-500">Loading news...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {gridNews.map((item) => (
                                    <div key={item.id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden hover:border-zinc-700 transition-colors flex flex-col group">
                                        <div className="relative h-48 overflow-hidden">
                                            <img
                                                src={item.image_url || "/placeholder-news.jpg"}
                                                alt={item.title}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                            />
                                            <div className="absolute top-3 left-3">
                                                <span className="bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded-md font-medium border border-white/10">
                                                    {item.category}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-5 flex-1 flex flex-col">
                                            <div className="flex items-center gap-2 text-xs text-zinc-400 mb-3">
                                                {item.source_icon && <img src={item.source_icon} className="w-4 h-4 rounded-full" />}
                                                <span className="font-medium text-zinc-300">{item.source_name}</span>
                                                <span>•</span>
                                                <span>{new Date(item.pub_date).toLocaleDateString()}</span>
                                            </div>
                                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="block mb-3 group-hover:text-emerald-400 transition-colors">
                                                <h3 className="text-xl font-bold leading-snug line-clamp-2">
                                                    {item.title}
                                                </h3>
                                            </a>
                                            <p className="text-zinc-400 text-sm line-clamp-3 mb-4 flex-1">
                                                {item.description.replace(/<[^>]*>/g, '').replace('...', '')}
                                            </p>
                                            <a
                                                href={item.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 text-sm text-emerald-500 font-medium hover:text-emerald-400 mt-auto"
                                            >
                                                Read Article <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!loading && news.length === 0 && (
                            <div className="text-center py-20 text-zinc-500">
                                No news found for this category.
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
