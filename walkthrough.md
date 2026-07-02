# Kanban Board Jira-Standards Upgrade

We upgraded the developer workspace Kanban board to match modern Jira standards, adding advanced functionality and solving all UX issues.

## Changes Made

### 1. Column Drag & Drop Reordering
- Column headers are now fully draggable with standard drag grab styles.
- Dragging a column over another column triggers column-reordering state updating in `WorkspaceContext` and updates the board.

### 2. Rename & Delete on All Columns
- Double-clicking a column name or clicking the hover pencil edit icon activates rename mode. Clicking away or pressing Enter saves the name.
- Default columns can now be renamed or deleted. Deleting a column safely migrates all its tasks to the first available column.

### 3. Centered Dialog Modal
- The right-side drawer layout is replaced by a centered dialog pop-up.
- Background backdrop styling set to `z-[99999] bg-black/75 backdrop-blur-md` covering the entire viewport, which blurs and blocks all background widgets (including the bottom-right Messages drawer).

### 4. Spacious Scrollable Layout
- Set up a Jira-like two-column grid inside a scrollable layout:
  - Left Column (2/3): Title, description, subtask progress, and comment activity.
  - Right Column (1/3): Priority buttons, Category buttons, assignee input, due date, and metadata.

### 5. Dynamic Column Color Status Dropdown
- The status select dropdown at the top-left of the task details now matches the color palette of the column the task is currently in.

### 6. Realistic Commenter Profiles & Links
- Comments now store the username of the logged-in user instead of a generic "You" string.
- Commenter names are clickable links (`/[username]`) pointing to their public profile pages.

### 7. Quick Assign from Task Card
- Task cards now feature a quick assign dropdown icon/badge on hover.
- Clicking the badge opens a dropdown with options to assign to the current user (Assign to Me), other team members from the workspace, or Unassigned. Clicks are stopped from propagating to the parent card.

### 8. Quick Filters Bar
- Added a toolbar at the top of the Kanban Board with quick actions:
  - **Assigned to Me**: Quickly filters the entire board to show only tasks assigned to your username.
  - **Category Filters**: Clicking Code, Art, Audio, or QA highlights only tasks matching those categories.
  - **Search Field**: Real-time filtering matching task titles, descriptions, and task IDs.
  - **Create Task Inline**: Quick add input at the bottom of every column to quickly type and hit Enter.

### 9. Multiple Kanban Boards per Workspace (Organisation & Projects)
- Each workspace (both Solo and Organisation) now supports a general board (Personal / Organisation General Board) as well as separate project-specific Kanban boards.
- The board switcher dropdown is positioned prominently on the **left** of the main header, followed by a slash `/` divider and the title **Kanban Board on the **right**.
- Instead of generic emojis, the board switcher trigger displays the **actual profile picture** (user avatar, organization logo, or project cover photo) and name of the active board.
- The suffix "Board" is removed from names inside the switcher to prevent redundancy since the title itself says "Kanban Board".
- Switching boards is done via a modern custom-styled dropdown panel featuring profile pictures for each workspace board, and is fully persisted in localStorage.
- **Clean Slate Initialization**: Newly visited project boards start completely clean (0 tasks, 0 docs, etc.) instead of cloning the workspace general board template. This makes the database separation immediately obvious and clean.

### 10. Searchable Assignee Selector with Avatars
- Assignee selection is now an interactive searchable popup list rather than a simple input box.
- User profile pictures and display names are shown alongside their `@username`.
- If the board is the organization board, the list shows organization members. If the board is a project board, the list fetches and shows only members of that specific project.
- Inside comments, commenter names display as `Full Name @username` and include their actual profile picture.

### 11. Jira-Style Agile Features
- **Work-In-Progress (WIP) Limits**:
  - Restricts the number of cards in columns. In Progress has a default limit of `3` and Review has a default limit of `2`.
  - Exceeding the WIP limit adds a vibrant red warning glow border and header styling to call out bottlenecks.
  - Double-clicking the task count/WIP badge on a column header triggers inline editing where users can set or clear limits.
- **Story Points Estimation**:
  - Tasks can be estimated using Fibonacci numbers (1, 2, 3, 5, 8).
  - Selected Story Points are visible as a clean numeric badge on the bottom-left of each task card on the board.
  - The sum of Story Points is computed dynamically and displayed on each column header (e.g. `8 SP`).
  - Added Story Points selectors in both `CreateTaskModal` and `TaskDetailsModal`.
- **Horizontal Swimlanes Grouping**:
  - Added a "Group By" select dropdown in the Quick Filters bar.
  - Allows grouping the board horizontally by **Assignee** or **Priority**.
  - Lanes are collapsible, showing a clean summary of task counts and Story Point totals per lane.
  - Standard Drag & Drop functionality is fully preserved across columns within swimlanes.

