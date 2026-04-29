import * as vscode from "vscode";
import { StashEntry } from "./gitService";
import { ShelveManager } from "./shelveManager";

export class ShelfItem extends vscode.TreeItem {
	constructor(public readonly stash: StashEntry) {
		super(stash.branchName ?? stash.ref, vscode.TreeItemCollapsibleState.None);
		this.description = stash.ref;
		this.iconPath = new vscode.ThemeIcon("archive");
		this.tooltip = new vscode.MarkdownString(
			`**${stash.branchName}**\n\nRef: \`${stash.ref}\`\n\n${stash.subject}`,
		);
		this.contextValue = "shelf";
	}
}

export class ShelvesProvider implements vscode.TreeDataProvider<ShelfItem> {
	private readonly _onDidChangeTreeData = new vscode.EventEmitter<
		ShelfItem | undefined | null | void
	>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(private readonly shelveManager: ShelveManager) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: ShelfItem): vscode.TreeItem {
		return element;
	}

	async getChildren(): Promise<ShelfItem[]> {
		try {
			const shelves = await this.shelveManager.getAllShelves();
			return shelves.map((s) => new ShelfItem(s));
		} catch {
			return [];
		}
	}
}
