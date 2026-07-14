'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Organisation } from '@/types';
import { getImageUrl } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import { useToast } from '@/context/ToastContext';
import api from '@/lib/api';
import { Check, Users, ShieldAlert, Globe, Twitter, Youtube, Plus, CheckSquare } from 'lucide-react';

interface OrganisationCardProps {
    organisation: Organisation;
    onFollowToggle?: (slug: string, isFollowing: boolean) => void;
}

export default function OrganisationCard({ organisation, onFollowToggle }: OrganisationCardProps) {
    const { t } = useTranslation();
    const { user } = useAuth();
    const toast = useToast();
    const [isFollowing, setIsFollowing] = useState(organisation.is_following || false);
    const [followersCount, setFollowersCount] = useState(organisation.followers_count || 0);
    const [loading, setLoading] = useState(false);

    const logoUrl = getImageUrl(organisation.logo);
    const bannerUrl = getImageUrl(organisation.banner);

    const handleFollowClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user) {
            toast.info(t('pleaseLogin' as any) || 'Please log in to follow organisations.');
            return;
        }

        setLoading(true);
        try {
            if (isFollowing) {
                await api.post(`/organisations/${organisation.slug}/unfollow/`);
                setIsFollowing(false);
                setFollowersCount(prev => Math.max(0, prev - 1));
                if (onFollowToggle) onFollowToggle(organisation.slug, false);
            } else {
                await api.post(`/organisations/${organisation.slug}/follow/`);
                setIsFollowing(true);
                setFollowersCount(prev => prev + 1);
                if (onFollowToggle) onFollowToggle(organisation.slug, true);
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
        } finally {
            setLoading(false);
        }
    };

    const isMember = organisation.members?.some(m => m.user.id === user?.id);
    const userRole = organisation.members?.find(m => m.user.id === user?.id)?.role;

    return (
        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-zinc-700/80 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 flex flex-col h-full group">
            {/* Banner section */}
            <div className="h-28 w-full relative overflow-hidden bg-gradient-to-r from-blue-900/40 via-indigo-950/40 to-zinc-900">
                {bannerUrl ? (
                    <img 
                        src={bannerUrl} 
                        alt={`${organisation.name} banner`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/30 via-zinc-950/10 to-transparent" />
                )}

                {/* Dashboard Badge if member */}
                {isMember && (
                    <Link
                        href={`/organisations/${organisation.slug}/dashboard`}
                        className="absolute top-3 right-3 bg-zinc-900/80 hover:bg-blue-600 backdrop-blur-md border border-zinc-750 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {t('manage' as any) || 'Yönet'}
                    </Link>
                )}
            </div>

            {/* Content section */}
            <div className="px-5 pb-5 pt-0 flex-1 flex flex-col relative">
                {/* Logo overlapping banner */}
                <div className="w-16 h-16 rounded-2xl border-2 border-zinc-900 bg-zinc-950 overflow-hidden absolute -top-8 left-5 shadow-lg flex items-center justify-center font-bold text-white text-xl">
                    {logoUrl ? (
                        <img src={logoUrl} alt={organisation.name} className="w-full h-full object-cover" />
                    ) : (
                        organisation.name.charAt(0).toUpperCase()
                    )}
                </div>

                {/* Info */}
                <div className="mt-10 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                        <Link href={`/organisations/${organisation.slug}`} className="hover:underline block">
                            <h3 className="text-lg font-bold text-white flex items-center gap-1.5 leading-snug group-hover:text-blue-400 transition-colors">
                                {organisation.name}
                                {organisation.is_verified && (
                                    <span className="inline-flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-400 p-0.5 rounded-md" title="Verified Studio">
                                        <Check className="h-3 w-3 stroke-[3]" />
                                    </span>
                                )}
                            </h3>
                            <span className="text-xs text-zinc-550 block font-mono">
                                /organisations/{organisation.slug}
                            </span>
                        </Link>

                        {/* Follow Button */}
                        {user?.id !== organisation.members?.find(m => m.role === 'owner')?.user.id && (
                            <button
                                onClick={handleFollowClick}
                                disabled={loading}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                    isFollowing
                                        ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                                        : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-500 hover:border-blue-500 shadow-md shadow-blue-600/10'
                                }`}
                            >
                                {isFollowing ? (
                                    <>
                                        <CheckSquare className="h-3.5 w-3.5" />
                                        <span>{t('following') || 'Takip Ediliyor'}</span>
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-3.5 w-3.5" />
                                        <span>{t('follow') || 'Takip Et'}</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <p className="text-zinc-400 text-sm mt-3.5 line-clamp-2 leading-relaxed">
                        {organisation.description || t('noBioAvailable' as any) || 'No description provided.'}
                    </p>

                    {/* Stats & Links */}
                    <div className="mt-auto pt-4 border-t border-zinc-800/40 flex items-center justify-between text-xs text-zinc-500">
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1">
                                <Users className="h-3.5 w-3.5 text-zinc-600" />
                                <strong className="text-zinc-350">{followersCount}</strong> {t('followers') || 'takipçi'}
                            </span>
                            <span className="w-1 h-1 bg-zinc-800 rounded-full" />
                            <span>
                                <strong className="text-zinc-350">{organisation.members?.length || 0}</strong> {t('members') || 'üye'}
                            </span>
                        </div>

                        {/* Social Links */}
                        <div className="flex items-center gap-2">
                            {organisation.website && (
                                <a 
                                    href={organisation.website} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="p-1 hover:text-white transition-colors text-zinc-650"
                                >
                                    <Globe className="h-3.5 w-3.5" />
                                </a>
                            )}
                            {organisation.twitter && (
                                <a 
                                    href={organisation.twitter} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="p-1 hover:text-white transition-colors text-zinc-650"
                                >
                                    <Twitter className="h-3.5 w-3.5" />
                                </a>
                            )}
                            {organisation.youtube && (
                                <a 
                                    href={organisation.youtube} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="p-1 hover:text-white transition-colors text-zinc-650"
                                >
                                    <Youtube className="h-3.5 w-3.5" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
