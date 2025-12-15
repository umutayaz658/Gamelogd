import { Heart, MessageCircle, Share2, MoreHorizontal } from 'lucide-react';

interface DevlogCardProps {
    developer: {
        name: string;
        avatar: string;
        project: string;
    };
    content: string;
    media?: string;
    tags: string[];
    timestamp: string;
}

export default function DevlogCard({ developer, content, media, tags, timestamp }: DevlogCardProps) {
    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5 hover:border-zinc-700 transition-all">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex gap-3">
                    <img
                        src={developer.avatar}
                        alt={developer.name}
                        className="h-12 w-12 rounded-full bg-zinc-800 object-cover"
                    />
                    <div>
                        <h3 className="font-bold text-white text-lg leading-tight">
                            {developer.project}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-zinc-400">
                            <span className="hover:text-emerald-400 cursor-pointer transition-colors">
                                {developer.name}
                            </span>
                            <span className="text-zinc-600">•</span>
                            <span>{timestamp}</span>
                        </div>
                    </div>
                </div>
                <button className="text-zinc-500 hover:text-white p-1 rounded-full hover:bg-zinc-800 transition-all">
                    <MoreHorizontal className="h-5 w-5" />
                </button>
            </div>

            {/* Content */}
            <p className="text-zinc-300 mb-4 whitespace-pre-wrap leading-relaxed">
                {content}
            </p>

            {/* Media */}
            {media && (
                <div className="rounded-xl overflow-hidden border border-zinc-800 mb-4 bg-black/50">
                    <img
                        src={media}
                        alt="Devlog update"
                        className="w-full h-auto object-cover max-h-[400px]"
                    />
                </div>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((tag) => (
                    <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg bg-zinc-800/50 text-emerald-400 text-xs font-medium border border-zinc-800 hover:border-emerald-500/30 transition-colors cursor-pointer"
                    >
                        #{tag}
                    </span>
                ))}
            </div>

            {/* Footer / Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all font-medium text-sm">
                    <MessageCircle className="h-4 w-4" />
                    Give Feedback
                </button>

                <div className="flex items-center gap-2">
                    <button className="p-2 text-zinc-400 hover:text-pink-500 hover:bg-pink-500/10 rounded-full transition-all">
                        <Heart className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-full transition-all">
                        <Share2 className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
