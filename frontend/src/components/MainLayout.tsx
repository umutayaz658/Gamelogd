import React from 'react';
import Link from 'next/link';

const Navbar = () => {
    return (
        <nav className="sticky top-0 z-50 bg-gray-900 border-b border-gray-800 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/" className="text-xl font-bold text-indigo-500">
                            Gamelogd
                        </Link>
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-baseline space-x-4">
                            <Link href="/profile" className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Profile</Link>
                            <Link href="/" className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Home</Link>
                            <Link href="/news" className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">News</Link>
                            <Link href="/devs" className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Devs</Link>
                            <Link href="/invest" className="hover:bg-gray-700 px-3 py-2 rounded-md text-sm font-medium">Invest</Link>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

const MainLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="min-h-screen bg-black text-gray-100">
            <Navbar />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Left Column: Search, Notifications, Messages */}
                    <aside className="hidden md:block md:col-span-3 space-y-6">
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                            <input
                                type="text"
                                placeholder="Search games, users..."
                                className="w-full bg-gray-800 border border-gray-700 rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                            <h3 className="font-semibold mb-4 text-gray-400 uppercase text-xs tracking-wider">Menu</h3>
                            <ul className="space-y-2">
                                <li><Link href="/notifications" className="block hover:text-indigo-400">Notifications</Link></li>
                                <li><Link href="/messages" className="block hover:text-indigo-400">Messages</Link></li>
                            </ul>
                        </div>
                    </aside>

                    {/* Center Column: Main Feed */}
                    <main className="md:col-span-6 space-y-6">
                        {children}
                    </main>

                    {/* Right Column: Trending News */}
                    <aside className="hidden md:block md:col-span-3 space-y-6">
                        <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
                            <h3 className="font-semibold mb-4 text-gray-400 uppercase text-xs tracking-wider">Trending News</h3>
                            <div className="space-y-4">
                                {/* Placeholder for news items */}
                                <div className="text-sm">
                                    <p className="font-medium hover:text-indigo-400 cursor-pointer">New RPG announced by top studio</p>
                                    <span className="text-xs text-gray-500">2 hours ago</span>
                                </div>
                                <div className="text-sm">
                                    <p className="font-medium hover:text-indigo-400 cursor-pointer">Indie game hits 1M sales</p>
                                    <span className="text-xs text-gray-500">5 hours ago</span>
                                </div>
                                <div className="text-sm">
                                    <p className="font-medium hover:text-indigo-400 cursor-pointer">Tech giant acquires VR startup</p>
                                    <span className="text-xs text-gray-500">1 day ago</span>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default MainLayout;
