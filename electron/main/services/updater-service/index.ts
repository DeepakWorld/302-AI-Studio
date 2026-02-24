import type { UpdateChannel } from "@shared/storage/general-settings";
import { autoUpdater, dialog, net, type IpcMainInvokeEvent } from "electron";
import * as fs from "fs";
import * as path from "path";
import { broadcastService } from "../broadcast-service";
import { generalSettingsService } from "../settings-service/general-settings-service";
import { generalSettingsStorage } from "../storage-service/general-settings-storage";

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;
const DOWNLOAD_MONITOR_INTERVAL = 1000;

export class UpdaterService {
	private checkInterval: NodeJS.Timeout | null = null;
	private updateFeedUrl: string;
	private updateDownloaded = false;
	private static isInstallingUpdate = false;
	private currentChannel: UpdateChannel = "stable";
	private isChecking = false;

	// Download monitoring
	private downloadInterval: NodeJS.Timeout | null = null;
	private targetFileSize: number = 0;
	private isMonitoringDownload = false;

	constructor() {
		// Only support Windows
		if (process.platform === "win32") {
			this.updateFeedUrl = this.buildUpdateFeedUrl("stable");
			this.setupAutoUpdater();
			this.initializeAutoCheck();
		} else {
			this.updateFeedUrl = "";
			console.warn("Auto-update only supported on Windows");
		}
	}

	private buildUpdateFeedUrl(channel: UpdateChannel): string {
		const server = "https://updater.302.ai";
		const appId = "302-ai-studio";

		// Windows Squirrel expects base URL without version
		// It will automatically request /RELEASES file
		return `${server}/update/${appId}/${channel}/${process.platform}/${process.arch}`;
	}

	private updateFeedUrlForChannel(channel: UpdateChannel) {
		this.currentChannel = channel;
		this.updateFeedUrl = this.buildUpdateFeedUrl(channel);
		autoUpdater.setFeedURL({ url: this.updateFeedUrl });
		console.log(`Update feed URL set to: ${this.updateFeedUrl} (channel: ${channel})`);
	}

	// ******************************* Private Methods ******************************* //
	private async initializeAutoCheck() {
		// Read initial settings
		const autoUpdate = await generalSettingsStorage.getAutoUpdate();
		const updateChannel = await generalSettingsStorage.getUpdateChannel();

		// Update feed URL based on channel
		this.updateFeedUrlForChannel(updateChannel);

		if (autoUpdate) {
			setTimeout(() => {
				this.checkForUpdates();
			}, 1000);
			this.startAutoCheck();
		}
	}

	private setupAutoUpdater() {
		autoUpdater.setFeedURL({ url: this.updateFeedUrl });

		autoUpdater.on("checking-for-update", () => {
			console.log("Checking for updates...");
			broadcastService.broadcastChannelToAll("updater:update-checking");
		});

		autoUpdater.on("update-available", async () => {
			console.log("Update available");
			this.isChecking = false;
			broadcastService.broadcastChannelToAll("updater:update-available");

			// Try to fetch file size from server for progress calculation
			this.targetFileSize = await this.fetchUpdateFileSize();
			console.log(`Target file size: ${this.targetFileSize} bytes`);

			// Start monitoring download progress via directory
			this.startDownloadMonitoring();
		});

		autoUpdater.on("update-not-available", () => {
			console.log("Update not available");
			this.isChecking = false;

			// Stop any ongoing download monitoring
			this.stopDownloadMonitoring();

			broadcastService.broadcastChannelToAll("updater:update-not-available");
		});

		autoUpdater.on("update-downloaded", async (_event, releaseNotes, releaseName) => {
			console.log("Update downloaded");
			this.updateDownloaded = true;

			// Save target size before stopping monitoring (which resets it)
			const totalSize = this.targetFileSize;

			// Stop monitoring download progress
			this.stopDownloadMonitoring();

			// Broadcast 100% progress
			broadcastService.broadcastChannelToAll("updater:download-progress", {
				percent: 100,
				transferred: totalSize,
				total: totalSize,
			});

			broadcastService.broadcastChannelToAll("updater:update-downloaded", {
				releaseNotes,
				releaseName,
			});

			// Show native dialog
			await this.showUpdateDownloadedDialog();
		});

		autoUpdater.on("error", (error) => {
			console.error("Update error:", error);
			this.isChecking = false;

			// Stop any ongoing download monitoring
			this.stopDownloadMonitoring();

			// Check if this is a "no releases available" error (common on Windows)
			// These errors should be treated as "no update available" rather than errors
			const errorMessage = error.message || "";
			const isNoReleasesError =
				errorMessage.includes("empty or corrupted") ||
				errorMessage.includes("RELEASES") ||
				errorMessage.includes("404") ||
				errorMessage.includes("Not Found");

			if (isNoReleasesError) {
				console.log("No releases available on server, treating as no update available");
				broadcastService.broadcastChannelToAll("updater:update-not-available");
			} else {
				broadcastService.broadcastChannelToAll("updater:update-error", { message: error.message });
			}
		});
	}

	private startAutoCheck() {
		if (this.checkInterval) {
			this.stopAutoCheck();
		}

		this.checkInterval = setInterval(() => {
			this.checkForUpdates();
		}, UPDATE_CHECK_INTERVAL);

		console.log("Auto-update check enabled");
	}

	private stopAutoCheck() {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
			console.log("Auto-update check disabled");
		}
	}

	// ******************************* Download Monitoring Methods ******************************* //

	/**
	 * Get the Squirrel download directory for Windows
	 */
	private getSquirrelDownloadDir(): string {
		// Windows: %LOCALAPPDATA%\SquirrelTemp
		return path.join(process.env.LOCALAPPDATA || "", "SquirrelTemp");
	}

	/**
	 * Find the update file (nupkg) in the download directory
	 */
	private findUpdateFile(downloadDir: string): { name: string; size: number } | null {
		if (!fs.existsSync(downloadDir)) {
			return null;
		}

		try {
			const files = fs.readdirSync(downloadDir);

			// Windows: Look for nupkg files
			const updateFiles = files.filter(
				(file) =>
					file.endsWith(".nupkg") ||
					file.endsWith(".nupkg.temp") ||
					file.endsWith(".nupkg.broken") ||
					file.endsWith(".zip"),
			);

			if (updateFiles.length > 0) {
				const sortedFiles = updateFiles
					.map((name) => {
						const filePath = path.join(downloadDir, name);
						const stats = fs.statSync(filePath);
						return { name, size: stats.size, mtime: stats.mtime };
					})
					.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

				return { name: sortedFiles[0].name, size: sortedFiles[0].size };
			}

			return null;
		} catch (error) {
			console.error("Error finding update file:", error);
			return null;
		}
	}

	/**
	 * Start monitoring the download directory for progress
	 */
	private startDownloadMonitoring() {
		if (this.isMonitoringDownload) {
			return;
		}

		this.isMonitoringDownload = true;
		const downloadDir = this.getSquirrelDownloadDir();

		console.log(`Starting download monitoring: ${downloadDir}`);

		this.downloadInterval = setInterval(() => {
			const updateFile = this.findUpdateFile(downloadDir);

			if (!updateFile) {
				return;
			}

			const downloadedSize = updateFile.size;

			// Use targetFileSize from server if available, otherwise use estimated size
			const totalSize = this.targetFileSize > 0 ? this.targetFileSize : 100 * 1024 * 1024;
			const percent = Math.min((downloadedSize / totalSize) * 100, 99);

			// Broadcast progress to all windows
			broadcastService.broadcastChannelToAll("updater:download-progress", {
				percent: Math.round(percent * 100) / 100,
				transferred: downloadedSize,
				total: totalSize,
			});
		}, DOWNLOAD_MONITOR_INTERVAL);
	}

	/**
	 * Stop monitoring download progress
	 */
	private stopDownloadMonitoring() {
		if (this.downloadInterval) {
			clearInterval(this.downloadInterval);
			this.downloadInterval = null;
		}
		this.isMonitoringDownload = false;
		this.targetFileSize = 0;
		console.log("Download monitoring stopped");
	}

	/**
	 * Fetch update file size from server
	 */
	private fetchUpdateFileSize(): Promise<number> {
		return new Promise((resolve) => {
			try {
				const request = net.request(this.updateFeedUrl);

				let data = "";

				request.on("response", (response) => {
					response.on("data", (chunk) => {
						data += chunk.toString();
					});

					response.on("end", () => {
						try {
							const json = JSON.parse(data);
							const fileSize = json.file_size || 0;
							console.log(`Fetched file size from server: ${fileSize} bytes`);
							resolve(fileSize);
						} catch {
							resolve(0);
						}
					});
				});

				request.on("error", () => {
					resolve(0);
				});

				request.end();
			} catch {
				resolve(0);
			}
		});
	}

	private checkForUpdates() {
		if (this.isChecking) {
			console.log("Update check already in progress, skipping...");
			return;
		}

		// Only check for updates on Windows
		if (process.platform !== "win32") {
			this.isChecking = false;
			return;
		}

		try {
			this.isChecking = true;
			autoUpdater.checkForUpdates();
		} catch (error) {
			this.isChecking = false;
			console.error("Failed to check for updates:", error);
		}
	}

	private async showUpdateDownloadedDialog() {
		try {
			const language = await generalSettingsService.getLanguage();

			const messages = {
				zh: {
					title: "更新已下载完成",
					message: "新版本已下载完成，是否立即重启更新？",
					buttons: ["立即重启", "稍后再说"],
				},
				en: {
					title: "Update Downloaded",
					message:
						"A new version has been downloaded. Would you like to restart and install it now?",
					buttons: ["Restart Now", "Later"],
				},
			};

			const msg = messages[language] || messages.en;

			const { response } = await dialog.showMessageBox({
				type: "info",
				title: msg.title,
				message: msg.message,
				buttons: msg.buttons,
				defaultId: 0,
				cancelId: 1,
			});

			if (response === 0) {
				// User clicked "Restart Now"
				UpdaterService.isInstallingUpdate = true;
				autoUpdater.quitAndInstall();
			}
		} catch (error) {
			console.error("Failed to show update dialog:", error);
		}
	}

	private _quitAndInstall() {
		UpdaterService.isInstallingUpdate = true;
		autoUpdater.quitAndInstall();
	}

	// ******************************* IPC Methods ******************************* //
	async checkForUpdatesManually(_event: IpcMainInvokeEvent): Promise<void> {
		this.checkForUpdates();
	}

	async quitAndInstall(_event: IpcMainInvokeEvent): Promise<void> {
		this._quitAndInstall();
	}

	static isInstallingUpdateNow(): boolean {
		return UpdaterService.isInstallingUpdate;
	}

	async isUpdateDownloaded(_event: IpcMainInvokeEvent): Promise<boolean> {
		return this.updateDownloaded;
	}

	async setAutoUpdate(_event: IpcMainInvokeEvent, enabled: boolean): Promise<void> {
		if (enabled) {
			this.startAutoCheck();
		} else {
			this.stopAutoCheck();
		}
	}

	async setUpdateChannel(_event: IpcMainInvokeEvent, channel: UpdateChannel): Promise<void> {
		this.updateFeedUrlForChannel(channel);
		// If auto-update is enabled, check for updates immediately with new channel
		const autoUpdate = await generalSettingsStorage.getAutoUpdate();
		if (autoUpdate) {
			setTimeout(() => {
				this.checkForUpdates();
			}, 500);
		}
	}

	async getUpdateChannel(_event: IpcMainInvokeEvent): Promise<UpdateChannel> {
		return this.currentChannel;
	}

	destroy() {
		this.stopAutoCheck();
		this.stopDownloadMonitoring();
	}
}

export const updaterService = new UpdaterService();
