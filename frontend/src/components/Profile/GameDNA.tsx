import { Dna, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface GenreStat {
    genre: string;
    percentage: number;
    color: string;
}

interface GameDNAProps {
    stats: GenreStat[];
    username?: string;
}

export default function GameDNA({ stats, username }: GameDNAProps) {
    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-zinc-100 font-bold">
                    <Dna className="h-5 w-5 text-emerald-500" />
                    <span>Game DNA</span>
                </div>
                {username && (
                    <Link
                        href={`/${username}/games`}
                        className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors group"
                        title="View Full Library"
                    >
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                )}
            </div>

            <div className="flex flex-col gap-4">
                {stats.map((stat) => (
                    <div key={stat.genre}>
                        <div className="flex justify-between text-sm mb-1.5">
                            <span className="text-zinc-400 font-medium">{stat.genre}</span>
                            <span className="text-white font-bold">{stat.percentage}%</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${stat.color} transition-all duration-1000 ease-out`}
                                style={{ width: `${stat.percentage}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
