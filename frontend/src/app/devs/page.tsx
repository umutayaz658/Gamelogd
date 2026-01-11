'use client';

import { useState } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import DevlogCard from "@/components/DevlogCard";
import OpportunityCard from "@/components/OpportunityCard";
import { PlusCircle, Layout, Users } from 'lucide-react';

export default function DevsPage() {
    const [activeTab, setActiveTab] = useState<'devlogs' | 'talent'>('devlogs');

    const devlogs = [
        {
            id: 1,
            developer: {
                name: "PixelForge Studio",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pixel",
                project: "Project: Aether"
            },
            content: "Finally nailed the cloud rendering system! ☁️ It's fully volumetric and reacts to wind direction. Still need to optimize for lower-end GPUs but the visual result is worth it.",
            media: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop",
            tags: ["Unity", "Shaders", "VFX"],
            timestamp: "2h ago"
        },
        {
            id: 2,
            developer: {
                name: "SoloDev_99",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Solo",
                project: "Neon Drifter"
            },
            content: "Working on the new boss mechanics. The 'Cyber-Worm' now burrows underground and attacks from below. Need feedback on the telegraphing animation - is it too fast?",
            media: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop",
            tags: ["Godot", "BossFight", "IndieDev"],
            timestamp: "5h ago"
        },
        {
            id: 3,
            developer: {
                name: "ArtisticSoul",
                avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Art",
                project: "Forest Tales"
            },
            content: "Just finished the character concept art for the main protagonist. Going for a hand-drawn style inspired by Studio Ghibli. 🎨✨",
            media: "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?q=80&w=2070&auto=format&fit=crop",
            tags: ["ConceptArt", "2D", "CharacterDesign"],
            timestamp: "1d ago"
        }
    ];

    const opportunities = [
        {
            id: 1,
            role: "Senior Gameplay Engineer",
            team: "Ubisoft Montreal",
            type: "Full-time" as const,
            techStack: ["C++", "Unreal Engine 5"],
            description: "Join the team working on the next Assassin's Creed title. We are looking for an experienced gameplay programmer to lead the combat systems team."
        },
        {
            id: 2,
            role: "Pixel Artist & Animator",
            team: "Neon Knights (Indie)",
            type: "Rev-Share" as const,
            techStack: ["Aseprite", "Unity"],
            description: "We are a small team of 3 building a Cyberpunk Metroidvania. Looking for a dedicated pixel artist to handle character animations and environments. 20% Rev-share."
        },
        {
            id: 3,
            role: "Composer / Sound Designer",
            team: "Global Game Jam Team",
            type: "Hobby/Jam" as const,
            techStack: ["FMOD", "Ableton"],
            description: "Need a musician for the upcoming Global Game Jam! We are making a cozy farming sim in space. Just for fun and learning!"
        },
        {
            id: 4,
            role: "Backend Developer (Go/Node)",
            team: "Riot Games",
            type: "Full-time" as const,
            techStack: ["Go", "AWS", "Redis"],
            description: "Help us scale the matchmaking services for Valorant. Experience with high-concurrency systems is a must."
        }
    ];

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

                        {/* Header Section */}
                        <div className="flex items-end justify-between mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2">Developer Hub</h1>
                                <p className="text-zinc-400">Share your journey, find your team.</p>
                            </div>
                            <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20">
                                <PlusCircle className="h-5 w-5" />
                                <span>Post Update / Job</span>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-4 mb-8 border-b border-zinc-800">
                            <button
                                onClick={() => setActiveTab('devlogs')}
                                className={`flex items-center gap-2 pb-4 px-2 text-lg font-bold transition-all relative ${activeTab === 'devlogs'
                                        ? 'text-white'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <Layout className="h-5 w-5" />
                                Devlogs & Showcase
                                {activeTab === 'devlogs' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('talent')}
                                className={`flex items-center gap-2 pb-4 px-2 text-lg font-bold transition-all relative ${activeTab === 'talent'
                                        ? 'text-white'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <Users className="h-5 w-5" />
                                Talent & Collabs
                                {activeTab === 'talent' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {activeTab === 'devlogs' ? (
                                <div className="flex flex-col gap-6 max-w-3xl">
                                    {devlogs.map((log) => (
                                        <DevlogCard key={log.id} {...log} />
                                    ))}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {opportunities.map((opp) => (
                                        <OpportunityCard key={opp.id} {...opp} />
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
