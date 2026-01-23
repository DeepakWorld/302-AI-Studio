import { Notification, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { tabService } from "../tab-service";
import { tabStorage } from "../storage-service/tab-storage";
import { isNull, isUndefined } from "es-toolkit/predicate";

export class NotificationService {
	private activeNotifications = new Set<Notification>();

	async notifyTaskCompleted(
		_event: IpcMainInvokeEvent,
		options: {
			title: string;
			body: string;
			windowId: string;
			tabId: string;
		},
	): Promise<void> {
		const notification = new Notification({
			title: options.title,
			body: options.body,
			silent: false,
		});

		this.activeNotifications.add(notification);

		notification.on("close", () => {
			this.activeNotifications.delete(notification);
		});

		notification.on("click", async () => {
			// Focus the window and activate the tab
			const numericWindowId = Number.parseInt(options.windowId, 10);
			if (Number.isNaN(numericWindowId)) return;

			const targetWindow = BrowserWindow.fromId(numericWindowId);
			if (isNull(targetWindow) || targetWindow.isDestroyed()) return;

			// Restore window if minimized
			if (targetWindow.isMinimized()) {
				targetWindow.restore();
			}

			// Show window if hidden
			if (!targetWindow.isVisible()) {
				targetWindow.show();
			}

			// Focus the window
			targetWindow.focus();

			// Focus the tab
			const tab = tabService.getTabById(options.tabId);
			if (isUndefined(tab)) return;

			tabService.focusTabInWindow(targetWindow, options.tabId);

			// Update storage to set this tab as active
			const tabState = await tabStorage.getItemInternal("tab-bar-state");
			if (!isNull(tabState) && tabState[options.windowId]) {
				const updatedTabs = tabState[options.windowId].tabs.map((t) => ({
					...t,
					active: t.id === options.tabId,
				}));
				tabState[options.windowId] = { tabs: updatedTabs };
				await tabStorage.setItemInternal("tab-bar-state", tabState);
				console.log(
					`[NotificationService] Activated tab ${options.tabId} in window ${options.windowId} via notification click`,
				);
			}
		});

		notification.show();
	}
}

export const notificationService = new NotificationService();
