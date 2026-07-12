'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Check, Building2, User } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/lib/useTranslation';
import { getImageUrl } from '@/lib/utils';
import CreateOrganisationModal from '@/components/modals/CreateOrganisationModal';
import { Organisation } from '@/types';

export default function WorkspaceSelector() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { activeWorkspace, setActiveWorkspace, organisations, refetchOrgs } = useWorkspace();
    const [isOpen, setIsOpen] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentName =
        activeWorkspace.type === 'solo'
            ? (user?.username || t('soloWorkspace'))
            : (activeWorkspace.org?.name || t('workspace'));

    const currentLogo =
        activeWorkspace.type === 'org' && activeWorkspace.org?.logo
            ? getImageUrl(activeWorkspace.org.logo)
            : null;

    // Always resolved (never null) so a user without an uploaded avatar gets the same
    // username-seeded initials placeholder used everywhere else in the app, instead of this
    // component's own generic "anonymous" icon.
    const currentAvatar = activeWorkspace.type === 'solo' ? getImageUrl(user?.avatar, user?.username) : null;

    const handleSelectSolo = () => {
        setActiveWorkspace({ type: 'solo' });
        setIsOpen(false);
    };

    const handleSelectOrg = (org: Organisation) => {
        setActiveWorkspace({ type: 'org', org });
        setIsOpen(false);
    };

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                {/* Selector Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80 transition-all group"
                >
                    {/* Avatar / Logo */}
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-zinc-700/50">
                        {currentLogo ? (
                            <img src={currentLogo} alt={currentName} className="w-full h-full object-cover" />
                        ) : currentAvatar ? (
                            <img src={currentAvatar} alt={currentName} className="w-full h-full object-cover" />
                        ) : activeWorkspace.type === 'solo' ? (
                            <User className="w-4 h-4 text-blue-400" />
                        ) : (
                            <Building2 className="w-4 h-4 text-blue-400" />
                        )}
                    </div>
                    {/* Name */}
                    <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-white truncate">{currentName}</p>
                        <p className="text-[11px] text-zinc-500 truncate">
                            {activeWorkspace.type === 'solo' ? t('soloWorkspace') : t('organisations')}
                        </p>
                    </div>
                    <ChevronDown
                        className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="p-2 max-h-72 overflow-y-auto scrollbar-thin-dark">
                            {/* Personal Workspace */}
                            <button
                                onClick={handleSelectSolo}
                                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-left transition-all ${
                                    activeWorkspace.type === 'solo'
                                        ? 'bg-blue-600/15 border border-blue-500/30'
                                        : 'hover:bg-zinc-800/70 border border-transparent'
                                }`}
                            >
                                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {currentAvatar ? (
                                        <img src={currentAvatar} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="w-4 h-4 text-blue-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
                                    <p className="text-[11px] text-zinc-500">{t('soloWorkspace')}</p>
                                </div>
                                {activeWorkspace.type === 'solo' && (
                                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                )}
                            </button>

                            {/* Divider */}
                            {organisations.length > 0 && (
                                <div className="mx-2 my-1.5 border-t border-zinc-800" />
                            )}

                            {/* Organisations */}
                            {organisations.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => handleSelectOrg(org)}
                                    className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-left transition-all ${
                                        activeWorkspace.type === 'org' && activeWorkspace.org?.id === org.id
                                            ? 'bg-blue-600/15 border border-blue-500/30'
                                            : 'hover:bg-zinc-800/70 border border-transparent'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {org.logo ? (
                                            <img src={getImageUrl(org.logo)} alt={org.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Building2 className="w-4 h-4 text-blue-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{org.name}</p>
                                        <p className="text-[11px] text-zinc-500">{t('organisations')}</p>
                                    </div>
                                    {activeWorkspace.type === 'org' && activeWorkspace.org?.id === org.id && (
                                        <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                    )}
                                </button>
                            ))}

                            {/* Create Organisation */}
                            <div className="mx-2 my-1.5 border-t border-zinc-800" />
                            <button
                                onClick={() => { setIsOpen(false); setShowCreateModal(true); }}
                                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-left hover:bg-zinc-800/70 border border-transparent transition-all"
                            >
                                <div className="w-8 h-8 rounded-lg bg-zinc-800/50 border border-dashed border-zinc-700 flex items-center justify-center flex-shrink-0">
                                    <Plus className="w-4 h-4 text-zinc-500" />
                                </div>
                                <p className="text-sm font-medium text-zinc-400">{t('createOrganisation')}</p>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <CreateOrganisationModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={(newOrg) => {
                    refetchOrgs();
                    setActiveWorkspace({ type: 'org', org: newOrg });
                    setShowCreateModal(false);
                }}
            />
        </>
    );
}
