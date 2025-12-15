import { TrendingUp, Lock, Gamepad2 } from 'lucide-react';

interface PitchCardProps {
    title: string;
    genre: string;
    fundingGoal: string;
    pitch: string;
    image: string;
}

export default function PitchCard({ title, genre, fundingGoal, pitch, image }: PitchCardProps) {
    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden hover:border-amber-500/30 transition-all group flex flex-col h-full">
            {/* Cover Art */}
            <div className="relative aspect-video overflow-hidden">
                <img
                    src={image}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-bold rounded-lg border border-white/10 flex items-center gap-1.5">
                        <Gamepad2 className="h-3 w-3 text-amber-500" />
                        {genre}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">
                        {title}
                    </h3>
                </div>

                <div className="mb-4">
                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-1">Funding Goal</div>
                    <div className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        {fundingGoal}
                    </div>
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed mb-6 flex-1">
                    {pitch}
                </p>

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
