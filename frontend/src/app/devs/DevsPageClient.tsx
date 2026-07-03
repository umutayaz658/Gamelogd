'use client';

import { useState, useEffect } from 'react';
import { PlusCircle, Building } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import { useWorkspace } from '@/components/devs/WorkspaceContext';
import WorkspaceDashboard from '@/components/devs/WorkspaceDashboard';
import KanbanBoard from '@/components/devs/KanbanBoard';
import GDDHub from '@/components/devs/GDDHub';
import AssetRegistry from '@/components/devs/AssetRegistry';
import LocalisationManager from '@/components/devs/LocalisationManager';
import TeamManagement from '@/components/devs/TeamManagement';
import WorkspaceSettings from '@/components/devs/WorkspaceSettings';
import PostCard from '@/components/PostCard';
import ProjectCard from '@/components/ProjectCard';
import CreateProjectModal from '@/components/modals/CreateProjectModal';
import CreateDevlogModal from '@/components/modals/CreateDevlogModal';
import api from '@/lib/api';
import { Post, Project } from '@/types';

export default function DevsPageClient() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { activeTool, activeWorkspace, setActiveTool } = useWorkspace();

    const [devlogs, setDevlogs] = useState<Post[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showDevlogModal, setShowDevlogModal] = useState(false);

    // Fetch data only when on devlogs / projects tool
    useEffect(() => {
        if (!user) return;
        if (activeTool !== 'devlogs' && activeTool !== 'projects') return;
        const fetchData = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                params.append('manageable', 'true');
                if (activeWorkspace.type === 'org' && activeWorkspace.org) {
                    params.append('organisation', String(activeWorkspace.org.id));
                }
                if (activeTool === 'devlogs') {
                    const res = await api.get(`/posts/?${params.toString()}`);
                    const data = res.data.results ?? res.data;
                    setDevlogs([...data].sort((a: Post, b: Post) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    ));
                } else {
                    const res = await api.get(`/projects/?${params.toString()}`);
                    setProjects(res.data.results ?? res.data);
                }
            } catch { /* silent */ }
            finally { setLoading(false); }
        };
        fetchData();
    }, [activeTool, activeWorkspace, user]);

    // Not logged in gate
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-full p-8">
                <div className="text-center max-w-md bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-3xl p-10 space-y-6 shadow-2xl">
                    <div className="inline-flex items-center justify-center p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 text-blue-500 shadow-inner">
                        <Building className="h-10 w-10" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-extrabold text-white">Developer Workspace</h2>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Log in to access your personal studio hub — Kanban boards, GDD editor, asset registry, localisation manager and more.
                        </p>
                    </div>
                    <Link
                        href="/login"
                        className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/20"
                    >
                        Log In / Sign Up
                    </Link>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (activeTool) {
            case 'dashboard':
                return <WorkspaceDashboard />;
            case 'kanban':
                return <KanbanBoard />;
            case 'gdd':
                return <GDDHub />;
            case 'assets':
                return <AssetRegistry />;
            case 'localisation':
                return <LocalisationManager />;
            case 'members':
                return <TeamManagement />;
            case 'settings':
                return <WorkspaceSettings />;

            case 'devlogs':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">{t('devlogsPublisher')}</h2>
                                <p className="text-sm text-zinc-500 mt-0.5">Publish developer logs for your projects.</p>
                            </div>
                            <button
                                onClick={() => setShowDevlogModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
                            >
                                <PlusCircle className="w-4 h-4" />
                                New Devlog
                            </button>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                            </div>
                        ) : devlogs.length > 0 ? (
                            <div className="flex flex-col gap-6">
                                {devlogs.map((post) => <PostCard key={post.id} post={post} />)}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-zinc-600 text-sm">No devlogs found.</div>
                        )}
                    </div>
                );

            case 'projects':
                return (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-white">{t('projects')}</h2>
                                <p className="text-sm text-zinc-500 mt-0.5">Manage your game projects.</p>
                            </div>
                            <button
                                onClick={() => setShowProjectModal(true)}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
                            >
                                <PlusCircle className="w-4 h-4" />
                                {t('createProject')}
                            </button>
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
                            </div>
                        ) : projects.length > 0 ? (
                            <div className="flex flex-col gap-6">
                                {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
                            </div>
                        ) : (
                            <div className="text-center py-20 text-zinc-600 text-sm">No projects found.</div>
                        )}
                    </div>
                );

            default:
                return <WorkspaceDashboard />;
        }
    };

    return (
        <>
            {activeTool === 'gdd' ? (
                /* GDD Hub needs full-height, no padding wrapper, manages own scroll */
                <div className="h-full flex flex-col min-h-0 overflow-hidden">
                    <GDDHub />
                </div>
            ) : (
                /* Other tools: scrollable with padding */
                <div className="flex-1 overflow-y-auto scrollbar-thin-dark" style={{ scrollbarGutter: 'stable' }}>
                    <div className="p-6 xl:p-8 max-w-7xl">
                        {renderContent()}
                    </div>
                </div>
            )}
            <CreateProjectModal
                isOpen={showProjectModal}
                onClose={() => setShowProjectModal(false)}
                onSuccess={(newProject) => {
                    setProjects((prev) => [newProject, ...prev]);
                    setActiveTool('projects');
                }}
            />
            <CreateDevlogModal
                isOpen={showDevlogModal}
                onClose={() => setShowDevlogModal(false)}
                onSuccess={(newPost) => setDevlogs((prev) => [newPost, ...prev])}
            />
        </>
    );
}
