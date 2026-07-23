'use client';

import { useWorkspace } from './WorkspaceContext';
import BoardSwitcher from './BoardSwitcher';
import FeedbackPanel from './FeedbackPanel';

export default function PlaytestFeedback() {
    const { activeWorkspace, activeBoard, data, refreshWorkspaceData } = useWorkspace();
    const projectId = activeBoard.startsWith('project_') ? parseInt(activeBoard.replace('project_', ''), 10) : null;
    const orgId = activeWorkspace.type === 'org' ? (activeWorkspace.org?.id ?? null) : null;

    // The Kanban board's own first column — mirrors backend's convert_to_task target exactly, so
    // the Submit button can be disabled up front instead of only failing after a click.
    const firstColumn = data.columns?.[0];
    const kanbanFirstColumnStatus = firstColumn ? (() => {
        const current = data.tasks.filter((t) => t.columnId === firstColumn.id).length;
        return {
            label: firstColumn.label,
            current,
            limit: firstColumn.wipLimit,
            full: firstColumn.wipLimit !== undefined && current >= firstColumn.wipLimit,
        };
    })() : null;

    return (
        <FeedbackPanel
            projectId={projectId}
            organisationId={orgId}
            headerExtra={<BoardSwitcher projectsOnly />}
            allowConvertToTask
            emptyProjectMessage="Select a project to view its feedback."
            kanbanFirstColumnStatus={kanbanFirstColumnStatus}
            onKanbanChanged={refreshWorkspaceData}
        />
    );
}
