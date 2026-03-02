import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { WebContents } from "electron";

import { ViewLoadTracker, type TrackableView } from "./view-load-tracker";

class FakeWebContents extends EventEmitter {
	loading = true;
	destroyed = false;
	url = "app://localhost";

	isLoading() {
		return this.loading;
	}

	isDestroyed() {
		return this.destroyed;
	}

	getURL() {
		return this.url;
	}
}

const makeView = (): { view: TrackableView; webContents: FakeWebContents } => {
	const webContents = new FakeWebContents();
	const view = { webContents: webContents as unknown as WebContents } as TrackableView;
	return { view, webContents };
};

describe("ViewLoadTracker", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("resolves after all tracked views finish loading", async () => {
		const tracker = new ViewLoadTracker();
		const first = makeView();
		const second = makeView();

		tracker.track(first.view);
		tracker.track(second.view);

		let resolved = false;
		const waitPromise = tracker.waitForAll(1000).then(() => {
			resolved = true;
		});

		first.webContents.loading = false;
		first.webContents.emit("did-finish-load");
		await Promise.resolve();

		expect(resolved).toBe(false);

		second.webContents.loading = false;
		second.webContents.emit("did-finish-load");
		await waitPromise;

		expect(resolved).toBe(true);
	});

	it("resolves after timeout even if views never finish", async () => {
		vi.useFakeTimers();
		const tracker = new ViewLoadTracker();
		const view = makeView();

		tracker.track(view.view);

		const waitPromise = tracker.waitForAll(500);
		await vi.advanceTimersByTimeAsync(500);
		await waitPromise;
	});

	it("resolves immediately for already-loaded views", async () => {
		const tracker = new ViewLoadTracker();
		const view = makeView();

		view.webContents.loading = false;

		tracker.track(view.view);
		await tracker.waitForAll(1000);
	});

	it("resolves immediately for destroyed views", async () => {
		const tracker = new ViewLoadTracker();
		const view = makeView();

		view.webContents.destroyed = true;

		tracker.track(view.view);
		await tracker.waitForAll(1000);
	});
});
