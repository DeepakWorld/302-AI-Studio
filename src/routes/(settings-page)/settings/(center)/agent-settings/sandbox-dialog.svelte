<script lang="ts">
	import { updateSessionNote } from "$lib/api/sandbox-session";
	import { validate302Provider } from "$lib/api/webserve-deploy";
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { m } from "$lib/paraglide/messages";
	import {
		claudeCodeSandboxState,
		persistedClaudeCodeSandboxState,
	} from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { formatDateTimeFull } from "$lib/utils/date-format";
	import { Loader2 } from "@lucide/svelte";
	import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";
	import { toast } from "svelte-sonner";
	import SandboxDeleteConfirmDialog from "./sandbox-delete-confirm-dialog.svelte";
	import SessionDeleteConfirmDialog from "./session-delete-confirm-dialog.svelte";
	import SessionRemarkDialog from "./session-remark-dialog.svelte";
	interface Props {
		open?: boolean;
		sandbox?: ClaudeCodeSandboxInfo | null;
		onDelete?: () => void;
		onClose?: () => void;
	}

	type SessionType = {
		sessionId: string;
		workspacePath: string;
		note?: string;
		usedAt?: string;
	};

	let {
		open = $bindable(false),
		sandbox = null,
		onDelete = () => {},
		onClose = () => {},
	}: Props = $props();

	let isLoading = $state(false);
	let isDeleteDialogOpen = $state(false);
	let isSessionRemarkDialogOpen = $state(false);
	let isSessionDeleteDialogOpen = $state(false);
	let targetSession = $state<SessionType | null>(null);

	// Get the latest sessions from the persisted state
	const sessions = $derived.by(() => {
		if (!sandbox) return [];
		const currentSandbox = persistedClaudeCodeSandboxState.current.find(
			(s) => s.sandboxId === sandbox.sandboxId,
		);
		return currentSandbox?.sessionInfos || [];
	});

	// Refresh sessions when dialog opens
	$effect(() => {
		if (open && sandbox) {
			(async () => {
				isLoading = true;
				try {
					await claudeCodeSandboxState.refreshSessions(sandbox.sandboxId);
				} finally {
					isLoading = false;
				}
			})();
		}
	});

	// Reset dialog states when main dialog closes
	$effect(() => {
		if (!open) {
			isDeleteDialogOpen = false;
			isSessionRemarkDialogOpen = false;
			isSessionDeleteDialogOpen = false;
			targetSession = null;
		}
	});

	function formatTime(session: { usedAt?: string }) {
		return formatDateTimeFull(session.usedAt);
	}

	function handleModifySessionRemark(session: SessionType) {
		targetSession = session;
		isSessionRemarkDialogOpen = true;
	}

	function handleDeleteSession(session: SessionType) {
		targetSession = session;
		isSessionDeleteDialogOpen = true;
	}

	async function handleConfirmSessionRename(newRemark: string) {
		if (!sandbox || !targetSession) return;

		const providerResult = validate302Provider(persistedProviderState.current);
		if (!providerResult.valid || !providerResult.provider) {
			toast.error("No 302.AI provider available");
			return;
		}

		const result = await updateSessionNote(providerResult.provider, {
			sandbox_id: sandbox.sandboxId,
			session_id: targetSession.sessionId,
			note: newRemark,
		});

		if (result.success) {
			toast.success("Update session remark success");
			// Refresh sessions
			await claudeCodeSandboxState.refreshSessions(sandbox.sandboxId);
		} else {
			toast.error(result.error || "Update session remark failed");
		}
	}

	async function handleConfirmSessionDelete() {
		if (!sandbox || !targetSession) return;
		// The actual deletion is handled by the dialog component
		isSessionDeleteDialogOpen = false;
		// Refresh is handled in the deleteSession method
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="min-w-[568px] rounded-2xl p-6">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-lg font-semibold text-foreground">
				{sandbox?.sandboxRemark || sandbox?.sandboxId || "Sandbox"}
			</h2>
			<p class="text-sm text-muted-foreground">{sandbox?.sandboxId}</p>
		</div>

		<!-- Main View -->
		<div>
			<h3 class="text-base font-medium mb-3 text-foreground">
				{m.label_session_list()}
			</h3>

			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			{:else if sessions.length === 0}
				<Empty.Root>
					<Empty.Content class="h-[120px] flex flex-col items-center justify-center">
						<Empty.Description class="text-muted-foreground">
							{m.no_sessions()}
						</Empty.Description>
					</Empty.Content>
				</Empty.Root>
			{:else}
				<div class="space-y-2 max-h-64 overflow-y-auto">
					{#each sessions as session (session.sessionId)}
						<ContextMenu.Root>
							<ContextMenu.Trigger>
								<div class="flex items-center justify-between p-4 rounded-xl bg-muted/50">
									<div>
										<p class="text-sm font-medium text-foreground">
											{session.note || session.sessionId}
										</p>
										{#if session.note}
											<p class="text-xs text-muted-foreground">{session.sessionId}</p>
										{/if}
									</div>
									<span class="text-sm text-muted-foreground">{formatTime(session)}</span>
								</div>
							</ContextMenu.Trigger>
							<ContextMenu.Content>
								<ContextMenu.Item onclick={() => handleModifySessionRemark(session)}>
									{m.text_button_edit()}
								</ContextMenu.Item>
								<ContextMenu.Item
									class="text-destructive focus:text-destructive"
									onclick={() => handleDeleteSession(session)}
								>
									{m.text_button_delete()}
								</ContextMenu.Item>
							</ContextMenu.Content>
						</ContextMenu.Root>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer Buttons -->
		<div class="flex gap-3 mt-6 justify-between">
			<Button
				variant="ghost"
				class="bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive text-sm"
				onclick={() => (isDeleteDialogOpen = true)}
			>
				{m.label_delete_sandbox()}
			</Button>
			<Button variant="outline" class="text-sm" onclick={() => onClose()}>
				{m.btn_close()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<SandboxDeleteConfirmDialog
	bind:open={isDeleteDialogOpen}
	{sandbox}
	onSuccess={() => {
		onClose();
		onDelete();
	}}
/>

<SessionRemarkDialog
	bind:open={isSessionRemarkDialogOpen}
	sessionId={targetSession?.sessionId || ""}
	remark={targetSession?.note || ""}
	onClose={() => (isSessionRemarkDialogOpen = false)}
	onSave={handleConfirmSessionRename}
/>

<SessionDeleteConfirmDialog
	bind:open={isSessionDeleteDialogOpen}
	sandboxId={sandbox?.sandboxId || ""}
	sessionId={targetSession?.sessionId || ""}
	remark={targetSession?.note || ""}
	onClose={() => (isSessionDeleteDialogOpen = false)}
	onConfirm={handleConfirmSessionDelete}
/>

<style>
</style>
