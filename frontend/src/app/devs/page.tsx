'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import PostCard from "@/components/PostCard";
import ProjectCard from "@/components/ProjectCard";
import { PlusCircle, Layout, FolderKanban, X, ArrowUpDown, SlidersHorizontal, UserCheck } from 'lucide-react';
import api from '@/lib/api';
import { Post, Project } from '@/types';
import CreateProjectModal from '@/components/modals/CreateProjectModal';
import CreateDevlogModal from '@/components/modals/CreateDevlogModal';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';

const AVAILABLE_TECH = [
    'Unity', 'Unreal Engine', 'Godot', 'GameMaker', 'C#', 'C++', 'Python', 'JavaScript', 'TypeScript', 
    'Blender', 'Maya', 'ZBrush', 'Photoshop', 'Illustrator', 'FMOD', 'Wwise', 'Audacity', 'React', 'Next.js'
];

const STATUS_OPTIONS = [
    { value: 'in_dev', label: 'In Development', activeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-400' },
    { value: 'alpha', label: 'Alpha', activeClass: 'bg-orange-500/15 border-orange-500/40 text-orange-400' },
    { value: 'beta', label: 'Beta', activeClass: 'bg-blue-500/15 border-blue-500/40 text-blue-400' },
    { value: 'released', label: 'Released', activeClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' },
];

export default function DevsPage() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'devlogs' | 'projects'>('devlogs');
    const [devlogs, setDevlogs] = useState<Post[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showDevlogModal, setShowDevlogModal] = useState(false);

    // Filter states
    const [selectedTechs, setSelectedTechs] = useState<string[]>([]);
    const [selectedStatus, setSelectedStatus] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [showTechPicker, setShowTechPicker] = useState(false);
    const [showFollowingOnly, setShowFollowingOnly] = useState(false);
    const { user } = useAuth();

    const hasActiveFilters = selectedTechs.length > 0 || selectedStatus !== '' || sortOrder !== 'newest' || showFollowingOnly;

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (activeTab === 'devlogs') {
                    const params = new URLSearchParams();
                    params.append('project_parent__isnull', 'false');
                    if (selectedStatus) params.append('status', selectedStatus);
                    if (selectedTechs.length > 0) params.append('tech_stack_filter', selectedTechs.join(','));
                    if (showFollowingOnly) params.append('is_following_project', 'true');
                    
                    const queryStr = params.toString();
                    const res = await api.get(`/posts/?${queryStr}`);
                    let data = res.data.results || res.data;
                    
                    // Client-side sort for devlogs
                    if (sortOrder === 'oldest') {
                        data = [...data].sort((a: Post, b: Post) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    } else {
                        data = [...data].sort((a: Post, b: Post) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    }
                    
                    setDevlogs(data);
                } else {
                    // Build query params for projects
                    const params = new URLSearchParams();
                    if (selectedStatus) params.append('status', selectedStatus);
                    if (selectedTechs.length > 0) params.append('tech_stack_filter', selectedTechs.join(','));
                    if (sortOrder === 'oldest') params.append('ordering', 'created_at');
                    if (showFollowingOnly) params.append('is_following', 'true');
                    
                    const queryStr = params.toString();
                    const res = await api.get(`/projects/${queryStr ? '?' + queryStr : ''}`);
                    setProjects(res.data.results || res.data);
                }
            } catch (error) {
                console.error("Failed to fetch devs data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [activeTab, selectedTechs, selectedStatus, sortOrder, showFollowingOnly]);

    const handleCreateClick = () => {
        if (activeTab === 'devlogs') {
            setShowDevlogModal(true);
        } else {
            setShowProjectModal(true);
        }
    };

    const toggleTech = (tech: string) => {
        setSelectedTechs(prev =>
            prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]
        );
    };

    const clearAllFilters = () => {
        setSelectedTechs([]);
        setSelectedStatus('');
        setSortOrder('newest');
        setShowFollowingOnly(false);
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
                                <h1 className="text-3xl font-bold text-white mb-2">
                                    <span className="text-blue-500">{t('developerHub').split(' ')[0]}</span> {t('developerHub').split(' ').slice(1).join(' ')}
                                </h1>
                                <p className="text-zinc-400">{t('devsDescription')}</p>
                            </div>
                            <button
                                onClick={handleCreateClick}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
                            >
                                <PlusCircle className="h-5 w-5" />
                                <span>{activeTab === 'devlogs' ? t('devLog') : t('createProject')}</span>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-4 border-b border-zinc-800">
                            <button
                                onClick={() => setActiveTab('devlogs')}
                                className={`flex items-center gap-2 pb-4 px-2 text-lg font-bold transition-all relative ${activeTab === 'devlogs'
                                    ? 'text-white'
                                    : 'text-zinc-550 hover:text-zinc-350'
                                    }`}
                            >
                                <Layout className="h-5 w-5" />
                                {t('devlogs')}
                                {activeTab === 'devlogs' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full" />
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('projects')}
                                className={`flex items-center gap-2 pb-4 px-2 text-lg font-bold transition-all relative ${activeTab === 'projects'
                                    ? 'text-white'
                                    : 'text-zinc-550 hover:text-zinc-350'
                                    }`}
                            >
                                <FolderKanban className="h-5 w-5" />
                                {t('projects')}
                                {activeTab === 'projects' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full" />
                                )}
                            </button>
                        </div>

                        {/* ── Filter Bar ── always visible below tabs */}
                        <div className="flex items-center gap-3 flex-wrap py-4 border-b border-zinc-800/50 mb-6">
                            
                            {/* Sort */}
                            <button
                                onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                                    sortOrder !== 'newest'
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                }`}
                            >
                                <ArrowUpDown className="w-4 h-4" />
                                {sortOrder === 'newest' ? t('newest') : t('oldest')}
                            </button>

                            {/* Status Filter */}
                            {STATUS_OPTIONS.map(opt => {
                                const statusLabel = opt.value === 'in_dev' 
                                    ? (t('inDevelopment' as any) || opt.label) 
                                    : opt.value === 'released' 
                                        ? (t('released' as any) || opt.label) 
                                        : opt.label;
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSelectedStatus(selectedStatus === opt.value ? '' : opt.value)}
                                        className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all border ${
                                            selectedStatus === opt.value
                                                ? opt.activeClass
                                                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                        }`}
                                    >
                                        {statusLabel}
                                    </button>
                                );
                            })}

                            {/* Following Filter */}
                            {user && (
                                <button
                                    onClick={() => setShowFollowingOnly(!showFollowingOnly)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                                        showFollowingOnly
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                    }`}
                                >
                                    <UserCheck className="w-4 h-4" />
                                    {t('following')}
                                </button>
                            )}

                            {/* Tech Stack Picker Toggle */}
                            <button
                                onClick={() => setShowTechPicker(!showTechPicker)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                                    showTechPicker || selectedTechs.length > 0
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                                  }`}
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                {t('techStack')}
                                {selectedTechs.length > 0 && (
                                    <span className="bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                        {selectedTechs.length}
                                    </span>
                                )}
                            </button>

                            {/* Active Tech Chips */}
                            {selectedTechs.map(tech => (
                                <span
                                    key={tech}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20"
                                >
                                    {tech}
                                    <X 
                                        className="w-3 h-3 cursor-pointer hover:text-emerald-200 transition-colors" 
                                        onClick={() => toggleTech(tech)}
                                    />
                                </span>
                            ))}

                            {/* Clear All */}
                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="text-xs text-zinc-500 hover:text-red-400 transition-colors ml-auto underline underline-offset-2"
                                >
                                    {t('clearAll')}
                                </button>
                            )}
                        </div>

                        {/* Tech Stack Picker Panel — expandable */}
                        {showTechPicker && (
                            <div className="mb-6 p-5 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('selectTechnologies')}</label>
                                    <button onClick={() => setShowTechPicker(false)} className="text-zinc-500 hover:text-white p-1">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {AVAILABLE_TECH.map(tech => (
                                        <button
                                            key={tech}
                                            onClick={() => toggleTech(tech)}
                                            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all border ${
                                                selectedTechs.includes(tech)
                                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                                                    : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:border-zinc-600 hover:text-white'
                                            }`}
                                        >
                                            {tech}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
                                </div>
                            ) : activeTab === 'devlogs' ? (
                                <div className="flex flex-col gap-6 w-full">
                                    {devlogs.length > 0 ? (
                                        devlogs.map((post) => (
                                            <PostCard key={post.id} post={post} />
                                        ))
                                    ) : (
                                        <div className="text-center py-20 text-zinc-500">
                                            {t('noDevlogsFound')}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6 w-full">
                                    {projects.length > 0 ? (
                                        projects.map((project) => (
                                            <ProjectCard key={project.id} project={project} />
                                        ))
                                    ) : (
                                        <div className="text-center py-20 text-zinc-500">
                                            {hasActiveFilters ? t('noProjectsMatch') : t('noProjectsFound')}
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
                    setActiveTab('projects');
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
