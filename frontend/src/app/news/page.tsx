'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import FilterDropdown from "@/components/FilterDropdown";
import { ExternalLink, Calendar, Newspaper, Search } from 'lucide-react';

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
    { id: 'all', key: 'catAllNews' as const },
    { id: 'invest', key: 'catIndustryInvest' as const },
    { id: 'devs', key: 'catDevelopment' as const },
    { id: 'hardware', key: 'catHardware' as const },
    { id: 'general', key: 'catGeneral' as const },
];

import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/useTranslation';
import api from '@/lib/api';

export default function NewsPage() {
    const router = useRouter();
    const { t } = useTranslation();

    const getTranslatedCategory = (cat: string) => {
        const lower = cat.toLowerCase();
        if (lower === 'invest') return t('catIndustryInvest');
        if (lower === 'devs') return t('catDevelopment');
        if (lower === 'hardware') return t('catHardware');
        if (lower === 'general') return t('catGeneral');
        return cat;
    };
    const [news, setNews] = useState<NewsItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
    const [ordering, setOrdering] = useState<'newest' | 'oldest'>('newest');
    const [currentPage, setCurrentPage] = useState(1);

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

    const categoryFilteredNews = useMemo(() => {
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
        return categoryFilteredNews.slice(0, 3);
    }, [categoryFilteredNews]);

    const searchFilteredNews = useMemo(() => {
        if (searchQuery.trim() === '') {
            return categoryFilteredNews;
        }
        const query = searchQuery.toLowerCase();
        return categoryFilteredNews.filter(item =>
            item.title.toLowerCase().includes(query) ||
            (item.description && item.description.toLowerCase().includes(query))
        );
    }, [categoryFilteredNews, searchQuery]);

    const gridNews = useMemo(() => {
        const isSearchActive = searchQuery.trim() !== '';
        const start = isSearchActive ? (currentPage - 1) * 20 : 3 + (currentPage - 1) * 20;
        const end = start + 20;
        return searchFilteredNews.slice(start, end);
    }, [searchFilteredNews, searchQuery, currentPage]);

    const totalPages = useMemo(() => {
        const isSearchActive = searchQuery.trim() !== '';
        const totalGridItems = isSearchActive 
            ? searchFilteredNews.length 
            : Math.max(0, categoryFilteredNews.length - 3);
        return Math.ceil(totalGridItems / 20);
    }, [categoryFilteredNews, searchFilteredNews, searchQuery]);

    const pageNumbers = useMemo(() => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);
            
            let start = Math.max(2, currentPage - 1);
            let end = Math.min(totalPages - 1, currentPage + 1);
            
            if (currentPage <= 3) {
                end = 4;
            } else if (currentPage >= totalPages - 2) {
                start = totalPages - 3;
            }
            
            if (start > 2) {
                pages.push('...');
            }
            
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            
            if (end < totalPages - 1) {
                pages.push('...');
            }
            
            pages.push(totalPages);
        }
        return pages;
    }, [currentPage, totalPages]);

    const handleCardClick = (id: number) => {
        router.push(`/news/${id}`);
    };

    const handleExternalLink = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6 pb-20">
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
                                {t('gameNews')}
                            </h1>
                        </div>

                        {/* Hero Section */}
                        {!loading && heroNews.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                                {/* Main Hero */}
                                <div onClick={() => handleCardClick(heroNews[0].id)} className="md:col-span-2 relative group rounded-2xl overflow-hidden border border-zinc-800 cursor-pointer block h-56 md:h-[400px]">
                                    <img
                                        src={heroNews[0].image_url || "/placeholder-news.jpg"}
                                        alt={heroNews[0].title}
                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent p-6 flex flex-col justify-end">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-emerald-600 text-white text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                                {getTranslatedCategory(heroNews[0].category)}
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

                                {/* Side Hero Stack — side-by-side on mobile, stacked on md+ */}
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:grid-rows-2 md:gap-6 md:h-[400px]">
                                    {heroNews.slice(1, 3).map((item) => (
                                        <div key={item.id} onClick={() => handleCardClick(item.id)} className="relative group rounded-2xl overflow-hidden border border-zinc-800 cursor-pointer block h-32 md:h-auto">
                                            <img
                                                src={item.image_url || "/placeholder-news.jpg"}
                                                alt={item.title}
                                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent p-4 flex flex-col justify-end">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="bg-zinc-800 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase border border-zinc-700">
                                                        {getTranslatedCategory(item.category)}
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
                        <div ref={filterRef} className="flex flex-col gap-4 border-b border-zinc-800 pb-4">
                            {/* Mobile row: Search (always fully open, fills remaining space) + Sort */}
                            <div className="flex lg:hidden items-center gap-2">
                                <div className="relative flex-1 min-w-0">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Search className="h-4 w-4 text-zinc-500" />
                                    </span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            handlePageChange(1);
                                        }}
                                        placeholder={t('searchNewsPlaceholder')}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-10 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-medium"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => {
                                                setSearchQuery('');
                                                handlePageChange(1);
                                            }}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                <FilterDropdown
                                    label={t('sortBy')}
                                    options={[
                                        { value: 'newest', label: t('newestFirst') },
                                        { value: 'oldest', label: t('oldestFirst') },
                                    ]}
                                    value={ordering}
                                    onChange={(v) => { setOrdering(v as 'newest' | 'oldest'); handlePageChange(1); }}
                                    showAllOption={false}
                                    showSelectionAccent={false}
                                    align="right"
                                />
                            </div>

                            {/* Desktop row: Search (fixed, always visible) + Sort */}
                            <div className="hidden lg:flex lg:items-center justify-between gap-4">
                                {/* Search Bar */}
                                <div className="relative flex-1 max-w-md">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                        <Search className="h-4 w-4 text-zinc-500" />
                                    </span>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            handlePageChange(1);
                                        }}
                                        placeholder={t('searchNewsPlaceholder')}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-10 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all font-medium"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => {
                                                setSearchQuery('');
                                                handlePageChange(1);
                                            }}
                                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                <FilterDropdown
                                    label={t('sortBy')}
                                    options={[
                                        { value: 'newest', label: t('newestFirst') },
                                        { value: 'oldest', label: t('oldestFirst') },
                                    ]}
                                    value={ordering}
                                    onChange={(v) => { setOrdering(v as 'newest' | 'oldest'); handlePageChange(1); }}
                                    showAllOption={false}
                                    showSelectionAccent={false}
                                    align="right"
                                />
                            </div>

                            {/* Category Tabs (Multi-Select) */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
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
                                            {t(cat.key)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* News Grid */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <span className="loading-spinner text-emerald-500">{t('loadingNews')}</span>
                            </div>
                        ) : (
                            <>
                                {/* Mobile: compact horizontal list cards */}
                                <div className="grid grid-cols-1 gap-3 lg:hidden">
                                    {gridNews.map((item) => (
                                        <div key={item.id} onClick={() => handleCardClick(item.id)} className="flex gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800 active:bg-zinc-800/50 transition-colors cursor-pointer">
                                            <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                                                <img
                                                    src={item.image_url || "/placeholder-news.jpg"}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                <div>
                                                    <span className="text-[10px] font-bold uppercase text-emerald-500">
                                                        {getTranslatedCategory(item.category)}
                                                    </span>
                                                    <h3 className="text-sm font-bold leading-snug line-clamp-2 mt-0.5">
                                                        {item.title}
                                                    </h3>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
                                                    {item.source_icon && <img src={item.source_icon} className="w-3.5 h-3.5 rounded-full flex-shrink-0" />}
                                                    <span className="truncate">{item.source_name}</span>
                                                    <span className="flex-shrink-0">•</span>
                                                    <span className="flex-shrink-0">{new Date(item.pub_date).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop: large cards with image, description, and external link */}
                                <div className="hidden lg:grid lg:grid-cols-2 gap-6">
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
                                                        {getTranslatedCategory(item.category)}
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
                                                    {t('readFullArticle')} <ExternalLink className="h-4 w-4" />
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
                                            {t('previous')}
                                        </button>
                                        
                                        {pageNumbers.map((page, idx) => {
                                            if (typeof page === 'number') {
                                                return (
                                                    <button
                                                        key={`page-${page}`}
                                                        onClick={() => handlePageChange(page)}
                                                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                                                            currentPage === page
                                                                ? 'bg-emerald-500 text-black font-bold'
                                                                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                                                        }`}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            } else {
                                                return (
                                                    <span
                                                        key={`ellipsis-${idx}`}
                                                        className="w-10 h-10 flex items-center justify-center text-zinc-500 select-none text-sm"
                                                    >
                                                        {page}
                                                    </span>
                                                );
                                            }
                                        })}

                                        <button
                                            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm font-medium hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:hover:bg-zinc-900 transition-colors"
                                        >
                                            {t('next')}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                        {!loading && searchFilteredNews.length === 0 && (
                            <div className="text-center py-20 text-zinc-500">
                                {t('noNewsFound')}
                            </div>
                        ) }
                    </div>
                </div>
            </main>
        </div>
    );
}
