'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import api from '@/lib/api';
import { Organisation, OrganisationInvitation, User } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import {
    Check, X, Upload, Search, Mail,
    Globe, Twitter, Youtube, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import MemberManager from '@/components/team/MemberManager';
import { useToast } from '@/context/ToastContext';

export default function OrganisationDashboardPage() {
    const { slug } = useParams() as { slug: string };
    const { t } = useTranslation();
    const { user: currentUser } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [organisation, setOrganisation] = useState<Organisation | null>(null);
    const [invitations, setInvitations] = useState<OrganisationInvitation[]>([]);
    const [loading, setLoading] = useState(true);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'members' | 'invites'>('general');

    // Edit form states
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [website, setWebsite] = useState('');
    const [twitter, setTwitter] = useState('');
    const [youtube, setYoutube] = useState('');

    const [logo, setLogo] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [banner, setBanner] = useState<File | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    // Invite states
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
    const [invitingUserId, setInvitingUserId] = useState<number | null>(null);

    const fetchData = async () => {
        if (!slug) return;
        try {
            const orgRes = await api.get(`/organisations/${slug}/`);
            const orgData = orgRes.data as Organisation;

            // Check permissions
            const requestingMember = orgData.members?.find(m => m.user.id === currentUser?.id);
            if (!requestingMember || (requestingMember.role !== 'owner' && requestingMember.role !== 'admin')) {
                setError("Access Denied: You do not have permission to manage this organisation.");
                setOrganisation(orgData);
                return;
            }

            setOrganisation(orgData);
            setName(orgData.name);
            setDescription(orgData.description || '');
            setWebsite(orgData.website || '');
            setTwitter(orgData.twitter || '');
            setYoutube(orgData.youtube || '');

            if (orgData.logo) setLogoPreview(getImageUrl(orgData.logo));
            if (orgData.banner) setBannerPreview(getImageUrl(orgData.banner));

            // Fetch pending invitations
            const invitesRes = await api.get(`/organisation-invitations/?organisation_slug=${slug}`);
            setInvitations(invitesRes.data.results || invitesRes.data);
        } catch (err: any) {
            console.error("Error fetching dashboard details:", err);
            setError(err.response?.data?.detail || "Failed to load dashboard data.");
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchData().finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slug, currentUser]);

    // Handle updates
    const handleGeneralSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organisation) return;

        setSaveLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('description', description);
            formData.append('website', website);
            formData.append('twitter', twitter);
            formData.append('youtube', youtube);

            if (logo) formData.append('logo', logo);
            if (banner) formData.append('banner', banner);

            const res = await api.patch(`/organisations/${slug}/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setOrganisation(res.data);
            setSuccessMessage("Organisation settings updated successfully!");
        } catch (err: any) {
            console.error("Failed to update general settings:", err);
            setError(err.response?.data?.detail || "Failed to save settings. Please verify details.");
        } finally {
            setSaveLoading(false);
        }
    };

    // User Search for Invite
    const handleSearchUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setSearchLoading(true);
        try {
            const res = await api.get(`/users/?search=${searchQuery}`);
            const data = res.data.results || res.data;
            // Filter out current members
            const currentMemberUsernames = organisation?.members?.map(m => m.user.username) || [];
            const filteredUsers = data.filter((u: User) => !currentMemberUsernames.includes(u.username));
            setSearchResults(filteredUsers);
        } catch (err) {
            console.error("Search users failed:", err);
        } finally {
            setSearchLoading(false);
        }
    };

    // Send invite
    const handleSendInvite = async (userId: number) => {
        setInvitingUserId(userId);
        try {
            const res = await api.post(`/organisations/${slug}/invite/`, {
                user_id: userId,
                role: inviteRole
            });
            setInvitations(prev => [res.data, ...prev]);
            setSearchResults(prev => prev.filter(u => u.id !== userId));
            setSuccessMessage("Invitation sent successfully!");
        } catch (err: any) {
            toast.error(err.response?.data?.error || err.response?.data?.detail || "Failed to send invitation.");
        } finally {
            setInvitingUserId(null);
        }
    };

    // Cancel invite
    const handleCancelInvite = async (inviteId: number) => {
        try {
            await api.delete(`/organisation-invitations/${inviteId}/`);
            setInvitations(prev => prev.filter(inv => inv.id !== inviteId));
            setSuccessMessage("Invitation cancelled.");
        } catch (err) {
            console.error("Failed to cancel invitation:", err);
            toast.error("Failed to cancel invitation.");
        }
    };

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

    // Access Denied template
    const requestingMember = organisation?.members?.find(m => m.user.id === currentUser?.id);
    const hasAccess = requestingMember && (requestingMember.role === 'owner' || requestingMember.role === 'admin');

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white font-sans">
                <Navbar />
                <div className="container mx-auto px-4 py-20 text-center">
                    <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
                    <p className="text-zinc-400 mb-8">You do not have permission to access the management dashboard for this studio.</p>
                    <Link href={`/organisations/${slug}`} className="bg-zinc-900 hover:bg-zinc-800 px-6 py-2.5 rounded-xl font-bold border border-zinc-800 transition-all">
                        {t('backToProfile' as any) || 'Back to Profile'}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-12">
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

                    {/* Dashboard Area */}
                    <div className="col-span-12 lg:col-span-9 space-y-6">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                            <div className="flex items-center gap-3">
                                <Link href={`/organisations/${slug}`} className="p-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-blue-400 hover:border-zinc-700 transition-all">
                                    <ArrowLeft className="h-5 w-5" />
                                </Link>
                                <div>
                                    <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
                                        {organisation?.name} Dashboard
                                    </h1>
                                    <p className="text-xs text-zinc-500 font-medium">Manage visuals, settings, developer team, and sent invitations.</p>
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
                                onClick={() => setActiveTab('members')}
                                className={`pb-4 px-2 text-base font-bold transition-all relative ${activeTab === 'members' ? 'text-white' : 'text-zinc-550 hover:text-zinc-350'}`}
                            >
                                Members ({organisation?.members?.length || 0})
                                {activeTab === 'members' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full" />}
                            </button>
                            <button
                                onClick={() => setActiveTab('invites')}
                                className={`pb-4 px-2 text-base font-bold transition-all relative ${activeTab === 'invites' ? 'text-white' : 'text-zinc-550 hover:text-zinc-350'}`}
                            >
                                Invite & Outgoing ({invitations.length})
                                {activeTab === 'invites' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500 rounded-t-full" />}
                            </button>
                        </div>

                        {/* Tabs Content */}
                        <div className="animate-in fade-in duration-300">
                            {activeTab === 'general' ? (
                                <form onSubmit={handleGeneralSave} className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6 space-y-6">
                                    <h3 className="text-base font-bold text-white border-b border-zinc-800/40 pb-2">Visual Identity</h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Banner upload */}
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Banner Image</label>
                                            <div 
                                                className="w-full h-36 rounded-xl bg-zinc-950 border border-dashed border-zinc-800 relative cursor-pointer overflow-hidden flex items-center justify-center text-center group hover:border-zinc-700 transition-all"
                                                onClick={() => bannerInputRef.current?.click()}
                                            >
                                                <input 
                                                    type="file"
                                                    ref={bannerInputRef}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            setBanner(file);
                                                            setBannerPreview(URL.createObjectURL(file));
                                                        }
                                                    }}
                                                    className="hidden"
                                                    accept="image/*"
                                                />
                                                {bannerPreview ? (
                                                    <img src={bannerPreview} alt="Banner Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="p-4 space-y-1">
                                                        <Upload className="h-6 w-6 text-zinc-650 mx-auto group-hover:scale-110 transition-transform" />
                                                        <div className="text-xs font-semibold text-zinc-400">Change Banner</div>
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
                                                    We recommend uploading a square logo. This will show on all aggregated feeds, comments, and project details.
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <h3 className="text-base font-bold text-white border-b border-zinc-800/40 pb-2 pt-4">General Details</h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Organisation Name</label>
                                            <input 
                                                type="text"
                                                required
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm font-medium"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Slug / Handle</label>
                                            <input 
                                                type="text"
                                                disabled
                                                className="w-full bg-zinc-950/60 border border-zinc-850 rounded-xl px-4 py-2.5 text-zinc-500 cursor-not-allowed outline-none text-sm font-mono"
                                                value={organisation?.slug}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">About / Biography</label>
                                        <textarea 
                                            rows={4}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm font-medium"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Write bio, values, stack, games etc..."
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Links & Social Profiles</label>
                                        
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
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-zinc-800/40">
                                        <button 
                                            type="submit"
                                            disabled={saveLoading || !name}
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
                            ) : activeTab === 'members' ? (
                                <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-4">
                                    {organisation && (
                                        <MemberManager
                                            scope="organisation"
                                            organisationId={organisation.id}
                                            organisationSlug={organisation.slug}
                                            members={organisation.members ?? []}
                                            onRefresh={fetchData}
                                            showInviteButton={false}
                                        />
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Send new Invitation */}
                                    <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-6">
                                        <h3 className="text-base font-bold text-white border-b border-zinc-800/40 pb-2 mb-4">Invite Developer</h3>
                                        <form onSubmit={handleSearchUser} className="flex gap-2">
                                            <div className="flex-1 flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1 focus-within:border-zinc-700 transition-all">
                                                <Search className="h-4 w-4 text-zinc-650 mr-2" />
                                                <input 
                                                    type="text"
                                                    required
                                                    className="flex-1 bg-transparent border-none text-white text-xs outline-none py-2 placeholder:text-zinc-650"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Search developer by username or real name..."
                                                />
                                            </div>
                                            <button 
                                                type="submit" 
                                                disabled={searchLoading}
                                                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white font-bold px-4 rounded-xl text-xs transition-all flex items-center gap-1.5"
                                            >
                                                {searchLoading ? 'Searching...' : 'Search'}
                                            </button>
                                        </form>

                                        {/* Search results */}
                                        {searchResults.length > 0 && (
                                            <div className="mt-4 border border-zinc-800 bg-zinc-950/40 rounded-xl overflow-hidden divide-y divide-zinc-850 animate-in slide-in-from-top-2 duration-300">
                                                {searchResults.map((user) => (
                                                    <div key={user.id} className="p-3.5 flex items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-zinc-950 overflow-hidden flex items-center justify-center font-bold text-white shrink-0 text-xs">
                                                                {user.avatar ? (
                                                                    <img src={getImageUrl(user.avatar)} alt={user.username} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    user.username.charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h5 className="font-bold text-white text-xs leading-none">{user.real_name || user.username}</h5>
                                                                <span className="text-[10px] text-zinc-550 font-mono">@{user.username}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                className="bg-zinc-950 border border-zinc-800 text-white rounded-lg text-[10px] font-bold px-2 py-1 outline-none"
                                                                value={inviteRole}
                                                                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                                                            >
                                                                <option value="member">Developer</option>
                                                                <option value="admin">Admin</option>
                                                            </select>
                                                            <button
                                                                onClick={() => handleSendInvite(user.id)}
                                                                disabled={invitingUserId === user.id}
                                                                className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                                                            >
                                                                <Mail className="h-3 w-3" />
                                                                <span>Invite</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Active/Pending Outgoing Invitations */}
                                    <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden">
                                        <div className="p-4 bg-zinc-950/60 border-b border-zinc-800">
                                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Pending Outgoing Invitations</h3>
                                        </div>
                                        <div className="divide-y divide-zinc-850">
                                            {invitations.length > 0 ? (
                                                invitations.map((invite) => (
                                                    <div key={invite.id} className="p-4 flex items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-zinc-950 overflow-hidden flex items-center justify-center font-bold text-white shrink-0 text-sm">
                                                                {invite.user.avatar ? (
                                                                    <img src={getImageUrl(invite.user.avatar)} alt={invite.user.username} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    invite.user.username.charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-white text-sm">{invite.user.real_name || invite.user.username}</h4>
                                                                <span className="text-xs text-zinc-550 block">@{invite.user.username} • Invited to be <strong className="text-zinc-400 capitalize">{invite.role}</strong></span>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={() => handleCancelInvite(invite.id)}
                                                            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-950 border border-zinc-800 hover:border-red-500/20 text-zinc-500 hover:text-red-400 rounded-xl text-xs font-bold transition-all"
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
