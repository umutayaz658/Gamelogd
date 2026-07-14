'use client';

import { useState } from 'react';
import { ArrowLeft, Lock, Pencil, Plus, Settings2, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import type { PermissionHierarchy, Role } from '@/types';
import ConfirmDeleteModal from '@/components/devs/ConfirmDeleteModal';
import { useToast } from '@/context/ToastContext';

const CATEGORY_LABEL: Record<string, string> = {
    kanban: 'Kanban', gdd: 'GDD Hub', assets: 'Asset Registry',
    localisation: 'Localisation', team: 'Team & Roles', feedback: 'Feedback', settings: 'Settings',
};

export type RoleScope =
    | { type: 'organisation'; id: number }
    | { type: 'project'; id: number; organisationId: number };

interface RolesManagerModalProps {
    roleScope: RoleScope;
    roles: Role[];
    hierarchy: PermissionHierarchy;
    canManage: boolean;
    /** Whether the viewer is the organisation's actual owner — only they may edit the Owner role's permissions. */
    viewerIsOwner?: boolean;
    onClose: () => void;
    onChanged: () => void;
}

function tierIsSelected(keys: string[], selected: Set<string>) {
    return keys.length > 0 && keys.every((k) => selected.has(k));
}

export default function RolesManagerModal({ roleScope, roles, hierarchy, canManage, viewerIsOwner, onClose, onChanged }: RolesManagerModalProps) {
    const toast = useToast();
    const [editingRole, setEditingRole] = useState<Role | null | 'new'>(null);
    const [name, setName] = useState('');
    const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());
    const [confirmDeleteRole, setConfirmDeleteRole] = useState<Role | null>(null);

    const startCreate = () => { setEditingRole('new'); setName(''); setSelectedPerms(new Set()); };
    const startEdit = (role: Role) => { setEditingRole(role); setName(role.name); setSelectedPerms(new Set(role.permissions)); };

    const canEditRole = (role: Role | 'new' | null) => {
        if (!canManage) return false;
        if (role && role !== 'new' && role.is_default_for === 'owner') return !!viewerIsOwner;
        return true;
    };
    const nameIsLocked = (role: Role | 'new' | null) => role !== null && role !== 'new' && role.is_default_for === 'owner';

    // Clicking any tier jumps straight to that level: the category's selection becomes exactly
    // "this tier and everything below it" — no need to peel off higher tiers one at a time first.
    // Clicking the tier that's already the sole active level clears the whole category instead.
    const selectTier = (tiers: { keys: string[] }[], tierIndex: number) => {
        if (!editable) return;
        const currentHighest = tiers.reduce((highest, t, i) => (tierIsSelected(t.keys, selectedPerms) ? i : highest), -1);
        setSelectedPerms((prev) => {
            const next = new Set(prev);
            tiers.forEach((t) => t.keys.forEach((k) => next.delete(k)));
            if (currentHighest !== tierIndex) {
                for (let i = 0; i <= tierIndex; i++) tiers[i].keys.forEach((k) => next.add(k));
            }
            return next;
        });
    };

    const save = () => {
        const permissions = Array.from(selectedPerms);
        if (editingRole === 'new') {
            if (!name.trim()) return;
            const payload: { organisation?: number; project?: number; name: string; permissions: string[] } = { name: name.trim(), permissions };
            if (roleScope.type === 'project') payload.project = roleScope.id;
            else payload.organisation = roleScope.id;
            api.post('/organisation-roles/', payload)
                .then(() => { onChanged(); setEditingRole(null); })
                .catch((err) => toast.error(err.response?.data?.name?.[0] || err.response?.data?.detail || 'Failed to create role.'));
        } else if (editingRole) {
            const payload: { permissions: string[]; name?: string } = { permissions };
            if (!nameIsLocked(editingRole)) payload.name = name.trim();
            api.patch(`/organisation-roles/${editingRole.id}/`, payload)
                .then(() => { onChanged(); setEditingRole(null); })
                .catch((err) => toast.error(err.response?.data?.name?.[0] || err.response?.data?.detail || 'Failed to update role.'));
        }
    };

    const remove = (role: Role) => {
        api.delete(`/organisation-roles/${role.id}/`)
            .then(() => { onChanged(); setConfirmDeleteRole(null); })
            .catch((err) => toast.error(err.response?.data?.[0] || err.response?.data?.detail || 'Cannot delete this role.'));
    };

    const editable = canEditRole(editingRole);

    return (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 h-[88vh] max-h-[900px] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800 flex-shrink-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        {editingRole && (
                            <button onClick={() => setEditingRole(null)} className="text-zinc-500 hover:text-white p-1 -ml-1 rounded-lg hover:bg-zinc-900 transition-all">
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                        )}
                        <Settings2 className="w-5 h-5 text-blue-400" /> {editingRole ? (editingRole === 'new' ? 'Create Role' : editingRole.name) : 'Manage Roles'}
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                </div>

                {!editingRole ? (
                    <div className="p-5 space-y-2 overflow-y-auto scrollbar-thin-dark flex-1">
                        {roles.map((role) => (
                            <div key={role.id} className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                                {role.is_system && <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white">{role.name}</p>
                                    <p className="text-[11px] text-zinc-600">{role.permissions.length} permissions</p>
                                </div>
                                {canManage && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        {canEditRole(role) && (
                                            <button onClick={() => startEdit(role)} className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all">
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        {!role.is_system && (
                                            <button onClick={() => setConfirmDeleteRole(role)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {canManage && (
                            <button onClick={startCreate}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 text-xs font-semibold transition-all">
                                <Plus className="w-4 h-4" /> Create Role
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="p-5 pb-3 flex-shrink-0 space-y-3 border-b border-zinc-800">
                            <div>
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-1.5">Role Name</label>
                                <input value={name} onChange={(e) => setName(e.target.value)}
                                    disabled={nameIsLocked(editingRole)}
                                    placeholder="e.g. QA Tester"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50" />
                            </div>
                            <p className="text-[11px] text-zinc-600">Picking a higher level automatically includes everything below it — click any level to jump straight there.</p>
                        </div>

                        <div className="p-5 grid md:grid-cols-2 gap-x-8 gap-y-5 overflow-y-auto scrollbar-thin-dark flex-1 content-start">
                            {Object.entries(hierarchy).map(([cat, tiers]) => (
                                <div key={cat}>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2">{CATEGORY_LABEL[cat] ?? cat}</p>
                                    <div className="space-y-1.5">
                                        {tiers.map((tier, idx) => {
                                            const selected = tierIsSelected(tier.keys, selectedPerms);
                                            return (
                                                <button
                                                    key={tier.label}
                                                    type="button"
                                                    disabled={!editable}
                                                    onClick={() => selectTier(tiers, idx)}
                                                    className={`w-full flex items-start gap-3 text-left p-2.5 rounded-xl border transition-all ${
                                                        !editable ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-zinc-700'
                                                    } ${selected ? 'bg-blue-600/10 border-blue-500/30' : 'bg-zinc-900/50 border-zinc-800'}`}
                                                >
                                                    <input type="checkbox" checked={selected} readOnly tabIndex={-1}
                                                        className="accent-blue-600 w-3.5 h-3.5 mt-0.5 pointer-events-none" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-white">{tier.label}</p>
                                                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{tier.description}</p>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 p-5 border-t border-zinc-800 flex-shrink-0">
                            <button onClick={() => setEditingRole(null)} className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-all">Back</button>
                            <button onClick={save} disabled={(editingRole === 'new' && !name.trim()) || !editable}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all disabled:opacity-40">Save</button>
                        </div>
                    </>
                )}

                <ConfirmDeleteModal
                    isOpen={confirmDeleteRole !== null}
                    title="Delete Role"
                    description={`Are you sure you want to delete "${confirmDeleteRole?.name}"? Members assigned to it will be moved to the Member role.`}
                    onConfirm={() => confirmDeleteRole && remove(confirmDeleteRole)}
                    onCancel={() => setConfirmDeleteRole(null)}
                />
            </div>
        </div>
    );
}
