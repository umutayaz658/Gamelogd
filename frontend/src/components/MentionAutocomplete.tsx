'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { User } from '@/types';
import { getImageUrl } from '@/lib/utils';

interface MentionAutocompleteProps {
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    value: string;
    onChange: (newValue: string) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export default function MentionAutocomplete({
    textareaRef,
    value,
    onChange,
    onKeyDown,
}: MentionAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mentionMatch, setMentionMatch] = useState<{ query: string; startIndex: number; endIndex: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Detect mention when typing
    const checkMention = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
            setMentionMatch(null);
            return;
        }

        const cursorPos = textarea.selectionStart;
        const textBeforeCursor = value.slice(0, cursorPos);
        
        // Match @username pattern at cursor
        const match = textBeforeCursor.match(/@([a-zA-Z0-9_-]*)$/);
        
        if (match) {
            const query = match[1];
            const startIndex = cursorPos - match[0].length;
            const endIndex = cursorPos;
            setMentionMatch({ query, startIndex, endIndex });
        } else {
            setMentionMatch(null);
            setSuggestions([]);
        }
    }, [textareaRef, value]);

    useEffect(() => {
        checkMention();
    }, [value, checkMention]);

    // Fetch user suggestions
    useEffect(() => {
        if (!mentionMatch) {
            setSuggestions([]);
            return;
        }

        let isMounted = true;
        const query = mentionMatch.query;

        const fetchSuggestions = async () => {
            setIsLoading(true);
            try {
                const res = await api.get('/users/', {
                    params: { search: query, page_size: 5 }
                });
                if (isMounted) {
                    const users: User[] = Array.isArray(res.data) ? res.data : (res.data.results || []);
                    setSuggestions(users.slice(0, 5));
                    setSelectedIndex(0);
                }
            } catch (err) {
                if (isMounted) setSuggestions([]);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        const timer = setTimeout(fetchSuggestions, 150);
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [mentionMatch?.query]);

    // Insert selected user mention into text
    const insertMention = (userToInsert: User) => {
        if (!mentionMatch || !textareaRef.current) return;

        const before = value.slice(0, mentionMatch.startIndex);
        const after = value.slice(mentionMatch.endIndex);
        const insertedText = `@${userToInsert.username} `;
        const newValue = before + insertedText + after;
        
        onChange(newValue);
        setMentionMatch(null);
        setSuggestions([]);

        // Restore focus and move cursor right after inserted mention
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newCursorPos = before.length + insertedText.length;
                textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
            }
        }, 10);
    };

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (suggestions.length > 0 && mentionMatch) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % suggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                if (suggestions[selectedIndex]) {
                    insertMention(suggestions[selectedIndex]);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setMentionMatch(null);
                setSuggestions([]);
                return;
            }
        }

        if (onKeyDown) {
            onKeyDown(e);
        }
    };

    if (!mentionMatch || (suggestions.length === 0 && !isLoading)) {
        return { handleKeyDown, renderSuggestions: () => null };
    }

    const renderSuggestions = () => (
        <div className="absolute bottom-full left-0 mb-2 w-72 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase border-b border-zinc-800 flex items-center justify-between">
                <span>Mentions</span>
                {isLoading && <span className="text-emerald-500 animate-pulse">Searching...</span>}
            </div>
            <div className="max-h-48 overflow-y-auto divide-y divide-zinc-800/40">
                {suggestions.map((userItem, idx) => (
                    <button
                        key={userItem.id || userItem.username}
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            insertMention(userItem);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                            idx === selectedIndex ? 'bg-emerald-500/15 text-white' : 'hover:bg-zinc-800/60 text-zinc-300'
                        }`}
                    >
                        <img
                            src={getImageUrl(userItem.avatar, userItem.username)}
                            alt={userItem.username}
                            className="w-7 h-7 rounded-full object-cover bg-zinc-800 flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-zinc-200 truncate leading-tight">
                                {userItem.real_name || userItem.username}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                                @{userItem.username}
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    return { handleKeyDown, renderSuggestions };
}
