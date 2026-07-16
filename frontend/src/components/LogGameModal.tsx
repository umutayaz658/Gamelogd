'use client';

import { useState, useEffect } from 'react';
import { X, Search, Loader2, ChevronLeft, Calendar, Check, RefreshCw } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';

interface Game {
    id: number;
    title: string;
    cover_image: string;
    release_date: string;
    platforms?: string[];
}

interface LogGameModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialGame?: any;
    existingReview?: any;
    isReplay?: boolean;
}

export default function LogGameModal({ isOpen, onClose, onSuccess, initialGame, existingReview, isReplay }: LogGameModalProps) {
    // State Management
    const { user } = useAuth();
    const { t } = useTranslation();
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedGame, setSelectedGame] = useState<Game | null>(null);

    // Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<Game[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [rating, setRating] = useState(5.0);
    const [content, setContent] = useState('');
    const [isLiked, setIsLiked] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const [containsSpoilers, setContainsSpoilers] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [nextPlaythrough, setNextPlaythrough] = useState(2);
    const [playtimeHours, setPlaytimeHours] = useState<number | ''>('');
    const [selectedPlatform, setSelectedPlatform] = useState<string>('');

    // Reset state on open/close
    useEffect(() => {
        if (!isOpen) {
            setStep(1);
            setSearchTerm('');
            setResults([]);
            setSelectedGame(null);
            setRating(5.0);
            setContent('');
            setIsLiked(false);
            setIsCompleted(false);
            setContainsSpoilers(false);
            setSubmitError(null);
            setPlaytimeHours('');
            setSelectedPlatform('');
        } else if (isReplay && initialGame) {
            // Replay mode: fresh form but with game pre-selected
            setSelectedGame(initialGame);
            setStep(2);
            setRating(5.0);
            setContent('');
            setIsLiked(false);
            setIsCompleted(false);
            setContainsSpoilers(false);
            setPlaytimeHours('');
            setSelectedPlatform('');
            // Fetch how many playthroughs exist to determine next number
            const username = user?.username || '';
            api.get(`/reviews/?game_id=${initialGame.id}&username=${username}`).then(res => {
                const data = res.data.results || res.data;
                const maxPt = data.reduce((max: number, r: any) => Math.max(max, r.playthrough_number || 1), 0);
                setNextPlaythrough(maxPt + 1);
            }).catch(() => setNextPlaythrough(2));
        } else if (existingReview) {
            setSelectedGame(initialGame || existingReview.game);
            setStep(2);
            setRating(existingReview.rating != null ? parseFloat(existingReview.rating) : 5.0);
            setContent(existingReview.content || '');
            setIsLiked(existingReview.is_liked || false);
            setIsCompleted(existingReview.is_completed || false);
            setContainsSpoilers(existingReview.contains_spoilers || false);
        } else if (initialGame) {
            setSelectedGame(initialGame);
            setStep(2);
        }
    }, [isOpen, initialGame, existingReview]);

    // Search Logic
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.trim().length > 1) {
                setLoading(true);
                try {
                    const response = await api.get(`/games/?search=${searchTerm}`);
                    setResults(response.data);
                } catch (error) {
                    console.error("Search failed:", error);
                    setResults([]);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleSelectGame = (game: Game) => {
        setSelectedGame(game);
        setStep(2);
    };

    const handleSubmit = async () => {
        if (!selectedGame) return;
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            const payload: any = {
                game_id: selectedGame.id,
                rating: rating,
                content: content,
                is_liked: isLiked,
                is_completed: isCompleted,
                contains_spoilers: containsSpoilers
            };
            if (playtimeHours !== '') payload.playtime_hours = playtimeHours;
            if (selectedPlatform) payload.platform = selectedPlatform;

            if (isReplay) {
                payload.playthrough_number = nextPlaythrough;
                await api.post('/reviews/', payload);
            } else if (existingReview) {
                await api.patch(`/reviews/${existingReview.id}/`, payload);
            } else {
                await api.post('/reviews/', payload);
            }

            if (onSuccess) onSuccess();
            onClose();
            window.location.reload();
        } catch (error: any) {
            console.error("Failed to submit review:", error);
            if (error.response && error.response.data) {
                // Handle DRF validation errors (which might be list or string)
                const data = error.response.data;
                if (Array.isArray(data)) {
                    setSubmitError(data[0]);
                } else if (typeof data === 'object') {
                    // If it's a field error like {"non_field_errors": ["..."]} or {"detail": "..."}
                    const firstKey = Object.keys(data)[0];
                    const firstError = data[firstKey];
                    if (Array.isArray(firstError)) {
                        setSubmitError(firstError[0]);
                    } else {
                        setSubmitError(String(firstError));
                    }
                } else {
                    setSubmitError("Failed to submit review.");
                }
            } else {
                setSubmitError("An unexpected error occurred.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper for Rating Color
    const getRatingColor = (value: number) => {
        if (value < 5.0) return '#ef4444'; // red-500
        if (value < 8.0) return '#eab308'; // yellow-500
        return '#10b981'; // emerald-500
    };

    const getRatingTextClass = (value: number) => {
        if (value < 5.0) return 'text-red-500';
        if (value < 8.0) return 'text-yellow-500';
        return 'text-emerald-500';
    };

    // CRITICAL FIX: Return null if not open to prevent invisible overlay blocking clicks
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className={`w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-in-out flex flex-col ${step === 1
                    ? 'max-w-lg h-[600px]'
                    : 'max-w-5xl h-[80vh] md:h-[600px] md:flex-row'
                    }`}
            >
                {step === 1 ? (
                    // UI Step 1: Search (Compact)
                    <div className="flex flex-col h-full">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">{t('logAGame')}</h2>
                            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-4 h-6 w-6 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder={t('searchForGame')}
                                    autoFocus
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-lg text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-600"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 mx-2 mb-2">
                            {loading ? (
                                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>
                            ) : results.length > 0 ? (
                                <div className="space-y-1">
                                    {results.map((game) => (
                                        <button
                                            key={game.id}
                                            onClick={() => handleSelectGame(game)}
                                            className="w-full flex items-center gap-4 p-3 hover:bg-zinc-800 rounded-xl transition-colors text-left group"
                                        >
                                            <div className="h-16 w-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                                                {game.cover_image && <img src={getImageUrl(game.cover_image)} className="w-full h-full object-cover" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-base text-zinc-200 group-hover:text-white truncate">{game.title}</div>
                                                <div className="text-sm text-zinc-500">{game.release_date?.split('-')[0]}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : searchTerm.length > 1 ? (
                                <div className="text-center py-12 text-zinc-500">{t('noGamesFound')}</div>
                            ) : (
                                <div className="text-center py-16 text-zinc-600 flex flex-col items-center gap-4">
                                    <Search className="h-12 w-12 opacity-20" />
                                    <p className="text-base">{t('typeToSearchLog')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="w-full flex flex-col md:flex-row h-full">
                        {/* Left Column: Game Info (Clickable to change game) */}
                        <button
                            onClick={() => setStep(1)}
                            className="w-full md:w-1/3 bg-zinc-950 border-r border-zinc-800 flex flex-col relative group overflow-hidden text-left transition-all"
                        >
                            {/* Image Section */}
                            <div className="relative w-full shrink-0">
                                {selectedGame?.cover_image ? (
                                    <>
                                        <img
                                            src={getImageUrl(selectedGame.cover_image)}
                                            className="w-full h-auto object-top shadow-md transition-all duration-300 group-hover:scale-105 group-hover:blur-sm group-hover:brightness-50"
                                            alt={selectedGame.title}
                                        />
                                        {/* Gradient Overlay */}
                                        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent transition-opacity group-hover:opacity-50" />

                                        {/* Hover Overlay: Change Game */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                            <RefreshCw className="h-10 w-10 text-emerald-500 mb-2" />
                                            <span className="font-bold text-white text-lg shadow-black drop-shadow-lg">{t('changeGame')}</span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="w-full aspect-[3/4] bg-zinc-900 flex items-center justify-center">
                                        <Search className="h-12 w-12 text-zinc-700" />
                                    </div>
                                )}
                            </div>

                            {/* Game Details - Positioned in the black space below */}
                            <div className="flex-1 flex flex-col justify-end p-6 z-20">
                                <h2 className="text-3xl font-black text-white leading-tight mb-2 drop-shadow-sm group-hover:text-emerald-500 transition-colors">{selectedGame?.title}</h2>
                                <div className="flex items-center gap-2 text-zinc-400 font-medium">
                                    <Calendar className="h-4 w-4" />
                                    <span>{selectedGame?.release_date?.split('-')[0]}</span>
                                </div>
                            </div>
                        </button>

                        {/* Right Column: Review Form */}
                        <div className="w-full md:w-2/3 flex flex-col bg-zinc-950/50">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950">
                                <h2 className="text-xl font-bold flex items-center gap-3">
                                    {isReplay ? t('logReplay') : existingReview ? t('editReview') : t('writeReview')}
                                    {isReplay && (
                                        <span className="text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded-full">
                                            {nextPlaythrough === 2 ? '2nd' : nextPlaythrough === 3 ? '3rd' : `${nextPlaythrough}th`} {t('playthrough')}
                                        </span>
                                    )}
                                </h2>
                                <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
                                {/* Rating Slider */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('rating')}</label>
                                        <div className={`text-3xl font-black transition-colors ${getRatingTextClass(rating)}`}>{Number(rating || 0).toFixed(1)}</div>
                                    </div>
                                    <div className="relative h-6 flex items-center">
                                        <input
                                            type="range"
                                            min="0"
                                            max="10"
                                            step="0.1"
                                            value={rating}
                                            onChange={(e) => setRating(parseFloat(e.target.value))}
                                            style={{
                                                background: `linear-gradient(to right, ${getRatingColor(rating)} ${rating * 10}%, #27272a ${rating * 10}%)`
                                            }}
                                            className="w-full h-3 rounded-full appearance-none cursor-pointer focus:outline-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-xl [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1 font-mono">
                                        <span>0.0</span>
                                        <span>5.0</span>
                                        <span>10.0</span>
                                    </div>
                                </div>

                                {/* Playtime & Platform */}
                                <div className="grid grid-cols-2 gap-4 shrink-0">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Playtime (Hours)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="50000"
                                            value={playtimeHours}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '') { setPlaytimeHours(''); return; }
                                                const num = Number(val);
                                                if (num < 0 || num > 50000) return;
                                                setPlaytimeHours(num);
                                            }}
                                            placeholder="e.g. 10"
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-zinc-600 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Platform</label>
                                        <select
                                            value={selectedPlatform}
                                            onChange={(e) => setSelectedPlatform(e.target.value)}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500/50 transition-all appearance-none text-sm"
                                        >
                                            <option value="">Select Platform</option>
                                            {(selectedGame?.platforms && selectedGame.platforms.length > 0
                                                ? selectedGame.platforms
                                                : ['PC', 'PlayStation 5', 'PlayStation 4', 'Xbox Series X|S', 'Xbox One', 'Nintendo Switch', 'Mobile']
                                            ).map((platform: string) => (
                                                <option key={platform} value={platform}>{platform}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Review Text */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">{t('reviewOptional')}</label>
                                    <textarea
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder={t('whatDidYouThink')}
                                        className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-200 focus:outline-none focus:border-emerald-500/50 transition-all resize-none placeholder:text-zinc-600 text-base leading-relaxed"
                                    />
                                </div>

                                {/* Toggles */}
                                <div className="grid grid-cols-3 gap-3 shrink-0">
                                    <button
                                        onClick={() => setIsLiked(!isLiked)}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${isLiked ? 'border-pink-500 bg-pink-500/10 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'}`}
                                    >
                                        <div className={`p-1.5 rounded-full ${isLiked ? 'bg-pink-500 text-white' : 'bg-zinc-800'}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                                        </div>
                                        <span className="font-bold text-xs">{t('liked')}</span>
                                    </button>

                                    <button
                                        onClick={() => setIsCompleted(!isCompleted)}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${isCompleted ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'}`}
                                    >
                                        <div className={`p-1.5 rounded-full ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-zinc-800'}`}>
                                            <Check className="h-4 w-4" />
                                        </div>
                                        <span className="font-bold text-xs">{t('completed')}</span>
                                    </button>

                                    <button
                                        onClick={() => setContainsSpoilers(!containsSpoilers)}
                                        className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${containsSpoilers ? 'border-amber-500 bg-amber-500/10 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'}`}
                                    >
                                        <div className={`p-1.5 rounded-full ${containsSpoilers ? 'bg-amber-500 text-white' : 'bg-zinc-800'}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /><path d="M2 2l20 20" /></svg>
                                        </div>
                                        <span className="font-bold text-xs">{t('spoilers')}</span>
                                    </button>
                                </div>
                            </div>

                            {submitError && (
                                <div className="mx-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-medium flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                                    {submitError}
                                </div>
                            )}

                            {/* Footer Actions */}
                            <div className="p-4 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-3 shrink-0">
                                <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm">
                                    {t('cancel')}
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={!selectedGame || isSubmitting}
                                    className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2 text-sm"
                                >
                                    {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                                    {isReplay ? t('logReplay') : existingReview ? t('updateLog') : t('logActivity')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

