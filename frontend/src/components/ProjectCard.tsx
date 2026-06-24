'use client';

import { useState } from 'react';
import { Project } from '@/types';
import { getImageUrl } from '@/lib/utils';
import Link from 'next/link';
import { UserPlus, UserCheck, Code2, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { useTranslation } from '@/lib/useTranslation';

interface ProjectCardProps {
    project: Project;
}

export default function ProjectCard({ project }: ProjectCardProps) {
    const { t, language } = useTranslation();
    const [isFollowing, setIsFollowing] = useState(project.is_following || false);
    const [followersCount, setFollowersCount] = useState(project.followers_count || 0);
    const [isLoading, setIsLoading] = useState(false);

    const handleFollowToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isLoading) return;
        setIsLoading(true);
        try {
            if (isFollowing) {
                await api.post(`/projects/${project.id}/unfollow/`);
                setIsFollowing(false);
                setFollowersCount(prev => Math.max(0, prev - 1));
            } else {
                await api.post(`/projects/${project.id}/follow/`);
                setIsFollowing(true);
                setFollowersCount(prev => prev + 1);
            }
        } catch (error) {
            console.error("Failed to toggle follow:", error);
        } finally {
            setIsLoading(false);
        }
    };

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
        <Link href={`/projects/${project.id}`} className="group overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-blue-500/50 transition-all duration-300 flex flex-col sm:flex-row h-auto sm:h-56">
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
                        {project.status === 'released' ? t('released') :
                         project.status === 'in_dev' ? t('inDevelopment') :
                         project.status.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Content Right */}
            <div className="p-5 flex flex-col flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2 gap-4">
                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {project.title}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Creation Date */}
                        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(project.created_at)}
                        </span>
                        {/* Follow Button */}
                        <button 
                            className={`p-2 rounded-full transition-all duration-200 ${
                                isFollowing 
                                    ? 'text-blue-400 bg-blue-500/10 hover:bg-red-500/10 hover:text-red-400' 
                                    : 'text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10'
                            } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                            onClick={handleFollowToggle}
                            title={isFollowing ? t('unfollowProject') : t('followProject')}
                        >
                            {isFollowing ? (
                                <UserCheck className="w-5 h-5" />
                            ) : (
                                <UserPlus className="w-5 h-5" />
                            )}
                        </button>
                    </div>
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
                    {followersCount > 0 && (
                        <span className="text-xs text-zinc-600 ml-auto">
                            {followersCount} {t('followers').toLowerCase()}
                        </span>
                    )}
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
