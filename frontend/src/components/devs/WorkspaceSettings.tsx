'use client';

import { useState } from 'react';
import {
    Settings, Globe, Link2, Github, Copy, Check, Zap, Trash2,
    AlertTriangle, X, RefreshCw, Terminal,
} from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { cn } from '@/lib/utils';

export default function WorkspaceSettings() {
    const { activeWorkspace, logActivity } = useWorkspace();
    const isOrg = activeWorkspace.type === 'org';

    const [orgName, setOrgName] = useState(isOrg ? (activeWorkspace.org?.name ?? '') : 'Solo Workspace');
    const [website, setWebsite] = useState('');
    const [description, setDescription] = useState('');
    const [github, setGithub] = useState('https://github.com/yourstudio/yourgame');

    // Git integration
    const [webhookCopied, setWebhookCopied] = useState(false);
    const [gitTestResult, setGitTestResult] = useState<string | null>(null);
    const [gitTesting, setGitTesting] = useState(false);

    // Steam integration
    const [apiToken] = useState(() => `glk_${Array.from({ length: 32 }, () => Math.random().toString(36)[2]).join('')}`);
    const [tokenCopied, setTokenCopied] = useState(false);
    const [steamTestResult, setSteamTestResult] = useState<string | null>(null);
    const [steamTesting, setSteamTesting] = useState(false);

    // Danger zone
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    const webhookUrl = `https://api.gamelogd.com/api/integrations/github/webhook/${isOrg ? activeWorkspace.org?.id : 'solo'}/`;
    const confirmText = isOrg ? (activeWorkspace.org?.name ?? 'workspace') : 'Solo Workspace';

    const copyText = async (text: string, setter: (v: boolean) => void) => {
        await navigator.clipboard.writeText(text);
        setter(true);
        setTimeout(() => setter(false), 2000);
    };

    const testGitWebhook = async () => {
        setGitTesting(true);
        setGitTestResult(null);
        await new Promise((r) => setTimeout(r, 1200));
        logActivity('git_push', 'GitHub webhook test triggered — commit "fix: adjusted player jump height" received.', '🔗', 'devuser');
        setGitTestResult('✅ Webhook received! Activity feed updated with mock commit.');
        setGitTesting(false);
    };

    const testSteamBuild = async () => {
        setSteamTesting(true);
        setSteamTestResult(null);
        await new Promise((r) => setTimeout(r, 1500));
        logActivity('steam_build', 'Steam build v1.2.0-beta successfully uploaded to Default branch!', '🚀');
        setSteamTestResult('🚀 Mock build push received! Dashboard activity updated. Devlog draft would be auto-created.');
        setSteamTesting(false);
    };

    return (
        <div className="space-y-8 max-w-3xl">
            {/* Header */}
            <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-zinc-400" /> Workspace Settings
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                    {isOrg ? `Manage "${activeWorkspace.org?.name}" organisation settings` : 'Manage your solo workspace settings'}
                </p>
            </div>

            {/* General Info */}
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" /> General Information
                </h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">
                            {isOrg ? 'Organisation Name' : 'Workspace Name'}
                        </label>
                        <input
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Short description of your studio or project..."
                            rows={2}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 resize-none transition-all"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Website</label>
                        <input
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://yourstudio.com"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>
                <button className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20">
                    Save Changes
                </button>
            </section>

            {/* Git Integration */}
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                    <Github className="w-4 h-4 text-zinc-400" /> Git Integration (GitHub / GitLab)
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                    Add this webhook URL to your GitHub repo Settings → Webhooks. Push events, pull requests and releases will appear in your workspace activity feed.
                </p>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Webhook URL</label>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-emerald-400 font-mono overflow-x-auto whitespace-nowrap">
                            {webhookUrl}
                        </code>
                        <button
                            onClick={() => copyText(webhookUrl, setWebhookCopied)}
                            className={cn('flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0',
                                webhookCopied ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600')}
                        >
                            {webhookCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {webhookCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">GitHub Repo URL</label>
                    <input value={github} onChange={(e) => setGithub(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-all font-mono" />
                </div>

                <button
                    onClick={testGitWebhook}
                    disabled={gitTesting}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                    {gitTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                    {gitTesting ? 'Testing...' : 'Test Webhook (Simulate Commit)'}
                </button>

                {gitTestResult && (
                    <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                        {gitTestResult}
                    </p>
                )}
            </section>

            {/* Steam Integration */}
            <section className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-400" /> Steam CI/CD Build Notifier
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                    Add this API token to your GitHub Actions or CI/CD pipeline. When you push a build to Steam, include a simple curl command with this token to receive a build notification in your workspace dashboard.
                </p>

                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">API Token</label>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-amber-400 font-mono overflow-x-auto whitespace-nowrap">
                            {apiToken}
                        </code>
                        <button
                            onClick={() => copyText(apiToken, setTokenCopied)}
                            className={cn('flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0',
                                tokenCopied ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600')}
                        >
                            {tokenCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {tokenCopied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-700 rounded-xl p-4">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold mb-2">Example CI/CD Step (GitHub Actions)</p>
                    <pre className="text-[11px] text-emerald-400 font-mono leading-relaxed overflow-x-auto whitespace-pre">
{`- name: Notify Gamelogd
  run: |
    curl -X POST https://api.gamelogd.com/api/builds/ \\
      -H "Authorization: Token ${apiToken.slice(0, 12)}..." \\
      -d '{"version":"v\${{ env.VERSION }}","changes":"...'}`}
                    </pre>
                </div>

                <button
                    onClick={testSteamBuild}
                    disabled={steamTesting}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                >
                    {steamTesting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    {steamTesting ? 'Simulating...' : 'Simulate Steam Build Push (v1.2.0-beta)'}
                </button>

                {steamTestResult && (
                    <p className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5">
                        {steamTestResult}
                    </p>
                )}
            </section>

            {/* Danger Zone */}
            <section className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold text-zinc-300">
                            {isOrg ? 'Delete Organisation' : 'Clear Workspace Data'}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                            {isOrg
                                ? 'Permanently deletes this organisation and all its data. This action cannot be undone.'
                                : 'Clears all workspace data from localStorage. This action cannot be undone.'}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowDeleteModal(true)}
                        className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 px-4 py-2 rounded-xl text-sm font-bold transition-all flex-shrink-0"
                    >
                        <Trash2 className="w-4 h-4" />
                        {isOrg ? 'Delete' : 'Clear Data'}
                    </button>
                </div>
            </section>

            {/* Delete Confirm Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}>
                    <div className="bg-zinc-950 border border-red-900/50 rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 duration-300 p-6 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-red-500/10 rounded-xl">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white">Confirm Deletion</h3>
                            </div>
                            <button onClick={() => setShowDeleteModal(false)} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                        <p className="text-sm text-zinc-400">
                            Type <span className="font-bold text-white font-mono">"{confirmText}"</span> to confirm deletion:
                        </p>
                        <input
                            autoFocus
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder={confirmText}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-red-500 transition-all"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">Cancel</button>
                            <button
                                disabled={deleteConfirmText !== confirmText}
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Delete Forever
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
