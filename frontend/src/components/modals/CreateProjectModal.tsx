import { useState, useRef } from 'react';
import { X, Upload, Check, Image as ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import { Project } from '@/types';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newProject: Project) => void;
}

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        status: 'in_dev',
        tech_stack: ''
    });
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('description', formData.description);
            data.append('status', formData.status);

            // Process tech stack (comma separated string -> JSON array)
            const stackArray = formData.tech_stack.split(',').map(s => s.trim()).filter(s => s.length > 0);
            data.append('tech_stack', JSON.stringify(stackArray));

            if (coverImage) {
                data.append('cover_image', coverImage);
            }

            const res = await api.post('/projects/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onSuccess(res.data);
            onClose();
            // Reset form
            setFormData({ title: '', description: '', status: 'in_dev', tech_stack: '' });
            setCoverImage(null);
            setPreviewUrl(null);
        } catch (error) {
            console.error('Failed to create project:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-5xl h-[600px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* LEFT COLUMN: Visual / Cover Image Upload */}
                <div
                    className="w-full md:w-2/5 bg-zinc-950 border-r border-zinc-800 relative group cursor-pointer flex flex-col items-center justify-center text-center p-6 transition-all hover:bg-zinc-950/80"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                        className="hidden"
                        accept="image/*"
                    />

                    {previewUrl ? (
                        <>
                            <img
                                src={previewUrl}
                                alt="Cover Preview"
                                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                            />
                            <div className="relative z-10 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0 duration-300">
                                <div className="p-4 bg-black/50 backdrop-blur-md rounded-full mb-3 text-emerald-500">
                                    <Upload className="h-8 w-8" />
                                </div>
                                <p className="text-white font-bold text-lg shadow-black drop-shadow-lg">Change Cover Image</p>
                            </div>

                            {/* Persistent Title Preview */}
                            <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black to-transparent">
                                <h3 className="text-3xl font-black text-white leading-tight drop-shadow-md line-clamp-2">
                                    {formData.title || "Untitled Project"}
                                </h3>
                                <p className="text-zinc-300 text-sm mt-2 font-medium">
                                    {formData.status === 'in_dev' && 'In Development'}
                                    {formData.status === 'alpha' && 'Alpha Build'}
                                    {formData.status === 'beta' && 'Beta Access'}
                                    {formData.status === 'released' && 'Released'}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-zinc-600 transition-colors group-hover:text-zinc-400">
                            <div className="p-6 rounded-full bg-zinc-900 border border-zinc-800 mb-6 group-hover:scale-110 transition-transform duration-300 group-hover:border-emerald-500/30 group-hover:bg-zinc-900/50">
                                <ImageIcon className="h-12 w-12" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-300 mb-2">Upload Cover Image</h3>
                            <p className="text-sm max-w-[200px]">
                                Choose a standardized 3:4 or 16:9 image for your project card.
                            </p>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Form */}
                <div className="w-full md:w-3/5 flex flex-col bg-zinc-900">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                        <div>
                            <h2 className="text-xl font-bold text-white">Create New Project</h2>
                            <p className="text-xs text-zinc-500 mt-1">Share your next big idea with the world.</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Scrollable Form Content */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                        {/* Title Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Project Title</label>
                            <input
                                type="text"
                                required
                                autoFocus
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-lg text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g. Super Space Odyssey"
                            />
                        </div>

                        {/* Description Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description</label>
                            <textarea
                                required
                                rows={4}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all resize-none leading-relaxed"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="What's this project about? What makes it special?"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            {/* Status Select */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Development Status</label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white appearance-none focus:border-emerald-500/50 outline-none transition-all"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="in_dev">🚧 In Development</option>
                                        <option value="alpha">🧪 Alpha</option>
                                        <option value="beta">🚀 Beta</option>
                                        <option value="released">🌟 Released</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>
                            </div>

                            {/* Tech Stack Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tech Stack</label>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                                    value={formData.tech_stack}
                                    onChange={e => setFormData({ ...formData, tech_stack: e.target.value })}
                                    placeholder="Unity, C#, Blender..."
                                />
                            </div>
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
                            disabled={loading || !formData.title}
                            className="px-8 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2 text-sm"
                        >
                            {loading ? 'Creating...' : (
                                <>
                                    <Check className="h-4 w-4" />
                                    <span>Create Project</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
