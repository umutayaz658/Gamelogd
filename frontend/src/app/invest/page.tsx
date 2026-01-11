'use client';

import { useState } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import PitchCard from "@/components/PitchCard";
import InvestorCallCard from "@/components/InvestorCallCard";
import { Briefcase, LineChart } from 'lucide-react';

export default function InvestPage() {
    const [activeTab, setActiveTab] = useState<'showcase' | 'calls'>('showcase');
    const [activeFilter, setActiveFilter] = useState('All');

    const filters = ["All", "PC", "Console", "Mobile", "VR/AR"];

    const projects = [
        {
            id: 1,
            title: "Nebula Drifters",
            genre: "RTS / Sci-Fi",
            fundingGoal: "$50k - $100k",
            pitch: "A fast-paced RTS where you control fleets of spaceships in a procedurally generated galaxy. Features a unique 'Time-Dilation' mechanic for multiplayer matches.",
            image: "https://images.unsplash.com/photo-1614713555616-9da981754df8?q=80&w=2070&auto=format&fit=crop",
            platform: "PC"
        },
        {
            id: 2,
            title: "Hollow Knight: Silk Song (Fan Project)",
            genre: "Metroidvania",
            fundingGoal: "$20k",
            pitch: "An ambitious fan project exploring a new kingdom with hand-drawn art and tight combat mechanics. Seeking funding for sound design and QA.",
            image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop",
            platform: "PC"
        },
        {
            id: 3,
            title: "Cyber-Noir Detective",
            genre: "Narrative RPG",
            fundingGoal: "Publisher Support",
            pitch: "A detective RPG set in a dystopian future where you solve crimes by hacking into people's memories. Heavy focus on narrative choices and consequences.",
            image: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=2070&auto=format&fit=crop",
            platform: "Console"
        }
    ];

    const investorCalls = [
        {
            id: 1,
            investorName: "Indie Fund X",
            type: "VC Fund" as const,
            lookingFor: "Mobile Puzzle Games with retention > 15%",
            ticketSize: "$50k - $200k",
            platform: "Mobile"
        },
        {
            id: 2,
            investorName: "Devolver Digital",
            type: "Publisher" as const,
            lookingFor: "Unique, stylized action games with strong hooks.",
            ticketSize: "Full Funding",
            platform: "PC"
        },
        {
            id: 3,
            investorName: "Angel Syndicate",
            type: "Angel Investor" as const,
            lookingFor: "Early stage VR/AR experiences.",
            ticketSize: "$20k per team",
            platform: "VR/AR"
        },
        {
            id: 4,
            investorName: "Raw Fury",
            type: "Publisher" as const,
            lookingFor: "Atmospheric narrative games.",
            ticketSize: "Negotiable",
            platform: "Console"
        }
    ];

    const filteredProjects = activeFilter === 'All'
        ? projects
        : projects.filter(p => p.platform === activeFilter);

    const filteredCalls = activeFilter === 'All'
        ? investorCalls
        : investorCalls.filter(c => c.platform === activeFilter);

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-amber-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-12">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Main Content */}
                    <div className="col-span-12 lg:col-span-9">

                        {/* Header Section */}
                        <div className="mb-10 text-center md:text-left">
                            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                                Investment <span className="text-amber-500">Opportunities</span>
                            </h1>
                            <p className="text-zinc-400 text-lg max-w-2xl">
                                Connect with top-tier publishers, VC funds, and angel investors.
                                Showcase your project or find the next big hit.
                            </p>
                        </div>

                        {/* Tabs */}
                        <div className="flex justify-center md:justify-start gap-2 mb-6 bg-zinc-900/50 p-1 rounded-xl w-fit border border-zinc-800">
                            <button
                                onClick={() => setActiveTab('showcase')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'showcase'
                                        ? 'bg-zinc-800 text-white shadow-lg'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                                    }`}
                            >
                                <LineChart className="h-5 w-5" />
                                Project Showcase
                            </button>

                            <button
                                onClick={() => setActiveTab('calls')}
                                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${activeTab === 'calls'
                                        ? 'bg-zinc-800 text-white shadow-lg'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                                    }`}
                            >
                                <Briefcase className="h-5 w-5" />
                                Investor Calls
                            </button>
                        </div>

                        {/* Filter Bar */}
                        <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                            {filters.map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setActiveFilter(filter)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-all ${activeFilter === filter
                                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                                        }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {activeTab === 'showcase' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {filteredProjects.map((project) => (
                                        <PitchCard key={project.id} {...project} />
                                    ))}
                                    {filteredProjects.length === 0 && (
                                        <div className="col-span-full text-center py-12 text-zinc-500">
                                            No projects found for this category.
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredCalls.map((call) => (
                                        <InvestorCallCard key={call.id} {...call} />
                                    ))}
                                    {filteredCalls.length === 0 && (
                                        <div className="col-span-full text-center py-12 text-zinc-500">
                                            No investor calls found for this category.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
