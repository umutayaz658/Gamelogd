import { useState, useRef } from 'react';
import { X, Upload, Check, Image as ImageIcon, Globe, Twitter, Youtube } from 'lucide-react';
import api from '@/lib/api';
import { Organisation } from '@/types';
import { useTranslation } from '@/lib/useTranslation';

interface CreateOrganisationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newOrg: Organisation) => void;
}

export default function CreateOrganisationModal({ isOpen, onClose, onSuccess }: CreateOrganisationModalProps) {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        description: '',
        website: '',
        twitter: '',
        youtube: ''
    });
    
    const [logo, setLogo] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [banner, setBanner] = useState<File | null>(null);
    const [bannerPreview, setBannerPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const logoInputRef = useRef<HTMLInputElement>(null);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogo(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setBanner(file);
            setBannerPreview(URL.createObjectURL(file));
        }
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nameVal = e.target.value;
        const generatedSlug = nameVal
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
        
        setFormData(prev => ({
            ...prev,
            name: nameVal,
            slug: prev.slug === '' || prev.slug === generatedSlug.slice(0, -1) ? generatedSlug : prev.slug
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const data = new FormData();
            data.append('name', formData.name);
            data.append('slug', formData.slug.trim().toLowerCase());
            data.append('description', formData.description);
            data.append('website', formData.website);
            data.append('twitter', formData.twitter);
            data.append('youtube', formData.youtube);

            if (logo) {
                data.append('logo', logo);
            }
            if (banner) {
                data.append('banner', banner);
            }

            const res = await api.post('/organisations/', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            onSuccess(res.data);
            onClose();
            // Reset
            setFormData({ name: '', slug: '', description: '', website: '', twitter: '', youtube: '' });
            setLogo(null);
            setLogoPreview(null);
            setBanner(null);
            setBannerPreview(null);
        } catch (err: any) {
            console.error('Failed to create organisation:', err);
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
                setError('Failed to create organization. Check input details.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-5xl h-[85vh] md:h-[650px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
                
                {/* Left Column: Visuals / Logo & Banner uploads */}
                <div className="w-full md:w-2/5 bg-zinc-950 border-r border-zinc-800 p-6 flex flex-col justify-between gap-6 overflow-y-auto">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-2">Organisation Branding</h3>
                            <p className="text-xs text-zinc-500">Provide high-resolution visual identities for your company page.</p>
                        </div>

                        {/* Banner Upload Box */}
                        <div 
                            className="w-full h-32 rounded-xl bg-zinc-900 border border-dashed border-zinc-800 relative cursor-pointer overflow-hidden flex items-center justify-center text-center group hover:border-zinc-700 transition-all"
                            onClick={() => bannerInputRef.current?.click()}
                        >
                            <input 
                                type="file"
                                ref={bannerInputRef}
                                onChange={handleBannerChange}
                                className="hidden"
                                accept="image/*"
                            />
                            {bannerPreview ? (
                                <img src={bannerPreview} alt="Banner Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="p-4 space-y-1">
                                    <Upload className="h-6 w-6 text-zinc-500 mx-auto group-hover:scale-110 transition-transform" />
                                    <div className="text-xs font-semibold text-zinc-400">Upload Banner</div>
                                    <div className="text-[10px] text-zinc-600">Recom. 16:9 ratio</div>
                                </div>
                            )}
                        </div>

                        {/* Logo Upload Box */}
                        <div className="flex justify-center">
                            <div 
                                className="w-24 h-24 rounded-2xl bg-zinc-900 border border-dashed border-zinc-800 relative cursor-pointer overflow-hidden flex items-center justify-center text-center group hover:border-zinc-700 transition-all"
                                onClick={() => logoInputRef.current?.click()}
                            >
                                <input 
                                    type="file"
                                    ref={logoInputRef}
                                    onChange={handleLogoChange}
                                    className="hidden"
                                    accept="image/*"
                                />
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="p-2 space-y-1">
                                        <ImageIcon className="h-6 w-6 text-zinc-500 mx-auto group-hover:scale-110 transition-transform" />
                                        <div className="text-[10px] font-semibold text-zinc-400">Upload Logo</div>
                                        <div className="text-[8px] text-zinc-600">1:1 square</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="text-[10px] text-zinc-600 bg-zinc-900/40 p-3 rounded-lg border border-zinc-800">
                        * Once created, your organisation will have its own public route under `/organisations/[slug]` where other users can find your developer page and follow it.
                    </div>
                </div>

                {/* Right Column: Form Inputs */}
                <form onSubmit={handleSubmit} className="flex-1 flex flex-col h-full bg-zinc-900 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950">
                        <div>
                            <h2 className="text-xl font-bold text-white">Create Organisation</h2>
                            <p className="text-xs text-zinc-500 mt-1">Establish a unified game studio or team presence.</p>
                        </div>
                        <button type="button" onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full transition-colors"><X className="h-5 w-5" /></button>
                    </div>

                    {/* Inputs Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {error && (
                            <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold whitespace-pre-line animate-in fade-in duration-200">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Organisation Name</label>
                                <input 
                                    type="text"
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm"
                                    value={formData.name}
                                    onChange={handleNameChange}
                                    placeholder="e.g. CD Projekt Red"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Slug / Handle</label>
                                <input 
                                    type="text"
                                    required
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm font-mono"
                                    value={formData.slug}
                                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                                    placeholder="e.g. cdprojektred"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">About / Biography</label>
                            <textarea 
                                rows={3}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe your studio, games developed, mission statement..."
                            />
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Links & Social Profiles</label>
                            
                            {/* Website */}
                            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1 group focus-within:border-blue-500/50 transition-all">
                                <Globe className="h-4 w-4 text-zinc-650 mr-2" />
                                <input 
                                    type="url"
                                    className="flex-1 bg-transparent border-none text-white text-xs outline-none py-2 placeholder:text-zinc-750"
                                    value={formData.website}
                                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                                    placeholder="Website URL (e.g. https://cdprojektred.com)"
                                />
                            </div>

                            {/* Twitter */}
                            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1 group focus-within:border-blue-500/50 transition-all">
                                <Twitter className="h-4 w-4 text-zinc-655 mr-2" />
                                <input 
                                    type="url"
                                    className="flex-1 bg-transparent border-none text-white text-xs outline-none py-2 placeholder:text-zinc-750"
                                    value={formData.twitter}
                                    onChange={e => setFormData({ ...formData, twitter: e.target.value })}
                                    placeholder="Twitter URL (e.g. https://x.com/cdprojektred)"
                                />
                            </div>

                            {/* Youtube */}
                            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1 group focus-within:border-blue-500/50 transition-all">
                                <Youtube className="h-4 w-4 text-zinc-655 mr-2" />
                                <input 
                                    type="url"
                                    className="flex-1 bg-transparent border-none text-white text-xs outline-none py-2 placeholder:text-zinc-750"
                                    value={formData.youtube}
                                    onChange={e => setFormData({ ...formData, youtube: e.target.value })}
                                    placeholder="YouTube URL (e.g. https://youtube.com/c/cdprojektred)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex items-center justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all text-sm font-semibold"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={loading || !formData.name || !formData.slug}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-650 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 text-sm"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                                    <span>Creating...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4" />
                                    <span>Create Organisation</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
}
