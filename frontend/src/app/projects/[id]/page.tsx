'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import LeftSidebar from "@/components/LeftSidebar";
import PostCard from "@/components/PostCard";
import api from '@/lib/api';
import { Project, Post, User, ProjectMember } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { MapPin, Calendar, Link as LinkIcon, Users, Layout, Info, Edit2, Check, X, ShieldAlert, Trash2, Plus, Settings, MoreHorizontal, ChevronDown, Clock, UserPlus, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import CreateDevlogModal from '@/components/modals/CreateDevlogModal';

const AVAILABLE_TECH = [
    'Unity', 'Unreal Engine', 'Godot', 'GameMaker', 'C#', 'C++', 'Python', 'JavaScript', 'TypeScript', 
    'Blender', 'Maya', 'ZBrush', 'Photoshop', 'Illustrator', 'FMOD', 'Wwise', 'Audacity', 'React', 'Next.js'
];

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id;
    const { user } = useAuth();

    const [project, setProject] = useState<Project | null>(null);
    const [devlogs, setDevlogs] = useState<Post[]>([]);
    const [activeTab, setActiveTab] = useState<'about' | 'devlogs' | 'participants'>('devlogs');
    const [loading, setLoading] = useState(true);

    const [isEditingAbout, setIsEditingAbout] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedDescription, setEditedDescription] = useState('');
    const [editedTechStack, setEditedTechStack] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showAboutTechDropdown, setShowAboutTechDropdown] = useState(false);

    // Settings Drawer
    const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    // Add Participant
    const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [selectedTargetUser, setSelectedTargetUser] = useState<User | null>(null);
    const [selectedRole, setSelectedRole] = useState<'participant' | 'editor' | 'admin'>('participant');
    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
    const [isAddingUser, setIsAddingUser] = useState(false);

    // 3-dots Menu
    const [actionMenuOpenFor, setActionMenuOpenFor] = useState<number | null>(null);

    // Status Dropdown
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);

    // Follow State
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [isFollowLoading, setIsFollowLoading] = useState(false);
    const [showDevlogModal, setShowDevlogModal] = useState(false);

    // Collapsible Roles
    const [collapsedRoles, setCollapsedRoles] = useState<Record<string, boolean>>({
        admin: false,
        editor: false,
        participant: false
    });

    const toggleRoleCollapse = (role: string) => {
        setCollapsedRoles(prev => ({ ...prev, [role]: !prev[role] }));
    };

    const fetchProjectData = async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const projectRes = await api.get(`/projects/${projectId}/`);
            setProject(projectRes.data);
            setEditedTitle(projectRes.data.title);
            setEditedDescription(projectRes.data.description);
            setEditedTechStack(projectRes.data.tech_stack || []);
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

    const handleSaveAbout = async () => {
        if (!project) return;
        setIsSaving(true);
        try {
            await api.patch(`/projects/${project.id}/`, { 
                title: editedTitle,
                description: editedDescription,
                tech_stack: editedTechStack
            });
            setProject({ 
                ...project, 
                title: editedTitle, 
                description: editedDescription,
                tech_stack: editedTechStack
            });
            setIsEditingAbout(false);
        } catch (error) {
            console.error("Failed to update project", error);
        } finally {
            setIsSaving(false);
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

    const handleDeleteProject = async () => {
        if (!project || deleteConfirmText !== project.title) return;
        setIsDeleting(true);
        try {
            await api.delete(`/projects/${project.id}/`);
            router.push('/');
        } catch (error) {
            console.error("Failed to delete project", error);
            setIsDeleting(false);
        }
    };

    const handleSearchUsers = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        if (e.target.value.length > 2) {
            try {
                const res = await api.get(`/users/?search=${e.target.value}`);
                setSearchResults(res.data.results || res.data);
            } catch (err) {
                console.error(err);
            }
        } else {
            setSearchResults([]);
        }
    };

    const handleAddParticipant = async () => {
        if (!project || !selectedTargetUser) return;
        setIsAddingUser(true);
        try {
            await api.post(`/project-members/`, {
                project: project.id,
                user_id: selectedTargetUser.id,
                role: selectedRole
            });
            await fetchProjectData();
            
            // Reset
            setShowAddParticipantModal(false);
            setSearchQuery('');
            setSearchResults([]);
            setSelectedTargetUser(null);
            setSelectedRole('participant');
        } catch (error: any) {
            console.error("Failed to add participant", error);
            if (error.response?.data) {
                alert(JSON.stringify(error.response.data));
            }
        } finally {
            setIsAddingUser(false);
        }
    };

    const handleRevokeFromSearch = async () => {
        if (!selectedTargetUser || !project) return;
        const existingMember = project.members?.find(m => m.user.id === selectedTargetUser.id);
        if (!existingMember) return;
        
        setIsAddingUser(true);
        try {
            await api.delete(`/project-members/${existingMember.id}/`);
            await fetchProjectData();
            // It automatically turns back to send invite because existingMember will be undefined
        } catch (error) {
            console.error("Failed to revoke invite", error);
        } finally {
            setIsAddingUser(false);
        }
    };

    const handleChangeRole = async (memberId: number, newRole: string) => {
        try {
            await api.patch(`/project-members/${memberId}/`, { role: newRole });
            await fetchProjectData();
            setActionMenuOpenFor(null);
        } catch (error) {
            console.error("Failed to change role", error);
        }
    };

    const handleRemoveParticipant = async (memberId: number) => {
        if (!confirm("Remove this participant?")) return;
        try {
            await api.delete(`/project-members/${memberId}/`);
            await fetchProjectData();
            setActionMenuOpenFor(null);
        } catch (error) {
            console.error("Failed to remove participant", error);
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
                <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
                <Link href="/devs" className="text-emerald-500 hover:underline">
                    Back to Developer Hub
                </Link>
            </div>
        );
    }

    const membersByRole = {
        admin: project.members?.filter(m => m.role === 'admin') || [],
        editor: project.members?.filter(m => m.role === 'editor') || [],
        participant: project.members?.filter(m => m.role === 'participant') || []
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="container mx-auto px-4 pt-6 pb-12">
                <div className="grid grid-cols-12 gap-6">
                    <div className="hidden lg:block col-span-3">
                        <LeftSidebar />
                    </div>

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
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                                                project.status === 'released' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' :
                                                project.status === 'beta' ? 'bg-blue-500/20 border-blue-500 text-blue-400' :
                                                project.status === 'alpha' ? 'bg-purple-500/20 border-purple-500 text-purple-400' :
                                                'bg-amber-500/20 border-amber-500 text-amber-400'
                                            }`}>
                                            {project.status.replace('_', ' ')}
                                        </span>
                                    </div>
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

                                {/* Divider */}
                                <div className="h-8 w-px bg-zinc-800" />

                                {/* Followers Count */}
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-zinc-500" />
                                    <span className="text-sm font-medium text-zinc-300">
                                        {followersCount} <span className="text-zinc-500">followers</span>
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {isEditor && (
                                    <button
                                        onClick={() => setShowDevlogModal(true)}
                                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-all duration-200 shadow-lg shadow-blue-900/20"
                                    >
                                        <Plus className="w-4 h-4" /> Log Dev
                                    </button>
                                )}
                                {/* Follow Button */}
                                <button
                                    onClick={handleFollowToggle}
                                    disabled={isFollowLoading}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all duration-200 ${
                                        isFollowing
                                            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
                                    } ${isFollowLoading ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    {isFollowing ? (
                                        <><UserCheck className="w-4 h-4" /> Following</>
                                    ) : (
                                        <><UserPlus className="w-4 h-4" /> Follow</>
                                    )}
                                </button>
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
                            <button
                                onClick={() => setActiveTab('participants')}
                                className={`pb-3 text-lg font-bold transition-all relative ${activeTab === 'participants' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Participants
                                </div>
                                {activeTab === 'participants' && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
                                )}
                            </button>
                            
                            {isAdmin && (
                                <div className="ml-auto flex items-center">
                                    <button 
                                        onClick={() => setShowSettingsDrawer(true)} 
                                        className="p-2 mb-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                    >
                                        <Settings className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
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
                                            <p className="text-zinc-400 text-lg">No devlogs published yet.</p>
                                        </div>
                                    )}
                                </div>
                            ) : activeTab === 'about' ? (
                                <div className="grid grid-cols-1 gap-6">
                                    {/* About & Stats */}
                                    <div className="space-y-6">
                                        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-xl font-bold">About this Project</h3>
                                                {isEditor && !isEditingAbout && (
                                                    <button onClick={() => setIsEditingAbout(true)} className="text-zinc-400 hover:text-white flex items-center gap-1 text-sm bg-zinc-800 px-3 py-1.5 rounded-lg transition-colors">
                                                        <Edit2 className="w-4 h-4" /> Edit
                                                    </button>
                                                )}
                                            </div>
                                            
                                            {isEditingAbout ? (
                                                <div className="space-y-4">
                                                    {isAdmin && (
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Project Title</label>
                                                            <input 
                                                                type="text"
                                                                value={editedTitle}
                                                                onChange={e => setEditedTitle(e.target.value)}
                                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-emerald-500 focus:outline-none text-lg font-bold"
                                                                placeholder="Project Title"
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description</label>
                                                        <textarea 
                                                            value={editedDescription}
                                                            onChange={e => setEditedDescription(e.target.value)}
                                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-300 min-h-[150px] focus:ring-1 focus:ring-emerald-500 focus:outline-none leading-relaxed"
                                                            placeholder="Project Description"
                                                        />
                                                    </div>
                                                    <div className="space-y-2 relative" style={{ overflow: 'visible' }}>
                                                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tech Stack</label>
                                                        <div 
                                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white cursor-pointer min-h-[50px] flex flex-wrap gap-2 items-center hover:border-zinc-700 transition-colors"
                                                            onClick={() => setShowAboutTechDropdown(!showAboutTechDropdown)}
                                                        >
                                                            {editedTechStack.length > 0 ? (
                                                                editedTechStack.map(tech => (
                                                                    <span key={tech} className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                                        {tech}
                                                                        <X 
                                                                            className="w-3 h-3 cursor-pointer hover:text-emerald-300" 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditedTechStack(editedTechStack.filter(t => t !== tech));
                                                                            }}
                                                                        />
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-zinc-700">Select technologies...</span>
                                                            )}
                                                        </div>
                                                        {showAboutTechDropdown && (
                                                            <>
                                                                <div className="fixed inset-0 z-10" onClick={() => setShowAboutTechDropdown(false)} />
                                                                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-20 max-h-72 overflow-y-auto p-3 grid grid-cols-2 md:grid-cols-3 gap-1.5 animate-in fade-in slide-in-from-top-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>
                                                                    {AVAILABLE_TECH.map(tech => (
                                                                        <button
                                                                            key={tech}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                if (editedTechStack.includes(tech)) {
                                                                                    setEditedTechStack(editedTechStack.filter(t => t !== tech));
                                                                                } else {
                                                                                    setEditedTechStack([...editedTechStack, tech]);
                                                                                }
                                                                            }}
                                                                            className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${editedTechStack.includes(tech) ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                                                                        >
                                                                            {tech}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-end gap-2 pt-2">
                                                        <button onClick={() => { setIsEditingAbout(false); setShowAboutTechDropdown(false); }} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                                                        <button onClick={handleSaveAbout} disabled={isSaving} className="px-4 py-2 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center gap-2">
                                                            {isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Check className="w-4 h-4" />} Save
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-6">
                                                    <h2 className="text-2xl font-black text-white">{project.title}</h2>
                                                    <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                                        {project.description}
                                                    </p>
                                                    {project.tech_stack.length > 0 && (
                                                        <div className="pt-2">
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Tech Stack</h4>
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
                                            )}

                                            <div className="mt-8 pt-8 border-t border-zinc-800">
                                                <h4 className="font-bold mb-3 text-zinc-400 uppercase text-sm tracking-wider">Project Stats</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                        <div className="text-zinc-500 text-xs mb-1">Started</div>
                                                        <div className="font-mono text-white">{new Date(project.created_at).toLocaleDateString()}</div>
                                                    </div>
                                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                        <div className="text-zinc-500 text-xs mb-1">Status</div>
                                                        {isAdmin ? (
                                                            <div className="relative">
                                                                <button 
                                                                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                                                                    className="font-mono text-emerald-400 capitalize flex items-center gap-1 hover:text-emerald-300 transition-colors"
                                                                >
                                                                    {project.status.replace('_', ' ')} <ChevronDown className="w-3 h-3" />
                                                                </button>
                                                                {showStatusDropdown && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                                                                        <div className="absolute top-full left-0 mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95">
                                                                            {['in_dev', 'alpha', 'beta', 'released'].map(s => (
                                                                                <button 
                                                                                    key={s}
                                                                                    onClick={() => handleUpdateStatus(s)}
                                                                                    className={`w-full text-left px-4 py-2 text-sm capitalize transition-colors ${project.status === s ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}
                                                                                >
                                                                                    {s.replace('_', ' ')}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="font-mono text-emerald-400 capitalize">{project.status.replace('_', ' ')}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* Participants */}
                                    <div className="space-y-6">
                                        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="text-lg font-bold flex items-center gap-2">
                                                    <Users className="w-5 h-5 text-emerald-500" />
                                                    Participants
                                                </h3>
                                                {isAdmin && (
                                                    <button onClick={() => setShowAddParticipantModal(true)} className="bg-zinc-800 hover:bg-zinc-700 text-white p-1.5 rounded-lg transition-colors">
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-6">
                                                {/* Admins */}
                                                <div>
                                                    <div 
                                                        className="flex items-center gap-2 cursor-pointer mb-3 group w-max"
                                                        onClick={() => toggleRoleCollapse('admin')}
                                                    >
                                                        <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${collapsedRoles.admin ? '-rotate-90' : ''}`} />
                                                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">Admins</h4>
                                                    </div>
                                                    
                                                    {!collapsedRoles.admin && (
                                                        <div className="space-y-3 pl-6">
                                                            <div className="flex items-center justify-between">
                                                                <Link href={`/${project.owner.username}`} className="flex items-center gap-3">
                                                                    <img src={getImageUrl(project.owner.avatar, project.owner.username)} className="w-8 h-8 rounded-full border border-zinc-700 object-cover" alt="Owner" />
                                                                    <div>
                                                                        <div className="text-sm font-medium text-white">{project.owner.username}</div>
                                                                        <div className="text-xs text-zinc-500">Owner</div>
                                                                    </div>
                                                                </Link>
                                                            </div>
                                                            {membersByRole.admin.map(member => (
                                                                <div key={member.id} className="flex items-center justify-between group relative">
                                                                    <Link href={`/${member.user.username}`} className="flex items-center gap-3">
                                                                        <img src={getImageUrl(member.user.avatar, member.user.username)} className="w-8 h-8 rounded-full border border-zinc-700 object-cover" alt="Admin" />
                                                                        <div>
                                                                            <div className="text-sm font-medium text-white flex items-center gap-2">
                                                                                {member.user.username}
                                                                                {member.status === 'pending' && <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase"><Clock className="w-3 h-3"/> Pending</span>}
                                                                            </div>
                                                                            <div className="text-xs text-zinc-500">Admin</div>
                                                                        </div>
                                                                    </Link>
                                                                    {isAdmin && (
                                                                        <div className="relative">
                                                                            <button onClick={() => setActionMenuOpenFor(actionMenuOpenFor === member.id ? null : member.id)} className="text-zinc-500 hover:text-white p-1 rounded transition-colors hover:bg-zinc-800">
                                                                                <MoreHorizontal className="w-5 h-5" />
                                                                            </button>
                                                                            {actionMenuOpenFor === member.id && (
                                                                                <>
                                                                                    <div className="fixed inset-0 z-10" onClick={() => setActionMenuOpenFor(null)} />
                                                                                    <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95">
                                                                                        <div className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/50">Change Role</div>
                                                                                        <button onClick={() => handleChangeRole(member.id, 'admin')} className="w-full text-left px-4 py-2 text-sm text-emerald-400 bg-emerald-500/10">Make Admin</button>
                                                                                        <button onClick={() => handleChangeRole(member.id, 'editor')} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">Make Editor</button>
                                                                                        <button onClick={() => handleChangeRole(member.id, 'participant')} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800">Make Participant</button>
                                                                                        
                                                                                        <button onClick={() => handleRemoveParticipant(member.id)} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                                                                                            {member.status === 'pending' ? 'Revoke Invite' : 'Remove Participant'}
                                                                                        </button>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Editors */}
                                                {membersByRole.editor.length > 0 && (
                                                    <div>
                                                        <div 
                                                            className="flex items-center gap-2 cursor-pointer mb-3 group w-max"
                                                            onClick={() => toggleRoleCollapse('editor')}
                                                        >
                                                            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${collapsedRoles.editor ? '-rotate-90' : ''}`} />
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">Editors</h4>
                                                        </div>
                                                        
                                                        {!collapsedRoles.editor && (
                                                            <div className="space-y-3 pl-6">
                                                            {membersByRole.editor.map(member => (
                                                                <div key={member.id} className="flex items-center justify-between group">
                                                                    <Link href={`/${member.user.username}`} className="flex items-center gap-3">
                                                                        <img src={getImageUrl(member.user.avatar, member.user.username)} className="w-8 h-8 rounded-full border border-zinc-700 object-cover" alt="Editor" />
                                                                        <div className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                                                                            {member.user.username}
                                                                            {member.status === 'pending' && <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase"><Clock className="w-3 h-3"/> Pending</span>}
                                                                        </div>
                                                                    </Link>
                                                                {isAdmin && (
                                                                    <div className="relative">
                                                                        <button onClick={() => setActionMenuOpenFor(actionMenuOpenFor === member.id ? null : member.id)} className="text-zinc-500 hover:text-white p-1 rounded transition-colors hover:bg-zinc-800">
                                                                            <MoreHorizontal className="w-5 h-5" />
                                                                        </button>
                                                                        {actionMenuOpenFor === member.id && (
                                                                            <>
                                                                                <div className="fixed inset-0 z-10" onClick={() => setActionMenuOpenFor(null)} />
                                                                                <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95">
                                                                                    <div className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/50">Change Role</div>
                                                                                    <button onClick={() => handleChangeRole(member.id, 'admin')} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">Make Admin</button>
                                                                                    <button onClick={() => handleChangeRole(member.id, 'editor')} className="w-full text-left px-4 py-2 text-sm text-emerald-400 bg-emerald-500/10">Make Editor</button>
                                                                                    <button onClick={() => handleChangeRole(member.id, 'participant')} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800">Make Participant</button>
                                                                                    
                                                                                    <button onClick={() => handleRemoveParticipant(member.id)} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                                                                                        {member.status === 'pending' ? 'Revoke Invite' : 'Remove Participant'}
                                                                                    </button>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                        </div>
                                                    )}
                                                </div>
                                                )}

                                                {/* Participants */}
                                                {membersByRole.participant.length > 0 && (
                                                    <div>
                                                        <div 
                                                            className="flex items-center gap-2 cursor-pointer mb-3 group w-max"
                                                            onClick={() => toggleRoleCollapse('participant')}
                                                        >
                                                            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${collapsedRoles.participant ? '-rotate-90' : ''}`} />
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">Participants</h4>
                                                        </div>
                                                        
                                                        {!collapsedRoles.participant && (
                                                            <div className="space-y-3 pl-6">
                                                            {membersByRole.participant.map(member => (
                                                                <div key={member.id} className="flex items-center justify-between group">
                                                                    <Link href={`/${member.user.username}`} className="flex items-center gap-3">
                                                                        <img src={getImageUrl(member.user.avatar, member.user.username)} className="w-8 h-8 rounded-full border border-zinc-700 object-cover" alt="Participant" />
                                                                        <div className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                                                                            {member.user.username}
                                                                            {member.status === 'pending' && <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded font-bold uppercase"><Clock className="w-3 h-3"/> Pending</span>}
                                                                        </div>
                                                                    </Link>
                                                                    {isAdmin && (
                                                                        <div className="relative">
                                                                            <button onClick={() => setActionMenuOpenFor(actionMenuOpenFor === member.id ? null : member.id)} className="text-zinc-500 hover:text-white p-1 rounded transition-colors hover:bg-zinc-800">
                                                                                <MoreHorizontal className="w-5 h-5" />
                                                                            </button>
                                                                            {actionMenuOpenFor === member.id && (
                                                                                <>
                                                                                    <div className="fixed inset-0 z-10" onClick={() => setActionMenuOpenFor(null)} />
                                                                                    <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-20 animate-in fade-in zoom-in-95">
                                                                                        <div className="px-3 py-2 text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-800 bg-zinc-900/50">Change Role</div>
                                                                                        <button onClick={() => handleChangeRole(member.id, 'admin')} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">Make Admin</button>
                                                                                        <button onClick={() => handleChangeRole(member.id, 'editor')} className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">Make Editor</button>
                                                                                        <button onClick={() => handleChangeRole(member.id, 'participant')} className="w-full text-left px-4 py-2 text-sm text-emerald-400 bg-emerald-500/10 border-b border-zinc-800">Make Participant</button>
                                                                                        
                                                                                        <button onClick={() => handleRemoveParticipant(member.id)} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors">
                                                                                            {member.status === 'pending' ? 'Revoke Invite' : 'Remove Participant'}
                                                                                        </button>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="lg:col-span-2 hidden lg:block">
                                        <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 border-dashed text-center flex flex-col items-center justify-center h-full text-zinc-500">
                                            <Users className="w-12 h-12 mb-4 opacity-50" />
                                            <p>Manage your team here.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>

            {/* Settings Drawer */}
            {showSettingsDrawer && (
                <div 
                    className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowSettingsDrawer(false)}
                >
                    <div 
                        className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 h-full flex flex-col animate-in slide-in-from-right duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2"><Settings className="w-5 h-5"/> Project Settings</h2>
                            <button onClick={() => setShowSettingsDrawer(false)} className="text-zinc-500 hover:text-white p-2 rounded-lg hover:bg-zinc-900 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            {/* Danger Zone */}
                            <div className="bg-red-950/20 border border-red-900/50 rounded-2xl p-6">
                                <h3 className="text-red-500 font-bold flex items-center gap-2 mb-2">
                                    <ShieldAlert className="w-5 h-5" /> Danger Zone
                                </h3>
                                <p className="text-sm text-zinc-400 mb-4">Deleting this project will permanently remove it and all associated devlogs.</p>
                                <button onClick={() => { setShowSettingsDrawer(false); setShowDeleteModal(true); }} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl py-2 font-bold transition-colors">
                                    Delete Project
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Participant Modal */}
            {showAddParticipantModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <h3 className="font-bold text-lg">Add Participant</h3>
                            <button onClick={() => { setShowAddParticipantModal(false); setSelectedTargetUser(null); setSearchQuery(''); }} className="text-zinc-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            {!selectedTargetUser ? (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-2">Search User</label>
                                        <input 
                                            type="text" 
                                            value={searchQuery}
                                            onChange={handleSearchUsers}
                                            placeholder="Type username..."
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                                        />
                                    </div>
                                    
                                    {searchResults.length > 0 && (
                                        <div className="max-h-60 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-xl p-2 space-y-1">
                                            {searchResults.map(u => (
                                                <div 
                                                    key={u.id} 
                                                    onClick={() => {
                                                        setSelectedTargetUser(u);
                                                        setSearchResults([]);
                                                        setSearchQuery('');
                                                    }}
                                                    className="flex items-center gap-3 p-3 hover:bg-zinc-900 rounded-lg cursor-pointer transition-colors"
                                                >
                                                    <img src={getImageUrl(u.avatar, u.username)} className="w-10 h-10 rounded-full border border-zinc-800" alt="" />
                                                    <span className="font-medium text-white">{u.username}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex flex-col items-center p-6 bg-zinc-950 rounded-xl border border-zinc-800">
                                        <img src={getImageUrl(selectedTargetUser.avatar, selectedTargetUser.username)} className="w-16 h-16 rounded-full border-2 border-zinc-800 mb-3" alt="" />
                                        <div className="text-lg font-bold text-white">{selectedTargetUser.username}</div>
                                        <div className="text-sm text-zinc-500">Will receive an invitation to join</div>
                                    </div>

                                    <div>
                                        <label className="block text-sm text-zinc-400 mb-2">Select Role</label>
                                        <div className="relative">
                                            <div 
                                                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)} 
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white cursor-pointer flex justify-between items-center hover:border-emerald-500 transition-colors"
                                            >
                                                <span className="font-medium">
                                                    {selectedRole === 'admin' ? 'Admin (Full access)' : selectedRole === 'editor' ? 'Editor (Can post devlogs & edit about)' : 'Participant (Read-only)'}
                                                </span>
                                                <ChevronDown className="w-5 h-5 text-zinc-500" />
                                            </div>
                                            
                                            {roleDropdownOpen && (
                                                <div className="absolute z-10 w-full mt-2 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                                                    {[
                                                        { value: 'participant', label: 'Participant', desc: 'Read-only access to the project.' },
                                                        { value: 'editor', label: 'Editor', desc: 'Can post devlogs & edit about section.' },
                                                        { value: 'admin', label: 'Admin', desc: 'Full access including managing members.' }
                                                    ].map(r => (
                                                        <div 
                                                            key={r.value} 
                                                            onClick={() => { setSelectedRole(r.value as any); setRoleDropdownOpen(false); }} 
                                                            className={`px-4 py-3 cursor-pointer hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0 ${selectedRole === r.value ? 'bg-emerald-500/10' : ''}`}
                                                        >
                                                            <div className={`font-bold ${selectedRole === r.value ? 'text-emerald-400' : 'text-white'}`}>{r.label}</div>
                                                            <div className="text-xs text-zinc-500 mt-1">{r.desc}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button 
                                            onClick={() => setSelectedTargetUser(null)} 
                                            className="flex-1 py-3 text-zinc-400 font-bold hover:text-white bg-zinc-950 hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-800"
                                        >
                                            Cancel
                                        </button>
                                        
                                        {project.members?.find(m => m.user.id === selectedTargetUser.id) ? (
                                            <button 
                                                onClick={handleRevokeFromSearch}
                                                disabled={isAddingUser}
                                                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 border border-red-500/20"
                                            >
                                                {isAddingUser ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500" /> : 'Revoke Invite'}
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={handleAddParticipant}
                                                disabled={isAddingUser}
                                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {isAddingUser ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : 'Send Invite'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-red-900/50 rounded-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="p-6">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                                <ShieldAlert className="w-6 h-6 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Delete Project?</h3>
                            <p className="text-zinc-400 mb-6">
                                This action cannot be undone. This will permanently delete the project 
                                <span className="text-white font-bold mx-1">{project?.title}</span> 
                                and all its devlogs, jobs, and associated data.
                            </p>
                            <div className="mb-6">
                                <label className="block text-sm text-zinc-400 mb-2">
                                    Please type <strong className="text-white">{project?.title}</strong> to confirm.
                                </label>
                                <input 
                                    type="text" 
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-xl font-bold transition-colors">
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleDeleteProject}
                                    disabled={deleteConfirmText !== project?.title || isDeleting}
                                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:hover:bg-red-500 text-white py-2 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    {isDeleting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <Trash2 className="w-4 h-4" />} Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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
