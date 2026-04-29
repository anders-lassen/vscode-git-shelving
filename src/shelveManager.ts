import { GitService, StashEntry, makeShelvingMessage } from "./gitService";

export class ShelveManager {
	constructor(private readonly git: GitService) {}

	/**
	 * Shelve the current working-tree changes for the given branch (or the
	 * currently checked-out branch when none is specified).  Any previous
	 * shelf for the same branch is replaced.
	 */
	async shelve(branchName?: string): Promise<string> {
		const branch = branchName ?? (await this.git.getCurrentBranch());
		const hasChanges = await this.git.hasUncommittedChanges();
		if (!hasChanges) {
			throw new Error(`No uncommitted changes to shelve on branch "${branch}"`);
		}

		// Drop any existing shelf(ves) for this branch before creating the new one.
		await this.dropAllForBranch(branch);

		await this.git.stashPush(makeShelvingMessage(branch));
		return branch;
	}

	/**
	 * Restore (pop) the shelf for the given branch (or current branch).
	 */
	async unshelve(branchName?: string): Promise<void> {
		const branch = branchName ?? (await this.git.getCurrentBranch());
		const entry = await this.getShelfForBranch(branch);
		if (!entry) {
			throw new Error(`No shelf found for branch "${branch}"`);
		}
		await this.git.stashPop(entry.ref);
	}

	async getShelfForBranch(branch: string): Promise<StashEntry | undefined> {
		const stashes = await this.git.stashList();
		return stashes.find((s) => s.branchName === branch);
	}

	async getAllShelves(): Promise<StashEntry[]> {
		const stashes = await this.git.stashList();
		return stashes.filter((s) => s.branchName !== undefined);
	}

	async deleteShelf(stashRef: string): Promise<void> {
		await this.git.stashDrop(stashRef);
	}

	/**
	 * Drop all shelves that belong to `branch`.
	 * We drop in descending index order so that earlier refs stay valid.
	 */
	private async dropAllForBranch(branch: string): Promise<void> {
		const stashes = await this.git.stashList();
		const matching = stashes
			.filter((s) => s.branchName === branch)
			.sort((a, b) => b.index - a.index); // highest index first

		for (const stash of matching) {
			await this.git.stashDrop(stash.ref);
		}
	}
}
