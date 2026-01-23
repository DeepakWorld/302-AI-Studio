// ! This service is only used within the renderer process
import type { ChatMessage } from "$lib/types/chat";
import mitt from "mitt";

export enum EventNames {
	CHAT_FINISHED = "chat:finish",
	TASKBOARD_ALL_TASKS_DONE = "taskboard:all_tasks_done",

	THREAD_TITLE_UPDATED = "thread:title:updated",
}

type Events = {
	[EventNames.CHAT_FINISHED]: {
		canDeploy: boolean;
		lastMessage: ChatMessage;
	};

	[EventNames.TASKBOARD_ALL_TASKS_DONE]: {
		sandboxId: string;
		sessionId: string;
		taskCount: number;
	};

	[EventNames.THREAD_TITLE_UPDATED]: {
		title: string;
	};
};

const mittInstance = mitt<Events>();

export const emitter = {
	...mittInstance,
	on<Key extends keyof Events>(type: Key, handler: (event: Events[Key]) => void): () => void {
		mittInstance.on(type, handler);
		return () => mittInstance.off(type, handler);
	},
	_mittInstance: mittInstance,
};
