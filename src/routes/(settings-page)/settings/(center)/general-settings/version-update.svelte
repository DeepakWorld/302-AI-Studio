<script lang="ts">
	import { goto } from "$app/navigation";
	import { appInfo } from "$lib/app-info";
	import { ChangelogItem } from "$lib/components/buss/changelog";
	import {
		SettingInfoItem,
		SettingSelectItem,
		SettingSwitchItem,
	} from "$lib/components/buss/settings";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Progress } from "$lib/components/ui/progress/index.js";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { changelogState } from "$lib/stores/changelog-state.svelte";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import FileDownIcon from "@lucide/svelte/icons/file-down";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import type { UpdateChannel } from "@shared/storage/general-settings";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	const { updaterService } = window.electronAPI;
	const {
		onUpdateChecking,
		onUpdateAvailable,
		onUpdateNotAvailable,
		onUpdateDownloaded,
		onUpdateError,
		onDownloadProgress,
	} = window.electronAPI.updater;

	let checking = $state(false);
	let downloading = $state(false);
	let updateDownloaded = $state(false);
	let downloadProgress = $state({ percent: 0, transferred: 0, total: 0 });

	let isUpdating = $derived(checking || downloading);

	// Check if there's a newer version available based on changelog
	let hasNewerVersion = $derived(changelogState.hasNewerVersion());
	let latestVersionNumber = $derived(changelogState.latestVersion?.version ?? null);

	const updateChannelOptions = [
		{ value: "stable" as UpdateChannel, label: m.update_channel_stable() },
		{ value: "beta" as UpdateChannel, label: m.update_channel_beta() },
	];
	let statusText = $derived(
		updateDownloaded
			? m.restart_to_update()
			: checking
				? m.checking_update()
				: downloading
					? m.downloading_update()
					: m.check_update(),
	);

	// Format bytes to human readable string
	function formatBytes(bytes: number): string {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
	}

	async function handleCheckUpdate() {
		checking = true;
		try {
			await updaterService.checkForUpdatesManually();
		} catch (_error) {
			toast.error(m.update_error());
			checking = false;
		}
	}

	async function handleRestartToUpdate() {
		try {
			await updaterService.quitAndInstall();
		} catch (_error) {
			toast.error(m.update_error());
		}
	}

	onMount(async () => {
		try {
			const isDownloaded = await updaterService.isUpdateDownloaded();
			updateDownloaded = isDownloaded;
		} catch (error) {
			console.error("Failed to check update status:", error);
		}

		// Fetch the latest changelog
		changelogState.fetchLatest();
	});

	function handleViewFullChangelog() {
		goto("/settings/about/changelog");
	}

	onMount(() => {
		const cleanupChecking = onUpdateChecking(() => {
			checking = true;
		});

		const cleanupAvailable = onUpdateAvailable(() => {
			checking = false;
			downloading = true;
			downloadProgress = { percent: 0, transferred: 0, total: 0 };
			toast.success(m.update_available());
		});

		const cleanupNotAvailable = onUpdateNotAvailable(() => {
			checking = false;
			downloading = false;
			downloadProgress = { percent: 0, transferred: 0, total: 0 };
			toast.success(m.update_not_available());
		});

		const cleanupDownloaded = onUpdateDownloaded((_data) => {
			checking = false;
			downloading = false;
			downloadProgress = {
				percent: 100,
				transferred: downloadProgress.total,
				total: downloadProgress.total,
			};
			updateDownloaded = true;
		});

		const cleanupProgress = onDownloadProgress((data) => {
			downloadProgress = data;
			console.log("Download progress:", data);
		});

		const cleanupError = onUpdateError((data) => {
			checking = false;
			downloading = false;
			downloadProgress = { percent: 0, transferred: 0, total: 0 };
			toast.error(m.update_error(), {
				description: data.message,
			});
		});

		return () => {
			cleanupChecking?.();
			cleanupAvailable?.();
			cleanupNotAvailable?.();
			cleanupDownloaded?.();
			cleanupProgress?.();
			cleanupError?.();
		};
	});
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg font-normal">{m.version_update()}</Label>
	<SettingSwitchItem
		label={m.auto_update()}
		checked={generalSettings.autoUpdate}
		onCheckedChange={(v) => generalSettings.setAutoUpdate(v)}
	/>
	<SettingSelectItem
		label={m.update_channel()}
		description={m.update_channel_desc()}
		options={updateChannelOptions}
		value={generalSettings.updateChannel}
		onValueChange={(v) => generalSettings.setUpdateChannel(v as UpdateChannel)}
	/>
	{#snippet updateButton()}
		<Button
			size="sm"
			onclick={updateDownloaded ? handleRestartToUpdate : handleCheckUpdate}
			disabled={isUpdating}
		>
			{statusText}
			{#if isUpdating}
				<Loader2Icon class="animate-spin w-4 h-4" />
			{/if}
		</Button>
	{/snippet}

	<SettingInfoItem label={m.version_information()} value={appInfo.version} action={updateButton} />

	<!-- Download progress -->
	{#if downloading && downloadProgress.percent > 0}
		<div class="rounded-settings-item bg-muted/50 p-3 space-y-2">
			<div class="flex items-center justify-between text-sm">
				<div class="flex items-center gap-2">
					<FileDownIcon class="size-4 text-primary animate-pulse" />
					<span class="text-muted-fg">{m.downloading_update()}</span>
				</div>
				<span class="text-muted-fg font-medium">{downloadProgress.percent.toFixed(1)}%</span>
			</div>
			<Progress value={downloadProgress.percent} class="h-2" />
			<div class="flex justify-between text-xs text-muted-fg">
				<span>{formatBytes(downloadProgress.transferred)}</span>
				{#if downloadProgress.total > 0}
					<span>{formatBytes(downloadProgress.total)}</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- New version notification -->
	{#if hasNewerVersion && latestVersionNumber}
		<div
			class="rounded-settings-item bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3"
		>
			<p class="text-sm text-amber-700 dark:text-amber-300">
				{m.changelog_new_version_available({ version: latestVersionNumber })}
			</p>
		</div>
	{/if}

	<!-- Latest changelog display -->
	<div class="flex flex-col gap-2">
		{#if changelogState.loadingLatest}
			<Skeleton class="h-14 w-full rounded-settings-item" />
		{:else if changelogState.latestVersion}
			<ChangelogItem
				version={changelogState.latestVersion}
				isCurrentVersion={changelogState.isCurrentVersion(changelogState.latestVersion.version)}
				defaultOpen={true}
			/>
			<Button
				variant="link"
				class="self-start text-sm p-0 h-auto"
				onclick={handleViewFullChangelog}
			>
				{m.changelog_view_full()}
				<ChevronRightIcon class="size-4 ml-1" />
			</Button>
		{/if}
	</div>
</div>
