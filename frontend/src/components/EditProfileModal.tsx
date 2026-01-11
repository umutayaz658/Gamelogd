import { useState, useRef, useEffect } from 'react';
import { User } from '@/types';
import { X, Camera, Loader2, Calendar, Check } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface EditProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    onUpdate: (updatedUser: User) => void;
}

export default function EditProfileModal({ isOpen, onClose, user, onUpdate }: EditProfileModalProps) {
    const { updateUser } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    // Form State
    const [realName, setRealName] = useState(user.real_name || '');
    const [bio, setBio] = useState(user.bio || '');
    const [location, setLocation] = useState(user.location || '');
    const [birthDate, setBirthDate] = useState(user.birth_date || ''); // YYYY-MM-DD
    const [showBirthDate, setShowBirthDate] = useState(user.show_birth_date || false);

    // Image State (Previews and Files)
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [coverFile, setCoverFile] = useState<File | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    const coverInputRef = useRef<HTMLInputElement>(null);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setRealName(user.real_name || '');
            setBio(user.bio || '');
            setLocation(user.location || '');
            setBirthDate(user.birth_date || '');
            setShowBirthDate(user.show_birth_date || false);
            setCoverPreview(getImageUrl(user.cover_image));
            setAvatarPreview(getImageUrl(user.avatar, user.username));
            setCoverFile(null);
            setAvatarFile(null);
        }
    }, [isOpen, user]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'avatar') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            if (type === 'cover') {
                setCoverPreview(reader.result as string);
                setCoverFile(file);
            } else {
                setAvatarPreview(reader.result as string);
                setAvatarFile(file);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('real_name', realName);
            formData.append('bio', bio);
            formData.append('location', location);
            if (birthDate) {
                formData.append('birth_date', birthDate);
                formData.append('show_birth_date', showBirthDate ? 'true' : 'false');
            }

            if (coverFile) {
                formData.append('cover_image', coverFile);
            }
            if (avatarFile) {
                formData.append('avatar', avatarFile);
            }

            const res = await api.patch('/users/me/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            onUpdate(res.data);

            // Sync global auth state
            updateUser(res.data);

            onClose();
        } catch (error) {
            console.error("Failed to update profile:", error);
            alert("Failed to update profile. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-black border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-black/50 backdrop-blur-md z-10 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-800 transition-colors">
                            <X className="h-5 w-5 text-zinc-400" />
                        </button>
                        <h2 className="text-xl font-bold text-white">Edit Profile</h2>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="px-5 py-1.5 bg-emerald-600 text-white font-bold rounded-full hover:bg-emerald-500 disabled:opacity-50 transition-colors text-sm"
                    >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </button>
                    <style>{`
                        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #3f3f46; border-radius: 20px; }
                    `}</style>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">

                    {/* Cover Image */}
                    <div className="relative h-48 w-full bg-zinc-900 group">
                        {coverPreview ? (
                            <img src={coverPreview} alt="Cover" className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity" />
                        ) : (
                            <div className="w-full h-full bg-zinc-800" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity gap-4">
                            <button
                                onClick={() => coverInputRef.current?.click()}
                                className="p-3 bg-black/50 rounded-full hover:bg-zinc-800/80 text-white backdrop-blur-sm transition-all"
                            >
                                <Camera className="h-5 w-5" />
                            </button>
                            {coverPreview && (
                                <button
                                    onClick={() => { setCoverPreview(null); setCoverFile(null); }}
                                    className="p-3 bg-black/50 rounded-full hover:bg-red-500/80 text-white backdrop-blur-sm transition-all"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={coverInputRef}
                            onChange={(e) => handleImageChange(e, 'cover')}
                            className="hidden"
                            accept="image/*"
                        />
                    </div>

                    {/* Avatar - Overlapping */}
                    <div className="px-4 -mt-14 mb-4">
                        <div className="relative inline-block group">
                            <div className="w-28 h-28 rounded-full border-4 border-black bg-zinc-900 overflow-hidden relative">
                                <img src={avatarPreview || getImageUrl(null)} alt="Avatar" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                                    <Camera className="h-6 w-6 text-white" />
                                </div>
                            </div>
                            <input
                                type="file"
                                ref={avatarInputRef}
                                onChange={(e) => handleImageChange(e, 'avatar')}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>
                    </div>

                    {/* Fields */}
                    <div className="px-4 pb-8 space-y-6">

                        {/* Name */}
                        <div className="space-y-1">
                            <label className="text-zinc-500 text-sm font-bold ml-1">Name</label>
                            <input
                                type="text"
                                value={realName}
                                onChange={(e) => setRealName(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                                placeholder="Display Name"
                            />
                        </div>

                        {/* Bio */}
                        <div className="space-y-1">
                            <label className="text-zinc-500 text-sm font-bold ml-1">Bio</label>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value)}
                                rows={3}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700 resize-none"
                                placeholder="Tell us about yourself..."
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-1">
                            <label className="text-zinc-500 text-sm font-bold ml-1">Location</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700"
                                placeholder="Where are you based?"
                            />
                        </div>

                        {/* Birth Date */}
                        <div className="space-y-1">
                            <label className="text-zinc-500 text-sm font-bold ml-1 flex items-center gap-2">
                                <Calendar className="h-3 w-3" />
                                Birth Date
                            </label>
                            <input
                                type="date"
                                value={birthDate}
                                onChange={(e) => setBirthDate(e.target.value)}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-zinc-700 [color-scheme:dark]"
                            />
                            <div className="flex items-center gap-3 mt-3 cursor-pointer group" onClick={() => setShowBirthDate(!showBirthDate)}>
                                <div className={`
                                    w-5 h-5 rounded border flex items-center justify-center transition-all duration-200
                                    ${showBirthDate
                                        ? 'bg-emerald-500 border-emerald-500'
                                        : 'bg-zinc-800 border-zinc-600 group-hover:border-zinc-500'}
                                `}>
                                    {showBirthDate && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                </div>
                                <span className="text-zinc-300 text-sm select-none font-medium">
                                    Show on profile
                                </span>
                            </div>
                        </div>

                    </div>

                </div>
            </div>
        </div>
    );
}
