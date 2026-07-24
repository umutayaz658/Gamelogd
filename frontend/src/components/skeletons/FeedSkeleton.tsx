function PostSkeletonCard() {
    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-4 animate-pulse">
            <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-800 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="h-3.5 w-32 bg-zinc-800 rounded mb-2" />
                    <div className="h-3 w-20 bg-zinc-800 rounded" />
                </div>
            </div>
            <div className="mt-3 space-y-2">
                <div className="h-3.5 w-full bg-zinc-800 rounded" />
                <div className="h-3.5 w-5/6 bg-zinc-800 rounded" />
                <div className="h-3.5 w-2/3 bg-zinc-800 rounded" />
            </div>
            <div className="mt-4 flex items-center gap-6">
                <div className="h-3 w-8 bg-zinc-800 rounded" />
                <div className="h-3 w-8 bg-zinc-800 rounded" />
                <div className="h-3 w-8 bg-zinc-800 rounded" />
            </div>
        </div>
    );
}

export default function FeedSkeleton({ count = 5 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <PostSkeletonCard key={i} />
            ))}
        </div>
    );
}
