import { Project } from '@/types';
import { getImageUrl } from '@/lib/utils';
import Link from 'next/link';
import { BookmarkPlus, Code2 } from 'lucide-react';

interface ProjectCardProps {
    project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
    return (
        <Link href={`/projects/${project.id}`} className="group overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 transition-all duration-300 flex flex-col sm:flex-row h-auto sm:h-56">
            {/* Cover Image Left */}
            <div className="w-full sm:w-2/5 md:w-1/3 lg:w-1/4 h-48 sm:h-full relative shrink-0 bg-black overflow-hidden">
                <img
                    src={project.cover_image || getImageUrl(null)}
                    alt={project.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                
                {/* Status Badge */}
                <div className="absolute top-3 left-3 sm:top-auto sm:bottom-3 sm:left-3">
                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md backdrop-blur-md border shadow-lg ${
                        project.status === 'released' ? 'bg-emerald-500/80 border-emerald-500/30 text-emerald-100' :
                        project.status === 'beta' ? 'bg-blue-500/80 border-blue-500/30 text-blue-100' :
                        project.status === 'alpha' ? 'bg-orange-500/80 border-orange-500/30 text-orange-100' :
                        'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                    }`}>
                        {project.status.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Content Right */}
            <div className="p-5 flex flex-col flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2 gap-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {project.title}
                    </h3>
                    <button 
                        className="text-zinc-500 hover:text-white transition-colors p-2 rounded-full hover:bg-zinc-800 shrink-0"
                        onClick={(e) => {
                            e.preventDefault();
                            // Future: Add Bookmark Logic
                        }}
                        title="Follow Project"
                    >
                        <BookmarkPlus className="w-5 h-5" />
                    </button>
                </div>

                {/* Developer Info */}
                <div className="flex items-center gap-2 mb-4">
                    <img
                        src={getImageUrl(project.owner.avatar, project.owner.username)}
                        alt={project.owner.username}
                        className="h-6 w-6 rounded-full object-cover border border-zinc-700"
                    />
                    <span className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
                        {project.owner.username}
                    </span>
                </div>

                <p className="text-sm text-zinc-400 line-clamp-3 mb-4 flex-1">
                    {project.description}
                </p>

                {/* Footer / Tech Stack */}
                <div className="flex items-center gap-2 overflow-hidden mt-auto pt-4 border-t border-zinc-800/50">
                    <Code2 className="w-4 h-4 text-zinc-600 shrink-0" />
                    <div className="flex flex-wrap gap-1.5">
                        {project.tech_stack.slice(0, 5).map((tech, i) => (
                            <span key={i} className="text-[11px] font-medium px-2 py-0.5 bg-zinc-800/50 rounded text-zinc-300 border border-zinc-700/50">
                                {tech}
                            </span>
                        ))}
                        {project.tech_stack.length > 5 && (
                            <span className="text-[11px] font-medium px-2 py-0.5 text-zinc-500">
                                +{project.tech_stack.length - 5}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
