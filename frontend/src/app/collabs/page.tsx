'use client';

import { useState, useEffect } from 'react';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import JobPostingCard from "@/components/JobPostingCard";
import FilterDropdown from "@/components/FilterDropdown";
import { PlusCircle, Search, Briefcase, MapPin, Zap, Filter } from 'lucide-react';
import api from '@/lib/api';
import { JobPosting } from '@/types';

export default function CollabsPage() {
    const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        job_type: '',
        location_type: '',
        experience_level: ''
    });

    useEffect(() => {
        const fetchJobs = async () => {
            setLoading(true);
            try {
                // Build query string
                const params = new URLSearchParams();
                if (filters.search) params.append('search', filters.search);
                if (filters.job_type) params.append('job_type', filters.job_type);
                if (filters.location_type) params.append('location_type', filters.location_type);
                if (filters.experience_level) params.append('experience_level', filters.experience_level);

                const res = await api.get(`/job-postings/?${params.toString()}`);
                setJobPostings(res.data.results || res.data);
            } catch (error) {
                console.error("Failed to fetch job postings:", error);
            } finally {
                setLoading(false);
            }
        };
        const timeoutId = setTimeout(() => {
            fetchJobs();
        }, 300); // Debounce

        return () => clearTimeout(timeoutId);
    }, [filters]);

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

                        {/* Header & Filter Bar */}
                        <div className="mb-8">
                            <div className="flex items-end justify-between mb-6">
                                <div>
                                    <h1 className="text-3xl font-bold text-white mb-2">Collabs & Jobs Hub</h1>
                                    <p className="text-zinc-400">Find your next team or hire talented developers.</p>
                                </div>
                                <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20">
                                    <PlusCircle className="h-5 w-5" />
                                    <span>Post Job</span>
                                </button>
                            </div>

                            {/* Filter Area */}
                            {/* Filter Area (Modernized) */}
                            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                                <div className="relative mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
                                    <input
                                        type="text"
                                        placeholder="Search by title, description, or math..."
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-600"
                                        value={filters.search}
                                        onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                    />
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <FilterDropdown
                                        label="Job Type"
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
                                        label="Location"
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
                                        label="Level"
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

                                    {/* Reset Button */}
                                    {(filters.search || filters.job_type || filters.location_type || filters.experience_level) && (
                                        <button
                                            onClick={() => setFilters({ search: '', job_type: '', location_type: '', experience_level: '' })}
                                            className="ml-auto text-sm font-medium text-zinc-500 hover:text-white transition-colors px-3 py-2"
                                        >
                                            Clear Filters
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {loading ? (
                                <div className="flex justify-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                                    {jobPostings.length > 0 ? (
                                        jobPostings.map((job) => (
                                            <JobPostingCard key={job.id} job={job} />
                                        ))
                                    ) : (
                                        <div className="col-span-full py-20 text-center text-zinc-500 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                                            <Briefcase className="h-12 w-12 mx-auto mb-4 text-zinc-700" />
                                            <p className="text-lg font-medium text-zinc-300">No jobs found matching your filters.</p>
                                            <p className="text-zinc-500">Try adjusting your search criteria.</p>
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
