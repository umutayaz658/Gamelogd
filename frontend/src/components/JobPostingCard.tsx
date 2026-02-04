import { JobPosting } from '@/types';
import { Briefcase, Users, Code2, ArrowUpRight, MapPin, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface JobPostingCardProps {
    job: JobPosting;
}

export default function JobPostingCard({ job }: JobPostingCardProps) {
    const router = useRouter();

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'full_time':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'rev_share':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'hobby':
                return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
            default:
                return 'bg-zinc-800 text-zinc-400 border-zinc-700';
        }
    };

    const formatJobType = (type: string) => {
        return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 hover:border-zinc-600 transition-all group cursor-pointer relative overflow-hidden flex flex-col h-full">
            <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpRight className="h-5 w-5 text-zinc-400" />
            </div>

            <div className="flex flex-col gap-4 flex-grow">
                <div className="flex items-start justify-between">
                    <div>
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border mb-3 ${getTypeColor(job.job_type)}`}>
                            {formatJobType(job.job_type)}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-emerald-400 transition-colors bg-zinc-900">
                            {job.title}
                        </h3>
                        <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium">
                            {job.project ? (
                                <>
                                    <Users className="h-4 w-4" />
                                    {job.project.title}
                                </>
                            ) : (
                                <>
                                    <Users className="h-4 w-4" />
                                    Indie Team (@{job.recruiter.username})
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                    <span className="flex items-center gap-1 bg-zinc-800/50 px-2 py-1 rounded">
                        <MapPin className="h-3 w-3" />
                        {formatJobType(job.location_type)}
                    </span>
                    <span className="flex items-center gap-1 bg-zinc-800/50 px-2 py-1 rounded">
                        <Zap className="h-3 w-3" />
                        {formatJobType(job.experience_level)}
                    </span>
                </div>

                <p className="text-zinc-400 text-sm line-clamp-3">
                    {job.description}
                </p>

                <div className="mt-auto pt-4 border-t border-zinc-800 flex items-center justify-between">
                    <span className="text-xs text-zinc-600">Posted {new Date(job.created_at).toLocaleDateString()}</span>
                    <button className="text-sm font-bold text-white bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg transition-colors">
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}
