'use client';

import { useState, useEffect, useRef } from 'react';
import { notFound } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import JobPostingCard from "@/components/JobPostingCard";
import FilterDropdown from "@/components/FilterDropdown";
import CollabDetailPane from "@/components/CollabDetailPane";
import { PlusCircle, Search, Briefcase, MapPin, Zap, Filter, Code2, Check, X } from 'lucide-react';
import api from '@/lib/api';
import { JobPosting } from '@/types';
import { useTranslation } from '@/lib/useTranslation';

const AVAILABLE_TECH = [
    "Unity", "Unreal Engine", "Godot", "C#", "C++", "Python", "JavaScript",
    "TypeScript", "React", "Node.js", "Blender", "Maya", "ZBrush", "Photoshop",
    "Illustrator", "FMOD", "Wwise", "HLSL", "GLSL", "Firebase", "AWS", "Docker"
];

export default function CollabsPage() {
    if (process.env.NODE_ENV === 'production') {
        notFound();
        return null;
    }

    const { t } = useTranslation();
    const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
    const [selectedJob, setSelectedJob] = useState<JobPosting | null>(null);
    const [loading, setLoading] = useState(true);

    // Filter State
    const [postType, setPostType] = useState<'all' | 'job' | 'talent'>('all');
    const [filters, setFilters] = useState({
        search: '',
        job_type: '',
        location_type: '',
        experience_level: ''
    });
    const [techStack, setTechStack] = useState<string[]>([]);

    // Tech Stack Drawer state
    const [showTechDrawer, setShowTechDrawer] = useState(false);
    const techDrawerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchJobs = async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams();
                if (filters.search) params.append('search', filters.search);
                if (postType !== 'all') params.append('post_type', postType);
                if (filters.job_type) params.append('job_type', filters.job_type);
                if (filters.location_type) params.append('location_type', filters.location_type);
                if (filters.experience_level) params.append('experience_level', filters.experience_level);
                if (techStack.length > 0) params.append('tech_stack', techStack.join(','));

                const res = await api.get(`/job-postings/?${params.toString()}`);
                const data = res.data.results || res.data;
                setJobPostings(data);

                // If selected job is no longer in results, clear selection or select first
                if (selectedJob && !data.find((j: JobPosting) => j.id === selectedJob.id)) {
                    setSelectedJob(null);
                } else if (!selectedJob && data.length > 0 && window.innerWidth >= 1024) {
                    // Auto-select first item on desktop
                    setSelectedJob(data[0]);
                }
            } catch (error) {
                console.error("Failed to fetch job postings:", error);
            } finally {
                setLoading(false);
            }
        };
        const timeoutId = setTimeout(() => {
            fetchJobs();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [filters, postType, techStack]);

    // Close tech drawer on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (techDrawerRef.current && !techDrawerRef.current.contains(event.target as Node)) {
                setShowTechDrawer(false);
            }
        }
        if (showTechDrawer) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showTechDrawer]);

    const handleTechToggle = (tech: string) => {
        setTechStack(prev =>
            prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]
        );
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30 flex flex-col">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-12 flex-1 flex flex-col overflow-hidden h-[calc(100vh-64px)]">
                <div className="grid grid-cols-12 gap-6 h-full">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3 overflow-y-auto h-full pr-2 custom-scrollbar">
                        <LeftSidebar />
                    </div>

                    {/* Main Content Area */}
                    <div className={`col-span-12 lg:col-span-9 h-full flex flex-col ${selectedJob ? 'hidden lg:flex' : 'flex'}`}>
                        {/* Header & Filter Bar */}
                        <div className="mb-6 flex-shrink-0">
                            <div className="flex items-end justify-between mb-4">
                                <div>
<<<<<<< HEAD
                                    <h1 className="text-3xl font-bold text-white mb-2">{t('collabsJobsHub')}</h1>
                                    <p className="text-zinc-400">{t('collabsDescription')}</p>
=======
                                    <h1 className="text-3xl font-bold text-white mb-2">Collabs & Jobs</h1>
                                    <p className="text-zinc-400">Find your next team or hire talented developers.</p>
>>>>>>> origin/main
                                </div>
                                <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20">
                                    <PlusCircle className="h-5 w-5" />
                                    <span>{t('postCollab')}</span>
                                </button>
                            </div>

                            {/* Filters Container */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-4">
                                {/* Top Row: Post Type Toggle & Search */}
                                <div className="flex flex-col md:flex-row gap-4 items-center">
                                    <div className="flex p-1 bg-zinc-950 border border-zinc-800 rounded-xl w-full md:w-auto">
                                        <button
                                            onClick={() => setPostType('all')}
                                            className={`flex-1 md:px-6 py-2 rounded-lg text-sm font-bold transition-colors ${postType === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                            {t('all')}
                                        </button>
                                        <button
                                            onClick={() => setPostType('job')}
                                            className={`flex-1 md:px-6 py-2 rounded-lg text-sm font-bold transition-colors ${postType === 'job' ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                            {t('jobs')}
                                        </button>
                                        <button
                                            onClick={() => setPostType('talent')}
                                            className={`flex-1 md:px-6 py-2 rounded-lg text-sm font-bold transition-colors ${postType === 'talent' ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                            {t('talent')}
                                        </button>
                                    </div>

                                    <div className="relative flex-1 w-full">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                        <input
                                            type="text"
                                            placeholder={t('collabsSearchPlaceholder')}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-600"
                                            value={filters.search}
                                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                        />
                                    </div>
                                </div>

                                {/* Bottom Row: Dropdowns */}
                                <div className="flex flex-wrap gap-3 items-center">
                                    <FilterDropdown
                                        label={t('jobType')}
                                        icon={<Filter className="h-4 w-4" />}
                                        value={filters.job_type}
                                        onChange={(val) => setFilters(prev => ({ ...prev, job_type: val }))}
                                        options={[
                                            { value: 'full_time', label: 'Full-time' },
                                            { value: 'part_time', label: 'Part-time' },
                                            { value: 'contract', label: 'Contract' },
                                            { value: 'rev_share', label: 'Rev-share' },
                                            { value: 'hobby', label: 'Hobby' },
                                        ]}
                                    />

                                    <FilterDropdown
                                        label={t('location')}
                                        icon={<MapPin className="h-4 w-4" />}
                                        value={filters.location_type}
                                        onChange={(val) => setFilters(prev => ({ ...prev, location_type: val }))}
                                        options={[
                                            { value: 'remote', label: 'Remote' },
                                            { value: 'on_site', label: 'On-site' },
                                            { value: 'hybrid', label: 'Hybrid' },
                                        ]}
                                    />

                                    <FilterDropdown
                                        label={t('level')}
                                        icon={<Zap className="h-4 w-4" />}
                                        value={filters.experience_level}
                                        onChange={(val) => setFilters(prev => ({ ...prev, experience_level: val }))}
                                        options={[
                                            { value: 'junior', label: 'Junior' },
                                            { value: 'mid', label: 'Mid-Level' },
                                            { value: 'senior', label: 'Senior' },
                                            { value: 'lead', label: 'Lead' },
                                        ]}
                                    />

                                    <div className="relative" ref={techDrawerRef}>
                                        <button
                                            onClick={() => setShowTechDrawer(!showTechDrawer)}
                                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${techStack.length > 0 || showTechDrawer ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                                                }`}
                                        >
                                            <Code2 className={`h-4 w-4 ${techStack.length > 0 ? 'text-emerald-500' : ''}`} />
                                            <span className={techStack.length > 0 ? 'text-emerald-500' : ''}>
                                                {techStack.length > 0 ? `${techStack.length} ${t('techSelected')}` : t('techStack')}
                                            </span>
                                        </button>

                                        {showTechDrawer && (
                                            <div className="absolute top-full left-0 mt-2 w-72 md:w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl shadow-black/50 overflow-hidden z-50 p-4">
                                                <div className="flex justify-between items-center mb-3">
                                                    <span className="text-sm font-bold text-white">{t('selectTechnologies')}</span>
                                                    {techStack.length > 0 && (
                                                        <button onClick={() => setTechStack([])} className="text-xs text-zinc-400 hover:text-white">{t('clearAll')}</button>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                                                    {AVAILABLE_TECH.map(tech => (
                                                        <button
                                                            key={tech}
                                                            onClick={() => handleTechToggle(tech)}
                                                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${techStack.includes(tech)
                                                                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
                                                                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                                                                }`}
                                                        >
                                                            {tech}
                                                            {techStack.includes(tech) && <Check className="h-3 w-3" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {(filters.search || filters.job_type || filters.location_type || filters.experience_level || techStack.length > 0 || postType !== 'all') && (
                                        <button
                                            onClick={() => {
                                                setFilters({ search: '', job_type: '', location_type: '', experience_level: '' });
                                                setTechStack([]);
                                                setPostType('all');
                                            }}
                                            className="ml-auto text-sm font-medium text-red-400 hover:text-red-300 transition-colors px-3 py-2 flex items-center gap-1"
                                        >
                                            <X className="h-4 w-4" /> {t('clearAll')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Split Pane Area */}
                        <div className="flex-1 overflow-hidden grid grid-cols-12 gap-6 min-h-0">
                            {/* Left List Pane */}
                            <div className={`col-span-12 lg:col-span-5 h-full overflow-y-auto custom-scrollbar pr-2 pb-20 ${selectedJob ? 'hidden lg:block' : 'block'}`}>
                                {loading ? (
                                    <div className="flex justify-center py-20">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {jobPostings.length > 0 ? (
                                            jobPostings.map((job) => (
                                                <JobPostingCard
                                                    key={job.id}
                                                    job={job}
                                                    selected={selectedJob?.id === job.id}
                                                    onClick={() => setSelectedJob(job)}
                                                />
                                            ))
                                        ) : (
                                            <div className="py-20 text-center text-zinc-500 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                                                <Briefcase className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
                                                <p className="text-lg font-medium text-zinc-300">{t('noPostingsFound')}</p>
                                                <p className="text-sm text-zinc-500">{t('tryAdjustingFilters')}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Right Detail Pane (Desktop only natively, Mobile shows full screen when selected) */}
                            {selectedJob && (
                                <div className="col-span-12 lg:col-span-7 h-full lg:block">
                                    <CollabDetailPane
                                        job={selectedJob}
                                        onClose={() => setSelectedJob(null)}
                                    />
                                </div>
                            )}
                        </div>

                    </div>

                    {/* Mobile Detail Overlay (Only visible on mobile when selectedJob exists) */}
                    {selectedJob && (
                        <div className="lg:hidden fixed inset-0 z-50 bg-zinc-950 flex flex-col">
                            <div className="flex-1 overflow-hidden pt-4 px-4 pb-4">
                                <CollabDetailPane
                                    job={selectedJob}
                                    onClose={() => setSelectedJob(null)}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
