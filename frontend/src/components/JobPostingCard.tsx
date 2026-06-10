import { JobPosting } from '@/types';
import { Briefcase, Users, Code2, MapPin, Zap, User as UserIcon } from 'lucide-react';
import { getImageUrl } from '@/lib/utils';
import { useTranslation } from '@/lib/useTranslation';

interface JobPostingCardProps {
    job: JobPosting;
    selected?: boolean;
    onClick?: () => void;
}

export default function JobPostingCard({ job, selected, onClick }: JobPostingCardProps) {
    const { t } = useTranslation();

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
        switch (type) {
            case 'full_time': return t('fullTime');
            case 'part_time': return t('partTime');
            case 'contract': return t('contract');
            case 'rev_share': return t('revShare');
            case 'hobby': return t('hobby');
            case 'remote': return t('remote');
            case 'on_site': return t('onSite');
            case 'hybrid': return t('hybrid');
            case 'junior': return t('junior');
            case 'mid': return t('midLevel');
            case 'senior': return t('senior');
            case 'lead': return t('lead');
            default: return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        }
    };

    return (
        <div 
            onClick={onClick}
            className={`rounded-2xl border p-4 sm:p-5 transition-all cursor-pointer flex gap-4 ${
                selected 
                    ? 'bg-zinc-800 border-emerald-500 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/20' 
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'
            }`}
        >
            {/* Visual Identifier (Avatar or Icon) */}
            <div className="flex-shrink-0 mt-1">
                {job.post_type === 'talent' ? (
                    <img 
                        src={getImageUrl(job.recruiter.avatar, job.recruiter.username)} 
                        alt={job.recruiter.username} 
                        className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                    />
                ) : job.project?.cover_image ? (
                    <img 
                        src={job.project.cover_image} 
                        alt={job.project.title} 
                        className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                    />
                ) : (
                    <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700">
                        {job.post_type === 'job' ? <Briefcase className="h-5 w-5 text-zinc-500" /> : <UserIcon className="h-5 w-5 text-zinc-500" />}
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className={`text-lg font-bold truncate transition-colors ${selected ? 'text-emerald-400' : 'text-white'}`}>
                        {job.title}
                    </h3>
                    <span className="text-xs text-zinc-500 flex-shrink-0 mt-1 hidden sm:block">
                        {new Date(job.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                </div>
                
                <div className="flex items-center gap-1.5 text-zinc-400 text-sm font-medium mb-3 truncate">
                    {job.post_type === 'talent' ? (
                        <>
                            <UserIcon className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                            <span className="truncate">{job.recruiter.real_name || job.recruiter.username}</span>
                        </>
                    ) : (
                        job.project ? (
                            <>
                                <Users className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                                <span className="truncate">{job.project.title}</span>
                            </>
                        ) : (
                            <>
                                <Users className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                                <span className="truncate">@{job.recruiter.username}</span>
                            </>
                        )
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
                    <span className={`px-2 py-0.5 rounded border ${getTypeColor(job.job_type)}`}>
                        {formatJobType(job.job_type)}
                    </span>
                    {job.post_type === 'talent' && (
                        <span className="px-2 py-0.5 rounded border bg-purple-500/10 text-purple-400 border-purple-500/20">
                            {t('talent')}
                        </span>
                    )}
                    {job.tech_stack && job.tech_stack.length > 0 && (
                        <span className="text-zinc-500 lowercase flex items-center gap-1 font-mono font-medium">
                            <Code2 className="h-3 w-3" />
                            {job.tech_stack[0]}
                            {job.tech_stack.length > 1 && ` +${job.tech_stack.length - 1}`}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
