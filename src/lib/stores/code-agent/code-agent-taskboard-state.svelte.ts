import { getTasklist, updateTasklist } from "$lib/api/taskboard";
import { m } from "$lib/paraglide/messages";
import type { Task } from "@shared/types";
import { toast } from "svelte-sonner";
import { match } from "ts-pattern";
import { claudeCodeSandboxState } from "./claude-code-sandbox-state.svelte";
import { codeAgentState } from "./code-agent-state.svelte";
import { withLoadingState } from "./utils";

export class CodeAgentTaskboardState {
	isTaskboardRunning = $state(false);
	isLoading = $state(false);
	tasklist = $state<Task[]>([]);
	taskboardStatus = $state<"idle" | "running" | "waiting_to_stop">("idle");

	// 当前正在执行的任务 ID
	currentExecutingTaskId = $state<string | null>(null);

	// 错误信息（任务失败时记录）
	lastError = $state<{ taskId: string; error: string } | null>(null);

	#isInitialized = $derived(
		codeAgentState.enabled && codeAgentState.isFreshTab && codeAgentState.sandboxId === "",
	);

	inTaskOrchestrationMode = $derived(
		this.tasklist.length > 0 && this.tasklist.some((task) => task.status === "pending"),
	);
	inProgressTask = $derived<Task | null>(
		this.tasklist.find((task) => task.status === "in_progress") ?? null,
	);

	// 是否可以开始执行
	canStart = $derived(
		this.taskboardStatus === "idle" && this.tasklist.some((t) => t.status === "pending"),
	);

	// 是否可以暂停
	canPause = $derived(this.taskboardStatus === "running");

	// 是否正在等待停止
	isWaitingToStop = $derived(this.taskboardStatus === "waiting_to_stop");

	toggleTaskboardRunningStatus() {
		this.isTaskboardRunning = !this.isTaskboardRunning;
	}

	/**
	 * Synchronizes the tasklist with the backend.
	 * If the taskboard is not initialized, it will fetch the tasklist from the backend.
	 * Otherwise, it will use an empty array.
	 */
	async syncTasklist(): Promise<void> {
		await withLoadingState(
			(loading) => (this.isLoading = loading),
			async () => {
				await match(this.#isInitialized)
					.with(true, () => (this.tasklist = []))
					.otherwise(async () => {
						const [sandboxId, path] = [
							codeAgentState.sandboxId,
							claudeCodeSandboxState.currentSessionWorkspacePath,
						];
						const tasklist = await getTasklist(sandboxId, path);
						this.tasklist = tasklist.tasks;
					});
			},
		);
	}

	/**
	 * Updates the tasklist in the backend.
	 * If the taskboard is not initialized, it will update the tasklist in the backend.
	 * Otherwise, it will use the provided tasklist.
	 */
	async updateTasklist(tasklist: Task[]): Promise<void> {
		match(this.#isInitialized)
			.with(true, () => {
				this.tasklist = tasklist;
			})
			.otherwise(async () => {
				this.tasklist = tasklist;
				const [sandboxId, path] = [
					codeAgentState.sandboxId,
					claudeCodeSandboxState.currentSessionWorkspacePath,
				];
				const result = await updateTasklist(sandboxId, path, tasklist);
				if (!result.isOk) {
					const { isOk, tasks } = await getTasklist(sandboxId, path);
					this.tasklist = isOk ? tasks : [];

					toast.error(m.taskboard_update_failed());
				}
			});
	}

	/**
	 * 开始/继续自动执行任务列表
	 */
	async startAutoExecution(): Promise<void> {
		if (this.taskboardStatus === "running") return;

		this.lastError = null;
		this.taskboardStatus = "running";

		while (this.taskboardStatus === "running") {
			const nextTask = this.tasklist.find((t) => t.status === "pending");

			if (!nextTask) {
				this.taskboardStatus = "idle";
				break;
			}

			await this.#executeTask(nextTask);

			// 检查是否需要暂停（状态可能在 await 期间被 pauseAutoExecution 修改）
			if (this.#shouldStop()) {
				this.taskboardStatus = "idle";
				break;
			}
		}
	}

	/**
	 * 检查是否应该停止执行
	 */
	#shouldStop(): boolean {
		return this.taskboardStatus === "waiting_to_stop" || this.taskboardStatus === "idle";
	}

	/**
	 * 暂停自动执行（等待当前任务完成后停止）
	 */
	pauseAutoExecution(): void {
		if (this.taskboardStatus === "running") {
			this.taskboardStatus = "waiting_to_stop";
		}
	}

	/**
	 * 执行单个任务
	 */
	async #executeTask(task: Task): Promise<void> {
		this.currentExecutingTaskId = task.id;
		await this.#updateTaskStatus(task.id, "in_progress");

		try {
			const delay = 1000 + Math.random() * 2000; // 1-3秒随机延迟
			await new Promise((resolve) => setTimeout(resolve, delay));
			console.log(`[TaskBoard] Task completed: ${task.content}`);

			await this.#updateTaskStatus(task.id, "done");
		} catch (error) {
			this.lastError = { taskId: task.id, error: String(error) };
			this.taskboardStatus = "idle"; // 失败时暂停整个流程
		} finally {
			this.currentExecutingTaskId = null;
		}
	}

	/**
	 * 更新单个任务状态
	 */
	async #updateTaskStatus(taskId: string, status: Task["status"]): Promise<void> {
		const updatedList = this.tasklist.map((t) => (t.id === taskId ? { ...t, status } : t));
		await this.updateTasklist(updatedList);
	}
}

export const codeAgentTaskboardState = new CodeAgentTaskboardState();
