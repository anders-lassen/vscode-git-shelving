import * as vscode from "vscode";
import { GitService } from "./gitService";
import { ShelveManager } from "./shelveManager";

export type BranchContextValue =
	| "branch"
	| "branchWithShelf"
	| "currentBranch"
	| "currentBranchWithShelf";

export class BranchItem extends vscode.TreeItem {
	constructor(
		public readonly branchName: string,
		public readonly isCurrent: boolean,
		public readonly hasShelf: boolean,
	) {
		super(branchName, vscode.TreeItemCollapsibleState.None);

		const parts: string[] = [];
		if (isCurrent) {
			parts.push("current");
		}
		if (hasShelf) {
			parts.push("shelved");
		}
		this.description = parts.length > 0 ? parts.join("  ·  ") : undefined;

		this.tooltip = new vscode.MarkdownString(
			`**${branchName}**` +
				(isCurrent ? "\n\nCurrently checked out" : "") +
				(hasShelf ? "\n\nHas shelved changes" : ""),
		);

		this.iconPath = isCurrent
			? new vscode.ThemeIcon(
					"git-branch",
					new vscode.ThemeColor("gitDecoration.addedResourceForeground"),
				)
			: new vscode.ThemeIcon("git-branch");

		this.contextValue = ((isCurrent ? "currentBranch" : "branch") +
			(hasShelf ? "WithShelf" : "")) as BranchContextValue;

		// Clicking a non-current branch triggers the switch flow.
		if (!isCurrent) {
			this.command = {
				command: "gitShelving.switchBranch",
				title: "Switch to Branch",
				arguments: [this],
			};
		}
	}
}

export class BranchesProvider implements vscode.TreeDataProvider<BranchItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<
		BranchItem | undefined | null | void
	>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(
		private readonly git: GitService,
		private readonly shelveManager: ShelveManager,
	) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: BranchItem): vscode.TreeItem {
		return element;
	}

	async getChildren(): Promise<BranchItem[]> {
		try {
			const [branches, currentBranch, shelves] = await Promise.all([
				this.git.getLocalBranches(),
				this.git.getCurrentBranch(),
				this.shelveManager.getAllShelves(),
			]);

			const shelvedBranches = new Set(shelves.map((s) => s.branchName));

			// Current branch first, then alphabetical.
			branches.sort((a, b) => {
				if (a === currentBranch) {
					return -1;
				}
				if (b === currentBranch) {
					return 1;
				}
				return a.localeCompare(b);
			});

			return branches.map(
				(name) =>
					new BranchItem(
						name,
						name === currentBranch,
						shelvedBranches.has(name),
					),
			);
		} catch {
			return [];
		}
	}
}
