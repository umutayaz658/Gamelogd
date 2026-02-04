'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import PostCard from "@/components/PostCard";
import ProjectCard from "@/components/ProjectCard"; // Make sure to export this
import { PlusCircle, Layout, FolderKanban } from 'lucide-react';
import api from '@/lib/api';
import { Post, Project } from '@/types';
import CreateProjectModal from '@/components/modals/CreateProjectModal';
import CreateDevlogModal from '@/components/modals/CreateDevlogModal';

export default function DevsPage() {
    const [activeTab, setActiveTab] = useState<'devlogs' | 'projects'>('devlogs');
    const [devlogs, setDevlogs] = useState<Post[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showDevlogModal, setShowDevlogModal] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'devlogs') {
                    // Fetch posts where project_parent is not null
                    // Using the new filter capability
                    const res = await api.get('/posts/?project_parent__isnull=false');
                    setDevlogs(res.data.results || res.data);
                } else {
                    const res = await api.get('/projects/');
                    setProjects(res.data.results || res.data);
                }
            } catch (error) {
                console.error("Failed to fetch devs data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [activeTab]);

    const handleCreateClick = () => {
        if (activeTab === 'devlogs') {
            setShowDevlogModal(true);
        } else {
            setShowProjectModal(true);
        }
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

                        {/* Header Section */}
                        <div className="flex items-end justify-between mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2">Developer Hub</h1>
                                <p className="text-zinc-400">Discover indie gems and follow their development journey.</p>
                            </div>
                            <button
                                onClick={handleCreateClick}
                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
                            >
                                <PlusCircle className="h-5 w-5" />
                                <span>{activeTab === 'devlogs' ? 'Log Dev' : 'Create Project'}</span>
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
                                Devlogs
                                {activeTab === 'devlogs' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('projects')}
                                className={`flex items-center gap-2 pb-4 px-2 text-lg font-bold transition-all relative ${activeTab === 'projects'
                                    ? 'text-white'
                                    : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <FolderKanban className="h-5 w-5" />
                                Projects
                                {activeTab === 'projects' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
                                </div>
                            ) : activeTab === 'devlogs' ? (
                                <div className="flex flex-col gap-6 max-w-3xl">
                                    {devlogs.length > 0 ? (
                                        devlogs.map((post) => (
                                            <PostCard key={post.id} post={post} />
                                        ))
                                    ) : (
                                        <div className="text-center py-20 text-zinc-500">
                                            No devlogs found. Be the first to post!
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {projects.length > 0 ? (
                                        projects.map((project) => (
                                            <ProjectCard key={project.id} project={project} />
                                        ))
                                    ) : (
                                        <div className="col-span-full text-center py-20 text-zinc-500">
                                            No projects found.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>

            {/* Modals */}
            <CreateProjectModal
                isOpen={showProjectModal}
                onClose={() => setShowProjectModal(false)}
                onSuccess={(newProject) => {
                    setProjects(prev => [newProject, ...prev]);
                    setActiveTab('projects'); // Switch to projects tab to see it
                }}
            />

            <CreateDevlogModal
                isOpen={showDevlogModal}
                onClose={() => setShowDevlogModal(false)}
                onSuccess={(newPost) => {
                    setDevlogs(prev => [newPost, ...prev]);
                }}
            />
        </div>
    );
}
