import { Briefcase, Users, Code2, ArrowUpRight } from 'lucide-react';

interface OpportunityCardProps {
    role: string;
    team: string;
    type: 'Full-time' | 'Rev-Share' | 'Hobby/Jam';
    techStack: string[];
    description: string;
}

export default function OpportunityCard({ role, team, type, techStack, description }: OpportunityCardProps) {
    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Full-time':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'Rev-Share':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'Hobby/Jam':
                return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            default:
                return 'bg-zinc-800 text-zinc-400 border-zinc-700';
        }
    };

    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 hover:border-zinc-600 transition-all group cursor-pointer relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpRight className="h-5 w-5 text-zinc-400" />
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                    <div>
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border mb-3 ${getTypeColor(type)}`}>
                            {type}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                            {role}
                        </h3>
                        <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
                            <Users className="h-4 w-4" />
                            {team}
                        </div>
                    </div>
                </div>

                <p className="text-zinc-400 text-sm line-clamp-2">
                    {description}
                </p>

                <div className="flex items-center gap-4 mt-2 pt-4 border-t border-zinc-800">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs">
                        <Code2 className="h-4 w-4" />
                        <div className="flex gap-2">
                            {techStack.map((tech) => (
                                <span key={tech} className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">
                                    {tech}
                                </span>
                            ))}
                        </div>
                    </div>

                    <button className="ml-auto text-sm font-bold text-white bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg transition-colors">
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}
