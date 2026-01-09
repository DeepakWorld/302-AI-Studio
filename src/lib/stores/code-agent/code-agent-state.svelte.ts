import type { ListSkillsResponse } from "$lib/api/skills/base-apis";
import { emitter, EventNames } from "$lib/event/emitter";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { chatState } from "$lib/stores/chat-state.svelte";
import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
import type { ChatMessage } from "$lib/types/chat";
import type { Model } from "@302ai/studio-plugin-sdk";
import {
	CodeAgentConfigMetadata,
	type CodeAgentCfgs,
	type CodeAgentSandboxStatus,
	type CodeAgentType,
	type Skill,
	type ThinkingBudgetType,
} from "@shared/storage/code-agent";
import { match } from "ts-pattern";
import { claudeCodeSandboxState } from "./claude-code-sandbox-state.svelte";
import { claudeCodeAgentState, type ClaudeCodeSandboxInfo } from "./claude-code-state.svelte";
import { withLoadingState } from "./utils";

const tab = window.tab ?? null;

const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

const INITIAL_CODE_AGENT_CONFIG: CodeAgentConfigMetadata = {
	enabled: false,
	threadId: threadId,
	type: "remote",
	currentAgentId: "claude-code",
	isDeleted: false,
};

export const persistedCodeAgentConfigState = new PersistedState<CodeAgentConfigMetadata>(
	"CodeAgentStorage:code-agent-config-state" + "-" + threadId,
	INITIAL_CODE_AGENT_CONFIG,
);

const { updateClaudeCodeSandboxModel } = window.electronAPI.codeAgentService;

class CodeAgentState {
	isCodeAgentPanelOpen = $state(false);
	isSkillsPanelOpen = $state(false);
	isLoadingSkills = $state(false);
	isUpdatingSandboxRemark = $state(false);
	isUpdatingSessionRemark = $state(false);

	enabled = $derived.by(() => persistedCodeAgentConfigState.current?.enabled ?? false);
	type = $derived.by(() => persistedCodeAgentConfigState.current?.type ?? "remote");
	currentAgentId = $derived.by(
		() => persistedCodeAgentConfigState.current?.currentAgentId ?? "claude-code",
	);
	isDeleted = $derived.by(() => persistedCodeAgentConfigState.current?.isDeleted ?? false);

	isFreshTab = $derived(!chatState.hasMessages);
	inCodeAgentMode = $derived(!this.isFreshTab && this.enabled);

	sandboxStatus = $derived.by<CodeAgentSandboxStatus>(() => {
		return match(this.currentAgentId)
			.with("claude-code", () =>
				claudeCodeAgentState.sandboxId === "" ? "waiting-for-sandbox" : "sandbox-created",
			)
			.otherwise(() => "waiting-for-sandbox");
	});

	handleChatFinished = (event: { canDeploy: boolean; lastMessage: ChatMessage }) => {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.handleChatFinished(event);
		}
	};

	handleThreadTitleUpdated = (event: { title: string }) => {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.handleThreadTitleUpdated(event);
		}
	};

	private updateState(partial: Partial<CodeAgentConfigMetadata>): void {
		persistedCodeAgentConfigState.current = {
			...(persistedCodeAgentConfigState.current ?? INITIAL_CODE_AGENT_CONFIG),
			...partial,
		};
	}

	updateCurrentAgentId(agentId: string): void {
		this.updateState({ currentAgentId: agentId });
	}

	updateType(type: CodeAgentType): void {
		this.updateState({ type });
	}

	updateEnabled(enabled: boolean): void {
		this.updateState({ enabled });
	}

	getCodeAgentCfgs(): CodeAgentCfgs {
		return match(this.currentAgentId)
			.with("claude-code", () => ({
				baseUrl: claudeCodeAgentState.baseUrl,
				model: claudeCodeAgentState.sandboxId,
			}))
			.otherwise(() => ({ baseUrl: "", model: "" }));
	}

	async executeCodeAgentMode(): Promise<{ isOK: boolean; sandboxInfo?: ClaudeCodeSandboxInfo }> {
		if (this.currentAgentId === "claude-code") {
			return claudeCodeAgentState.handleAgentModeExecute();
		}
		return { isOK: false };
	}

	updateCurrentSessionId(sessionId: string): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.updateCurrentSessionId(sessionId);
		}
	}

	get codeAgentCfgs(): CodeAgentCfgs {
		return match(this.currentAgentId)
			.with("claude-code", () => ({
				baseUrl: claudeCodeAgentState.baseUrl,
				model: claudeCodeAgentState.sandboxId,
			}))
			.otherwise(() => ({ baseUrl: "", model: "" }));
	}

	get currentSessionId(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.currentSessionId)
			.otherwise(() => "");
	}

	get sandboxId(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.sandboxId)
			.otherwise(() => "");
	}

	get sessionId(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.currentSessionId)
			.otherwise(() => "");
	}

	get currentModel(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.model)
			.otherwise(() => "");
	}

	get skills(): Skill[] {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.skills)
			.otherwise(() => []);
	}

	get thinkingBudget(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.thinkingBudget)
			.otherwise(() => "off");
	}

	get isUpdatingThinkingBudget(): boolean {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.isUpdatingThinkingBudget)
			.otherwise(() => false);
	}

	async getSkillList(isInit: boolean): Promise<ListSkillsResponse> {
		return withLoadingState(
			(loading) => (this.isLoadingSkills = loading),
			() =>
				match(this.currentAgentId)
					.with("claude-code", () => claudeCodeAgentState.listClaudeCodeSkills(isInit))
					.otherwise(() => ({
						success: false,
						user_skills: [],
						builtin_skills: [],
						project_skills: [],
					})),
		);
	}

	async handleCodeAgentModelChange(model: Model): Promise<boolean> {
		if (this.currentAgentId === "claude-code") {
			const { isOK } = await updateClaudeCodeSandboxModel(threadId, this.sandboxId, model.id);
			return isOK;
		}

		return false;
	}

	updateSandboxModel(model: string): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.updateSandboxModel(model);
		}
	}

	updateThinkingBudget(thinkingBudget: ThinkingBudgetType): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.updateThinkingBudget(thinkingBudget);
		}
	}

	handleSkillsUse(skills: Skill[]): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.handleSkillUse(skills);
		}
	}

	handleSkillsRemove(skills: Skill[]): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.handleSkillRemove(skills);
		}
	}

	async updateSandboxRemark(remark: string): Promise<boolean> {
		return withLoadingState(
			(loading) => (this.isUpdatingSandboxRemark = loading),
			() =>
				match(this.currentAgentId)
					.with("claude-code", () =>
						claudeCodeSandboxState.updateSandboxRemark(claudeCodeAgentState.sandboxId, remark),
					)
					.otherwise(() => false),
		);
	}

	async updateSessionRemark(remark: string): Promise<boolean> {
		return withLoadingState(
			(loading) => (this.isUpdatingSessionRemark = loading),
			async () => {
				const isOK = await match(this.currentAgentId)
					.with("claude-code", () => claudeCodeAgentState.updateSessionRemark(remark))
					.otherwise(() => false);

				if (isOK) {
					chatState.title = remark;
					await tabBarState.updateTabTitle(chatState.id, remark);
					await window.electronAPI.broadcastService.broadcastToAll("thread-list-updated", {
						threadId: chatState.id,
					});
				}

				return isOK;
			},
		);
	}

	handleSkillForceUseToggle(skillName: string, forceUse: boolean): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.handleSkillForceUseToggle(skillName, forceUse);
		}
	}
}

export const codeAgentState = new CodeAgentState();

$effect.root(() => {
	$effect(() => {
		if (codeAgentState.enabled) {
			const offChat = emitter.on(EventNames.CHAT_FINISHED, codeAgentState.handleChatFinished);
			const offTitle = emitter.on(
				EventNames.THREAD_TITLE_UPDATED,
				codeAgentState.handleThreadTitleUpdated,
			);

			return () => {
				offChat();
				offTitle();
			};
		}
	});
});
