'use client';

import {
    createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Organisation } from '@/types';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
    WorkspaceData,
    DEFAULT_COLUMNS,
    KanbanColumn,
    Task,
    GDDDoc,
    BalancingTable,
    DialogueNode,
    Asset,
    TranslationEntry,
    GlossaryTerm,
    TeamMember,
    PlaytestFeedback,
    ActivityItem,
    ActivityType,
    GDDCategory,
    DEFAULT_GDD_CATEGORIES,
} from './WorkspaceTypes';

export type WorkspaceTool =
    | 'dashboard'
    | 'kanban'
    | 'devlogs'
    | 'projects'
    | 'gdd'
    | 'assets'
    | 'localisation'
    | 'members'
    | 'settings';

export type WorkspaceType = 'solo' | 'org';

export interface ActiveWorkspace {
    type: WorkspaceType;
    org?: Organisation;
}

// ─── Default Empty Workspace State ───────────────────────────────────────────

function buildDefaultData(): WorkspaceData {
    return {
        columns: DEFAULT_COLUMNS,
        tasks: [
            {
                id: 'demo-1',
                title: 'Set up project structure and scene hierarchy',
                description: 'Create the initial folder layout for scripts, prefabs, scenes, and materials.',
                priority: 'high',
                category: 'code',
                columnId: 'done',
                assignee: 'devuser',
                subtasks: [
                    { id: 's1', title: 'Create folder structure', done: true },
                    { id: 's2', title: 'Configure build settings', done: true },
                ],
                comments: [],
                createdAt: new Date().toISOString(),
                dueDate: undefined,
            },
            {
                id: 'demo-2',
                title: 'Design main character concept art',
                description: '',
                priority: 'medium',
                category: 'art',
                columnId: 'inProgress',
                subtasks: [],
                comments: [],
                createdAt: new Date().toISOString(),
            },
            {
                id: 'demo-3',
                title: 'Implement player controller and movement system',
                description: 'Uses CharacterController or Rigidbody. WASD + gamepad support required.',
                priority: 'urgent',
                category: 'code',
                columnId: 'inProgress',
                subtasks: [
                    { id: 's3', title: 'WASD movement', done: true },
                    { id: 's4', title: 'Gamepad input', done: false },
                    { id: 's5', title: 'Slope sliding', done: false },
                ],
                comments: [],
                createdAt: new Date().toISOString(),
            },
            {
                id: 'demo-4',
                title: 'Record ambient background music loop',
                description: '',
                priority: 'low',
                category: 'audio',
                columnId: 'backlog',
                subtasks: [],
                comments: [],
                createdAt: new Date().toISOString(),
            },
            {
                id: 'demo-5',
                title: 'QA: Test jump physics on all platforms',
                description: 'Cover PC, Console (DualSense) and mobile input paths.',
                priority: 'medium',
                category: 'qa',
                columnId: 'review',
                subtasks: [
                    { id: 's6', title: 'PC test', done: true },
                    { id: 's7', title: 'Console test', done: false },
                ],
                comments: [],
                createdAt: new Date().toISOString(),
            },
        ],
        gddDocs: [
            {
                id: 'gdd-1',
                title: 'Game Overview & Core Concept',
                section: 'introduction',
                isPublic: true,
                emoji: '📖',
                content: '# Game Overview & Core Concept\n\n> 📖 Introduction document\n\n## Overview\n\nThis game is a **2D platformer** set in a neon-lit dystopian city.\n\n## Core Loop\n\n1. Explore levels\n2. Defeat enemies\n3. Unlock abilities\n\n## Target Audience\n\n- Ages 16+\n- Fans of action-platformers\n- Players who enjoy narrative-driven games\n',
                revisions: [],
                linkedTaskIds: [],
                comments: [],
                createdAt: new Date().toISOString(),
                lastEdited: '2h ago',
            },
            {
                id: 'gdd-2',
                title: 'Player Mechanics — Movement & Physics',
                section: 'mechanics',
                isPublic: false,
                emoji: '⚙️',
                content: '# Player Mechanics — Movement & Physics\n\n> ⚙️ Mechanics document\n\n## Movement\n\n| Stat | Value |\n|------|-------|\n| Run speed | 8 m/s |\n| Jump height | 3 units |\n| Double jump | ✅ Yes |\n| Dash distance | 5 units |\n\n## Physics\n\n- **Gravity**: 9.8 units/s²\n- **Air resistance**: 0.02\n- **Ground friction**: 0.85\n\n## Controls\n\n- `WASD` / Arrow keys — Move\n- `Space` — Jump (hold for higher jump)\n- `Shift` — Dash\n',
                revisions: [],
                linkedTaskIds: ['demo-3'],
                comments: [],
                createdAt: new Date().toISOString(),
                lastEdited: '1d ago',
            },
        ],
        balancingTables: [
            {
                id: 'bt-1',
                name: 'Weapon Stats',
                columns: ['Name', 'Damage', 'Fire Rate', 'Range', 'Weight'],
                rows: [
                    { id: 'r1', Name: 'Pistol', Damage: '25', 'Fire Rate': '3/s', Range: '30m', Weight: '1.2kg' },
                    { id: 'r2', Name: 'Shotgun', Damage: '80', 'Fire Rate': '0.8/s', Range: '10m', Weight: '3.5kg' },
                    { id: 'r3', Name: 'Rifle', Damage: '40', 'Fire Rate': '5/s', Range: '60m', Weight: '4.1kg' },
                ],
            },
        ],
        dialogueTrees: [
            [
                { id: 'd1', speaker: 'Merchant', message: 'Welcome traveller! What can I sell you?', choices: [{ text: 'Show me your wares', nextId: 'd2' }, { text: 'Never mind', nextId: '' }] },
                { id: 'd2', speaker: 'Merchant', message: 'I have swords, shields and potions!', choices: [{ text: 'I\'ll take a sword', nextId: '' }, { text: 'Maybe later', nextId: '' }] },
            ],
        ],
        assets: [
            { id: 'a1', name: 'Main Character Sprite Sheet', category: '2d', tags: ['character', 'animation'], link: 'https://drive.google.com', notes: '', addedAt: '3d ago', addedBy: 'devuser' },
            { id: 'a2', name: 'Player Character FBX Model', category: '3d', tags: ['character', 'mesh'], link: 'https://drive.google.com', notes: '', addedAt: '5d ago', addedBy: 'devuser' },
            { id: 'a3', name: 'Main Theme OST v3', category: 'audio', tags: ['music', 'ambient'], link: 'https://drive.google.com', notes: '', addedAt: '2w ago', addedBy: 'devuser' },
        ],
        translationKeys: [
            {
                id: 'lk1', key: 'mainMenu.play', namespace: 'mainMenu', baseText: 'Play', approved: true,
                suggestions: {
                    Turkish: [{ id: 'sg1', author: 'translator1', text: 'Oyna', votes: 5, approved: true }],
                    Spanish: [{ id: 'sg2', author: 'alejandro99', text: 'Jugar', votes: 3, approved: true }],
                },
            },
            {
                id: 'lk2', key: 'mainMenu.settings', namespace: 'mainMenu', baseText: 'Settings', approved: true,
                suggestions: {
                    Turkish: [{ id: 'sg3', author: 'translator1', text: 'Ayarlar', votes: 4, approved: true }],
                    French: [{ id: 'sg4', author: 'pierre_fr', text: 'Paramètres', votes: 2, approved: true }],
                },
            },
            {
                id: 'lk3', key: 'hud.health', namespace: 'hud', baseText: 'Health', approved: false,
                suggestions: {
                    Turkish: [{ id: 'sg5', author: 'translator1', text: 'Can', votes: 2, approved: false }],
                },
            },
            {
                id: 'lk4', key: 'dialogue.merchant.greeting', namespace: 'dialogue', baseText: 'Welcome traveller, what can I sell you?', approved: false,
                suggestions: {},
            },
        ],
        glossary: [
            { id: 'gl1', term: 'Mana', translations: { Turkish: 'Mana', Spanish: 'Maná', French: 'Mana' } },
            { id: 'gl2', term: 'Fireball', translations: { Turkish: 'Alev Topu', Spanish: 'Bola de Fuego' } },
        ],
        teamMembers: [
            {
                id: 'tm1', username: 'You (Owner)', role: 'owner', joinedAt: '3mo ago',
                stats: { tasksCompleted: 12, gddPagesEdited: 8, localisationsApproved: 0 },
            },
        ],
        playtestFeedback: [],
        activities: [
            { id: 'act1', type: 'task_created', text: 'Welcome to your Developer Workspace!', time: 'just now', icon: '🚀' },
            { id: 'act2', type: 'task_completed', text: 'Task "Set up project structure" marked as Done.', time: '2d ago', icon: '✅', actor: 'devuser' },
            { id: 'act3', type: 'gdd_edited', text: 'GDD document "Game Overview" updated.', time: '2h ago', icon: '📝' },
        ],
        gddCategories: DEFAULT_GDD_CATEGORIES,
    };
}

// ─── Context Types ────────────────────────────────────────────────────────────

interface WorkspaceContextType {
    // Navigation
    activeWorkspace: ActiveWorkspace;
    setActiveWorkspace: (ws: ActiveWorkspace) => void;
    activeTool: WorkspaceTool;
    setActiveTool: (tool: WorkspaceTool) => void;
    activeBoard: string; // 'solo' | 'org' | 'project_{id}'
    setActiveBoard: (board: string) => void;
    // Org list
    organisations: Organisation[];
    loadingOrgs: boolean;
    refetchOrgs: () => void;
    // Workspace data
    data: WorkspaceData;
    // Mutators
    setColumns: (cols: KanbanColumn[]) => void;
    setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
    setGDDDocs: (docs: GDDDoc[] | ((prev: GDDDoc[]) => GDDDoc[])) => void;
    setBalancingTables: (tables: BalancingTable[] | ((prev: BalancingTable[]) => BalancingTable[])) => void;
    setAssets: (assets: Asset[] | ((prev: Asset[]) => Asset[])) => void;
    setTranslationKeys: (keys: TranslationEntry[] | ((prev: TranslationEntry[]) => TranslationEntry[])) => void;
    setGlossary: (g: GlossaryTerm[] | ((prev: GlossaryTerm[]) => GlossaryTerm[])) => void;
    setTeamMembers: (m: TeamMember[] | ((prev: TeamMember[]) => TeamMember[])) => void;
    setPlaytestFeedback: (f: PlaytestFeedback[] | ((prev: PlaytestFeedback[]) => PlaytestFeedback[])) => void;
    setCategories: (categories: string[] | ((prev: string[]) => string[])) => void;
    setGDDCategories: (categories: GDDCategory[] | ((prev: GDDCategory[]) => GDDCategory[])) => void;
    logActivity: (type: ActivityType, text: string, icon: string, actor?: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// ─── Storage Key Helper ───────────────────────────────────────────────────────

function storageKey(ws: ActiveWorkspace, board: string, userId?: number): string {
    const suffix = userId ? `_u_${userId}` : '';
    if (ws.type === 'solo') {
        if (board === 'solo') return `workspace__solo${suffix}`;
        return `workspace__solo_board_${board}${suffix}`;
    }
    return `workspace__org_${ws.org?.id ?? 'unknown'}_board_${board}`;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [activeWorkspace, _setActiveWorkspace] = useState<ActiveWorkspace>({ type: 'solo' });
    const [activeTool, _setActiveTool] = useState<WorkspaceTool>('dashboard');
    const [activeBoard, _setActiveBoard] = useState<string>('solo');
    const [organisations, setOrganisations] = useState<Organisation[]>([]);
    const [loadingOrgs, setLoadingOrgs] = useState(false);
    const [data, setData] = useState<WorkspaceData>(buildDefaultData);

    // Track if we already initialised from URL params
    const initialised = useRef(false);

    // ── Load from URL params on first mount ──────────────────────────────────
    useEffect(() => {
        if (initialised.current) return;
        initialised.current = true;

        const toolParam = searchParams.get('tool') as WorkspaceTool | null;
        const wsParam = searchParams.get('workspace');
        const boardParam = searchParams.get('board');

        if (toolParam) _setActiveTool(toolParam);
        if (wsParam === 'solo') {
            _setActiveWorkspace({ type: 'solo' });
            _setActiveBoard(boardParam || 'solo');
        } else if (boardParam) {
            _setActiveBoard(boardParam);
        }
    }, [searchParams]);

    // Sync board param dynamically when URL changes
    useEffect(() => {
        const boardParam = searchParams.get('board');
        if (boardParam && boardParam !== activeBoard) {
            _setActiveBoard(boardParam);
        }
    }, [searchParams, activeBoard]);

    // ── Fetch organisations ──────────────────────────────────────────────────
    const fetchOrgs = useCallback(async () => {
        if (!user) return;
        setLoadingOrgs(true);
        try {
            const res = await api.get('/organisations/?member=true');
            const orgs: Organisation[] = res.data.results ?? res.data;
            setOrganisations(orgs);

            // Resolve org workspace from URL now that we have org list
            const wsParam = searchParams.get('workspace');
            if (wsParam && wsParam.startsWith('org_')) {
                const orgId = parseInt(wsParam.replace('org_', ''), 10);
                const org = orgs.find((o) => o.id === orgId);
                if (org) {
                    _setActiveWorkspace({ type: 'org', org });
                    const boardParam = searchParams.get('board') || 'org';
                    _setActiveBoard(boardParam);
                }
            }
        } catch (err) {
            console.error('Failed to fetch organisations:', err);
        } finally {
            setLoadingOrgs(false);
        }
    }, [user, searchParams]);

    useEffect(() => { fetchOrgs(); }, [user]);

    // ── Load workspace data from localStorage & backend when workspace or board changes ─
    useEffect(() => {
        const key = storageKey(activeWorkspace, activeBoard, user?.id);
        
        // 1. Load from localStorage cache first for instant render
        try {
            const stored = localStorage.getItem(key);
            if (stored) {
                const parsed: WorkspaceData = JSON.parse(stored);
                if (!parsed.columns?.length) parsed.columns = DEFAULT_COLUMNS;
                if (!parsed.categories?.length) parsed.categories = ['code', 'art', 'audio', 'qa', 'other'];
                if (!parsed.gddCategories?.length) parsed.gddCategories = DEFAULT_GDD_CATEGORIES;
                setData(parsed);
            } else {
                if (activeBoard.startsWith('project_')) {
                    const emptyData = buildDefaultData();
                    emptyData.tasks = [];
                    emptyData.gddDocs = [];
                    emptyData.balancingTables = [];
                    emptyData.dialogueTrees = [];
                    emptyData.assets = [];
                    emptyData.categories = ['code', 'art', 'audio', 'qa', 'other'];
                    emptyData.gddCategories = DEFAULT_GDD_CATEGORIES;
                    setData(emptyData);
                } else {
                    const defaultData = buildDefaultData();
                    defaultData.categories = ['code', 'art', 'audio', 'qa', 'other'];
                    defaultData.gddCategories = DEFAULT_GDD_CATEGORIES;
                    setData(defaultData);
                }
            }
        } catch {
            const defaultData = buildDefaultData();
            defaultData.categories = ['code', 'art', 'audio', 'qa', 'other'];
            defaultData.gddCategories = DEFAULT_GDD_CATEGORIES;
            setData(defaultData);
        }

        // 2. Fetch fresh data from backend
        if (!user) return;

        let active = true;
        api.get(`/workspace-state/${key}/`)
            .then((res) => {
                if (!active) return;
                const backendData = res.data?.data;
                if (backendData && backendData.columns?.length) {
                    if (!backendData.categories?.length) backendData.categories = ['code', 'art', 'audio', 'qa', 'other'];
                    if (!backendData.gddCategories?.length) backendData.gddCategories = DEFAULT_GDD_CATEGORIES;
                    setData(backendData);
                    try { localStorage.setItem(key, JSON.stringify(backendData)); } catch {}
                }
            })
            .catch((err) => {
                console.log('No backend workspace state found or failed to load. Using local state.', err);
            });

        return () => {
            active = false;
        };
    }, [activeWorkspace, activeBoard, user]);

    // ── Persist workspace data to localStorage & backend whenever it changes ──
    const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (persistTimer.current) clearTimeout(persistTimer.current);
        persistTimer.current = setTimeout(() => {
            const key = storageKey(activeWorkspace, activeBoard, user?.id);
            try {
                localStorage.setItem(key, JSON.stringify(data));
                if (user) {
                    api.post('/workspace-state/', { key, data })
                        .catch((err) => console.error('Failed to sync workspace state to backend:', err));
                }
            } catch { /* quota */ }
        }, 400); // debounce 400ms
        return () => { if (persistTimer.current) clearTimeout(persistTimer.current); };
    }, [data, activeWorkspace, activeBoard, user]);

    // ── URL sync helpers ──────────────────────────────────────────────────────
    const pushURL = useCallback((ws: ActiveWorkspace, tool: WorkspaceTool, board: string) => {
        const wsVal = ws.type === 'solo' ? 'solo' : `org_${ws.org?.id}`;
        router.replace(`/devs?workspace=${wsVal}&tool=${tool}&board=${board}`, { scroll: false });
    }, [router]);

    const setActiveWorkspace = useCallback((ws: ActiveWorkspace) => {
        _setActiveWorkspace(ws);
        const nextBoard = ws.type === 'solo' ? 'solo' : 'org';
        _setActiveBoard(nextBoard);
        pushURL(ws, activeTool, nextBoard);
    }, [activeTool, pushURL]);

    const setActiveTool = useCallback((tool: WorkspaceTool) => {
        _setActiveTool(tool);
        pushURL(activeWorkspace, tool, activeBoard);
    }, [activeWorkspace, activeBoard, pushURL]);

    const setActiveBoard = useCallback((board: string) => {
        _setActiveBoard(board);
        pushURL(activeWorkspace, activeTool, board);
    }, [activeWorkspace, activeTool, pushURL]);

    // ── Data mutators ─────────────────────────────────────────────────────────
    const setColumns = (cols: KanbanColumn[]) =>
        setData((d) => ({ ...d, columns: cols }));

    const setTasks = (tasks: Task[] | ((prev: Task[]) => Task[])) =>
        setData((d) => ({ ...d, tasks: typeof tasks === 'function' ? tasks(d.tasks) : tasks }));

    const setGDDDocs = (docs: GDDDoc[] | ((prev: GDDDoc[]) => GDDDoc[])) =>
        setData((d) => ({ ...d, gddDocs: typeof docs === 'function' ? docs(d.gddDocs) : docs }));

    const setBalancingTables = (tables: BalancingTable[] | ((prev: BalancingTable[]) => BalancingTable[])) =>
        setData((d) => ({ ...d, balancingTables: typeof tables === 'function' ? tables(d.balancingTables) : tables }));

    const setAssets = (assets: Asset[] | ((prev: Asset[]) => Asset[])) =>
        setData((d) => ({ ...d, assets: typeof assets === 'function' ? assets(d.assets) : assets }));

    const setTranslationKeys = (keys: TranslationEntry[] | ((prev: TranslationEntry[]) => TranslationEntry[])) =>
        setData((d) => ({ ...d, translationKeys: typeof keys === 'function' ? keys(d.translationKeys) : keys }));

    const setGlossary = (g: GlossaryTerm[] | ((prev: GlossaryTerm[]) => GlossaryTerm[])) =>
        setData((d) => ({ ...d, glossary: typeof g === 'function' ? g(d.glossary) : g }));

    const setTeamMembers = (m: TeamMember[] | ((prev: TeamMember[]) => TeamMember[])) =>
        setData((d) => ({ ...d, teamMembers: typeof m === 'function' ? m(d.teamMembers) : m }));

    const setPlaytestFeedback = (f: PlaytestFeedback[] | ((prev: PlaytestFeedback[]) => PlaytestFeedback[])) =>
        setData((d) => ({ ...d, playtestFeedback: typeof f === 'function' ? f(d.playtestFeedback) : f }));

    const setCategories = (cats: string[] | ((prev: string[]) => string[])) =>
        setData((d) => ({ ...d, categories: typeof cats === 'function' ? cats(d.categories ?? ['code', 'art', 'audio', 'qa', 'other']) : cats }));

    const setGDDCategories = (cats: GDDCategory[] | ((prev: GDDCategory[]) => GDDCategory[])) =>
        setData((d) => ({ ...d, gddCategories: typeof cats === 'function' ? cats(d.gddCategories ?? DEFAULT_GDD_CATEGORIES) : cats }));

    const logActivity = useCallback((type: ActivityType, text: string, icon: string, actor?: string) => {
        const item: ActivityItem = {
            id: `act-${Date.now()}`,
            type,
            text,
            icon,
            time: 'just now',
            actor,
        };
        setData((d) => ({ ...d, activities: [item, ...d.activities].slice(0, 50) }));
    }, []);

    return (
        <WorkspaceContext.Provider
            value={{
                activeWorkspace,
                setActiveWorkspace,
                activeTool,
                setActiveTool,
                activeBoard,
                setActiveBoard,
                organisations,
                loadingOrgs,
                refetchOrgs: fetchOrgs,
                data,
                setColumns,
                setTasks,
                setGDDDocs,
                setBalancingTables,
                setAssets,
                setTranslationKeys,
                setGlossary,
                setTeamMembers,
                setPlaytestFeedback,
                setCategories,
                setGDDCategories,
                logActivity,
            }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
    return ctx;
}
