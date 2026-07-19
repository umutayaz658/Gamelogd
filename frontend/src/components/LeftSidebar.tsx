import LeftSidebarContent from './LeftSidebarContent';

export default function LeftSidebar() {
    return (
        <div className="hidden lg:flex flex-col gap-2 sticky top-20 h-[calc(100vh-5rem)]">
            <LeftSidebarContent />
        </div>
    );
}
