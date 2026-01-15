import {
	getTasklist,
	updateTasklist,
	uploadAttachments,
	type Attachment,
} from "$lib/api/taskboard";
import { emitter, EventNames } from "$lib/event/emitter";
import { m } from "$lib/paraglide/messages";
import type { MessageMetadata } from "$lib/types/chat";
import type { AttachmentFile, Task } from "@shared/types";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";
import { match } from "ts-pattern";
import { chatState } from "../chat-state.svelte";
import { claudeCodeSandboxState } from "./claude-code-sandbox-state.svelte";
import { claudeCodeAgentState } from "./claude-code-state.svelte";
import { codeAgentState } from "./code-agent-state.svelte";
import { withLoadingState } from "./utils";

export class CodeAgentTaskboardState {
	#currentRetryCount = 0;
	readonly #MAX_RETRY_COUNT = 3;

	isLoading = $state(false);
	tasklist = $state<Task[]>([]);
	taskboardStatus = $state<"idle" | "running" | "waiting_to_stop">("idle");

	// Input state
	inputValue = $state("");
	attachments = $state<AttachmentFile[]>([]);

	// Pending attachments queue (for when sandbox is not yet initialized)
	pendingAttachments = $state<AttachmentFile[]>([]);

	currentExecutingTaskId = $state<string | null>(null);

	#taskResolve: ((success: boolean) => void) | null = null;

	isInitialized = $derived(
		codeAgentState.enabled && codeAgentState.isFreshTab && claudeCodeAgentState.agentMode === "new",
	);

	inProgressTask = $derived<Task | null>(
		this.tasklist.find((task) => task.status === "in_progress") ?? null,
	);
	canStart = $derived(
		this.taskboardStatus === "idle" && this.tasklist.some((t) => t.status === "pending"),
	);
	canPause = $derived(this.taskboardStatus === "running");
	isWaitingToStop = $derived(this.taskboardStatus === "waiting_to_stop");
	showTaskboardStatusBar = $derived(
		this.tasklist.some((t) => t.status === "in_progress") ||
			this.tasklist.some((t) => t.status === "pending"),
	);

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

	toggleTaskboardRunningStatus() {}

	stopExecution() {
		this.taskboardStatus = "idle";
		if (this.currentExecutingTaskId) {
			this.#updateTaskStatus(this.currentExecutingTaskId, "pending");
		}
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

		// Add reference to input value
		const prefix = this.inputValue.length > 0 && !this.inputValue.endsWith(" ") ? " " : "";
		this.inputValue += `${prefix}@${attachment.name} `;
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
	 * Adds attachments to the pending queue (for when sandbox is not yet initialized).
	 */
	addPendingAttachments(attachments: AttachmentFile[]) {
		this.pendingAttachments = [...this.pendingAttachments, ...attachments];
	}

	/**
	 * Clears the pending attachments queue.
	 */
	clearPendingAttachments() {
		this.pendingAttachments = [];
	}

	/**
	 * Helper function to convert file to base64.
	 */
	#fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				resolve(result);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	/**
	 * Uploads pending attachments after sandbox initialization.
	 */
	async uploadPendingAttachments(sandboxId: string, workspacePath: string): Promise<void> {
		if (this.pendingAttachments.length === 0) return;

		try {
			const attachmentList: Attachment[] = await Promise.all(
				this.pendingAttachments.map(async (att) => ({
					filename: att.name,
					content: att.file ? await this.#fileToBase64(att.file) : "",
				})),
			);

			const result = await uploadAttachments(sandboxId, workspacePath, attachmentList);
			if (!result.isOk) {
				toast.error(m.taskboard_error_attachment_upload_failed());
			}
		} catch (error) {
			console.error("Failed to upload pending attachments:", error);
			toast.error(m.taskboard_error_attachment_upload_failed());
		} finally {
			this.clearPendingAttachments();
		}
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
				await match(this.isInitialized)
					.with(true, () => this.tasklist)
					.otherwise(async () => {
						const [sandboxId, path] = [
							codeAgentState.sandboxId,
							claudeCodeSandboxState.currentSessionWorkspacePath,
						];
						if (path) {
							const tasklist = await getTasklist(sandboxId, path);
							this.tasklist = this.#sortTasks(tasklist.tasks);
						}
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
		const sortedTasklist = this.#sortTasks(tasklist);

		match(this.isInitialized)
			.with(true, () => {
				this.tasklist = sortedTasklist;
			})
			.otherwise(async () => {
				this.tasklist = sortedTasklist;
				const [sandboxId, path] = [
					codeAgentState.sandboxId,
					claudeCodeSandboxState.currentSessionWorkspacePath,
				];
				console.log("Updating tasklist", path);

				const result = await updateTasklist(sandboxId, path, sortedTasklist);
				if (!result.isOk) {
					const { isOk, tasks } = await getTasklist(sandboxId, path);
					this.tasklist = isOk ? this.#sortTasks(tasks) : [];

					toast.error(m.taskboard_update_failed());
				}
			});
	}

	/**
	 * Starts the auto execution of tasks.
	 */
	async startAutoExecution(fn: () => Promise<void>): Promise<void> {
		match(this.taskboardStatus)
			.with("running", () => {
				this.taskboardStatus = "waiting_to_stop";
			})
			.with("waiting_to_stop", () => {
				this.taskboardStatus = "running";
			})
			.with("idle", () => {
				this.taskboardStatus = "running";
				this.#executeLoop(fn);
			});
	}

	/**
	 * Executes the task loop.
	 */
	async #executeLoop(fn: () => Promise<void>): Promise<void> {
		while (this.taskboardStatus === "running") {
			const nextTask = this.tasklist.find(
				(t) => t.status === "in_progress" || t.status === "pending",
			);

			if (!nextTask) {
				this.taskboardStatus = "idle";
				break;
			}

			await this.#executeTask(nextTask, fn);

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
	async #executeTask(task: Task, fn: () => Promise<void>): Promise<void> {
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
				await fn();

				const success = await this.#waitForChatFinished();

				if (this.taskboardStatus !== "running") {
					break;
				}

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
	 * Sorts tasks by status: in_progress -> pending -> done
	 */
	#sortTasks(tasks: Task[]): Task[] {
		return [...tasks].sort((a, b) => {
			const statusOrder = { in_progress: 0, pending: 1, done: 2 };
			const orderA = statusOrder[a.status] ?? 1;
			const orderB = statusOrder[b.status] ?? 1;
			return orderA - orderB;
		});
	}

	/**
	 * Updates the status of a single task.
	 */
	async #updateTaskStatus(taskId: string, status: Task["status"]): Promise<void> {
		const updatedList = this.tasklist.map((t) => (t.id === taskId ? { ...t, status } : t));
		await this.updateTasklist(updatedList);
	}
}

export const codeAgentTaskboardState = new CodeAgentTaskboardState();

$effect.root(() => {
	$effect(() => {
		// Track enabled state
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		codeAgentState.enabled;
		codeAgentTaskboardState.tasklist = [];
	});
});
