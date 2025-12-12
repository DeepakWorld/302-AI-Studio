import { confirm, input, select } from "@inquirer/prompts";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import semver from "semver";

type ReleaseCommand = "patch" | "minor" | "major" | "to" | "beta" | "interactive";

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

	if (!["patch", "minor", "major", "to", "beta", "interactive"].includes(command)) {
		die(
			[
				"Usage:",
				'  pnpm tsx scripts/release.ts patch|minor|major [--notes "..."] [--push]',
				'  pnpm tsx scripts/release.ts to --to <version> [--notes "..."] [--push]',
				'  pnpm tsx scripts/release.ts beta [--notes "..."] [--push]',
				"  pnpm tsx scripts/release.ts  (interactive)",
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

function updateAppInfoVersion(source: string, nextVersion: string) {
	const re = /(\bversion\s*:\s*")([^"]+)("\s*,)/;
	if (!re.test(source)) {
		throw new Error("Failed to locate appInfo.version in src/lib/app-info.ts");
	}
	return source.replace(re, `$1${nextVersion}$3`);
}

function updatePackageJsonVersion(source: string, nextVersion: string) {
	const parsed = JSON.parse(source) as { version?: string } & Record<string, unknown>;
	parsed.version = nextVersion;
	return JSON.stringify(parsed, null, "\t") + "\n";
}

async function promptInteractive(currentVersion: string, preset: CliOptions) {
	const action = await select<Exclude<ReleaseCommand, "interactive">>({
		message: "Select release type",
		choices: [
			{
				name: `Patch (${currentVersion} -> ${semver.inc(currentVersion, "patch")})`,
				value: "patch",
			},
			{
				name: `Minor (${currentVersion} -> ${semver.inc(currentVersion, "minor")})`,
				value: "minor",
			},
			{
				name: `Major (${currentVersion} -> ${semver.inc(currentVersion, "major")})`,
				value: "major",
			},
			{ name: `Set exact version (to)`, value: "to" },
			{ name: `Beta tag (v${currentVersion}-beta, no version file changes)`, value: "beta" },
		],
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

	const syncAppInfo = await confirm({
		message: "Sync src/lib/app-info.ts ?",
		default: !preset.skipAppInfo,
	});
	options.skipAppInfo = !syncAppInfo;

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

	let finalCommand: Exclude<ReleaseCommand, "interactive">;
	let finalOptions: CliOptions;

	if (isInteractive) {
		const resolved = await promptInteractive(currentVersion, options);
		finalCommand = resolved.command;
		finalOptions = resolved.options;
	} else {
		finalCommand = command;
		finalOptions = options;
	}

	ensureCleanGit(finalOptions.allowDirty);

	let nextVersion = currentVersion;
	let tagName: string;
	let updateVersionFiles = true;

	if (finalCommand === "beta") {
		// Beta releases are represented by git tags only (e.g. v25.50.8-beta)
		updateVersionFiles = false;
		tagName = `v${currentVersion}-beta`;
	} else {
		if (finalCommand === "to") {
			if (!finalOptions.to) die("Missing --to <version>");
			if (!semver.valid(finalOptions.to)) die(`Invalid --to version: ${finalOptions.to}`);
			nextVersion = finalOptions.to;
		} else {
			const inc = semver.inc(currentVersion, finalCommand);
			if (!inc) die(`Failed to bump version from ${currentVersion} using ${finalCommand}`);
			nextVersion = inc;
		}

		tagName = `v${nextVersion}`;
	}

	const tagMessage = finalOptions.notes?.trim() ? finalOptions.notes.trim() : tagName;

	const planned: string[] = [];

	if (updateVersionFiles) {
		planned.push(`- package.json: ${currentVersion} -> ${nextVersion}`);
		if (!finalOptions.skipAppInfo)
			planned.push(`- src/lib/app-info.ts: ${currentVersion} -> ${nextVersion}`);
	} else {
		planned.push(`- (beta) no version file changes`);
	}

	const gitOps: string[] = [];
	if (!finalOptions.noCommit && updateVersionFiles) gitOps.push("- git commit: chore(release)");
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

	if (updateVersionFiles) {
		await writeText(pkgPath, updatePackageJsonVersion(pkgRaw, nextVersion), false);
		filesToAdd.push(pkgPath);

		if (!finalOptions.skipAppInfo) {
			const appInfoRaw = await readText(appInfoPath);
			await writeText(appInfoPath, updateAppInfoVersion(appInfoRaw, nextVersion), false);
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
