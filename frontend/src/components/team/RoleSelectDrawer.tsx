'use client';

import { Check, Crown } from 'lucide-react';
import type { Role } from '@/types';
import SideDrawer from './SideDrawer';

interface RoleSelectDrawerProps {
    isOpen: boolean;
    roles: Role[];
    selectedRoleId: number | null;
    onSelect: (roleId: number) => void;
    onClose: () => void;
    title?: string;
    /** Only passed when the viewer is the organisation's actual owner — pins an "Owner" row at
     * the top that hands off ownership (via a separate confirmation flow) instead of picking a
     * regular role. Never shown for project scope — there is no per-project owner role. */
    onTransferOwnership?: () => void;
}

function RoleRow({ selected, name, description, onClick }: { selected: boolean; name: string; description?: string; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-start gap-3 text-left p-3.5 rounded-xl border transition-all ${
                selected ? 'bg-blue-600/10 border-blue-500/40' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
            }`}
        >
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{name}</p>
                {description && <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{description}</p>}
            </div>
            {selected && <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />}
        </button>
    );
}

// Every member always has exactly one role — there is no "no role" state to pick here.
export default function RoleSelectDrawer({ isOpen, roles, selectedRoleId, onSelect, onClose, title = 'Select a role', onTransferOwnership }: RoleSelectDrawerProps) {
    const assignableRoles = roles.filter((r) => r.is_default_for !== 'owner');

    return (
        <SideDrawer isOpen={isOpen} title={title} onClose={onClose} widthClassName="max-w-sm">
            <div className="space-y-2">
                {onTransferOwnership && (
                    <button
                        onClick={onTransferOwnership}
                        className="w-full flex items-start gap-3 text-left p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/15 transition-all"
                    >
                        <Crown className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-amber-400">Make Owner</p>
                            <p className="text-xs text-amber-400/70 mt-0.5 leading-relaxed">Transfers organisation ownership to this member — you'll become an Admin. Requires confirmation.</p>
                        </div>
                    </button>
                )}
                {assignableRoles.map((role) => (
                    <RoleRow
                        key={role.id}
                        selected={selectedRoleId === role.id}
                        name={role.name}
                        description={role.description || `${role.permissions.length} permissions`}
                        onClick={() => onSelect(role.id)}
                    />
                ))}
                {assignableRoles.length === 0 && !onTransferOwnership && (
                    <p className="text-sm text-zinc-600 text-center py-8">No roles available yet.</p>
                )}
            </div>
        </SideDrawer>
    );
}
