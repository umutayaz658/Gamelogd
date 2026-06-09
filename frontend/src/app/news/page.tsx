'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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

import { useRouter } from 'next/navigation';

export default function NewsPage() {
    const router = useRouter();
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
    const [ordering, setOrdering] = useState<'newest' | 'oldest'>('newest');
    const [currentPage, setCurrentPage] = useState(1);
    const [isSortOpen, setIsSortOpen] = useState(false);

    const filterRef = useRef<HTMLDivElement>(null);
    const isFirstMount = useRef(true);

    // Custom smooth scroll with ease-in-out physics
    const smoothScrollTo = (targetY: number, duration: number = 700) => {
        const startY = window.scrollY;
        const difference = targetY - startY;
        let startTime: number | null = null;

        const easeInOutQuad = (t: number, b: number, c: number, d: number) => {
            t /= d / 2;
            if (t < 1) return c / 2 * t * t + b;
            t--;
            return -c / 2 * (t * (t - 2) - 1) + b;
        };

        const animateScroll = (timestamp: number) => {
            if (startTime === null) startTime = timestamp;
            const timeElapsed = timestamp - startTime;
            const nextY = easeInOutQuad(timeElapsed, startY, difference, duration);

            window.scrollTo(0, nextY);

            if (timeElapsed < duration) {
                requestAnimationFrame(animateScroll);
            } else {
                window.scrollTo(0, targetY);
            }
        };

        requestAnimationFrame(animateScroll);
    };

    // Load page query parameter on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const pageParam = params.get('page');
        if (pageParam) {
            const parsedPage = parseInt(pageParam, 10);
            if (!isNaN(parsedPage) && parsedPage > 0) {
                setCurrentPage(parsedPage);
            }
        }
    }, []);

    useEffect(() => {
        const fetchNews = async () => {
            setLoading(true);
            try {
                const res = await api.get('/news/');
                setNews(res.data);
            } catch (err) {
                console.error("Failed to fetch news:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

    // Outside click detection for custom sort dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const dropdown = document.getElementById('sort-dropdown');
            if (dropdown && !dropdown.contains(event.target as Node)) {
                setIsSortOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Smooth scroll to news grid when page changes (ignoring first mount)
    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            return;
        }
        if (filterRef.current) {
            const rect = filterRef.current.getBoundingClientRect();
            const targetY = window.scrollY + rect.top - 20; // 20px offset
            smoothScrollTo(targetY, 700);
        }
    }, [currentPage]);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        const url = new URL(window.location.href);
        url.searchParams.set('page', page.toString());
        window.history.pushState({}, '', url.toString());
    };

    const handleCategoryClick = (catId: string) => {
        if (catId === 'all') {
            setSelectedCategories(['all']);
        } else {
            let newSelection = selectedCategories.filter(c => c !== 'all');
            if (newSelection.includes(catId)) {
                newSelection = newSelection.filter(c => c !== catId);
            } else {
                newSelection.push(catId);
            }

            if (newSelection.length === 0) {
                setSelectedCategories(['all']);
            } else {
                setSelectedCategories(newSelection);
            }
        }
        handlePageChange(1);
    };

    const filteredAndSortedNews = useMemo(() => {
        let result = [...news];

        if (!selectedCategories.includes('all')) {
            result = result.filter(item => selectedCategories.includes(item.category));
        }

        result.sort((a, b) => {
            const dateA = new Date(a.pub_date).getTime();
            const dateB = new Date(b.pub_date).getTime();
            return ordering === 'newest' ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [news, selectedCategories, ordering]);

    const heroNews = useMemo(() => {
        return filteredAndSortedNews.slice(0, 3);
    }, [filteredAndSortedNews]);

    const gridNews = useMemo(() => {
        const start = 3 + (currentPage - 1) * 20;
        const end = start + 20;
        return filteredAndSortedNews.slice(start, end);
    }, [filteredAndSortedNews, currentPage]);

    const totalPages = useMemo(() => {
        const totalGridItems = Math.max(0, filteredAndSortedNews.length - 3);
        return Math.ceil(totalGridItems / 20);
    }, [filteredAndSortedNews]);

    const handleCardClick = (id: number) => {
        router.push(`/news/${id}`);
    };

    const handleExternalLink = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

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
                                <div onClick={() => handleCardClick(heroNews[0].id)} className="md:col-span-2 relative group rounded-2xl overflow-hidden border border-zinc-800 cursor-pointer block">
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
                                        <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-2 line-clamp-2 hover:text-emerald-400 transition-colors">
                                            {heroNews[0].title}
                                        </h2>
                                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                                            {heroNews[0].source_icon && <img src={heroNews[0].source_icon} className="w-4 h-4 rounded-full" />}
                                            <span>{heroNews[0].source_name}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Side Hero Stack */}
                                <div className="grid grid-rows-2 gap-6 h-full">
                                    {heroNews.slice(1, 3).map((item) => (
                                        <div key={item.id} onClick={() => handleCardClick(item.id)} className="relative group rounded-2xl overflow-hidden border border-zinc-800 cursor-pointer block">
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
                                                <h3 className="text-lg font-bold leading-tight mb-1 line-clamp-2 hover:text-emerald-400 transition-colors">
                                                    {item.title}
                                                </h3>
                                                <div className="flex items-center gap-2 text-xs text-zinc-400">
                                                    <span>{item.source_name}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Filters & Sorting */}
                        <div ref={filterRef} className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                            {/* Category Tabs (Multi-Select) */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                                {CATEGORIES.map(cat => {
                                    const isSelected = cat.id === 'all'
                                        ? selectedCategories.includes('all')
                                        : selectedCategories.includes(cat.id);
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => handleCategoryClick(cat.id)}
                                            className={`
                                                px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                                                ${isSelected
                                                    ? 'bg-emerald-500 text-black font-bold'
                                                    : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}
                                            `}
                                        >
                                            {cat.label}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Date Ordering Custom Selector */}
                            <div className="flex items-center gap-3 relative" id="sort-dropdown">
                                <span className="text-sm text-zinc-500">Sort by:</span>
                                <button
                                    onClick={() => setIsSortOpen(!isSortOpen)}
                                    className="flex items-center justify-between gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 text-sm text-white hover:border-zinc-700 hover:text-emerald-400 transition-all focus:outline-none focus:border-emerald-500 min-w-[140px]"
                                >
                                    <span>{ordering === 'newest' ? 'Newest First' : 'Oldest First'}</span>
                                    <svg
                                        className={`w-4 h-4 text-zinc-400 transition-transform ${isSortOpen ? 'rotate-180 text-emerald-500' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {isSortOpen && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                        <button
                                            onClick={() => {
                                                setOrdering('newest');
                                                handlePageChange(1);
                                                setIsSortOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-855 ${
                                                ordering === 'newest' ? 'text-emerald-500 font-bold bg-emerald-500/5' : 'text-zinc-300 hover:text-white'
                                            }`}
                                        >
                                            Newest First
                                        </button>
                                        <button
                                            onClick={() => {
                                                setOrdering('oldest');
                                                handlePageChange(1);
                                                setIsSortOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-855 ${
                                                ordering === 'oldest' ? 'text-emerald-500 font-bold bg-emerald-500/5' : 'text-zinc-300 hover:text-white'
                                            }`}
                                        >
                                            Oldest First
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* News Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <span className="loading-spinner text-emerald-500">Loading news...</span>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {gridNews.map((item) => (
                                        <div key={item.id} onClick={() => handleCardClick(item.id)} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden hover:border-zinc-700 transition-colors flex flex-col group cursor-pointer block">
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
                                                <h3 className="text-xl font-bold leading-snug line-clamp-2 mb-3 group-hover:text-emerald-400 transition-colors">
                                                    {item.title}
                                                </h3>
                                                <p className="text-zinc-400 text-sm line-clamp-3 mb-4 flex-1">
                                                    {item.description.replace(/<[^>]*>/g, '').replace('...', '')}
                                                </p>
                                                <a
                                                    href={item.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={handleExternalLink}
                                                    className="inline-flex items-center gap-2 text-sm text-emerald-500 font-medium hover:text-emerald-400 mt-auto w-fit"
                                                >
                                                    Read Article <ExternalLink className="h-4 w-4" />
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center flex-wrap gap-2 mt-12">
                                        <button
                                            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-medium hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:hover:bg-zinc-900 transition-colors"
                                        >
                                            Previous
                                        </button>
                                        
                                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                            <button
                                                key={page}
                                                onClick={() => handlePageChange(page)}
                                                className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
                                                    currentPage === page
                                                        ? 'bg-emerald-500 text-black font-bold'
                                                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-medium hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:hover:bg-zinc-900 transition-colors"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                        {!loading && filteredAndSortedNews.length === 0 && (
                            <div className="text-center py-20 text-zinc-500">
                                No news found for this category selection.
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
