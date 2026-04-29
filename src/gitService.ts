import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Stash message format used to identify shelves created by this extension.
// Pattern: [shelved/<branchName>]
const SHELVE_MARKER_RE = /\[shelved\/(.+?)\]$/;

export function makeShelvingMessage(branchName: string): string {
	return `[shelved/${branchName}]`;
}

export function extractShelvingBranch(subject: string): string | undefined {
	const m = subject.match(SHELVE_MARKER_RE);
	return m ? m[1] : undefined;
}

export interface StashEntry {
	ref: string; // e.g. "stash@{0}"
	index: number;
	subject: string;
	/** Set when this stash was created by Git Shelving for a specific branch. */
	branchName?: string;
}

export class GitService {
	constructor(private readonly cwd: string) {}

	private async run(...args: string[]): Promise<string> {
		const { stdout } = await execFileAsync("git", args, { cwd: this.cwd });
		return stdout.trim();
	}

	async isGitRepo(): Promise<boolean> {
		try {
			await this.run("rev-parse", "--git-dir");
			return true;
		} catch {
			return false;
		}
	}

	async getCurrentBranch(): Promise<string> {
		return this.run("rev-parse", "--abbrev-ref", "HEAD");
	}

	async getLocalBranches(): Promise<string[]> {
		const out = await this.run("branch", "--format=%(refname:short)");
		return out
			.split("\n")
			.map((s) => s.trim())
			.filter(Boolean);
	}

	async hasUncommittedChanges(): Promise<boolean> {
		const out = await this.run("status", "--porcelain");
		return out.length > 0;
	}

	/**
	 * Stash all changes (including untracked files) with the given message.
	 */
	async stashPush(message: string): Promise<void> {
		await this.run("stash", "push", "--include-untracked", "-m", message);
	}

	/**
	 * List all stash entries, annotated with the shelving branch if applicable.
	 */
	async stashList(): Promise<StashEntry[]> {
		let out: string;
		try {
			// %gd = stash ref (stash@{N}), %s = subject line
			out = await this.run("stash", "list", "--format=%gd\t%s");
		} catch {
			return [];
		}
		if (!out) {
			return [];
		}

		return out.split("\n").flatMap((line) => {
			const tab = line.indexOf("\t");
			if (tab === -1) {
				return [];
			}
			const ref = line.slice(0, tab);
			const subject = line.slice(tab + 1);
			const indexMatch = ref.match(/stash@\{(\d+)\}/);
			if (!indexMatch) {
				return [];
			}
			return [
				{
					ref,
					index: parseInt(indexMatch[1], 10),
					subject,
					branchName: extractShelvingBranch(subject),
				},
			];
		});
	}

	async stashPop(ref: string): Promise<void> {
		await this.run("stash", "pop", ref);
	}

	async stashApply(ref: string): Promise<void> {
		await this.run("stash", "apply", ref);
	}

	async stashDrop(ref: string): Promise<void> {
		await this.run("stash", "drop", ref);
	}

	async checkout(branch: string): Promise<void> {
		await this.run("checkout", branch);
	}

	/**
	 * Discard all uncommitted changes (tracked + untracked files).
	 */
	async discardChanges(): Promise<void> {
		await this.run("checkout", "--", ".");
		await this.run("clean", "-fd");
	}
}
