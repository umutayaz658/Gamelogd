'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import PitchCard from "@/components/PitchCard";
import InvestorCallCard from "@/components/InvestorCallCard";
import FilterDropdown from "@/components/FilterDropdown";
import CreatePitchModal from "@/components/modals/CreatePitchModal";
import CreateInvestorCallModal from "@/components/modals/CreateInvestorCallModal";
import { PlusCircle, Search, Filter, Layers, Gamepad2, Globe, Building2, Wallet } from 'lucide-react';
import api from '@/lib/api';
import { Pitch, InvestorCall } from '@/types';

export default function InvestPage() {
    const [activeTab, setActiveTab] = useState<'showcase' | 'calls'>('showcase');

    // Data States
    const [pitches, setPitches] = useState<Pitch[]>([]);
    const [calls, setCalls] = useState<InvestorCall[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter States
    const [filters, setFilters] = useState({
        search: '',
        // Pitch Filters
        genre: '',
        platform: '',
        stage: '',
        // Call Filters
        investor_type: '',
        ticket_size: ''
    });

    // Modals
    const [isPitchModalOpen, setIsPitchModalOpen] = useState(false);
    const [isCallModalOpen, setIsCallModalOpen] = useState(false);

    // Fetch Data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (filters.search) params.append('search', filters.search);

                if (activeTab === 'showcase') {
                    if (filters.genre) params.append('genre', filters.genre);
                    if (filters.platform) params.append('platform', filters.platform);
                    if (filters.stage) params.append('stage', filters.stage);

                    const res = await api.get(`/pitches/?${params.toString()}`);
                    setPitches(res.data.results || res.data);
                } else {
                    if (filters.investor_type) params.append('investor_type', filters.investor_type);
                    if (filters.ticket_size) params.append('ticket_size', filters.ticket_size);

                    const res = await api.get(`/investor-calls/?${params.toString()}`);
                    setCalls(res.data.results || res.data);
                }
            } catch (error) {
                console.error("Failed to fetch data:", error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchData();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [activeTab, filters]);

    // Handle Create Success
    const handlePitchCreated = (newPitch: Pitch) => {
        if (activeTab === 'showcase') setPitches([newPitch, ...pitches]);
    };

    const handleCallCreated = (newCall: InvestorCall) => {
        if (activeTab === 'calls') setCalls([newCall, ...calls]);
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-12">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-9">

                        {/* Page Header */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-white mb-2">
                                Investment <span className="text-amber-500">Opportunities</span>
                            </h1>
                            <p className="text-zinc-400">
                                Connect with top-tier publishers, VC funds, and angel investors. Showcase your project or find the next big hit.
                            </p>
                        </div>

                        {/* Tabs & Actions Row */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            {/* Tab Toggles */}
                            <div className="flex p-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl w-full md:w-fit">
                                <button
                                    onClick={() => setActiveTab('showcase')}
                                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'showcase'
                                        ? 'bg-zinc-800 text-white shadow-lg'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    Project Showcase
                                </button>
                                <button
                                    onClick={() => setActiveTab('calls')}
                                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'calls'
                                        ? 'bg-zinc-800 text-white shadow-lg'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                        }`}
                                >
                                    Investor Calls
                                </button>
                            </div>

                            {/* Create Button */}
                            <button
                                onClick={() => activeTab === 'showcase' ? setIsPitchModalOpen(true) : setIsCallModalOpen(true)}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
                            >
                                <PlusCircle className="h-5 w-5" />
                                <span>{activeTab === 'showcase' ? 'Pitch Project' : 'Create Call'}</span>
                            </button>
                        </div>

                        {/* Filter Bar (Collabs Style) */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-8">
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder={activeTab === 'showcase' ? "Search pitches..." : "Search investors..."}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-600"
                                    value={filters.search}
                                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                />
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {activeTab === 'showcase' ? (
                                    <>
                                        <FilterDropdown
                                            label="Genre"
                                            icon={<Gamepad2 className="h-4 w-4" />}
                                            value={filters.genre}
                                            onChange={(val) => setFilters(prev => ({ ...prev, genre: val }))}
                                            options={[
                                                { value: 'rpg', label: 'RPG' },
                                                { value: 'fps', label: 'FPS' },
                                                { value: 'strategy', label: 'Strategy' },
                                                { value: 'simulation', label: 'Simulation' },
                                                { value: 'adventure', label: 'Adventure' },
                                            ]}
                                        />
                                        <FilterDropdown
                                            label="Platform"
                                            icon={<Globe className="h-4 w-4" />}
                                            value={filters.platform}
                                            onChange={(val) => setFilters(prev => ({ ...prev, platform: val }))}
                                            options={[
                                                { value: 'pc', label: 'PC' },
                                                { value: 'console', label: 'Console' },
                                                { value: 'mobile', label: 'Mobile' },
                                                { value: 'vr_ar', label: 'VR/AR' },
                                            ]}
                                        />
                                        <FilterDropdown
                                            label="Stage"
                                            icon={<Layers className="h-4 w-4" />}
                                            value={filters.stage}
                                            onChange={(val) => setFilters(prev => ({ ...prev, stage: val }))}
                                            options={[
                                                { value: 'concept', label: 'Concept' },
                                                { value: 'prototype', label: 'Prototype' },
                                                { value: 'vertical_slice', label: 'Vertical Slice' },
                                                { value: 'production', label: 'In Production' },
                                                { value: 'alpha', label: 'Alpha' },
                                                { value: 'beta', label: 'Beta' },
                                            ]}
                                        />
                                    </>
                                ) : (
                                    <>
                                        <FilterDropdown
                                            label="Investor Type"
                                            icon={<Building2 className="h-4 w-4" />}
                                            value={filters.investor_type}
                                            onChange={(val) => setFilters(prev => ({ ...prev, investor_type: val }))}
                                            options={[
                                                { value: 'vc', label: 'VC' },
                                                { value: 'publisher', label: 'Publisher' },
                                                { value: 'angel', label: 'Angel Investor' },
                                                { value: 'grant', label: 'Grant / Fund' },
                                            ]}
                                        />
                                        <FilterDropdown
                                            label="Ticket Size"
                                            icon={<Wallet className="h-4 w-4" />}
                                            value={filters.ticket_size}
                                            onChange={(val) => setFilters(prev => ({ ...prev, ticket_size: val }))}
                                            options={[
                                                { value: '$10k-$50k', label: '$10k - $50k' },
                                                { value: '$50k-$100k', label: '$50k - $100k' },
                                                { value: '$100k-$500k', label: '$100k - $500k' },
                                                { value: '$500k+', label: '$500k+' },
                                            ]}
                                        />
                                    </>
                                )}

                                {/* Reset Button */}
                                <button
                                    onClick={() => setFilters({ search: '', genre: '', platform: '', stage: '', investor_type: '', ticket_size: '' })}
                                    className="ml-auto text-sm font-medium text-zinc-500 hover:text-white transition-colors px-3 py-2"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </div>

                        {/* Content Grid */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'showcase' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {pitches.length > 0 ? (
                                                pitches.map(pitch => (
                                                    <PitchCard key={pitch.id} pitch={pitch} onClick={() => { }} />
                                                ))
                                            ) : (
                                                <div className="col-span-full py-20 text-center text-zinc-500">
                                                    No pitches found. Be the first to pitch!
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {calls.length > 0 ? (
                                                calls.map(call => (
                                                    <InvestorCallCard key={call.id} call={call} onClick={() => { }} />
                                                ))
                                            ) : (
                                                <div className="col-span-full py-20 text-center text-zinc-500">
                                                    No investor calls found at the moment.
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                    </div>
                </div>
            </main>

            <CreatePitchModal
                isOpen={isPitchModalOpen}
                onClose={() => setIsPitchModalOpen(false)}
                onSuccess={handlePitchCreated}
            />
            <CreateInvestorCallModal
                isOpen={isCallModalOpen}
                onClose={() => setIsCallModalOpen(false)}
                onSuccess={handleCallCreated}
            />
        </div>
    );
}
