import type { WebContents } from "electron";

type TrackableWebContents = Pick<
	WebContents,
	"isLoading" | "isDestroyed" | "getURL" | "once" | "removeListener"
>;

export type TrackableView = {
	webContents: TrackableWebContents;
};

const waitForViewReady = (view: TrackableView): Promise<void> =>
	new Promise((resolve) => {
		const webContents = view.webContents;

		if (webContents.isDestroyed()) {
			resolve();
			return;
		}

		if (!webContents.isLoading() && webContents.getURL()) {
			resolve();
			return;
		}

		const done = () => {
			cleanup();
			resolve();
		};

		const cleanup = () => {
			webContents.removeListener("did-finish-load", done);
			webContents.removeListener("did-fail-load", done);
			webContents.removeListener("did-stop-loading", done);
			webContents.removeListener("destroyed", done);
		};

		webContents.once("did-finish-load", done);
		webContents.once("did-fail-load", done);
		webContents.once("did-stop-loading", done);
		webContents.once("destroyed", done);
	});

export class ViewLoadTracker {
	private pending: Promise<void>[] = [];

	track(view: TrackableView) {
		this.pending.push(waitForViewReady(view));
	}

	async waitForAll(timeoutMs: number) {
		const pending = this.pending;
		this.pending = [];

		if (pending.length === 0) return;

		const timeout = new Promise<void>((resolve) => {
			setTimeout(resolve, timeoutMs);
		});

		await Promise.race([Promise.allSettled(pending), timeout]);
	}
}
