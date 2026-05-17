import { JobPosting } from '@/types';
import { Briefcase, Users, MapPin, Zap, ArrowLeft, Send, CheckCircle2, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { getImageUrl } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface CollabDetailPaneProps {
    job: JobPosting;
    onClose?: () => void;
}

export default function CollabDetailPane({ job, onClose }: CollabDetailPaneProps) {
    const router = useRouter();

    const formatJobType = (type: string) => {
        return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const handleMessage = () => {
        // Redirect to messages with the recruiter
        router.push(`/messages?user=${job.recruiter.username}`);
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col h-full overflow-hidden">
            {/* Mobile Header with Back Button */}
            {onClose && (
                <div className="lg:hidden p-4 border-b border-zinc-800 flex items-center gap-3">
                    <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors">
                        <ArrowLeft className="h-5 w-5 text-white" />
                    </button>
                    <span className="font-bold text-white">Back to List</span>
                </div>
            )}

            {/* Header Content */}
            <div className="p-6 md:p-8 border-b border-zinc-800 bg-gradient-to-b from-zinc-800/30 to-zinc-900">
                <div className="flex flex-col md:flex-row gap-6 items-start">
                    {/* Visual Identifier */}
                    {job.post_type === 'talent' ? (
                        <Link href={`/${job.recruiter.username}`}>
                            <img 
                                src={getImageUrl(job.recruiter.avatar, job.recruiter.username)} 
                                alt={job.recruiter.username} 
                                className="w-20 h-20 rounded-2xl object-cover border-2 border-zinc-700 hover:border-emerald-500 transition-colors"
                            />
                        </Link>
                    ) : job.project?.cover_image ? (
                        <Link href={`/projects/${job.project.id}`}>
                            <img 
                                src={job.project.cover_image} 
                                alt={job.project.title} 
                                className="w-20 h-20 rounded-2xl object-cover border-2 border-zinc-700 hover:border-emerald-500 transition-colors"
                            />
                        </Link>
                    ) : (
                        <div className="w-20 h-20 bg-zinc-800 rounded-2xl flex items-center justify-center border-2 border-zinc-700">
                            {job.post_type === 'job' ? <Briefcase className="h-8 w-8 text-zinc-500" /> : <UserIcon className="h-8 w-8 text-zinc-500" />}
                        </div>
                    )}

                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${job.post_type === 'talent' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                {job.post_type === 'talent' ? 'Talent Profile' : 'Job Offering'}
                            </span>
                            <span className="text-zinc-500 text-xs font-medium">
                                Posted {new Date(job.created_at).toLocaleDateString()}
                            </span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white mb-2 leading-tight">
                            {job.title}
                        </h2>
                        
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-400 font-medium mb-6">
                            {job.post_type === 'talent' ? (
                                <Link href={`/${job.recruiter.username}`} className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                                    <UserIcon className="h-4 w-4" />
                                    {job.recruiter.real_name || job.recruiter.username}
                                </Link>
                            ) : (
                                job.project ? (
                                    <Link href={`/projects/${job.project.id}`} className="flex items-center gap-2 hover:text-emerald-400 transition-colors">
                                        <Users className="h-4 w-4" />
                                        {job.project.title}
                                    </Link>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Users className="h-4 w-4" />
                                        Indie Team (@{job.recruiter.username})
                                    </span>
                                )
                            )}
                        </div>

                        {/* Meta Tags */}
                        <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider text-zinc-300">
                            <span className="flex items-center gap-1.5 bg-zinc-800 px-3 py-1.5 rounded-lg">
                                <Briefcase className="h-3.5 w-3.5 text-zinc-500" />
                                {formatJobType(job.job_type)}
                            </span>
                            <span className="flex items-center gap-1.5 bg-zinc-800 px-3 py-1.5 rounded-lg">
                                <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                                {formatJobType(job.location_type)}
                            </span>
                            <span className="flex items-center gap-1.5 bg-zinc-800 px-3 py-1.5 rounded-lg">
                                <Zap className="h-3.5 w-3.5 text-zinc-500" />
                                {formatJobType(job.experience_level)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 md:p-8 flex-1 overflow-y-auto">
                <div className="space-y-8">
                    {/* Tech Stack */}
                    {job.tech_stack && job.tech_stack.length > 0 && (
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-emerald-500 pl-3">
                                Technologies
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {job.tech_stack.map((tech, i) => (
                                    <span key={i} className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium">
                                        {tech}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-emerald-500 pl-3">
                            {job.post_type === 'talent' ? 'About Me' : 'About the Role'}
                        </h3>
                        <div className="prose prose-invert max-w-none text-zinc-300 whitespace-pre-wrap leading-relaxed">
                            {job.description}
                        </div>
                    </div>

                    {/* How to Apply / Connect */}
                    <div className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50">
                        <h4 className="text-white font-bold mb-2 flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            {job.post_type === 'talent' ? 'Interested in this talent?' : 'Ready to join?'}
                        </h4>
                        <p className="text-zinc-400 text-sm mb-4">
                            {job.post_type === 'talent' 
                                ? 'Send them a direct message to discuss collaboration opportunities or invite them to your project.' 
                                : 'Reach out directly to the team to apply. Make sure to include your portfolio in your first message.'}
                        </p>
                        <button 
                            onClick={handleMessage}
                            className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20"
                        >
                            <Send className="h-4 w-4" />
                            {job.post_type === 'talent' ? 'Message Talent' : 'Apply via Message'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
