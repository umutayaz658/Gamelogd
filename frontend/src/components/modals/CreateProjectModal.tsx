import { useState, useRef } from 'react';
import { X, Upload, Check, Image as ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import { Project } from '@/types';
import { useTranslation } from '@/lib/useTranslation';
import { trackEvent } from '@/lib/analytics';
import { useWorkspace } from '@/components/devs/WorkspaceContext';
import FilterDropdown from '@/components/FilterDropdown';

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
    const { activeWorkspace, logActivity } = useWorkspace();
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
    const [logoImage, setLogoImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTechDropdown, setShowTechDropdown] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const data = new FormData();
            data.append('title', formData.title);
            data.append('description', formData.description);
            data.append('status', formData.status);
            data.append('tech_stack', JSON.stringify(formData.tech_stack));
            if (activeWorkspace.type === 'org' && activeWorkspace.org) {
                data.append('organisation', String(activeWorkspace.org.id));
            }

            if (logoImage) {
                // This upload is the project's square profile photo, not its banner — the
                // project page renders `logo` in the small avatar slot and `cover_image` in
                // the header banner, and this modal only collects one image.
                data.append('logo', logoImage);
            }

            const res = await api.post('/projects/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            trackEvent('project_create');
            logActivity('project_created', `Project "${res.data.title}" created.`, '🚀');

            onSuccess(res.data);
            onClose();
            // Reset form
            setFormData({ title: '', description: '', status: 'in_dev', tech_stack: [] });
            setLogoImage(null);
            setPreviewUrl(null);
            setShowTechDropdown(false);
        } catch (err: any) {
            console.error('Failed to create project:', err);
            const responseData = err.response?.data;
            if (responseData) {
                if (typeof responseData === 'object') {
                    const message = Object.entries(responseData)
                        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                        .join('\n');
                    setError(message);
                } else {
                    setError(responseData);
                }
            } else {
                setError('Failed to create project. Check input details.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-5xl h-[600px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">

                {/* LEFT COLUMN: Logo Upload (the project's square profile photo — see the
                    `logo` field note in handleSubmit) */}
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
                                alt="Logo Preview"
                                className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity"
                            />
                            <div className="relative z-10 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0 duration-300">
                                <div className="p-4 bg-black/50 backdrop-blur-md rounded-full mb-3 text-blue-500">
                                    <Upload className="h-8 w-8" />
                                </div>
                                <p className="text-white font-bold text-lg shadow-black drop-shadow-lg">{t('changeLogo')}</p>
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
                            <h3 className="text-xl font-bold text-zinc-300 mb-2">{t('uploadLogo')}</h3>
                            <p className="text-sm max-w-[200px]">
                                {t('oneToOneSquare')}
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
 
                    {/* Form Content — fits without scrolling now that Publish As is gone; the
                        description textarea scrolls internally on its own if it grows. */}
                    <div className="flex-1 overflow-y-hidden p-8 space-y-6">
                        {error && (
                            <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold whitespace-pre-line animate-in fade-in duration-200">
                                {error}
                            </div>
                        )}
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
                                <FilterDropdown
                                    label={t('developmentStatus')}
                                    value={formData.status}
                                    onChange={(v) => setFormData({ ...formData, status: v })}
                                    showAllOption={false}
                                    showSelectionAccent={false}
                                    matchTriggerWidth
                                    fullWidth
                                    options={[
                                        { value: 'in_dev', label: t('inDevelopment') },
                                        { value: 'alpha', label: 'Alpha' },
                                        { value: 'beta', label: 'Beta' },
                                        { value: 'released', label: t('released') },
                                    ]}
                                />
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
