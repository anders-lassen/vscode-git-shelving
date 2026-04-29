import * as vscode from "vscode";

const STATE_KEY = "gitShelving.recentBranches";
const MAX_RECENT = 100;

export class RecentBranches {
	constructor(private readonly state: vscode.Memento) {}

	get(): string[] {
		return this.state.get<string[]>(STATE_KEY, []);
	}

	/** Call after successfully switching to `branch`. */
	async record(branch: string): Promise<void> {
		const list = this.get().filter((b) => b !== branch);
		list.unshift(branch);
		await this.state.update(STATE_KEY, list.slice(0, MAX_RECENT));
	}

	/** Returns the recency rank (0 = most recent). Absent branches get Infinity. */
	rank(branch: string): number {
		const idx = this.get().indexOf(branch);
		return idx === -1 ? Infinity : idx;
	}
}
