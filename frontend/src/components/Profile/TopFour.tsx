import { Trophy } from 'lucide-react';

interface Game {
    id: number;
    title: string;
    image: string;
}

interface TopFourProps {
    games: Game[];
}

export default function TopFour({ games }: TopFourProps) {
    return (
        <div className="mb-8">
            <div className="flex items-center gap-2 mb-4 text-zinc-400 text-sm font-bold uppercase tracking-wider">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>All-Time Favorites</span>
            </div>
            <div className="grid grid-cols-4 gap-4 h-48 md:h-64 lg:h-80">
                {games.map((game) => (
                    <div
                        key={game.id}
                        className="relative group rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 cursor-pointer transition-all duration-500 hover:border-zinc-600 hover:shadow-2xl hover:shadow-emerald-900/20"
                    >
                        <img
                            src={game.image}
                            alt={game.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                            <span className="text-white font-bold text-sm md:text-lg leading-tight transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                {game.title}
                            </span>
                        </div>
                    </div>
                ))}
                {/* Empty slots filler if less than 4 games */}
                {[...Array(4 - games.length)].map((_, i) => (
                    <div key={`empty-${i}`} className="rounded-xl border border-zinc-800 bg-zinc-900/50 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-zinc-800/50" />
                    </div>
                ))}
            </div>
        </div>
    );
}
