
import { useState, useRef, useEffect } from 'react';
import { X, Check, Upload, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { Project, Post } from '@/types';
import { useTranslation } from '@/lib/useTranslation';
import { trackEvent } from '@/lib/analytics';

interface CreateDevlogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newPost: Post) => void;
    projectId: number;
    // Optional: only the Devs page's own entry point passes this (it already has
    // useWorkspace()'s logActivity in scope). This modal can't call useWorkspace() itself —
    // it's also rendered from a project's own page, which lives outside /devs's
    // WorkspaceProvider, so the hook would throw there.
    onLogged?: () => void;
}

interface MediaItem {
    file: File;
    preview: string;
    type: 'image' | 'video';
}

export default function CreateDevlogModal({ isOpen, onClose, onSuccess, projectId, onLogged }: CreateDevlogModalProps) {
    const { t, language } = useTranslation();
    const [project, setProject] = useState<Project | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    // Multi-media state
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch the project this devlog belongs to (for the background/branding visuals
    // and to resolve author_identity automatically — no more "Publish As" picker).
    useEffect(() => {
        if (isOpen) {
            api.get(`/projects/${projectId}/`)
                .then(res => setProject(res.data))
                .catch(err => console.error("Failed to load project", err));
        } else {
            // Reset state when closed
            setTitle('');
            setContent('');
            setProject(null);
            setMediaItems([]);
        }
    }, [isOpen, projectId]);

    // Cleanup object URLs on unmount or change
    useEffect(() => {
        return () => {
            mediaItems.forEach(item => URL.revokeObjectURL(item.preview));
        };
    }, [mediaItems]);

    if (!isOpen) return null;

    const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const newItems: MediaItem[] = Array.from(files).map(file => ({
                file,
                preview: URL.createObjectURL(file),
                type: file.type.startsWith('video') ? 'video' : 'image'
            }));
            setMediaItems(prev => [...prev, ...newItems]);
        }
        // Reset input so same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeMedia = (index: number) => {
        setMediaItems(prev => {
            const newItems = [...prev];
            URL.revokeObjectURL(newItems[index].preview);
            newItems.splice(index, 1);
            return newItems;
        });
    };

    const postAsProject = () => {
        const formData = new FormData();
        formData.append('project_parent', String(projectId));
        formData.append('title', title);
        formData.append('content', content);
        formData.append('author_identity', 'project');

        // Append each file as 'uploaded_media' (DRF ListField handles multiple values for same key)
        mediaItems.forEach(item => {
            formData.append('uploaded_media', item.file);
        });

        return api.post('/posts/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // No more "Publish As" picker — a devlog always posts under the project's own
            // identity, never the parent organisation's (PostViewSet.perform_create allows
            // this for the project owner/admin AND any org owner/admin, so nothing is lost).
            const res = await postAsProject();
            trackEvent('devlog_create');
            onLogged?.();

            onSuccess(res.data);
            onClose();
        } catch (error) {
            console.error('Failed to post devlog:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-5xl h-[600px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* LEFT COLUMN: Visual Context & Media Upload Gallery */}
                <div className="w-full md:w-2/5 bg-zinc-950 border-r border-zinc-800 relative flex flex-col overflow-hidden">

                    {/* Media Gallery Area */}
                    {mediaItems.length > 0 ? (
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <div className="grid grid-cols-2 gap-3">
                                {mediaItems.map((item, index) => (
                                    <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-zinc-800 group">
                                        {item.type === 'video' ? (
                                            <video src={item.preview} className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={item.preview} alt="Preview" className="w-full h-full object-cover" />
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button
                                                onClick={() => removeMedia(index)}
                                                className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {/* Add More Button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square rounded-xl border-2 border-dashed border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-blue-500"
                                >
                                    <Plus className="h-8 w-8" />
                                    <span className="text-xs font-bold uppercase">{t('addMedia')}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Empty State / Initial View
                        <div
                            className="flex-1 flex flex-col items-center justify-center text-center p-6 relative group cursor-pointer hover:bg-zinc-950/80 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {/* Background Project Cover */}
                            <div className="absolute inset-0">
                                {project?.logo ? (
                                    <img src={getImageUrl(project.logo)} alt="Project Cover" className="w-full h-full object-cover opacity-20 grayscale blur-[2px] transition-transform duration-700 group-hover:scale-105" />
                                ) : (
                                    <div className="w-full h-full bg-zinc-900/50" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                            </div>

                            <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="p-5 rounded-full bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 group-hover:bg-blue-600 group-hover:border-blue-500 group-hover:text-white transition-all duration-300">
                                    <Upload className="h-10 w-10 text-zinc-400 group-hover:text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1 drop-shadow-md">{t('addVisuals')}</h3>
                                    <p className="text-sm text-zinc-400 max-w-[200px]">
                                        {t('addVisualsDesc')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hidden Input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleMediaChange}
                        className="hidden"
                        accept="image/*,video/*"
                        multiple // Enable multiple selection
                    />

                    {/* Bottom Project Info Overlay (Only if no media, or sleek bar if media exists?) */}
                    {project && mediaItems.length === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 p-6 text-left pointer-events-none">
                            <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1 shadow-black drop-shadow-md">{t('postingTo')}</p>
                            <h3 className="text-2xl font-black text-white leading-none shadow-black drop-shadow-lg">{project.title}</h3>
                        </div>
                    )}
                    {project && mediaItems.length > 0 && (
                        <div className="p-4 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-sm z-10 flex items-center justify-between">
                            <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">{t('projects')}</span>
                            <span className="text-white font-bold text-sm truncate max-w-[150px]">{project.title}</span>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Form */}
                <div className="w-full md:w-3/5 flex flex-col bg-zinc-900">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                        <div>
                            <h2 className="text-xl font-bold text-white">{t('postNewDevlog')}</h2>
                            <p className="text-xs text-zinc-500 mt-1">{t('keepCommunityInLoop')}</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin-dark">

                        {/* Title Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('headline')}</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold placeholder:text-zinc-700 focus:border-blue-500/50 outline-none transition-all"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder={t('devlogHeadlinePlaceholder')}
                            />
                        </div>

                        {/* Content Input */}
                        <div className="space-y-2 flex-1 flex flex-col">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('details')}</label>
                            <textarea
                                required
                                className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-blue-500/50 outline-none transition-all resize-none leading-relaxed min-h-[150px]"
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder={t('devlogDetailsPlaceholder')}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={loading || !title.trim()}
                            className="px-8 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 text-sm"
                        >
                            {loading ? t('posting') : (
                                <>
                                    <Check className="h-4 w-4" />
                                    <span>{t('postDevlog')}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
