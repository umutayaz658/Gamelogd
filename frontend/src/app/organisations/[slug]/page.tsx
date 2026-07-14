'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import ProjectCard from "@/components/ProjectCard";
import PostCard from "@/components/PostCard";
import api from '@/lib/api';
import { Organisation, Project, Post } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import {
    Check, Users, Globe, Twitter, Youtube, Calendar,
    FolderKanban, Layout, Users2, Settings, Plus, CheckSquare
} from 'lucide-react';
import Link from 'next/link';
import MemberManager from '@/components/team/MemberManager';
import { useToast } from '@/context/ToastContext';

export default function OrganisationProfilePage() {
    const { slug } = useParams() as { slug: string };
    const { t } = useTranslation();
    const { user } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [organisation, setOrganisation] = useState<Organisation | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [devlogs, setDevlogs] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'projects' | 'devlogs' | 'team'>('projects');

    const fetchOrganisationData = async () => {
        if (!slug) return;
        try {
            // Fetch organisation details
            const orgRes = await api.get(`/organisations/${slug}/`);
            setOrganisation(orgRes.data);

            // Fetch projects associated with this organisation
            const projRes = await api.get(`/projects/?organisation_slug=${slug}`);
            setProjects(projRes.data.results || projRes.data);

            // Fetch devlogs associated with this organisation
            const devlogRes = await api.get(`/posts/?organisation_slug=${slug}`);
            setDevlogs(devlogRes.data.results || devlogRes.data);
        } catch (error) {
            console.error("Failed to fetch organisation details:", error);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchOrganisationData().finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-sans">
                <Navbar />
                <div className="flex justify-center items-center h-[70vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                </div>
            </div>
        );
    }

    if (!organisation) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-sans">
                <Navbar />
                <div className="container mx-auto px-4 py-20 text-center">
                    <h2 className="text-2xl font-bold mb-4">{t('organisationNotFound' as any) || 'Organisation Not Found'}</h2>
                    <p className="text-zinc-400 mb-8">{t('organisationNotFoundDesc' as any) || 'The organisation you are looking for does not exist or has been deleted.'}</p>
                    <Link href="/devs" className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl font-bold transition-all">
                        {t('backToDevsHub' as any) || 'Back to Devs Hub'}
                    </Link>
                </div>
            </div>
        );
    }

    const bannerUrl = getImageUrl(organisation.banner);
    const logoUrl = getImageUrl(organisation.logo);

    const isMember = organisation.members?.some(m => m.user.id === user?.id);
    const userMemberObj = organisation.members?.find(m => m.user.id === user?.id);
    const canManage = userMemberObj && (userMemberObj.role === 'owner' || userMemberObj.role === 'admin');

    const handleFollowToggle = async () => {
        if (!user) {
            toast.info(t('pleaseLogin' as any) || 'Please log in to follow.');
            return;
        }

        setFollowLoading(true);
        try {
            if (organisation.is_following) {
                await api.post(`/organisations/${slug}/unfollow/`);
                setOrganisation(prev => prev ? {
                    ...prev,
                    is_following: false,
                    followers_count: Math.max(0, (prev.followers_count || 1) - 1)
                } : null);
            } else {
                await api.post(`/organisations/${slug}/follow/`);
                setOrganisation(prev => prev ? {
                    ...prev,
                    is_following: true,
                    followers_count: (prev.followers_count || 0) + 1
                } : null);
            }
        } catch (error) {
            console.error("Error toggling organisation follow:", error);
        } finally {
            setFollowLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-12">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Profile Content */}
                    <div className="col-span-12 lg:col-span-9 space-y-6">
                        
                        {/* Header Container */}
                        <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
                            {/* Banner Image */}
                            <div className="h-48 md:h-64 bg-gradient-to-r from-blue-900/30 via-indigo-950/20 to-zinc-900 relative">
                                {bannerUrl && (
                                    <img 
                                        src={bannerUrl} 
                                        alt={`${organisation.name} banner`} 
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>

                            {/* Info Section */}
                            <div className="px-6 pb-6 pt-0 relative flex flex-col md:flex-row md:items-end justify-between gap-6">
                                {/* Logo overlapping banner */}
                                <div className="flex flex-col md:flex-row items-start md:items-end gap-5">
                                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl border-4 border-zinc-900 bg-zinc-950 overflow-hidden shadow-2xl flex items-center justify-center font-bold text-white text-3xl md:text-4xl absolute -top-12 md:-top-16 left-6">
                                        {logoUrl ? (
                                            <img src={logoUrl} alt={organisation.name} className="w-full h-full object-cover" />
                                        ) : (
                                            organisation.name.charAt(0).toUpperCase()
                                        )}
                                    </div>

                                    {/* Text Info */}
                                    <div className="pt-14 md:pt-0 md:ml-40 space-y-1.5">
                                        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
                                            {organisation.name}
                                            {organisation.is_verified && (
                                                <span className="inline-flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-400 p-0.5 rounded-lg" title="Verified Studio">
                                                    <Check className="h-4 w-4 stroke-[3]" />
                                                </span>
                                            )}
                                        </h1>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
                                            <span className="font-mono text-zinc-500">/organisations/{organisation.slug}</span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {t('joined') || 'Katılma'}: {new Date(organisation.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3 self-start md:self-end">
                                    {canManage && (
                                        <Link 
                                            href={`/organisations/${organisation.slug}/dashboard`}
                                            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-sm"
                                        >
                                            <Settings className="h-4 w-4" />
                                            <span>{t('manage' as any) || 'Yönet'}</span>
                                        </Link>
                                    )}

                                    {/* Follow toggle button */}
                                    <button
                                        onClick={handleFollowToggle}
                                        disabled={followLoading}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all text-sm border ${
                                            organisation.is_following
                                                ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                                                : 'bg-blue-600 border-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/15'
                                        }`}
                                    >
                                        {organisation.is_following ? (
                                            <>
                                                <CheckSquare className="h-4 w-4" />
                                                <span>{t('following') || 'Takip Ediliyor'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Plus className="h-4 w-4" />
                                                <span>{t('follow') || 'Takip Et'}</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Bio & Social Links bar */}
                            <div className="px-6 pb-6 border-t border-zinc-800/40 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="max-w-2xl text-zinc-300 text-sm leading-relaxed">
                                    {organisation.description || t('noBioAvailable' as any) || 'No description provided.'}
                                </div>

                                <div className="flex items-center gap-4 text-zinc-500 border-t md:border-t-0 border-zinc-850 pt-3 md:pt-0">
                                    {organisation.website && (
                                        <a href={organisation.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors text-sm font-semibold">
                                            <Globe className="h-4 w-4" />
                                            <span className="hidden md:inline">Website</span>
                                        </a>
                                    )}
                                    {organisation.twitter && (
                                        <a href={organisation.twitter} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors text-sm font-semibold">
                                            <Twitter className="h-4 w-4" />
                                            <span className="hidden md:inline">Twitter</span>
                                        </a>
                                    )}
                                    {organisation.youtube && (
                                        <a href={organisation.youtube} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors text-sm font-semibold">
                                            <Youtube className="h-4 w-4" />
                                            <span className="hidden md:inline">YouTube</span>
                                        </a>
                                    )}
                                    <div className="w-px h-4 bg-zinc-800 hidden md:block" />
                                    <span className="flex items-center gap-1 text-zinc-400 font-semibold text-sm">
                                        <Users className="h-4 w-4 text-zinc-550" />
                                        <strong>{organisation.followers_count}</strong> {t('followers') || 'takipçi'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Profile Tabs */}
                        <div className="flex gap-4 border-b border-zinc-800">
                            <button
                                onClick={() => setActiveTab('projects')}
                                className={`flex items-center gap-2 pb-4 px-2 text-lg font-bold transition-all relative ${activeTab === 'projects'
                                    ? 'text-white'
                                    : 'text-zinc-550 hover:text-zinc-350'
                                    }`}
                            >
                                <FolderKanban className="h-5 w-5" />
                                {t('projects') || 'Projeler'} ({projects.length})
                                {activeTab === 'projects' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full" />
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('devlogs')}
                                className={`flex items-center gap-2 pb-4 px-2 text-lg font-bold transition-all relative ${activeTab === 'devlogs'
                                    ? 'text-white'
                                    : 'text-zinc-550 hover:text-zinc-350'
                                    }`}
                            >
                                <Layout className="h-5 w-5" />
                                {t('devlogs') || 'Geliştirici Günlükleri'} ({devlogs.length})
                                {activeTab === 'devlogs' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full" />
                                )}
                            </button>

                            <button
                                onClick={() => setActiveTab('team')}
                                className={`flex items-center gap-2 pb-4 px-2 text-lg font-bold transition-all relative ${activeTab === 'team'
                                    ? 'text-white'
                                    : 'text-zinc-550 hover:text-zinc-350'
                                    }`}
                            >
                                <Users2 className="h-5 w-5" />
                                {t('team' as any) || 'Ekip'} ({organisation.members?.length || 0})
                                {activeTab === 'team' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full" />
                                )}
                            </button>
                        </div>

                        {/* Tabs Content */}
                        <div className="animate-in fade-in duration-300">
                            {activeTab === 'projects' ? (
                                <div className="flex flex-col gap-6 w-full">
                                    {projects.length > 0 ? (
                                        projects.map((project) => (
                                            <ProjectCard key={project.id} project={project} />
                                        ))
                                    ) : (
                                        <div className="text-center py-20 text-zinc-500 bg-zinc-900/20 rounded-2xl border border-zinc-800/40">
                                            {t('noProjectsFound') || 'Bu organizasyon için henüz bir proje oluşturulmamış.'}
                                        </div>
                                    )}
                                </div>
                            ) : activeTab === 'devlogs' ? (
                                <div className="flex flex-col gap-6 w-full">
                                    {devlogs.length > 0 ? (
                                        devlogs.map((post) => (
                                            <PostCard key={post.id} post={post} />
                                        ))
                                    ) : (
                                        <div className="text-center py-20 text-zinc-500 bg-zinc-900/20 rounded-2xl border border-zinc-800/40">
                                            {t('noDevlogsFound') || 'Bu organizasyon için henüz bir devlog paylaşılmamış.'}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full">
                                    <MemberManager
                                        scope="organisation"
                                        organisationId={organisation.id}
                                        organisationSlug={organisation.slug}
                                        members={organisation.members ?? []}
                                        onRefresh={fetchOrganisationData}
                                    />
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
