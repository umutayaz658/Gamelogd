import Navbar from '@/components/Navbar';
import { WorkspaceProvider } from '@/components/devs/WorkspaceContext';
import DevsWorkspaceSidebar from '@/components/devs/DevsWorkspaceSidebar';

export default function DevsLayout({ children }: { children: React.ReactNode }) {
    return (
        <WorkspaceProvider>
            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-500/30">
                <Navbar />
                <div className="flex h-[calc(100vh-64px)] overflow-hidden">
                    {/* Workspace Sidebar — fixed width, scrollable independently */}
                    <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0 border-r border-zinc-800/70 bg-zinc-950 overflow-y-auto scrollbar-thin-dark p-4">
                        <DevsWorkspaceSidebar />
                    </aside>

                    {/* Main Canvas — GDD Hub manages its own scroll; other tools use internal scroll */}
                    <main className="flex-1 overflow-hidden flex flex-col min-h-0">
                        {children}
                    </main>
                </div>
            </div>
        </WorkspaceProvider>
    );
}
