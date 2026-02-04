import { Project } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { Badge } from 'lucide-react';

interface ProjectCardProps {
    project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
    return (
        <div className="group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 transition-all duration-300">
            {/* Cover Image */}
            <div className="aspect-video w-full overflow-hidden">
                <img
                    src={project.cover_image || getImageUrl(null)}
                    alt={project.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
            </div>

            {/* Content */}
            <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {project.title}
                    </h3>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${project.status === 'released' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                            project.status === 'beta' ? 'bg-blue-500/10 border-blue-500/20 text-blue-500' :
                                'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}>
                        {project.status.replace('_', ' ')}
                    </span>
                </div>

                <p className="text-sm text-zinc-400 line-clamp-2 mb-4 h-10">
                    {project.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-2">
                        <img
                            src={getImageUrl(project.owner.avatar, project.owner.username)}
                            alt={project.owner.username}
                            className="h-5 w-5 rounded-full object-cover"
                        />
                        <span className="text-xs text-zinc-500">{project.owner.username}</span>
                    </div>
                </div>

                {/* Tech Stack Overlay (On Hover or Always?) Let's do always for "Devs" feel */}
                <div className="flex flex-wrap gap-1 mt-3">
                    {project.tech_stack.slice(0, 3).map((tech, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400 border border-zinc-700">
                            {tech}
                        </span>
                    ))}
                    {project.tech_stack.length > 3 && (
                        <span className="text-[10px] px-1.5 py-0.5 text-zinc-500">+{project.tech_stack.length - 3}</span>
                    )}
                </div>
            </div>
        </div>
    );
}
