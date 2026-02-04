'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import PostCard from "@/components/PostCard";
import api from '@/lib/api';
import { Project, Post } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { MapPin, Calendar, Link as LinkIcon, Users, Layout, Info } from 'lucide-react';
import Link from 'next/link';

export default function ProjectDetailPage() {
    const params = useParams();
    const projectId = params.id;

    const [project, setProject] = useState<Project | null>(null);
    const [devlogs, setDevlogs] = useState<Post[]>([]);
    const [activeTab, setActiveTab] = useState<'about' | 'devlogs'>('devlogs');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjectData = async () => {
            if (!projectId) return;
            setLoading(true);
            try {
                // Fetch Project Details
                const projectRes = await api.get(`/projects/${projectId}/`);
                setProject(projectRes.data);

                // Fetch Linked Devlogs
                const postsRes = await api.get(`/posts/?project_parent=${projectId}`);
                setDevlogs(postsRes.data.results || postsRes.data);
            } catch (error) {
                console.error("Failed to load project:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProjectData();
    }, [projectId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center">
                <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
                <Link href="/devs" className="text-emerald-500 hover:underline">
                    Back to Developer Hub
                </Link>
            </div>
        );
    }

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

                        {/* Hero Section */}
                        <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden mb-6 group">
                            {project.cover_image ? (
                                <img
                                    src={project.cover_image}
                                    alt={project.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-emerald-900 to-zinc-900 flex items-center justify-center">
                                    <Layout className="h-20 w-20 text-white/10" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-4xl font-bold text-white shadow-sm">{project.title}</h1>
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${project.status === 'released' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                                                project.status === 'beta' ? 'bg-blue-500/20 border-blue-500 text-blue-400' :
                                                    'bg-amber-500/20 border-amber-500 text-amber-400'
                                            }`}>
                                            {project.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p className="text-zinc-300 max-w-2xl text-shadow-sm line-clamp-2">
                                        {project.description}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Info Bar */}
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <Link href={`/${project.owner.username}`} className="flex items-center gap-2 group">
                                    <img
                                        src={getImageUrl(project.owner.avatar, project.owner.username)}
                                        alt={project.owner.username}
                                        className="h-10 w-10 rounded-full bg-zinc-800 object-cover border-2 border-transparent group-hover:border-emerald-500 transition-all"
                                    />
                                    <div>
                                        <p className="text-sm text-zinc-400">Created by</p>
                                        <p className="font-bold text-white group-hover:text-emerald-400 transition-colors">
                                            {project.owner.real_name || project.owner.username}
                                        </p>
                                    </div>
                                </Link>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {project.tech_stack.map((tech, i) => (
                                    <span key={i} className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-400">
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-6 border-b border-zinc-800 mb-6">
                            <button
                                onClick={() => setActiveTab('devlogs')}
                                className={`pb-3 text-lg font-bold transition-all relative ${activeTab === 'devlogs' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Layout className="h-5 w-5" />
                                    Devlogs ({devlogs.length})
                                </div>
                                {activeTab === 'devlogs' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('about')}
                                className={`pb-3 text-lg font-bold transition-all relative ${activeTab === 'about' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Info className="h-5 w-5" />
                                    About
                                </div>
                                {activeTab === 'about' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {activeTab === 'devlogs' ? (
                                <div className="flex flex-col gap-6 max-w-3xl">
                                    {devlogs.length > 0 ? (
                                        devlogs.map((post) => (
                                            <PostCard key={post.id} post={post} />
                                        ))
                                    ) : (
                                        <div className="p-12 text-center bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed">
                                            <Layout className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                                            <p className="text-zinc-400 text-lg">No devlogs published yet.</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                                    <h3 className="text-xl font-bold mb-4">About this Project</h3>
                                    <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                        {project.description}
                                    </p>

                                    <div className="mt-8 pt-8 border-t border-zinc-800">
                                        <h4 className="font-bold mb-3 text-zinc-400 uppercase text-sm tracking-wider">Project Stats</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                <div className="text-zinc-500 text-xs mb-1">Started</div>
                                                <div className="font-mono text-white">{new Date(project.created_at).toLocaleDateString()}</div>
                                            </div>
                                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                <div className="text-zinc-500 text-xs mb-1">Status</div>
                                                <div className="font-mono text-emerald-400 capitalize">{project.status.replace('_', ' ')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
