import { confirm, input, select } from "@inquirer/prompts";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import semver from "semver";

type ReleaseCommand = "patch" | "minor" | "major" | "to" | "beta" | "stable" | "interactive";

/**
 * Check if a version is a beta prerelease
 */
function isBetaVersion(version: string): boolean {
	const prerelease = semver.prerelease(version);
	return Array.isArray(prerelease) && prerelease[0] === "beta";
}

/**
 * Get the base version without prerelease suffix
 * e.g., "25.50.18-beta.2" -> "25.50.18"
 */
function getBaseVersion(version: string): string {
	const parsed = semver.parse(version);
	if (!parsed) return version;
	return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

/**
 * Calculate the next beta version
 * - If current is stable (e.g., 25.50.18): bump patch + add -beta.1 -> 25.50.19-beta.1
 * - If current is beta (e.g., 25.50.18-beta.1): increment beta number -> 25.50.18-beta.2
 */
function getNextBetaVersion(currentVersion: string): string {
	if (isBetaVersion(currentVersion)) {
		// Already a beta, increment the beta number
		const next = semver.inc(currentVersion, "prerelease", "beta");
		if (!next) throw new Error(`Failed to increment beta version from ${currentVersion}`);
		return next;
	} else {
		// Stable version, bump patch and add -beta.1
		const patchBumped = semver.inc(currentVersion, "patch");
		if (!patchBumped) throw new Error(`Failed to bump patch version from ${currentVersion}`);
		return `${patchBumped}-beta.1`;
	}
}

/**
 * Calculate the next stable version
 * - If current is beta (e.g., 25.50.18-beta.2): drop beta suffix -> 25.50.18
 * - If current is stable: use standard semver bump
 */
function getNextStableVersion(
	currentVersion: string,
	releaseType: "patch" | "minor" | "major",
): string {
	if (isBetaVersion(currentVersion)) {
		// From beta to stable: just drop the beta suffix
		return getBaseVersion(currentVersion);
	} else {
		// Standard semver bump
		const next = semver.inc(currentVersion, releaseType);
		if (!next) throw new Error(`Failed to bump ${releaseType} version from ${currentVersion}`);
		return next;
	}
}

type CliOptions = {
	to?: string;
	notes?: string;
	dryRun: boolean;
	allowDirty: boolean;
	noCommit: boolean;
	noTag: boolean;
	push: boolean;
	skipAppInfo: boolean;
};

const ROOT = path.resolve(process.cwd());

function die(message: string, exitCode = 1): never {
	console.error(message);
	process.exit(exitCode);
}

function run(cmd: string, args: string[], opts?: { cwd?: string; stdio?: "inherit" | "pipe" }) {
	const res = spawnSync(cmd, args, {
		cwd: opts?.cwd ?? ROOT,
		encoding: "utf-8",
		stdio: opts?.stdio ?? "pipe",
	});

	if (res.status !== 0) {
		const stderr = typeof res.stderr === "string" ? res.stderr.trim() : "";
		const stdout = typeof res.stdout === "string" ? res.stdout.trim() : "";
		const detail = [stdout, stderr].filter(Boolean).join("\n");
		throw new Error(`Command failed: ${cmd} ${args.join(" ")}\n${detail}`);
	}

	return {
		stdout: typeof res.stdout === "string" ? res.stdout : "",
		stderr: typeof res.stderr === "string" ? res.stderr : "",
	};
}

function parseArgs(argv: string[]): { command: ReleaseCommand; options: CliOptions } {
	const first = argv[0];
	const hasCommand = !!first && !first.startsWith("--");
	const command = (hasCommand ? first : "interactive") as ReleaseCommand;
	const rest = hasCommand ? argv.slice(1) : argv;

	if (!["patch", "minor", "major", "to", "beta", "stable", "interactive"].includes(command)) {
		die(
			[
				"Usage:",
				'  pnpm tsx scripts/release.ts patch|minor|major [--notes "..."] [--push]',
				'  pnpm tsx scripts/release.ts to --to <version> [--notes "..."] [--push]',
				'  pnpm tsx scripts/release.ts beta [--notes "..."] [--push]',
				'  pnpm tsx scripts/release.ts stable [--notes "..."] [--push]',
				"  pnpm tsx scripts/release.ts  (interactive)",
				"",
				"Commands:",
				"  patch                  Bump patch version (25.50.18 -> 25.50.19)",
				"                         From beta: release stable (25.50.18-beta.2 -> 25.50.18)",
				"  minor                  Bump minor version (25.50.18 -> 25.51.0)",
				"                         From beta: release stable (25.50.18-beta.2 -> 25.50.18)",
				"  major                  Bump major version (25.50.18 -> 26.0.0)",
				"                         From beta: release stable (25.50.18-beta.2 -> 25.50.18)",
				"  beta                   Create beta version:",
				"                         From stable: 25.50.18 -> 25.50.19-beta.1",
				"                         From beta: 25.50.18-beta.1 -> 25.50.18-beta.2",
				"  stable                 Release stable from beta (25.50.18-beta.2 -> 25.50.18)",
				"  to                     Set exact version",
				"",
				"Options:",
				"  --to <version>         Target version when using 'to'",
				"  --notes <text>         Optional tag annotation message",
				"  --dry-run              Print what would change; do not write/commit/tag",
				"  --allow-dirty          Allow running with uncommitted changes",
				"  --no-commit            Do not create a release commit",
				"  --no-tag               Do not create a git tag",
				"  --push                 Push commit + tags to origin",
				"  --skip-app-info        Do not sync src/lib/app-info.ts",
			].join("\n"),
		);
	}

	const options: CliOptions = {
		to: undefined,
		notes: undefined,
		dryRun: false,
		allowDirty: false,
		noCommit: false,
		noTag: false,
		push: false,
		skipAppInfo: false,
	};

	for (let i = 0; i < rest.length; i++) {
		const a = rest[i];
		if (a === "--to") options.to = rest[++i];
		else if (a === "--notes") options.notes = rest[++i];
		else if (a === "--dry-run") options.dryRun = true;
		else if (a === "--allow-dirty") options.allowDirty = true;
		else if (a === "--no-commit") options.noCommit = true;
		else if (a === "--no-tag") options.noTag = true;
		else if (a === "--push") options.push = true;
		else if (a === "--skip-app-info") options.skipAppInfo = true;
		else die(`Unknown option: ${a}`);
	}

	return { command, options };
}

async function readText(filePath: string) {
	return fs.readFile(filePath, "utf-8");
}

async function writeText(filePath: string, contents: string, dryRun: boolean) {
	if (dryRun) return;
	await fs.writeFile(filePath, contents);
}

function ensureCleanGit(allowDirty: boolean) {
	if (allowDirty) return;
	const { stdout } = run("git", ["status", "--porcelain"]);
	if (stdout.trim() !== "") {
		die(
			["Working tree is not clean.", "Commit/stash your changes or rerun with --allow-dirty."].join(
				"\n",
			),
		);
	}
}

function maybeUpdateAppInfoVersion(
	source: string,
	nextVersion: string,
): { contents: string; changed: boolean; reason?: "injected" } {
	// If version is injected at build time, do not modify the file.
	if (/\bversion\s*:\s*__APP_VERSION__\b/.test(source)) {
		return { contents: source, changed: false, reason: "injected" };
	}

	// Manual string version fallback (legacy)
	const re = /^(\s*version\s*:\s*)(["'])([^"']+)(\2)(\s*,?)/m;
	const m = source.match(re);
	if (!m) {
		throw new Error(
			"Failed to locate appInfo.version in src/lib/app-info.ts (expected __APP_VERSION__ or a string literal)",
		);
	}

	const current = m[3];
	if (current === nextVersion) return { contents: source, changed: false };

	const contents = source.replace(re, `$1$2${nextVersion}$2$5`);
	return { contents, changed: true };
}

function updatePackageJsonVersion(source: string, nextVersion: string) {
	const parsed = JSON.parse(source) as { version?: string } & Record<string, unknown>;
	parsed.version = nextVersion;
	return JSON.stringify(parsed, null, "\t") + "\n";
}

async function promptInteractive(
	currentVersion: string,
	preset: CliOptions,
	appInfoMode: "manual" | "injected" | "unknown",
) {
	const isBeta = isBetaVersion(currentVersion);
	const nextBeta = getNextBetaVersion(currentVersion);
	const nextStable = isBeta ? getNextStableVersion(currentVersion, "patch") : null;

	const choices: Array<{ name: string; value: Exclude<ReleaseCommand, "interactive"> }> = [];

	if (isBeta) {
		// Current version is beta, show stable release option first
		choices.push({
			name: `Stable (${currentVersion} -> ${nextStable})`,
			value: "stable",
		});
		choices.push({
			name: `Beta (${currentVersion} -> ${nextBeta})`,
			value: "beta",
		});
	} else {
		// Current version is stable
		choices.push({
			name: `Patch (${currentVersion} -> ${getNextStableVersion(currentVersion, "patch")})`,
			value: "patch",
		});
		choices.push({
			name: `Minor (${currentVersion} -> ${getNextStableVersion(currentVersion, "minor")})`,
			value: "minor",
		});
		choices.push({
			name: `Major (${currentVersion} -> ${getNextStableVersion(currentVersion, "major")})`,
			value: "major",
		});
		choices.push({
			name: `Beta (${currentVersion} -> ${nextBeta})`,
			value: "beta",
		});
	}

	choices.push({ name: `Set exact version (to)`, value: "to" });

	const action = await select<Exclude<ReleaseCommand, "interactive">>({
		message: "Select release type",
		choices,
	});

	const options: CliOptions = {
		...preset,
	};

	if (action === "to") {
		options.to = await input({
			message: "Target version (semver)",
			default: currentVersion,
			validate: (v) => (semver.valid(v) ? true : "Invalid semver version (e.g. 25.50.9)"),
		});
	}

	options.notes = await input({
		message: "Tag annotation message (optional)",
		default: preset.notes ?? "",
	});

	if (appInfoMode === "manual") {
		const syncAppInfo = await confirm({
			message: "Sync src/lib/app-info.ts ?",
			default: !preset.skipAppInfo,
		});
		options.skipAppInfo = !syncAppInfo;
	} else {
		// injected/unknown: default skip to avoid breaking injected version
		options.skipAppInfo = true;
	}

	const createCommit = await confirm({
		message: "Create release commit?",
		default: !preset.noCommit,
	});
	options.noCommit = !createCommit;

	const createTag = await confirm({
		message: "Create git tag?",
		default: !preset.noTag,
	});
	options.noTag = !createTag;

	options.push = await confirm({
		message: "Push commit/tag to origin?",
		default: preset.push,
	});

	options.dryRun = await confirm({
		message: "Dry-run (no file writes / no git operations)?",
		default: preset.dryRun,
	});

	options.allowDirty = await confirm({
		message: "Allow dirty working tree?",
		default: preset.allowDirty,
	});

	return { command: action, options };
}

async function main() {
	const { command, options } = parseArgs(process.argv.slice(2));
	const isInteractive = command === "interactive";

	const pkgPath = path.join(ROOT, "package.json");
	const appInfoPath = path.join(ROOT, "src/lib/app-info.ts");

	const pkgRaw = await readText(pkgPath);
	const pkg = JSON.parse(pkgRaw) as { version?: string };
	const currentVersion = pkg.version;
	if (!currentVersion || !semver.valid(currentVersion)) {
		die(`Invalid current version in package.json: ${String(currentVersion)}`);
	}

	let appInfoMode: "manual" | "injected" | "unknown" = "unknown";
	try {
		const appInfoRaw = await readText(appInfoPath);
		if (/\bversion\s*:\s*__APP_VERSION__\b/.test(appInfoRaw)) appInfoMode = "injected";
		else if (/^\s*version\s*:\s*["']/m.test(appInfoRaw)) appInfoMode = "manual";
	} catch {
		// ignore
	}

	let finalCommand: Exclude<ReleaseCommand, "interactive">;
	let finalOptions: CliOptions;

	if (isInteractive) {
		const resolved = await promptInteractive(currentVersion, options, appInfoMode);
		finalCommand = resolved.command;
		finalOptions = resolved.options;
	} else {
		finalCommand = command;
		finalOptions = options;
	}

	ensureCleanGit(finalOptions.allowDirty);

	let nextVersion = currentVersion;

	if (finalCommand === "to") {
		if (!finalOptions.to) die("Missing --to <version>");
		if (!semver.valid(finalOptions.to)) die(`Invalid --to version: ${finalOptions.to}`);
		nextVersion = finalOptions.to;
	} else if (finalCommand === "beta") {
		// Beta version: 25.50.18 -> 25.50.19-beta.1, or 25.50.18-beta.1 -> 25.50.18-beta.2
		nextVersion = getNextBetaVersion(currentVersion);
	} else if (finalCommand === "stable") {
		// Stable from beta: 25.50.18-beta.2 -> 25.50.18
		if (!isBetaVersion(currentVersion)) {
			die(
				`Cannot release stable: current version ${currentVersion} is not a beta. Use patch/minor/major instead.`,
			);
		}
		nextVersion = getNextStableVersion(currentVersion, "patch");
	} else {
		// patch, minor, major
		nextVersion = getNextStableVersion(currentVersion, finalCommand);
	}

	const tagName = `v${nextVersion}`;

	const tagMessage = finalOptions.notes?.trim() ? finalOptions.notes.trim() : tagName;

	const planned: string[] = [];

	if (nextVersion === currentVersion) planned.push(`- package.json: (no change) ${currentVersion}`);
	else planned.push(`- package.json: ${currentVersion} -> ${nextVersion}`);

	if (!finalOptions.skipAppInfo) {
		if (appInfoMode === "injected")
			planned.push("- src/lib/app-info.ts: uses __APP_VERSION__ (no change)");
		else planned.push(`- src/lib/app-info.ts: ${currentVersion} -> ${nextVersion}`);
	}

	const gitOps: string[] = [];
	if (!finalOptions.noCommit) gitOps.push("- git commit: chore(release)");
	if (!finalOptions.noTag) gitOps.push(`- git tag: ${tagName}`);
	if (finalOptions.push) gitOps.push("- git push (commits + tags)");

	console.log(["Plan:", ...planned, ...gitOps].join("\n"));

	if (finalOptions.dryRun) {
		console.log("\n(dry-run) No files will be modified.");
		return;
	}

	if (isInteractive) {
		const proceed = await confirm({ message: "Proceed?", default: true });
		if (!proceed) {
			console.log("Cancelled.");
			return;
		}
	}

	const filesToAdd: string[] = [];

	if (nextVersion !== currentVersion) {
		await writeText(pkgPath, updatePackageJsonVersion(pkgRaw, nextVersion), false);
		filesToAdd.push(pkgPath);
	}

	if (!finalOptions.skipAppInfo) {
		const appInfoRaw = await readText(appInfoPath);
		const updated = maybeUpdateAppInfoVersion(appInfoRaw, nextVersion);
		if (updated.changed) {
			await writeText(appInfoPath, updated.contents, false);
			filesToAdd.push(appInfoPath);
		}
	}

	if (filesToAdd.length > 0) {
		run("git", ["add", ...filesToAdd.map((p) => path.relative(ROOT, p))], { stdio: "inherit" });
	}

	if (!finalOptions.noCommit && filesToAdd.length > 0) {
		run("git", ["commit", "-m", `chore(release): ${tagName}`], { stdio: "inherit" });
	}

	if (!finalOptions.noTag) {
		run("git", ["tag", "-a", tagName, "-m", tagMessage], { stdio: "inherit" });
	}

	if (finalOptions.push) {
		run("git", ["push"], { stdio: "inherit" });
		run("git", ["push", "--follow-tags"], { stdio: "inherit" });
	}

	console.log(`\nDone: ${tagName}`);
}

main().catch((err) => {
	die(err instanceof Error ? err.message : String(err));
});
