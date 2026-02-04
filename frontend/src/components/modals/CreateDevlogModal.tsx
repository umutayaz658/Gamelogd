
import { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, Video, Check, Upload, Layout, Plus, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { getImageUrl } from '@/lib/utils';
import { Project, Post } from '@/types';

interface CreateDevlogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newPost: Post) => void;
}

interface MediaItem {
    file: File;
    preview: string;
    type: 'image' | 'video';
}

export default function CreateDevlogModal({ isOpen, onClose, onSuccess }: CreateDevlogModalProps) {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<number | ''>('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    // Multi-media state
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch user's projects
    useEffect(() => {
        if (isOpen) {
            const fetchProjects = async () => {
                try {
                    const res = await api.get('/projects/');
                    setProjects(res.data.results || res.data);
                } catch (err) {
                    console.error("Failed to load projects", err);
                }
            };
            fetchProjects();
        } else {
            // Reset state when closed
            setTitle('');
            setContent('');
            setSelectedProject('');
            setMediaItems([]);
        }
    }, [isOpen]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProject) return;
        setLoading(true);

        try {
            const formData = new FormData();
            formData.append('project_parent', selectedProject.toString());
            formData.append('title', title);
            formData.append('content', content);

            // Append each file as 'uploaded_media' (DRF ListField handles multiple values for same key)
            mediaItems.forEach(item => {
                formData.append('uploaded_media', item.file);
            });

            const res = await api.post('/posts/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onSuccess(res.data);
            onClose();
        } catch (error) {
            console.error('Failed to post devlog:', error);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Find selected project to get its cover image
    const currentProject = projects.find(p => p.id === Number(selectedProject));

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
                                    className="aspect-square rounded-xl border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-2 text-zinc-500 hover:text-emerald-500"
                                >
                                    <Plus className="h-8 w-8" />
                                    <span className="text-xs font-bold uppercase">Add Media</span>
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
                                {currentProject?.cover_image ? (
                                    <img src={getImageUrl(currentProject.cover_image)} alt="Project Cover" className="w-full h-full object-cover opacity-20 grayscale blur-[2px] transition-transform duration-700 group-hover:scale-105" />
                                ) : (
                                    <div className="w-full h-full bg-zinc-900/50" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                            </div>

                            <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="p-5 rounded-full bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:text-white transition-all duration-300">
                                    <Upload className="h-10 w-10 text-zinc-400 group-hover:text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-1 drop-shadow-md">Add Visuals</h3>
                                    <p className="text-sm text-zinc-400 max-w-[200px]">
                                        Upload multiple images or videos to showcase your progress.
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
                    {currentProject && mediaItems.length === 0 && (
                        <div className="absolute bottom-0 left-0 right-0 p-6 text-left pointer-events-none">
                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1 shadow-black drop-shadow-md">Posting to</p>
                            <h3 className="text-2xl font-black text-white leading-none shadow-black drop-shadow-lg">{currentProject.title}</h3>
                        </div>
                    )}
                    {currentProject && mediaItems.length > 0 && (
                        <div className="p-4 border-t border-zinc-800 bg-zinc-950/90 backdrop-blur-sm z-10 flex items-center justify-between">
                            <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Project</span>
                            <span className="text-white font-bold text-sm truncate max-w-[150px]">{currentProject.title}</span>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Form */}
                <div className="w-full md:w-3/5 flex flex-col bg-zinc-900">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                        <div>
                            <h2 className="text-xl font-bold text-white">Post New Devlog</h2>
                            <p className="text-xs text-zinc-500 mt-1">Keep your community in the loop.</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Form Content */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">

                        {/* Project Selector - Prominent */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Select Project</label>
                            <div className="relative">
                                <select
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white appearance-none focus:border-emerald-500/50 outline-none transition-all font-medium text-lg"
                                    value={selectedProject}
                                    onChange={e => setSelectedProject(Number(e.target.value))}
                                >
                                    <option value="">-- Choose a project --</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.title}</option>
                                    ))}
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                    <Layout className="h-5 w-5" />
                                </div>
                            </div>
                        </div>

                        {/* Title Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Headline</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold placeholder:text-zinc-700 focus:border-emerald-500/50 outline-none transition-all"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Update #4: New Combat System"
                            />
                        </div>

                        {/* Content Input */}
                        <div className="space-y-2 flex-1 flex flex-col">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Details</label>
                            <textarea
                                required
                                className="flex-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 outline-none transition-all resize-none leading-relaxed min-h-[150px]"
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="What have you been working on? Share the details..."
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
                            Cancel
                        </button>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={loading || !selectedProject || !title}
                            className="px-8 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2 text-sm"
                        >
                            {loading ? 'Posting...' : (
                                <>
                                    <Check className="h-4 w-4" />
                                    <span>Post Devlog</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
