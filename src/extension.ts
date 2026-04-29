import * as vscode from "vscode";
import { GitService } from "./gitService";
import { ShelveManager } from "./shelveManager";
import { BranchItem, BranchesProvider } from "./branchesProvider";
import { ShelfItem, ShelvesProvider } from "./shelvesProvider";

export async function activate(
	context: vscode.ExtensionContext,
): Promise<void> {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	if (!workspaceFolder) {
		return;
	}

	const git = new GitService(workspaceFolder.uri.fsPath);

	if (!(await git.isGitRepo())) {
		vscode.window.showWarningMessage(
			"Git Shelving: No git repository found in the current workspace.",
		);
		return;
	}

	const shelveManager = new ShelveManager(git);
	const branchesProvider = new BranchesProvider(git, shelveManager);
	const shelvesProvider = new ShelvesProvider(shelveManager);

	const branchesView = vscode.window.createTreeView(
		"gitShelving.branchesView",
		{
			treeDataProvider: branchesProvider,
			showCollapseAll: false,
		},
	);

	const shelvesView = vscode.window.createTreeView("gitShelving.shelvesView", {
		treeDataProvider: shelvesProvider,
		showCollapseAll: false,
	});

	function refreshAll(): void {
		branchesProvider.refresh();
		shelvesProvider.refresh();
	}

	// -------------------------------------------------------------------------
	// Switch Branch  (main UX flow)
	// -------------------------------------------------------------------------
	const switchBranch = vscode.commands.registerCommand(
		"gitShelving.switchBranch",
		async (item?: BranchItem) => {
			try {
				const currentBranch = await git.getCurrentBranch();
				let targetBranch: string;

				if (item instanceof BranchItem) {
					targetBranch = item.branchName;
				} else {
					// Launched from command palette — show a quick pick.
					const [branches, shelves] = await Promise.all([
						git.getLocalBranches(),
						shelveManager.getAllShelves(),
					]);
					const shelvedSet = new Set(shelves.map((s) => s.branchName));

					const picks = branches
						.filter((b) => b !== currentBranch)
						.sort((a, b) => {
							const aS = shelvedSet.has(a) ? 0 : 1;
							const bS = shelvedSet.has(b) ? 0 : 1;
							if (aS !== bS) {
								return aS - bS;
							}
							return a.localeCompare(b);
						})
						.map((b) => ({
							label: `$(git-branch)  ${b}`,
							description: shelvedSet.has(b) ? "$(archive) has shelf" : "",
							branchName: b,
						}));

					if (picks.length === 0) {
						vscode.window.showInformationMessage(
							"No other local branches found.",
						);
						return;
					}

					const selected = await vscode.window.showQuickPick(picks, {
						placeHolder: `Current: ${currentBranch} — select a branch to switch to`,
						matchOnDescription: true,
					});
					if (!selected) {
						return;
					}
					targetBranch = selected.branchName;
				}

				if (targetBranch === currentBranch) {
					vscode.window.showInformationMessage(
						`Already on branch "${currentBranch}".`,
					);
					return;
				}

				// Handle uncommitted changes before switching — always shelve.
				const hasChanges = await git.hasUncommittedChanges();
				if (hasChanges) {
					await shelveManager.shelve(currentBranch);
				}

				await git.checkout(targetBranch);

				// Auto-restore shelf if one exists for the target branch.
				const shelf = await shelveManager.getShelfForBranch(targetBranch);
				if (shelf) {
					try {
						await shelveManager.unshelve(targetBranch);
						vscode.window.showInformationMessage(
							`Switched to "${targetBranch}" and restored shelved changes.`,
						);
					} catch (err: unknown) {
						const msg = err instanceof Error ? err.message : String(err);
						vscode.window.showWarningMessage(
							`Switched to "${targetBranch}" but could not restore shelf: ${msg}`,
						);
					}
				} else {
					vscode.window.showInformationMessage(
						`Switched to "${targetBranch}".`,
					);
				}

				refreshAll();
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Git Shelving: ${msg}`);
			}
		},
	);

	// -------------------------------------------------------------------------
	// Discard & Switch Branch
	// -------------------------------------------------------------------------
	const discardAndSwitchBranch = vscode.commands.registerCommand(
		"gitShelving.discardAndSwitchBranch",
		async (item?: BranchItem) => {
			try {
				const currentBranch = await git.getCurrentBranch();
				let targetBranch: string;

				if (item instanceof BranchItem) {
					targetBranch = item.branchName;
				} else {
					const [branches, shelves] = await Promise.all([
						git.getLocalBranches(),
						shelveManager.getAllShelves(),
					]);
					const shelvedSet = new Set(shelves.map((s) => s.branchName));
					const picks = branches
						.filter((b) => b !== currentBranch)
						.sort((a, b) => {
							const aS = shelvedSet.has(a) ? 0 : 1;
							const bS = shelvedSet.has(b) ? 0 : 1;
							if (aS !== bS) {
								return aS - bS;
							}
							return a.localeCompare(b);
						})
						.map((b) => ({
							label: `$(git-branch)  ${b}`,
							description: shelvedSet.has(b) ? "$(archive) has shelf" : "",
							branchName: b,
						}));

					if (picks.length === 0) {
						vscode.window.showInformationMessage(
							"No other local branches found.",
						);
						return;
					}

					const selected = await vscode.window.showQuickPick(picks, {
						placeHolder: `Current: ${currentBranch} — select a branch to switch to`,
					});
					if (!selected) {
						return;
					}
					targetBranch = selected.branchName;
				}

				if (targetBranch === currentBranch) {
					return;
				}

				const hasChanges = await git.hasUncommittedChanges();
				if (hasChanges) {
					const confirmed = await vscode.window.showWarningMessage(
						`Discard all changes on "${currentBranch}"? This cannot be undone.`,
						{ modal: true },
						"Discard",
					);
					if (confirmed !== "Discard") {
						return;
					}
					await git.discardChanges();
				}

				await git.checkout(targetBranch);

				// Auto-restore shelf if one exists for the target branch.
				const shelf = await shelveManager.getShelfForBranch(targetBranch);
				if (shelf) {
					try {
						await shelveManager.unshelve(targetBranch);
						vscode.window.showInformationMessage(
							`Switched to "${targetBranch}" and restored shelved changes.`,
						);
					} catch (err: unknown) {
						const msg = err instanceof Error ? err.message : String(err);
						vscode.window.showWarningMessage(
							`Switched to "${targetBranch}" but could not restore shelf: ${msg}`,
						);
					}
				} else {
					vscode.window.showInformationMessage(
						`Switched to "${targetBranch}".`,
					);
				}

				refreshAll();
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Git Shelving: ${msg}`);
			}
		},
	);

	// -------------------------------------------------------------------------
	// Shelve Changes  (current branch)
	// -------------------------------------------------------------------------
	const shelveChanges = vscode.commands.registerCommand(
		"gitShelving.shelveChanges",
		async () => {
			try {
				const branch = await shelveManager.shelve();
				vscode.window.showInformationMessage(
					`Changes shelved for "${branch}".`,
				);
				refreshAll();
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Git Shelving: ${msg}`);
			}
		},
	);

	// -------------------------------------------------------------------------
	// Unshelve Changes  (current branch)
	// -------------------------------------------------------------------------
	const unshelveChanges = vscode.commands.registerCommand(
		"gitShelving.unshelveChanges",
		async () => {
			try {
				const branch = await git.getCurrentBranch();
				await shelveManager.unshelve(branch);
				vscode.window.showInformationMessage(`Shelf restored for "${branch}".`);
				refreshAll();
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Git Shelving: ${msg}`);
			}
		},
	);

	// -------------------------------------------------------------------------
	// Unshelve (from shelf tree-view item)
	// -------------------------------------------------------------------------
	const unshelveShelf = vscode.commands.registerCommand(
		"gitShelving.unshelveShelf",
		async (item?: ShelfItem) => {
			if (!item?.stash.branchName) {
				return;
			}
			try {
				const targetBranch = item.stash.branchName;
				const currentBranch = await git.getCurrentBranch();

				if (currentBranch !== targetBranch) {
					const pick = await vscode.window.showWarningMessage(
						`The shelf belongs to "${targetBranch}" but you are on "${currentBranch}".`,
						{ modal: true },
						"Switch & Unshelve",
						"Cancel",
					);
					if (pick !== "Switch & Unshelve") {
						return;
					}

					const hasChanges = await git.hasUncommittedChanges();
					if (hasChanges) {
						vscode.window.showErrorMessage(
							`Cannot switch: "${currentBranch}" has uncommitted changes. Shelve or discard them first.`,
						);
						return;
					}
					await git.checkout(targetBranch);
				}

				await shelveManager.unshelve(targetBranch);
				vscode.window.showInformationMessage(
					`Shelf for "${targetBranch}" restored.`,
				);
				refreshAll();
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Git Shelving: ${msg}`);
			}
		},
	);

	// -------------------------------------------------------------------------
	// Delete Shelf
	// -------------------------------------------------------------------------
	const deleteShelf = vscode.commands.registerCommand(
		"gitShelving.deleteShelf",
		async (item?: ShelfItem) => {
			if (!item) {
				return;
			}
			const confirmed = await vscode.window.showWarningMessage(
				`Delete the shelf for "${item.stash.branchName}"? The stashed changes will be permanently lost.`,
				{ modal: true },
				"Delete",
			);
			if (confirmed !== "Delete") {
				return;
			}
			try {
				await shelveManager.deleteShelf(item.stash.ref);
				vscode.window.showInformationMessage(
					`Shelf for "${item.stash.branchName}" deleted.`,
				);
				refreshAll();
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				vscode.window.showErrorMessage(`Git Shelving: ${msg}`);
			}
		},
	);

	// -------------------------------------------------------------------------
	// Filter Branches
	// -------------------------------------------------------------------------
	const filterBranches = vscode.commands.registerCommand(
		"gitShelving.filterBranches",
		async () => {
			const query = await vscode.window.showInputBox({
				placeHolder: "Type to filter branches…",
				value: branchesProvider.getFilter(),
				prompt: "Leave empty to clear the filter",
			});
			if (query === undefined) {
				return;
			} // escaped
			branchesProvider.setFilter(query);
			branchesView.description = query || undefined;
		},
	);

	// -------------------------------------------------------------------------
	// Refresh
	// -------------------------------------------------------------------------
	const refresh = vscode.commands.registerCommand(
		"gitShelving.refresh",
		refreshAll,
	);

	context.subscriptions.push(
		branchesView,
		shelvesView,
		switchBranch,
		discardAndSwitchBranch,
		shelveChanges,
		unshelveChanges,
		unshelveShelf,
		deleteShelf,
		filterBranches,
		refresh,
	);
}

export function deactivate(): void {}
