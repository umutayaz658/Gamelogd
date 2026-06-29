import { useState, useRef } from 'react';
import { X, Upload, Check, Image as ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import { Project } from '@/types';
import { useTranslation } from '@/lib/useTranslation';

interface CreateProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newProject: Project) => void;
}

const AVAILABLE_TECH = [
    'Unity', 'Unreal Engine', 'Godot', 'GameMaker', 'C#', 'C++', 'Python', 'JavaScript', 'TypeScript', 
    'Blender', 'Maya', 'ZBrush', 'Photoshop', 'Illustrator', 'FMOD', 'Wwise', 'Audacity', 'React', 'Next.js'
];

export default function CreateProjectModal({ isOpen, onClose, onSuccess }: CreateProjectModalProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        status: string;
        tech_stack: string[];
    }>({
        title: '',
        description: '',
        status: 'in_dev',
        tech_stack: []
    });
    const [coverImage, setCoverImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showTechDropdown, setShowTechDropdown] = useState(false);
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
            data.append('tech_stack', JSON.stringify(formData.tech_stack));

            if (coverImage) {
                data.append('cover_image', coverImage);
            }

            const res = await api.post('/projects/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onSuccess(res.data);
            onClose();
            // Reset form
            setFormData({ title: '', description: '', status: 'in_dev', tech_stack: [] });
            setCoverImage(null);
            setPreviewUrl(null);
            setShowTechDropdown(false);
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
                                <div className="p-4 bg-black/50 backdrop-blur-md rounded-full mb-3 text-blue-500">
                                    <Upload className="h-8 w-8" />
                                </div>
                                <p className="text-white font-bold text-lg shadow-black drop-shadow-lg">{t('changeCoverImage')}</p>
                            </div>
 
                            {/* Persistent Title Preview */}
                            <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black to-transparent">
                                <h3 className="text-3xl font-black text-white leading-tight drop-shadow-md line-clamp-2">
                                    {formData.title || t('untitledProject')}
                                </h3>
                                <p className="text-zinc-300 text-sm mt-2 font-medium">
                                    {formData.status === 'in_dev' && t('inDevelopment')}
                                    {formData.status === 'alpha' && 'Alpha'}
                                    {formData.status === 'beta' && 'Beta'}
                                    {formData.status === 'released' && t('released')}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-zinc-600 transition-colors group-hover:text-zinc-400">
                            <div className="p-6 rounded-full bg-zinc-900 border border-zinc-800 mb-6 group-hover:scale-110 transition-transform duration-300 group-hover:border-blue-500/30 group-hover:bg-zinc-900/50">
                                <ImageIcon className="h-12 w-12" />
                            </div>
                            <h3 className="text-xl font-bold text-zinc-300 mb-2">{t('uploadCoverImage')}</h3>
                            <p className="text-sm max-w-[200px]">
                                {t('chooseStandardizedImageDesc')}
                            </p>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Form */}
                <div className="w-full md:w-3/5 flex flex-col bg-zinc-900">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                        <div>
                            <h2 className="text-xl font-bold text-white">{t('createNewProject')}</h2>
                            <p className="text-xs text-zinc-500 mt-1">{t('shareNextBigIdeaDesc')}</p>
                        </div>
                        <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
 
                    {/* Scrollable Form Content */}
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin-dark">
                        {/* Title Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('projectTitle')}</label>
                            <input
                                type="text"
                                required
                                autoFocus
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-lg text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder={t('projectTitlePlaceholder')}
                            />
                        </div>
 
                        {/* Description Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('description')}</label>
                            <textarea
                                required
                                rows={4}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all resize-none leading-relaxed"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder={t('projectDescriptionPlaceholder')}
                            />
                        </div>
 
                        <div className="grid grid-cols-2 gap-6">
                            {/* Status Select */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('developmentStatus')}</label>
                                <div className="relative">
                                    <select
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white appearance-none focus:border-blue-500/50 outline-none transition-all"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    >
                                        <option value="in_dev">{t('inDevelopmentEmoji')}</option>
                                        <option value="alpha">{t('alphaEmoji')}</option>
                                        <option value="beta">{t('betaEmoji')}</option>
                                        <option value="released">{t('releasedEmoji')}</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                    </div>
                                </div>
                            </div>
 
                            {/* Tech Stack Input */}
                            <div className="space-y-2 relative">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('techStack')}</label>
                                <div 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white cursor-pointer min-h-[50px] flex flex-wrap gap-2 items-center hover:border-zinc-700 transition-colors"
                                    onClick={() => setShowTechDropdown(!showTechDropdown)}
                                >
                                    {formData.tech_stack.length > 0 ? (
                                        formData.tech_stack.map(tech => (
                                            <span key={tech} className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                                                {tech}
                                                <X 
                                                    className="w-3 h-3 cursor-pointer hover:text-blue-300" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setFormData({...formData, tech_stack: formData.tech_stack.filter(t => t !== tech)})
                                                    }}
                                                />
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-zinc-700">{t('selectTechPlaceholder')}</span>
                                    )}
                                </div>
                                
                                {showTechDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowTechDropdown(false)} />
                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto p-2 grid grid-cols-2 gap-1 animate-in fade-in slide-in-from-bottom-2 scrollbar-thin-dark">
                                            {AVAILABLE_TECH.map(tech => (
                                                <button
                                                    key={tech}
                                                    type="button"
                                                    onClick={() => {
                                                        if (formData.tech_stack.includes(tech)) {
                                                            setFormData({...formData, tech_stack: formData.tech_stack.filter(t => t !== tech)});
                                                        } else {
                                                            setFormData({...formData, tech_stack: [...formData.tech_stack, tech]});
                                                        }
                                                    }}
                                                    className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${formData.tech_stack.includes(tech) ? 'bg-blue-500 text-white' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                                                >
                                                    {tech}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
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
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={loading || !formData.title}
                            className="px-8 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 text-sm"
                        >
                            {loading ? t('creating') : (
                                <>
                                    <Check className="h-4 w-4" />
                                    <span>{t('createProject')}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
