import { TrendingUp, Lock, Gamepad2, Layers, Monitor } from 'lucide-react';
import { Pitch } from '@/types';
import { getImageUrl } from '@/lib/utils';

interface PitchCardProps {
    pitch: Pitch;
    onClick?: () => void;
}

export default function PitchCard({ pitch, onClick }: PitchCardProps) {
    return (
        <div
            onClick={onClick}
            className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden hover:border-amber-500/30 transition-all group flex flex-col h-full cursor-pointer"
        >
            {/* Cover Art */}
            <div className="relative aspect-video overflow-hidden">
                <img
                    src={getImageUrl(pitch.image)}
                    alt={pitch.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute top-3 left-3 flex gap-2">
                    <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-bold rounded-lg border border-white/10 flex items-center gap-1.5 uppercase">
                        <Gamepad2 className="h-3 w-3 text-amber-500" />
                        {pitch.genre}
                    </span>
                    <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-bold rounded-lg border border-white/10 flex items-center gap-1.5 uppercase">
                        <Monitor className="h-3 w-3 text-blue-400" />
                        {pitch.platform}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                        {pitch.title}
                    </h3>
                </div>

                <div className="mb-4 space-y-2">
                    <div>
                        <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-1">Funding Goal</div>
                        <div className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" />
                            {pitch.funding_goal}
                        </div>
                    </div>
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
                    {pitch.description}
                </p>

                <div className="flex items-center gap-2 mb-6 text-xs text-zinc-500 font-medium">
                    <Layers className="h-3.5 w-3.5" />
                    <span className="capitalize">{pitch.stage.replace('_', ' ')} Stage</span>
                </div>

                {/* Action */}
                <button className="w-full py-3 rounded-xl border border-amber-500/30 text-amber-500 font-bold text-sm hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-2 group/btn mt-auto">
                    <Lock className="h-4 w-4 group-hover/btn:hidden" />
                    <span className="hidden group-hover/btn:inline">Unlock Data</span>
                    <span>Request Pitch Deck</span>
                </button>
            </div>
        </div>
    );
}
