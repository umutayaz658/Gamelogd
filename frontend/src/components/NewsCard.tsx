import { Clock, Tag } from 'lucide-react';

interface NewsCardProps {
    title: string;
    image: string;
    category: string;
    readTime: string;
    size?: 'featured' | 'standard' | 'compact';
}

export default function NewsCard({ title, image, category, readTime, size = 'standard' }: NewsCardProps) {
    if (size === 'featured') {
        return (
            <div className="relative h-full w-full rounded-2xl overflow-hidden group cursor-pointer">
                <img
                    src={image}
                    alt={title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6 w-full">
                    <span className="inline-block px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full mb-3">
                        {category}
                    </span>
                    <h2 className="text-3xl font-bold text-white mb-2 leading-tight group-hover:text-emerald-400 transition-colors">
                        {title}
                    </h2>
                    <div className="flex items-center gap-4 text-zinc-300 text-sm">
                        <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4" />
                            <span>{readTime}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (size === 'compact') {
        return (
            <div className="flex h-full bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 group cursor-pointer hover:border-zinc-700 transition-all">
                <div className="w-1/3 relative">
                    <img
                        src={image}
                        alt={title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                </div>
                <div className="w-2/3 p-4 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                            {category}
                        </span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-2 line-clamp-2 group-hover:text-emerald-400 transition-colors">
                        {title}
                    </h3>
                    <div className="flex items-center gap-2 text-zinc-500 text-xs">
                        <Clock className="h-3 w-3" />
                        <span>{readTime}</span>
                    </div>
                </div>
            </div>
        );
    }

    // Standard card
    return (
        <div className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 group cursor-pointer hover:border-zinc-700 transition-all h-full flex flex-col">
            <div className="relative aspect-video overflow-hidden">
                <img
                    src={image}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-bold rounded-lg border border-white/10">
                        {category}
                    </span>
                </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
                <h3 className="text-xl font-bold text-white mb-3 line-clamp-2 group-hover:text-emerald-400 transition-colors flex-1">
                    {title}
                </h3>
                <div className="flex items-center justify-between text-zinc-500 text-sm mt-auto">
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        <span>{readTime}</span>
                    </div>
                    <span className="text-emerald-500 font-medium text-xs group-hover:translate-x-1 transition-transform">
                        Read more →
                    </span>
                </div>
            </div>
        </div>
    );
}
