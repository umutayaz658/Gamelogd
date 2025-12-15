'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Navbar from "@/components/Navbar";
import Switch from "@/components/Switch";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { User, Shield, Gamepad2, Bell, EyeOff, Lock, Trash2, Monitor, Twitch, Globe, FileText, HelpCircle, ChevronRight, ExternalLink, MessageCircle, Bug, Zap, Play, Loader2 } from 'lucide-react';

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading settings...</div>}>
            <SettingsContent />
        </Suspense>
    );
}

function SettingsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const activeTab = searchParams.get('tab') || 'account';

    const setActiveTab = (tabId: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', tabId);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // State for toggles
    const [settings, setSettings] = useState({
        privateProfile: false,
        directMessages: true,
        shareActivity: true,
        blurSpoilers: true,
        matureContent: false,
        newFollowers: true,
        mentions: true,
        jobAlerts: true,
    });

    // State for Display Settings
    const [displaySettings, setDisplaySettings] = useState({
        language: 'English',
        fontSize: 'Medium',
        accentColor: 'Emerald'
    });

    // Steam State
    const { user } = useAuth();
    const [steamIdInput, setSteamIdInput] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [steamConnected, setSteamConnected] = useState(false);

    useEffect(() => {
        if (user?.steam_id) {
            setSteamConnected(true);
            setSteamIdInput(user.steam_id);
        }
    }, [user]);

    const handleSteamSync = async () => {
        if (!steamIdInput) return;
        setIsSyncing(true);
        try {
            await api.post('/users/sync_steam/', { steam_id: steamIdInput });
            setSteamConnected(true);
            alert("Steam library syncing started! It may take a few minutes to appear.");
        } catch (error) {
            console.error("Steam sync failed:", error);
            alert("Failed to sync Steam account. Please check your ID.");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSteamDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect Steam? This will remove your synced games.")) return;
        try {
            await api.post('/users/disconnect_steam/');
            setSteamConnected(false);
            setSteamIdInput('');
            alert("Steam disconnected successfully.");
        } catch (error) {
            console.error("Failed to disconnect Steam:", error);
            alert("Failed to disconnect Steam.");
        }
    };

    const handleToggle = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const categories = [
        { id: 'account', label: 'My Account', icon: User },
        { id: 'connected', label: 'Connected Accounts', icon: Monitor },
        { id: 'privacy', label: 'Privacy & Safety', icon: Shield },
        { id: 'content', label: 'Content Preferences', icon: EyeOff },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'display', label: 'Display & Languages', icon: Globe },
        { id: 'resources', label: 'Additional Resources', icon: FileText },
        { id: 'help', label: 'Help Center', icon: HelpCircle },
    ];

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
            <Navbar />

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8">Settings</h1>

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Left Sidebar - Navigation */}
                        <div className="w-full md:w-1/4">
                            <nav className="flex flex-col gap-2">
                                {categories.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => setActiveTab(category.id)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeTab === category.id
                                            ? 'bg-zinc-800 text-white'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                                            }`}
                                    >
                                        <category.icon className="h-5 w-5" />
                                        {category.label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Right Content - Settings Forms */}
                        <div className="w-full md:w-3/4 bg-zinc-900 rounded-2xl border border-zinc-800 p-6 md:p-8 min-h-[500px]">

                            {/* My Account */}
                            {activeTab === 'account' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">My Account</h2>

                                    <div className="space-y-4 max-w-md">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Username</label>
                                            <input
                                                type="text"
                                                defaultValue="umutayaz"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Email</label>
                                            <input
                                                type="email"
                                                defaultValue="umut@example.com"
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-zinc-800">
                                        <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                                            <Lock className="h-4 w-4" />
                                            Change Password
                                        </button>
                                    </div>

                                    <div className="pt-6 border-t border-zinc-800">
                                        <h3 className="text-red-500 font-bold mb-2 uppercase tracking-wider text-sm">Danger Zone</h3>
                                        <p className="text-zinc-400 text-sm mb-4">Once you delete your account, there is no going back. Please be certain.</p>
                                        <button className="px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg font-medium transition-colors flex items-center gap-2">
                                            <Trash2 className="h-4 w-4" />
                                            Delete Account
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Connected Accounts */}
                            {activeTab === 'connected' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">Connected Accounts</h2>
                                    <p className="text-zinc-400 mb-6">Connect your gaming accounts to display your library and achievements.</p>

                                    <div className="space-y-4">
                                        {[
                                            { id: 'steam', name: 'Steam', icon: Gamepad2, connected: steamConnected, color: 'text-blue-400', description: 'Sync your Steam library and achievements.' },
                                            { id: 'psn', name: 'PlayStation Network', icon: Gamepad2, connected: false, color: 'text-blue-600', description: 'Connect your PSN account.' },
                                            { id: 'xbox', name: 'Xbox Live', icon: Gamepad2, connected: false, color: 'text-green-500', description: 'Connect your Xbox Live account.' },
                                            { id: 'twitch', name: 'Twitch', icon: Twitch, connected: false, color: 'text-purple-500', description: 'Connect your Twitch account.' },
                                            { id: 'epic', name: 'Epic Games', icon: Zap, connected: false, color: 'text-white', description: 'Sync your Epic Games library.' },
                                            { id: 'gog', name: 'GOG.com', icon: Monitor, connected: false, color: 'text-purple-400', description: 'Sync your GOG Galaxy library.' },
                                            { id: 'ea', name: 'EA App', icon: Play, connected: false, color: 'text-red-500', description: 'Sync your EA App library.' },
                                        ].map((platform) => (
                                            <div key={platform.id} className="flex flex-col p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`p-2 rounded-lg bg-zinc-900 ${platform.color}`}>
                                                            <platform.icon className="h-6 w-6" />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold">{platform.name}</div>
                                                            <div className="text-sm text-zinc-500">
                                                                {platform.connected ? 'Connected as umutayaz' : platform.description}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (platform.id === 'steam' && platform.connected) {
                                                                handleSteamDisconnect();
                                                            }
                                                        }}
                                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${platform.connected
                                                            ? 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30'
                                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                            }`}
                                                    >
                                                        {platform.connected ? 'Disconnect' : 'Connect'}
                                                    </button>
                                                </div>

                                                {/* Steam Specific Input Logic */}
                                                {platform.id === 'steam' && !platform.connected && (
                                                    <div className="mt-4 pt-4 border-t border-zinc-900 animate-in slide-in-from-top-2">
                                                        <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Steam ID 64</label>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={steamIdInput}
                                                                onChange={(e) => setSteamIdInput(e.target.value)}
                                                                placeholder="Enter your Steam ID..."
                                                                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50"
                                                            />
                                                            <button
                                                                onClick={handleSteamSync}
                                                                disabled={isSyncing || !steamIdInput}
                                                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2"
                                                            >
                                                                {isSyncing ? (
                                                                    <>
                                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                                        <span>Syncing...</span>
                                                                    </>
                                                                ) : (
                                                                    <span>Sync</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-zinc-500 mt-2">
                                                            Find your Steam ID 64 <a href="https://steamdb.info/calculator/" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:underline">here</a>.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Privacy & Safety */}
                            {activeTab === 'privacy' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">Privacy & Safety</h2>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">Private Profile</div>
                                                <div className="text-sm text-zinc-400">Only followers can see your profile and activity.</div>
                                            </div>
                                            <Switch checked={settings.privateProfile} onChange={() => handleToggle('privateProfile')} />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">Allow Direct Messages</div>
                                                <div className="text-sm text-zinc-400">Allow people you follow to send you messages.</div>
                                            </div>
                                            <Switch checked={settings.directMessages} onChange={() => handleToggle('directMessages')} />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">Share Game Activity</div>
                                                <div className="text-sm text-zinc-400">Automatically display the game you are currently playing.</div>
                                            </div>
                                            <Switch checked={settings.shareActivity} onChange={() => handleToggle('shareActivity')} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Content Preferences */}
                            {activeTab === 'content' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">Content Preferences</h2>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1 text-emerald-400">Blur Spoilers</div>
                                                <div className="text-sm text-zinc-400">Automatically hide reviews and posts tagged as spoilers.</div>
                                            </div>
                                            <Switch checked={settings.blurSpoilers} onChange={() => handleToggle('blurSpoilers')} />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">Show Mature Content</div>
                                                <div className="text-sm text-zinc-400">Display 18+ games and content in your feed.</div>
                                            </div>
                                            <Switch checked={settings.matureContent} onChange={() => handleToggle('matureContent')} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notifications */}
                            {activeTab === 'notifications' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">Notifications</h2>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">New Followers</div>
                                                <div className="text-sm text-zinc-400">Notify me when someone follows me.</div>
                                            </div>
                                            <Switch checked={settings.newFollowers} onChange={() => handleToggle('newFollowers')} />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">Mentions</div>
                                                <div className="text-sm text-zinc-400">Notify me when I'm mentioned in a post or comment.</div>
                                            </div>
                                            <Switch checked={settings.mentions} onChange={() => handleToggle('mentions')} />
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                            <div>
                                                <div className="font-bold mb-1 text-emerald-400">Job Alerts</div>
                                                <div className="text-sm text-zinc-400">Notify me about new developer roles matching my skills.</div>
                                            </div>
                                            <Switch checked={settings.jobAlerts} onChange={() => handleToggle('jobAlerts')} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Display & Languages */}
                            {activeTab === 'display' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">Display & Languages</h2>

                                    <div className="space-y-8">
                                        {/* Language */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Language</label>
                                            <select
                                                value={displaySettings.language}
                                                onChange={(e) => setDisplaySettings({ ...displaySettings, language: e.target.value })}
                                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="English">English</option>
                                                <option value="Turkish">Turkish</option>
                                                <option value="Spanish">Spanish</option>
                                                <option value="French">French</option>
                                                <option value="German">German</option>
                                            </select>
                                        </div>

                                        {/* Font Size */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Font Size</label>
                                                <span className="text-emerald-400 font-bold text-sm">{displaySettings.fontSize}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="2"
                                                step="1"
                                                value={displaySettings.fontSize === 'Small' ? 0 : displaySettings.fontSize === 'Medium' ? 1 : 2}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    const size = val === 0 ? 'Small' : val === 1 ? 'Medium' : 'Large';
                                                    setDisplaySettings({ ...displaySettings, fontSize: size });
                                                }}
                                                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                            />
                                            <div className="flex justify-between text-xs text-zinc-500 font-medium px-1">
                                                <span>Small</span>
                                                <span>Medium</span>
                                                <span>Large</span>
                                            </div>
                                        </div>

                                        {/* Color Theme */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Accent Color</label>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                {['Emerald', 'Blue', 'Purple', 'Orange'].map((color) => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setDisplaySettings({ ...displaySettings, accentColor: color })}
                                                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${displaySettings.accentColor === color
                                                            ? 'bg-zinc-800 border-zinc-600 ring-1 ring-zinc-600'
                                                            : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'
                                                            }`}
                                                    >
                                                        <div className={`h-4 w-4 rounded-full ${color === 'Emerald' ? 'bg-emerald-500' :
                                                            color === 'Blue' ? 'bg-blue-500' :
                                                                color === 'Purple' ? 'bg-purple-500' :
                                                                    'bg-orange-500'
                                                            }`} />
                                                        <span className="font-medium text-sm">{color}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Additional Resources */}
                            {activeTab === 'resources' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">Additional Resources</h2>

                                    <div className="space-y-2">
                                        {[
                                            'About Gamelogd',
                                            'Terms of Service',
                                            'Privacy Policy',
                                            'Cookie Policy',
                                            'Blog'
                                        ].map((item) => (
                                            <button
                                                key={item}
                                                className="w-full flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all group"
                                            >
                                                <span className="font-medium">{item}</span>
                                                <div className="flex items-center gap-2 text-zinc-500 group-hover:text-white transition-colors">
                                                    <ExternalLink className="h-4 w-4" />
                                                    <ChevronRight className="h-4 w-4" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Help Center */}
                            {activeTab === 'help' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">Help Center</h2>

                                    <div className="grid grid-cols-1 gap-4">
                                        <button className="flex items-center gap-4 p-6 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all text-left group">
                                            <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                                <HelpCircle className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg mb-1">Browse FAQs</div>
                                                <div className="text-sm text-zinc-400">Find answers to common questions about Gamelogd.</div>
                                            </div>
                                        </button>

                                        <button className="flex items-center gap-4 p-6 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all text-left group">
                                            <div className="p-3 rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                                                <MessageCircle className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg mb-1">Contact Support</div>
                                                <div className="text-sm text-zinc-400">Get in touch with our support team for assistance.</div>
                                            </div>
                                        </button>

                                        <button className="flex items-center gap-4 p-6 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all text-left group">
                                            <div className="p-3 rounded-full bg-red-500/10 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all">
                                                <Bug className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg mb-1">Report a Problem</div>
                                                <div className="text-sm text-zinc-400">Found a bug? Let us know so we can fix it.</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
