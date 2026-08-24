'use client';

import { Project } from '@/types';
import { getImageUrl } from '@/lib/utils';
import Link from 'next/link';
import { Code2, Calendar } from 'lucide-react';
import { useTranslation } from '@/lib/useTranslation';

interface ProjectCardProps {
    project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
    const { t, language } = useTranslation();

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        let locale = 'en-US';
        const l = language.toLowerCase();
        if (l === 'turkish' || l === 'tr') locale = 'tr-TR';
        else if (l === 'spanish' || l === 'es') locale = 'es-ES';
        else if (l === 'french' || l === 'fr') locale = 'fr-FR';
        else if (l === 'german' || l === 'de') locale = 'de-DE';
        
        return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <Link href={`/projects/${project.id}`} className="group overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 transition-all duration-300 flex flex-col h-full">
            {/* Logo Image */}
            <div className="relative aspect-[4/3] shrink-0 bg-black overflow-hidden">
                <img
                    src={getImageUrl(project.logo)}
                    alt={project.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md backdrop-blur-md border shadow-lg ${
                        project.status === 'released' ? 'bg-emerald-500/80 border-emerald-500/30 text-emerald-100' :
                        project.status === 'beta' ? 'bg-blue-500/80 border-blue-500/30 text-blue-100' :
                        project.status === 'alpha' ? 'bg-orange-500/80 border-orange-500/30 text-orange-100' :
                        'bg-zinc-800/80 border-zinc-700 text-zinc-300'
                    }`}>
                        {project.status === 'released' ? t('released') :
                         project.status === 'in_dev' ? t('inDevelopment') :
                         project.status.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-5 flex flex-col flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2 gap-3">
                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1 flex-1 min-w-0">
                        {project.title}
                    </h3>
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500 shrink-0 pt-0.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(project.created_at)}
                    </span>
                </div>

                {/* Developer Info */}
                <div className="flex items-center gap-2 mb-3">
                    {project.organisation_details ? (
                        <>
                            <img
                                src={getImageUrl(project.organisation_details.logo)}
                                alt={project.organisation_details.name}
                                className="h-6 w-6 rounded object-cover border border-zinc-800"
                            />
                            <span className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors font-bold flex items-center gap-1 truncate">
                                {project.organisation_details.name}
                                {project.organisation_details.is_verified && (
                                    <span className="inline-flex items-center justify-center bg-blue-500 text-white rounded-full w-3.5 h-3.5 shrink-0" title="Verified Brand">
                                        <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </span>
                                )}
                            </span>
                        </>
                    ) : (
                        <>
                            <img
                                src={getImageUrl(project.owner.avatar, project.owner.username)}
                                alt={project.owner.username}
                                className="h-6 w-6 rounded-full object-cover border border-zinc-700"
                            />
                            <span className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors truncate">
                                {project.owner.username}
                            </span>
                        </>
                    )}
                </div>

                <p className="text-sm text-zinc-400 line-clamp-3 mb-4 flex-1">
                    {project.description}
                </p>

                {/* Footer / Tech Stack */}
                <div className="flex items-center gap-2 overflow-hidden mt-auto pt-4 border-t border-zinc-800/50">
                    <Code2 className="w-4 h-4 text-zinc-600 shrink-0" />
                    <div className="flex flex-wrap gap-1.5">
                        {project.tech_stack.slice(0, 3).map((tech, i) => (
                            <span key={i} className="text-[11px] font-medium px-2 py-0.5 bg-zinc-800/50 rounded text-zinc-300 border border-zinc-700/50">
                                {tech}
                            </span>
                        ))}
                        {project.tech_stack.length > 3 && (
                            <span className="text-[11px] font-medium px-2 py-0.5 text-zinc-500">
                                {['+', project.tech_stack.length - 3].join('')}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}
