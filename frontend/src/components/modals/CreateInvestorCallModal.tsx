import { useState } from 'react';
import { X, Check } from 'lucide-react';
import api from '@/lib/api';
import { InvestorCall } from '@/types';

interface CreateInvestorCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newCall: InvestorCall) => void;
}

export default function CreateInvestorCallModal({ isOpen, onClose, onSuccess }: CreateInvestorCallModalProps) {
    const [formData, setFormData] = useState({
        organization_name: '',
        investor_type: 'vc',
        looking_for: '',
        ticket_size: '',
        deadline: ''
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await api.post('/investor-calls/', formData);
            onSuccess(res.data);
            onClose();
            setFormData({
                organization_name: '', investor_type: 'vc', looking_for: '',
                ticket_size: '', deadline: ''
            });
        } catch (error) {
            console.error('Failed to create call:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-950">
                    <div>
                        <h2 className="text-xl font-bold text-white">Create Investor Call</h2>
                        <p className="text-xs text-zinc-500 mt-1">Announce your funding specifications.</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-full"><X className="h-5 w-5" /></button>
                </div>

                {/* Form */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Organization Name</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                            value={formData.organization_name}
                            onChange={e => setFormData({ ...formData, organization_name: e.target.value })}
                            placeholder="e.g. Galaxy Ventures"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Investor Type</label>
                            <select
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                                value={formData.investor_type}
                                onChange={e => setFormData({ ...formData, investor_type: e.target.value })}
                            >
                                <option value="vc">Venture Capital</option>
                                <option value="publisher">Publisher</option>
                                <option value="angel">Angel Investor</option>
                                <option value="grant">Grant / Fund</option>
                                <option value="accelerator">Accelerator</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ticket Size</label>
                            <input
                                type="text"
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                                value={formData.ticket_size}
                                onChange={e => setFormData({ ...formData, ticket_size: e.target.value })}
                                placeholder="e.g. $100k - $500k"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">What are you looking for?</label>
                        <textarea
                            rows={4}
                            required
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all resize-none"
                            value={formData.looking_for}
                            onChange={e => setFormData({ ...formData, looking_for: e.target.value })}
                            placeholder="Describe genres, stages, or platforms you're targeting..."
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Deadline (Optional)</label>
                        <input
                            type="date"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-700 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                            value={formData.deadline}
                            onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !formData.organization_name}
                        className="px-8 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20 flex items-center gap-2 text-sm"
                    >
                        {loading ? 'Posting...' : 'Post Call'}
                    </button>
                </div>
            </div>
        </div>
    );
}
