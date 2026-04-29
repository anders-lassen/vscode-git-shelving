# Git Shelving

A VS Code extension that makes switching between branches effortless by giving each branch its own **shelf** — a named stash that is saved and restored automatically as you switch.

## How it works

Shelves are regular git stashes tagged with the branch name (`[shelved/<branch>]`), so they live in your normal stash stack and are fully accessible with plain `git stash` commands if needed.

## Features

### Branch list

A panel in the activity bar shows all local branches. The current branch is highlighted at the top. Branches that have a shelf are marked with a _shelved_ badge.

### Switch Branch `↔`

Switches to the selected branch.

- If you have uncommitted changes, they are **automatically shelved** on the current branch before switching.
- If the target branch has a shelf, it is **automatically restored** after switching.

### Discard & Switch `⊘`

Same as Switch Branch, but discards uncommitted changes instead of shelving them. Asks for confirmation before discarding.

### Shelve Changes `⊡`

Manually shelves the working-tree changes on the current branch without switching.

### Unshelve Changes

Restores the shelf for the current branch (command palette).

### Shelves panel

Lists all shelves. From here you can:

- **Unshelve** — restore a shelf onto its branch (offers to switch to that branch first if needed).
- **Delete** — permanently remove a shelf.

## Usage

1. Press **F5** to open an Extension Development Host (during development).
2. Open a folder that contains a git repository.
3. Click the **Git Shelving** icon in the activity bar.

When you are ready to switch branches, click **↔** next to any branch in the list. Your current changes are shelved, you land on the new branch, and any previously shelved work there is waiting for you.

## Commands

| Command                        | Where                                                           |
| ------------------------------ | --------------------------------------------------------------- |
| Git Shelving: Switch Branch    | Activity bar button, branch item inline button, command palette |
| Git Shelving: Discard & Switch | Branch item inline button                                       |
| Git Shelving: Shelve Changes   | Activity bar button, command palette                            |
| Git Shelving: Unshelve Changes | Command palette                                                 |
| Git Shelving: Refresh          | Activity bar button                                             |

## Requirements

- Git must be installed and available on `PATH`.
- The workspace must contain a git repository (`.git` folder).
