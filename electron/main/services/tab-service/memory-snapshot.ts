import { app } from "electron";

import type { MemorySnapshot } from "./memory-manager";

export const createElectronSnapshotProvider = () => (): MemorySnapshot => {
	const systemInfo = process.getSystemMemoryInfo();
	const totalKB = systemInfo?.total ?? 0;
	const freeKB = systemInfo?.free ?? 0;
	const metrics = app.isReady() ? app.getAppMetrics() : [];
	const appWorkingSetKB = metrics.reduce((sum, metric) => {
		const workingSet = metric.memory?.workingSetSize ?? 0;
		return sum + workingSet;
	}, 0);

	return {
		totalKB,
		freeKB,
		appWorkingSetKB,
		nowMs: Date.now(),
	};
};
