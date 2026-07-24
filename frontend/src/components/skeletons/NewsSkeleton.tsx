export default function NewsSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="animate-pulse">
                    <div className="h-4 w-full bg-zinc-800 rounded mb-1.5" />
                    <div className="h-4 w-2/3 bg-zinc-800 rounded mb-2" />
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-10 bg-zinc-800 rounded" />
                        <div className="h-3 w-20 bg-zinc-800 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}
