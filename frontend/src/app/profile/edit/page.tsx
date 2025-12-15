'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from "@/components/Navbar";
import { Camera, Save, X, Loader2, Github, Linkedin, Twitter, Facebook, Instagram, Gamepad2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { getImageUrl } from '@/lib/utils';

export default function EditProfilePage() {
    const { user, isLoading: authLoading, updateUser } = useAuth();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        real_name: '',
        location: '',
        bio: '',
        birth_date: '',
        show_birth_date: false,
        gender: '',
    });

    const [socialLinks, setSocialLinks] = useState({
        github: '',
        linkedin: '',
        steam: '',
        twitter: '',
        instagram: '',
        facebook: ''
    });

    // File State
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [coverPreview, setCoverPreview] = useState<string | null>(null);

    // Refs for file inputs
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Load initial data
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const res = await api.get('/users/me/');
                const data = res.data;

                setFormData({
                    real_name: data.real_name || '',
                    location: data.location || '',
                    bio: data.bio || '',
                    birth_date: data.birth_date || '',
                    show_birth_date: data.show_birth_date || false,
                    gender: data.gender || ''
                });

                if (data.social_links) {
                    setSocialLinks(prev => ({ ...prev, ...data.social_links }));
                }

                if (data.avatar) setAvatarPreview(getImageUrl(data.avatar, data.username));
                if (data.cover_image) setCoverPreview(data.cover_image); // Assuming full URL or relative

            } catch (error) {
                console.error("Failed to fetch user data", error);
            }
        };

        if (user) {
            fetchUserData();
        }
    }, [user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const previewUrl = URL.createObjectURL(file);

        if (type === 'avatar') {
            setAvatarFile(file);
            setAvatarPreview(previewUrl);
        } else {
            setCoverFile(file);
            setCoverPreview(previewUrl);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const data = new FormData();

            // Append Text Fields
            data.append('real_name', formData.real_name);
            data.append('location', formData.location);
            data.append('bio', formData.bio);
            if (formData.birth_date) data.append('birth_date', formData.birth_date);
            data.append('show_birth_date', String(formData.show_birth_date));
            if (formData.gender) data.append('gender', formData.gender);

            // Append Social Links (as JSON string)
            data.append('social_links', JSON.stringify(socialLinks));

            // Append Files
            if (avatarFile) data.append('avatar', avatarFile);
            if (coverFile) data.append('cover_image', coverFile);

            const res = await api.patch('/users/me/', data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // Update Auth Context with new data
            if (updateUser) {
                updateUser(res.data);
            }

            // Redirect to profile on success
            router.push(`/${res.data.username}`);
            router.refresh();

        } catch (error) {
            console.error("Failed to update profile", error);
            alert("Failed to update profile. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="container mx-auto px-4 py-12">
                <div className="max-w-3xl mx-auto">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <h1 className="text-3xl font-bold text-white">Edit Profile</h1>
                        <div className="flex gap-3">
                            <Link
                                href="/profile"
                                className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all font-medium flex items-center gap-2"
                            >
                                <X className="h-4 w-4" />
                                Cancel
                            </Link>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/20"
                            >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Changes
                            </button>
                        </div>
                    </div>

                    <div className="space-y-8">

                        {/* Visuals Section */}
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-6">
                            <h2 className="text-xl font-bold text-white mb-4">Visual Identity</h2>

                            {/* Cover Image */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Cover Image</label>
                                <div
                                    className="relative h-48 w-full rounded-xl overflow-hidden group border border-zinc-800 bg-zinc-950 cursor-pointer"
                                    onClick={() => coverInputRef.current?.click()}
                                >
                                    {coverPreview ? (
                                        <img
                                            src={coverPreview}
                                            alt="Cover Preview"
                                            className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                            No Cover Image
                                        </div>
                                    )}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                        <div className="bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-black/70 transition-colors">
                                            <Camera className="h-4 w-4" />
                                            Change Cover
                                        </div>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={coverInputRef}
                                    onChange={(e) => handleFileChange(e, 'cover')}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>

                            {/* Avatar */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Avatar</label>
                                <div className="flex items-center gap-6">
                                    <div
                                        className="relative h-28 w-28 rounded-full overflow-hidden group border-2 border-zinc-800 bg-zinc-950 cursor-pointer"
                                        onClick={() => avatarInputRef.current?.click()}
                                    >
                                        {avatarPreview ? (
                                            <img
                                                src={avatarPreview}
                                                alt="Avatar Preview"
                                                className="w-full h-full object-cover transition-opacity group-hover:opacity-75"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                                <Camera className="h-8 w-8" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                            <Camera className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <button
                                            onClick={() => avatarInputRef.current?.click()}
                                            className="text-emerald-500 hover:text-emerald-400 font-bold text-sm mb-1"
                                        >
                                            Upload New Avatar
                                        </button>
                                        <p className="text-xs text-zinc-500">Recommended: Square image, at least 400x400px. JPG, PNG or GIF.</p>
                                        <input
                                            type="file"
                                            ref={avatarInputRef}
                                            onChange={(e) => handleFileChange(e, 'avatar')}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Basic Info Section */}
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-6">
                            <h2 className="text-xl font-bold text-white mb-4">Basic Information</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400">Real Name</label>
                                    <input
                                        type="text"
                                        value={formData.real_name}
                                        onChange={(e) => setFormData({ ...formData, real_name: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="John Doe"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400">Location</label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="City, Country"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400">Birth Date</label>
                                    <input
                                        type="date"
                                        value={formData.birth_date}
                                        onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                    />
                                    <div className="flex items-center gap-2 mt-2">
                                        <input
                                            type="checkbox"
                                            id="showBirthDate"
                                            checked={formData.show_birth_date}
                                            onChange={(e) => setFormData({ ...formData, show_birth_date: e.target.checked })}
                                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20 accent-emerald-500"
                                        />
                                        <label htmlFor="showBirthDate" className="text-xs text-zinc-500 cursor-pointer select-none">
                                            Show on Profile
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400">Gender</label>
                                    <select
                                        value={formData.gender}
                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Select Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                        <option value="Non-binary">Non-binary</option>
                                        <option value="Prefer not to say">Prefer not to say</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-zinc-400">Bio</label>
                                <textarea
                                    value={formData.bio}
                                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                    rows={4}
                                    maxLength={500}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none"
                                    placeholder="Tell us about yourself..."
                                />
                                <div className="text-right text-xs text-zinc-500">
                                    {formData.bio.length}/500 characters
                                </div>
                            </div>
                        </div>

                        {/* Social Links Section */}
                        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-6">
                            <h2 className="text-xl font-bold text-white mb-4">Social Links</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                                        <Github className="h-4 w-4" /> GitHub
                                    </label>
                                    <input
                                        type="text"
                                        value={socialLinks.github}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, github: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="GitHub username"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                                        <Linkedin className="h-4 w-4" /> LinkedIn
                                    </label>
                                    <input
                                        type="text"
                                        value={socialLinks.linkedin}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="LinkedIn URL"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                                        <Gamepad2 className="h-4 w-4" /> Steam
                                    </label>
                                    <input
                                        type="text"
                                        value={socialLinks.steam}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, steam: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="Steam ID / URL"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                                        <Twitter className="h-4 w-4" /> Twitter
                                    </label>
                                    <input
                                        type="text"
                                        value={socialLinks.twitter}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="Twitter handle"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                                        <Instagram className="h-4 w-4" /> Instagram
                                    </label>
                                    <input
                                        type="text"
                                        value={socialLinks.instagram}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="Instagram username"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-zinc-400 flex items-center gap-2">
                                        <Facebook className="h-4 w-4" /> Facebook
                                    </label>
                                    <input
                                        type="text"
                                        value={socialLinks.facebook}
                                        onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                        placeholder="Facebook URL"
                                    />
                                </div>

                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}
