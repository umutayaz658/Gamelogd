'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import PostCard from "@/components/PostCard";
import api from '@/lib/api';
import { Project, Post } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { sanitizeUrl } from '@/lib/url';
import { Users, Layout, Info, Edit2, Plus, Settings, ChevronDown, UserPlus, UserCheck, Bug, Calendar, Globe, Twitter, Youtube, Link2 } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import CreateDevlogModal from '@/components/modals/CreateDevlogModal';
import { useTranslation } from '@/lib/useTranslation';
import MemberManager from '@/components/team/MemberManager';
import FeedbackPanel from '@/components/devs/FeedbackPanel';
import { useConfirm } from '@/context/ConfirmContext';

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id;
    const { user } = useAuth();
    const { t } = useTranslation();
    const confirm = useConfirm();

    const [project, setProject] = useState<Project | null>(null);
    const [devlogs, setDevlogs] = useState<Post[]>([]);
    const [activeTab, setActiveTab] = useState<'about' | 'devlogs' | 'feedback' | 'participants'>('devlogs');
    const [loading, setLoading] = useState(true);

    // Status Dropdown
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);

    // Follow State
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [showDevlogModal, setShowDevlogModal] = useState(false);
    const [isInviteActionLoading, setIsInviteActionLoading] = useState(false);

    const fetchProjectData = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const projectRes = await api.get(`/projects/${projectId}/`);
            setProject(projectRes.data);
            setIsFollowing(projectRes.data.is_following || false);
            setFollowersCount(projectRes.data.followers_count || 0);

            const postsRes = await api.get(`/posts/?project_parent=${projectId}`);
            setDevlogs(postsRes.data.results || postsRes.data);
        } catch (error) {
            console.error("Failed to load project:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjectData();
    }, [projectId]);

    const isOwner = user?.id === project?.owner.id;
    const userMember = project?.members?.find(m => m.user.id === user?.id);
    const isAdmin = isOwner || (userMember?.role === 'admin' && userMember?.status === 'active');
    const isEditor = isAdmin || (userMember?.role === 'editor' && userMember?.status === 'active');

    const handleAcceptInvite = async () => {
        if (!userMember || isInviteActionLoading) return;
        setIsInviteActionLoading(true);
        try {
            await api.post(`/project-members/${userMember.id}/accept/`);
            await fetchProjectData();
        } catch (error) {
            console.error("Failed to accept invite:", error);
        } finally {
            setIsInviteActionLoading(false);
        }
    };

    const handleDeclineInvite = async () => {
        if (!userMember || isInviteActionLoading) return;
        if (!(await confirm({ message: "Are you sure you want to decline this invitation?", confirmText: 'Decline', isDanger: true }))) return;
        setIsInviteActionLoading(true);
        try {
            await api.delete(`/project-members/${userMember.id}/`);
            router.push('/devs');
        } catch (error) {
            console.error("Failed to decline invite:", error);
        } finally {
            setIsInviteActionLoading(false);
        }
    };

    const handleFollowToggle = async () => {
        if (!project || isFollowLoading) return;
        setIsFollowLoading(true);
        try {
            if (isFollowing) {
                await api.post(`/projects/${project.id}/unfollow/`);
                setIsFollowing(false);
                setFollowersCount(prev => Math.max(0, prev - 1));
            } else {
                await api.post(`/projects/${project.id}/follow/`);
                setIsFollowing(true);
                setFollowersCount(prev => prev + 1);
            }
        } catch (error) {
            console.error("Failed to toggle follow:", error);
        } finally {
            setIsFollowLoading(false);
        }
    };

    const handleUpdateStatus = async (newStatus: string) => {
        if (!project) return;
        try {
            await api.patch(`/projects/${project.id}/`, { status: newStatus });
            setProject({ ...project, status: newStatus as any });
            setShowStatusDropdown(false);
        } catch (error) {
            console.error("Failed to update status", error);
        }
    };

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
                <h1 className="text-2xl font-bold mb-4">{t('projectNotFound')}</h1>
                <Link href="/devs" className="text-emerald-500 hover:underline">
                    {t('backToDevHub')}
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6 pb-12">
                <div className="grid grid-cols-12 gap-6">
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    <div className="col-span-12 lg:col-span-9">

                        {/* Header Container */}
                        <div className="bg-zinc-900/40 backdrop-blur-md border border-zinc-800 rounded-3xl overflow-hidden shadow-xl mb-6">
                            {/* Banner Image */}
                            <div className="h-48 md:h-64 bg-gradient-to-br from-emerald-900/30 via-zinc-950/20 to-zinc-900 relative">
                                {project.cover_image && (
                                    <img
                                        src={project.cover_image}
                                        alt={project.title}
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>

                            {/* Info Section */}
                            <div className="px-6 pb-6 pt-0 relative flex flex-col md:flex-row md:items-end justify-between gap-6">
                                {/* Logo overlapping banner */}
                                <div className="flex flex-col md:flex-row items-start md:items-end gap-5">
                                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl border-4 border-zinc-900 bg-zinc-950 overflow-hidden shadow-2xl flex items-center justify-center font-bold text-white text-3xl md:text-4xl absolute -top-12 md:-top-16 left-6">
                                        {project.logo ? (
                                            <img src={project.logo} alt={project.title} className="w-full h-full object-cover" />
                                        ) : (
                                            project.title.charAt(0).toUpperCase()
                                        )}
                                    </div>

                                    {/* Text Info */}
                                    <div className="pt-14 md:pt-0 md:ml-40 space-y-1.5">
                                        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-2">
                                            {project.title}
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                                    project.status === 'released' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                                                    project.status === 'beta' ? 'bg-blue-500/20 border-blue-500 text-blue-400' :
                                                    project.status === 'alpha' ? 'bg-purple-500/20 border-purple-500 text-purple-400' :
                                                    'bg-amber-500/20 border-amber-500 text-amber-400'
                                                }`}>
                                                {project.status.replaceAll('_', ' ')}
                                            </span>
                                        </h1>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-400">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="h-3.5 w-3.5" />
                                                {t('started')}: {new Date(project.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-3 self-start md:self-end">
                                    {userMember && userMember.status === 'pending' ? (
                                        <>
                                            <button
                                                onClick={handleAcceptInvite}
                                                disabled={isInviteActionLoading}
                                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 shadow-lg shadow-emerald-900/20"
                                            >
                                                Accept Invite
                                            </button>
                                            <button
                                                onClick={handleDeclineInvite}
                                                disabled={isInviteActionLoading}
                                                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200"
                                            >
                                                Decline
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {isAdmin && (
                                                <Link
                                                    href={`/projects/${project.id}/dashboard`}
                                                    className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-sm"
                                                >
                                                    <Settings className="h-4 w-4" />
                                                    <span>{t('manage')}</span>
                                                </Link>
                                            )}
                                            {isEditor && (
                                                <button
                                                    onClick={() => setShowDevlogModal(true)}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all duration-200 shadow-lg shadow-blue-900/20"
                                                >
                                                    <Plus className="w-4 h-4" /> Log Dev
                                                </button>
                                            )}
                                            {/* Follow Button */}
                                            <button
                                                onClick={handleFollowToggle}
                                                disabled={isFollowLoading}
                                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                                                    isFollowing
                                                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                                                } ${isFollowLoading ? 'opacity-50 pointer-events-none' : ''}`}
                                            >
                                                {isFollowing ? (
                                                    <><UserCheck className="w-4 h-4" /> {t('following')}</>
                                                ) : (
                                                    <><UserPlus className="w-4 h-4" /> {t('follow')}</>
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Created By & Social Links bar */}
                            <div className="px-6 pb-6 border-t border-zinc-800/40 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                {project.organisation_details ? (
                                    <Link href={`/organisations/${project.organisation_details.slug}`} className="flex items-center gap-2 group">
                                        <img
                                            src={getImageUrl(project.organisation_details.logo, project.organisation_details.name)}
                                            alt={project.organisation_details.name}
                                            className="h-8 w-8 rounded-full bg-zinc-800 object-cover border-2 border-transparent group-hover:border-emerald-500 transition-all"
                                        />
                                        <div>
                                            <p className="text-xs text-zinc-500">{t('createdBy')}</p>
                                            <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                                                {project.organisation_details.name}
                                            </p>
                                        </div>
                                    </Link>
                                ) : (
                                    <Link href={`/${project.owner.username}`} className="flex items-center gap-2 group">
                                        <img
                                            src={getImageUrl(project.owner.avatar, project.owner.username)}
                                            alt={project.owner.username}
                                            className="h-8 w-8 rounded-full bg-zinc-800 object-cover border-2 border-transparent group-hover:border-emerald-500 transition-all"
                                        />
                                        <div>
                                            <p className="text-xs text-zinc-500">{t('createdBy')}</p>
                                            <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors">
                                                {project.owner.real_name || project.owner.username}
                                            </p>
                                        </div>
                                    </Link>
                                )}

                                <div className="flex items-center gap-4 text-zinc-500 border-t md:border-t-0 border-zinc-850 pt-3 md:pt-0">
                                    {project.website && (
                                        <a href={sanitizeUrl(project.website)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors text-sm font-semibold">
                                            <Globe className="h-4 w-4" />
                                            <span className="hidden md:inline">Website</span>
                                        </a>
                                    )}
                                    {project.twitter && (
                                        <a href={sanitizeUrl(project.twitter)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors text-sm font-semibold">
                                            <Twitter className="h-4 w-4" />
                                            <span className="hidden md:inline">Twitter</span>
                                        </a>
                                    )}
                                    {project.youtube && (
                                        <a href={sanitizeUrl(project.youtube)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors text-sm font-semibold">
                                            <Youtube className="h-4 w-4" />
                                            <span className="hidden md:inline">YouTube</span>
                                        </a>
                                    )}
                                    {(project.extra_links ?? []).map((link, i) => (
                                        <a key={i} href={sanitizeUrl(link.url)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-white transition-colors text-sm font-semibold">
                                            <Link2 className="h-4 w-4" />
                                            <span className="hidden md:inline">{link.label}</span>
                                        </a>
                                    ))}
                                    <div className="w-px h-4 bg-zinc-800 hidden md:block" />
                                    <span className="flex items-center gap-1 text-zinc-400 font-semibold text-sm">
                                        <Users className="h-4 w-4 text-zinc-550" />
                                        <strong>{followersCount}</strong> {t('followers').toLowerCase()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-6 border-b border-zinc-800 mb-6 relative">
                            <button
                                onClick={() => setActiveTab('devlogs')}
                                className={`pb-3 text-lg font-bold transition-all relative ${activeTab === 'devlogs' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Layout className="h-5 w-5" />
                                    {t('devlogs')} ({devlogs.length})
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
                                    {t('about')}
                                </div>
                                {activeTab === 'about' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('feedback')}
                                className={`pb-3 text-lg font-bold transition-all relative ${activeTab === 'feedback' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Bug className="h-5 w-5" />
                                    Feedback
                                </div>
                                {activeTab === 'feedback' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('participants')}
                                className={`pb-3 text-lg font-bold transition-all relative ${activeTab === 'participants' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    {t('participants')}
                                </div>
                                {activeTab === 'participants' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {activeTab === 'devlogs' ? (
                                <div className="flex flex-col gap-6 w-full">
                                    {devlogs.length > 0 ? (
                                        devlogs.map((post) => (
                                            <PostCard key={post.id} post={post} />
                                        ))
                                    ) : (
                                        <div className="p-12 text-center bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed">
                                            <Layout className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                                            <p className="text-zinc-400 text-lg">{t('noDevlogsYet')}</p>
                                        </div>
                                    )}
                                </div>
                            ) : activeTab === 'about' ? (
                                <div className="grid grid-cols-1 gap-6">
                                    {/* About & Stats */}
                                    <div className="space-y-6">
                                        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-xl font-bold">{t('aboutProject')}</h3>
                                                {isAdmin && (
                                                    <Link
                                                        href={`/projects/${project.id}/dashboard`}
                                                        className="text-zinc-400 hover:text-white flex items-center gap-1 text-sm bg-zinc-800 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4" /> {t('edit')}
                                                    </Link>
                                                )}
                                            </div>

                                            <div className="space-y-6">
                                                <h2 className="text-2xl font-black text-white">{project.title}</h2>
                                                <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                                    {project.description}
                                                </p>
                                                {project.tech_stack.length > 0 && (
                                                    <div className="pt-2">
                                                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">{t('techStack')}</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {project.tech_stack.map((tech, i) => (
                                                                <span key={i} className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-400">
                                                                    {tech}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-8 pt-8 border-t border-zinc-800">
                                                <h4 className="font-bold mb-3 text-zinc-400 uppercase text-sm tracking-wider">{t('projectStats')}</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                        <div className="text-zinc-500 text-xs mb-1">{t('started')}</div>
                                                        <div className="font-mono text-white">{new Date(project.created_at).toLocaleDateString()}</div>
                                                    </div>
                                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                        <div className="text-zinc-500 text-xs mb-1">{t('status')}</div>
                                                        {isAdmin ? (
                                                            <div className="relative">
                                                                <button 
                                                                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                                                                    className="font-mono text-emerald-400 capitalize flex items-center gap-1 hover:text-emerald-300 transition-colors"
                                                                >
                                                                    {project.status === 'released' ? t('released') :
                                                                     project.status === 'in_dev' ? t('inDevelopment') :
                                                                     project.status.replaceAll('_', ' ')} <ChevronDown className="w-3 h-3" />
                                                                </button>
                                                                {showStatusDropdown && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                                                                        <div className="absolute top-full left-0 mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95">
                                                                            {['in_dev', 'alpha', 'beta', 'released'].map(s => {
                                                                                const statusLabel = s === 'in_dev' ? t('inDevelopment') :
                                                                                                    s === 'released' ? t('released') :
                                                                                                    s;
                                                                                return (
                                                                                    <button 
                                                                                        key={s}
                                                                                        onClick={() => handleUpdateStatus(s)}
                                                                                        className={`w-full text-left px-4 py-2 text-sm capitalize transition-colors ${project.status === s ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}
                                                                                    >
                                                                                        {statusLabel.replaceAll('_', ' ')}
                                                                                    </button>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="font-mono text-emerald-400 capitalize">
                                                                {project.status === 'released' ? t('released') :
                                                                 project.status === 'in_dev' ? t('inDevelopment') :
                                                                 project.status.replaceAll('_', ' ')}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : activeTab === 'feedback' ? (
                                <FeedbackPanel
                                    projectId={project.id}
                                    organisationId={project.organisation ?? null}
                                    stickyTopClassName="top-16"
                                />
                            ) : activeTab === 'participants' ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Participants */}
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                                            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                                                <Users className="w-5 h-5 text-emerald-500" />
                                                {t('participants')}
                                            </h3>
                                            <MemberManager
                                                scope="project"
                                                organisationId={project.organisation ?? null}
                                                projectId={project.id}
                                                members={project.members ?? []}
                                                projectOwner={project.owner}
                                                onRefresh={fetchProjectData}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                    </div>
                </div>
            </main>

            {/* Create Devlog Modal */}
            <CreateDevlogModal
                isOpen={showDevlogModal}
                onClose={() => setShowDevlogModal(false)}
                defaultProjectId={project.id}
                onSuccess={(newPost) => {
                    setDevlogs(prev => [newPost, ...prev]);
                }}
            />

        </div>
    );
}
