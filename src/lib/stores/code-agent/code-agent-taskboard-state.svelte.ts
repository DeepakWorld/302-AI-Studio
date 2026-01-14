import { getTasklist, updateTasklist } from "$lib/api/taskboard";
import { emitter, EventNames } from "$lib/event/emitter";
import { m } from "$lib/paraglide/messages";
import type { MessageMetadata } from "$lib/types/chat";
import type { AttachmentFile, Task } from "@shared/types";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";
import { match } from "ts-pattern";
import { chatState } from "../chat-state.svelte";
import { claudeCodeSandboxState } from "./claude-code-sandbox-state.svelte";
import { codeAgentState } from "./code-agent-state.svelte";
import { withLoadingState } from "./utils";

export class CodeAgentTaskboardState {
	#currentRetryCount = 0;
	readonly #MAX_RETRY_COUNT = 3;

	isTaskboardRunning = $state(false);
	isLoading = $state(false);
	tasklist = $state<Task[]>([]);
	taskboardStatus = $state<"idle" | "running" | "waiting_to_stop">("idle");

	// Input state
	inputValue = $state("");
	attachments = $state<AttachmentFile[]>([]);

	currentExecutingTaskId = $state<string | null>(null);

	#taskResolve: ((success: boolean) => void) | null = null;

	#isInitialized = $derived(codeAgentState.enabled && codeAgentState.isFreshTab);

	inTaskOrchestrationMode = $derived(
		this.tasklist.length > 0 && this.tasklist.some((task) => task.status === "pending"),
	);
	inProgressTask = $derived<Task | null>(
		this.tasklist.find((task) => task.status === "in_progress") ?? null,
	);
	canStart = $derived(
		this.taskboardStatus === "idle" && this.tasklist.some((t) => t.status === "pending"),
	);
	canPause = $derived(this.taskboardStatus === "running");
	isWaitingToStop = $derived(this.taskboardStatus === "waiting_to_stop");

	buttonText = $derived.by(() => {
		return match(this.taskboardStatus)
			.with("running", () => m.taskboard_button_pause())
			.with("waiting_to_stop", () => m.taskboard_button_waiting_to_stop())
			.with("idle", () => {
				if (this.tasklist.some((t) => t.status === "in_progress")) {
					return m.taskboard_button_resume();
				}
				return m.taskboard_button_run();
			})
			.exhaustive();
	});

	toggleTaskboardRunningStatus() {
		this.isTaskboardRunning = !this.isTaskboardRunning;
	}

	// ==================== Input Methods ====================

	/**
	 * Adds a new task from the current input value and attachments.
	 */
	addTaskFromInput() {
		if (this.inputValue.trim() || this.attachments.length > 0) {
			if (this.inputValue.trim()) {
				const newTask: Task = {
					id: nanoid(),
					content: this.inputValue.trim(),
					status: "pending",
				};
				const updatedTasklist = [...this.tasklist, newTask];
				this.updateTasklist(updatedTasklist);
			}
			this.inputValue = "";
			this.attachments = [];
		}
	}

	/**
	 * Adds an attachment to the list.
	 */
	addAttachment(attachment: AttachmentFile) {
		this.attachments = [...this.attachments, attachment];
	}

	/**
	 * Updates an attachment by id.
	 */
	updateAttachment(id: string, updates: Partial<AttachmentFile>) {
		this.attachments = this.attachments.map((a) => (a.id === id ? { ...a, ...updates } : a));
	}

	/**
	 * Removes an attachment by id.
	 */
	removeAttachment(id: string) {
		this.attachments = this.attachments.filter((a) => a.id !== id);
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
					.with(true, () => this.tasklist)
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
	 * Starts the auto execution of tasks.
	 */
	async startAutoExecution(): Promise<void> {
		match(this.taskboardStatus)
			.with("running", () => {
				this.taskboardStatus = "waiting_to_stop";
			})
			.with("waiting_to_stop", () => {
				this.taskboardStatus = "running";
			})
			.with("idle", () => {
				this.taskboardStatus = "running";
				this.#executeLoop();
			});
	}

	/**
	 * Executes the task loop.
	 */
	async #executeLoop(): Promise<void> {
		while (this.taskboardStatus === "running") {
			const nextTask = this.tasklist.find(
				(t) => t.status === "in_progress" || t.status === "pending",
			);

			if (!nextTask) {
				this.taskboardStatus = "idle";
				break;
			}

			await this.#executeTask(nextTask);

			// Check if we need to pause (status may have been modified externally during await)
			if (this.taskboardStatus !== "running") {
				if (this.taskboardStatus === "waiting_to_stop") {
					this.taskboardStatus = "idle";
				}
				break;
			}
		}
	}

	/**
	 * Executes a single task.
	 */
	async #executeTask(task: Task): Promise<void> {
		this.currentExecutingTaskId = task.id;
		this.#currentRetryCount = 0;

		if (task.status === "pending") {
			await this.#updateTaskStatus(task.id, "in_progress");
		}

		const off = emitter.on(EventNames.CHAT_FINISHED, this.#handleChatFinished);

		try {
			while (this.#currentRetryCount < this.#MAX_RETRY_COUNT) {
				const message = this.#currentRetryCount === 0 ? task.content : m.text_continue();
				chatState.inputValue = message;
				await chatState.sendMessage();

				const success = await this.#waitForChatFinished();

				if (success) {
					await this.#updateTaskStatus(task.id, "done");
					return;
				}

				this.#currentRetryCount++;
				console.log(`[TaskBoard] Task retry ${this.#currentRetryCount}/${this.#MAX_RETRY_COUNT}`);
			}

			console.error(`[TaskBoard] Task failed after ${this.#MAX_RETRY_COUNT} retries`);
			this.taskboardStatus = "idle";
		} finally {
			off();
			this.currentExecutingTaskId = null;
			this.#taskResolve = null;
		}
	}

	#waitForChatFinished(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			this.#taskResolve = resolve;
		});
	}

	/**
	 * Handles the chat finished event.
	 */
	#handleChatFinished = ({ lastMessage }: { lastMessage: { metadata?: MessageMetadata } }) => {
		if (!this.#taskResolve) return;

		const result = lastMessage.metadata?.result;
		const success = !!result && result.is_error === false;

		this.#taskResolve(success);
	};

	/**
	 * Updates the status of a single task.
	 */
	async #updateTaskStatus(taskId: string, status: Task["status"]): Promise<void> {
		const updatedList = this.tasklist.map((t) => (t.id === taskId ? { ...t, status } : t));

		updatedList.sort((a, b) => {
			const isDoneA = a.status === "done";
			const isDoneB = b.status === "done";

			if (isDoneA === isDoneB) return 0;
			return isDoneA ? 1 : -1;
		});

		await this.updateTasklist(updatedList);
	}
}

export const codeAgentTaskboardState = new CodeAgentTaskboardState();
