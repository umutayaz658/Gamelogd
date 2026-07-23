'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import LeftSidebar from '@/components/LeftSidebar';
import api from '@/lib/api';
import { Project } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { Check, X, Upload, ArrowLeft, Globe, Twitter, Youtube } from 'lucide-react';
import InviteMemberButton from '@/components/team/InviteMemberButton';
import ExtraLinksEditor, { ExtraLink } from '@/components/ui/ExtraLinksEditor';

const AVAILABLE_TECH = [
    'Unity', 'Unreal Engine', 'Godot', 'GameMaker', 'C#', 'C++', 'Python', 'JavaScript', 'TypeScript',
    'Blender', 'Maya', 'ZBrush', 'Photoshop', 'Illustrator', 'FMOD', 'Wwise', 'Audacity', 'React', 'Next.js'
];

export default function ProjectDashboardPage() {
    const { id } = useParams() as { id: string };
    const { user: currentUser } = useAuth();

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'invites'>('general');

    // Edit form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [techStack, setTechStack] = useState<string[]>([]);
    const [showTechDropdown, setShowTechDropdown] = useState(false);
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [logo, setLogo] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [website, setWebsite] = useState('');
    const [twitter, setTwitter] = useState('');
    const [youtube, setYoutube] = useState('');
    const [extraLinks, setExtraLinks] = useState<ExtraLink[]>([]);

    const fetchData = async () => {
        if (!id) return;
        try {
            const res = await api.get(`/projects/${id}/`);
            const data = res.data as Project;
            setProject(data);
            setTitle(data.title);
            setDescription(data.description);
            setTechStack(data.tech_stack || []);
            if (data.cover_image) setCoverPreview(getImageUrl(data.cover_image));
            if (data.logo) setLogoPreview(getImageUrl(data.logo));
            setWebsite(data.website || '');
            setTwitter(data.twitter || '');
            setYoutube(data.youtube || '');
            setExtraLinks(data.extra_links ?? []);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load dashboard data.');
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchData().finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, currentUser]);

    const isOwner = !!currentUser && !!project && project.owner.id === currentUser.id;
    const userMember = project?.members?.find((m) => m.user.id === currentUser?.id);
    // Mirrors the backend's ProjectAccessPermission (PATCH is allowed for owner, project admin,
    // or project editor) — this previously only checked role==='admin', so an editor with a
    // custom role granting management permissions was wrongly shown "Access Denied" even though
    // their PATCH would have succeeded.
    const hasAccess = isOwner || (
        (userMember?.role === 'admin' || userMember?.role === 'editor') && userMember?.status === 'active'
    );

    const pendingMembers = (project?.members ?? []).filter((m) => m.status === 'pending');

    const handleGeneralSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!project) return;
        setSaveLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('tech_stack', JSON.stringify(techStack));
            formData.append('website', website);
            formData.append('twitter', twitter);
            formData.append('youtube', youtube);
            formData.append('extra_links', JSON.stringify(extraLinks.filter((l) => l.url.trim())));
            if (coverImage) formData.append('cover_image', coverImage);
            if (logo) formData.append('logo', logo);

            const res = await api.patch(`/projects/${id}/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setProject(res.data);
            setSuccessMessage('Project settings updated successfully!');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to save settings. Please verify details.');
        } finally {
            setSaveLoading(false);
        }
    };

    const handleCancelInvite = async (memberId: number | string) => {
        try {
            await api.delete(`/project-members/${memberId}/`);
            setProject((prev) => prev ? { ...prev, members: (prev.members ?? []).filter((m) => m.id !== memberId) } : prev);
            setSuccessMessage('Invitation cancelled.');
        } catch {
            setError('Failed to cancel invitation.');
        }
    };

    const backHref = project
        ? (project.organisation
            ? `/devs?workspace=org_${project.organisation}&tool=settings&board=project_${id}`
            : `/devs?workspace=solo&tool=settings&board=project_${id}`)
        : '/devs';

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

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-sans">
                <Navbar />
                <div className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 py-20 text-center">
                    <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
                    <p className="text-zinc-400 mb-8">You do not have permission to access the management dashboard for this project.</p>
                    <Link href={`/projects/${id}`} className="bg-zinc-900 hover:bg-zinc-800 px-6 py-2.5 rounded-xl font-bold border border-zinc-800 transition-all">
                        Back to Profile
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-500/30">
            <Navbar />

            <main className="w-full mx-auto lg:max-w-[64rem] xl:max-w-[80rem] 2xl:max-w-[96rem] px-4 pt-6 pb-12">
                <div className="grid grid-cols-12 gap-6">
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    <div className="col-span-12 lg:col-span-9 space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                            <div className="flex items-center gap-3">
                                <Link
                                    href={backHref}
                                    className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-blue-400 hover:border-zinc-700 transition-all"
                                    title="Back to Workspace Settings"
                                >
                                    <ArrowLeft className="h-5 w-5" />
                                </Link>
                                <div>
                                    <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
                                        {project?.title} Dashboard
                                    </h1>
                                    <p className="text-xs text-zinc-500 font-medium">Manage identity, settings, and sent invitations.</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages */}
                        {error && (
                            <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold whitespace-pre-line animate-in fade-in duration-200">
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200">
                                <span>{successMessage}</span>
                                <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:text-emerald-350"><X className="h-4 w-4" /></button>
                            </div>
                        )}

                        {/* Navigation Tabs */}
                        <div className="flex gap-4 border-b border-zinc-800">
                            <button
                                onClick={() => setActiveTab('general')}
                                className={`pb-4 px-2 text-base font-bold transition-all relative ${activeTab === 'general' ? 'text-white' : 'text-zinc-550 hover:text-zinc-350'}`}
                            >
                                General Settings
                                {activeTab === 'general' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('invites')}
                                className={`pb-4 px-2 text-base font-bold transition-all relative ${activeTab === 'invites' ? 'text-white' : 'text-zinc-550 hover:text-zinc-350'}`}
                            >
                                Invite &amp; Outgoing ({pendingMembers.length})
                                {activeTab === 'invites' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full" />}
                            </button>
                        </div>

                        {/* Tabs Content */}
                        <div className="animate-in fade-in duration-300">
                            {activeTab === 'general' ? (
                                <form onSubmit={handleGeneralSave} className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 space-y-6">
                                    <h3 className="text-base font-bold text-white border-b border-zinc-800/40 pb-2">Visual Identity</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Cover image upload */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Cover Image</label>
                                            <div
                                                className="w-full h-36 rounded-xl bg-zinc-950 border border-dashed border-zinc-800 relative cursor-pointer overflow-hidden flex items-center justify-center text-center group hover:border-zinc-700 transition-all"
                                                onClick={() => coverInputRef.current?.click()}
                                            >
                                                <input
                                                    type="file"
                                                    ref={coverInputRef}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            setCoverImage(file);
                                                            setCoverPreview(URL.createObjectURL(file));
                                                        }
                                                    }}
                                                    className="hidden"
                                                    accept="image/*"
                                                />
                                                {coverPreview ? (
                                                    <img src={coverPreview} alt="Cover Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="p-4 space-y-1">
                                                        <Upload className="h-6 w-6 text-zinc-650 mx-auto group-hover:scale-110 transition-transform" />
                                                        <div className="text-xs font-semibold text-zinc-400">Change Cover Image</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Logo upload */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Logo / Avatar</label>
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="w-24 h-24 rounded-2xl bg-zinc-950 border border-dashed border-zinc-800 relative cursor-pointer overflow-hidden flex items-center justify-center text-center group hover:border-zinc-700 transition-all shrink-0"
                                                    onClick={() => logoInputRef.current?.click()}
                                                >
                                                    <input
                                                        type="file"
                                                        ref={logoInputRef}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) {
                                                                setLogo(file);
                                                                setLogoPreview(URL.createObjectURL(file));
                                                            }
                                                        }}
                                                        className="hidden"
                                                        accept="image/*"
                                                    />
                                                    {logoPreview ? (
                                                        <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="p-2 space-y-1">
                                                            <Upload className="h-5 w-5 text-zinc-650 mx-auto group-hover:scale-110 transition-transform" />
                                                            <div className="text-[10px] font-semibold text-zinc-400">Change Logo</div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="text-xs text-zinc-500">
                                                    We recommend uploading a square logo. This will show on all aggregated feeds, comments, and project cards.
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-base font-bold text-white border-b border-zinc-800/40 pb-2 pt-4">General Details</h3>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Project Title</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm font-medium"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description</label>
                                        <textarea
                                            rows={4}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm font-medium"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Write about your project..."
                                        />
                                    </div>

                                    <div className="space-y-2 relative" style={{ overflow: 'visible' }}>
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tech Stack</label>
                                        <div
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white cursor-pointer min-h-[50px] flex flex-wrap gap-2 items-center hover:border-zinc-700 transition-colors"
                                            onClick={() => setShowTechDropdown(!showTechDropdown)}
                                        >
                                            {techStack.length > 0 ? (
                                                techStack.map((tech) => (
                                                    <span key={tech} className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                        {tech}
                                                        <X
                                                            className="w-3 h-3 cursor-pointer hover:text-blue-300"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setTechStack(techStack.filter((t) => t !== tech));
                                                            }}
                                                        />
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-zinc-700">Select technologies used...</span>
                                            )}
                                        </div>
                                        {showTechDropdown && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setShowTechDropdown(false)} />
                                                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-20 max-h-72 overflow-y-auto p-3 grid grid-cols-2 md:grid-cols-3 gap-1.5 animate-in fade-in slide-in-from-top-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>
                                                    {AVAILABLE_TECH.map((tech) => (
                                                        <button
                                                            key={tech}
                                                            type="button"
                                                            onClick={() => {
                                                                if (techStack.includes(tech)) {
                                                                    setTechStack(techStack.filter((t) => t !== tech));
                                                                } else {
                                                                    setTechStack([...techStack, tech]);
                                                                }
                                                            }}
                                                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${techStack.includes(tech) ? 'bg-blue-500 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                                                        >
                                                            {tech}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Links &amp; Social Profiles</label>

                                        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1 focus-within:border-blue-500/50 transition-all">
                                            <Globe className="h-4 w-4 text-zinc-650 mr-2" />
                                            <input
                                                type="url"
                                                className="flex-1 bg-transparent border-none text-white text-xs outline-none py-2"
                                                value={website}
                                                onChange={(e) => setWebsite(e.target.value)}
                                                placeholder="Website URL"
                                            />
                                        </div>

                                        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1 focus-within:border-blue-500/50 transition-all">
                                            <Twitter className="h-4 w-4 text-zinc-650 mr-2" />
                                            <input
                                                type="url"
                                                className="flex-1 bg-transparent border-none text-white text-xs outline-none py-2"
                                                value={twitter}
                                                onChange={(e) => setTwitter(e.target.value)}
                                                placeholder="Twitter URL"
                                            />
                                        </div>

                                        <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1 focus-within:border-blue-500/50 transition-all">
                                            <Youtube className="h-4 w-4 text-zinc-650 mr-2" />
                                            <input
                                                type="url"
                                                className="flex-1 bg-transparent border-none text-white text-xs outline-none py-2"
                                                value={youtube}
                                                onChange={(e) => setYoutube(e.target.value)}
                                                placeholder="YouTube URL"
                                            />
                                        </div>

                                        <ExtraLinksEditor value={extraLinks} onChange={setExtraLinks} />
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-zinc-800/40">
                                        <button
                                            type="submit"
                                            disabled={saveLoading || !title}
                                            className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/10 text-sm flex items-center gap-2"
                                        >
                                            {saveLoading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                                                    <span>Saving...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="h-4 w-4" />
                                                    <span>Save Changes</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-6">
                                    {/* Invite Member */}
                                    <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
                                        <div>
                                            <h3 className="text-base font-bold text-white">Invite a developer</h3>
                                            <p className="text-xs text-zinc-500 mt-0.5">Search for a user and assign them a role — same flow as Team &amp; Roles.</p>
                                        </div>
                                        {project && (
                                            <InviteMemberButton
                                                scope="project"
                                                organisationId={project.organisation ?? null}
                                                projectId={project.id}
                                                excludeUserIds={[project.owner.id, ...(project.members ?? []).map((m) => m.user.id)]}
                                                onInvited={fetchData}
                                            />
                                        )}
                                    </div>

                                    {/* Active/Pending Outgoing Invitations */}
                                    <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden">
                                        <div className="p-4 bg-zinc-950/60 border-b border-zinc-800">
                                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Pending Outgoing Invitations</h3>
                                        </div>
                                        <div className="divide-y divide-zinc-850">
                                            {pendingMembers.length > 0 ? (
                                                pendingMembers.map((invite) => (
                                                    <div key={invite.id} className="p-4 flex items-center justify-between gap-4">
                                                        <Link href={`/${invite.user.username}`} className="flex items-center gap-3 group min-w-0">
                                                            <div className="w-9 h-9 rounded-xl bg-zinc-950 overflow-hidden flex items-center justify-center font-bold text-white shrink-0 text-sm">
                                                                {invite.user.avatar ? (
                                                                    <img src={getImageUrl(invite.user.avatar)} alt={invite.user.username} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    invite.user.username.charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-white text-sm truncate group-hover:underline">{invite.user.real_name || invite.user.username}</h4>
                                                                <span className="text-xs text-zinc-550 block truncate">@{invite.user.username} • Invited to be <strong className="text-zinc-400 capitalize">{invite.role}</strong></span>
                                                            </div>
                                                        </Link>

                                                        <button
                                                            onClick={() => handleCancelInvite(invite.id)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-red-500/20 text-zinc-500 hover:text-red-400 rounded-xl text-xs font-bold transition-all flex-shrink-0"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                            <span>Cancel</span>
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-center py-10 text-zinc-550 text-xs">
                                                    No pending invitations found.
                                                </div>
                                            )}
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
