import type { Task } from "@shared/types";

type TaskboardStatus = "idle" | "running" | "waiting_to_stop" | "waiting_for_chat";

interface ShouldPauseAfterTaskRestoreParams {
	hadLocalTasksBeforeSync: boolean;
	taskboardStatus: TaskboardStatus;
	restoredTasks: Task[];
}

export function shouldPauseAfterTaskRestore({
	hadLocalTasksBeforeSync,
	taskboardStatus,
	restoredTasks,
}: ShouldPauseAfterTaskRestoreParams): boolean {
	if (hadLocalTasksBeforeSync) return false;
	if (taskboardStatus !== "idle") return false;

	return restoredTasks.some((task) => task.status === "pending" || task.status === "in_progress");
}
