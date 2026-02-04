import { useState, useRef } from 'react';
import { X, Upload, Check, Image as ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import { Pitch } from '@/types';

interface CreatePitchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newPitch: Pitch) => void;
}

export default function CreatePitchModal({ isOpen, onClose, onSuccess }: CreatePitchModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        genre: 'rpg',
        platform: 'pc',
        funding_goal: '',
        stage: 'concept',
        pitch_deck_url: ''
    });
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = new FormData();
            Object.entries(formData).forEach(([key, value]) => {
                data.append(key, value);
            });

            if (image) {
                data.append('image', image);
            }

            const res = await api.post('/pitches/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onSuccess(res.data);
            onClose();
            setFormData({
                title: '', description: '', genre: 'rpg', platform: 'pc',
                funding_goal: '', stage: 'concept', pitch_deck_url: ''
            });
            setImage(null);
            setPreviewUrl(null);
        } catch (error) {
            console.error('Failed to create pitch:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-5xl h-[700px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* LEFT: Image Upload */}
                <div
                    className="w-full md:w-2/5 bg-zinc-950 border-r border-zinc-800 relative group cursor-pointer flex flex-col items-center justify-center text-center p-6 transition-all hover:bg-zinc-950/80"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />

                    {previewUrl ? (
                        <>
                            <img src={previewUrl} alt="Pitch Preview" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                            <div className="relative z-10 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0 duration-300">
                                <div className="p-4 bg-black/50 backdrop-blur-md rounded-full mb-3 text-emerald-500">
                                    <Upload className="h-8 w-8" />
                                </div>
                                <p className="text-white font-bold text-lg">Change Image</p>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black to-transparent">
                                <h3 className="text-3xl font-black text-white leading-tight drop-shadow-md line-clamp-2">
                                    {formData.title || "Untitled Pitch"}
                                </h3>
                                <p className="text-emerald-400 font-bold mt-2">{formData.funding_goal || "Unknown Funding"}</p>
                            </div>
                        </>
                    ) : (
                        <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors flex flex-col items-center">
                            <div className="p-6 rounded-full bg-zinc-900 border border-zinc-800 mb-6 group-hover:scale-110 transition-transform duration-300">
                                <ImageIcon className="h-12 w-12" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-300 mb-2">Upload Pitch Art</h3>
                            <p className="text-sm max-w-[200px]">Key visual for your game pitch (16:9 recommended).</p>
                        </div>
                    )}
                </div>

                {/* RIGHT: Form */}
                <div className="w-full md:w-3/5 flex flex-col bg-zinc-900">
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                        <div>
                            <h2 className="text-xl font-bold text-white">Pitch Your Project</h2>
                            <p className="text-xs text-zinc-500 mt-1">Submit your game for investment consideration.</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full"><X className="h-5 w-5" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Title</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Project Title"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">The Pitch</label>
                            <textarea
                                rows={4}
                                required
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all resize-none"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe your game, USP, and vision..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Genre</label>
                                <select
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                                    value={formData.genre}
                                    onChange={e => setFormData({ ...formData, genre: e.target.value })}
                                >
                                    <option value="rpg">RPG</option>
                                    <option value="fps">FPS</option>
                                    <option value="strategy">Strategy</option>
                                    <option value="simulation">Simulation</option>
                                    <option value="adventure">Adventure</option>
                                    <option value="platformer">Platformer</option>
                                    <option value="puzzle">Puzzle</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Platform</label>
                                <select
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                                    value={formData.platform}
                                    onChange={e => setFormData({ ...formData, platform: e.target.value })}
                                >
                                    <option value="pc">PC</option>
                                    <option value="console">Console</option>
                                    <option value="mobile">Mobile</option>
                                    <option value="vr_ar">VR/AR</option>
                                    <option value="web">Web</option>
                                    <option value="multi">Multi-platform</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Funding Goal</label>
                                <input
                                    type="text"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                                    value={formData.funding_goal}
                                    onChange={e => setFormData({ ...formData, funding_goal: e.target.value })}
                                    placeholder="$50k - $100k"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Stage</label>
                                <select
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                                    value={formData.stage}
                                    onChange={e => setFormData({ ...formData, stage: e.target.value })}
                                >
                                    <option value="concept">Concept</option>
                                    <option value="prototype">Prototype</option>
                                    <option value="vertical_slice">Vertical Slice</option>
                                    <option value="production">In Production</option>
                                    <option value="alpha">Alpha</option>
                                    <option value="beta">Beta</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pitch Deck URL (Optional)</label>
                            <input
                                type="url"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                                value={formData.pitch_deck_url}
                                onChange={e => setFormData({ ...formData, pitch_deck_url: e.target.value })}
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !formData.title}
                            className="px-8 py-2.5 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20 flex items-center gap-2 text-sm"
                        >
                            {loading ? 'Submitting...' : 'Submit Pitch'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
