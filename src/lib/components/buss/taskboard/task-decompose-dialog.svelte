<script lang="ts">
	import { decomposeTasks } from "$lib/api/task-decomposer";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Label } from "$lib/components/ui/label";
	import { Textarea } from "$lib/components/ui/textarea";
	import * as m from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { persistedModelState, persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { sessionState } from "$lib/stores/session-state.svelte";
	import { cn } from "$lib/utils.js";
	import { ListOrdered, Loader } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import CompactNumberInput from "./compact-number-input.svelte";

	interface Props {
		open?: boolean;
		initialRequirement?: string;
		onDecompose?: (tasks: string[]) => void;
		onClose?: () => void;
	}

	let { open = $bindable(false), initialRequirement, onDecompose, onClose }: Props = $props();

	// Local editing state
	let requirement = $state("");
	let taskCount = $state(3);
	let isDecomposing = $state(false);

	// Reset state when dialog opens
	$effect(() => {
		if (open) {
			requirement = initialRequirement || "";
			taskCount = 3;
		}
	});

	function getCurrentModel() {
		// Priority 1: Current chat's selected model
		const currentModel = chatState.selectedModel;
		if (currentModel) return currentModel;

		// Priority 2: Vibe mode default model
		const vibeModel = preferencesSettings.vibeNewSessionModel;
		if (vibeModel) return vibeModel;

		// Priority 3: Chat mode default model
		const newSessionModel = preferencesSettings.newSessionModel;
		if (newSessionModel) return newSessionModel;

		// Priority 4: Latest used model
		const latestUsedModel = sessionState.latestUsedModel;
		if (latestUsedModel) return latestUsedModel;

		// Fallback to first available model
		const models = persistedModelState.current;
		return models.length > 0 ? models[0] : null;
	}

	function getProviderForModel(modelId: string) {
		const model = persistedModelState.current.find((m) => m.id === modelId);
		if (!model) return undefined;
		return persistedProviderState.current.find((p) => p.id === model.providerId);
	}

	async function handleDecompose() {
		if (!requirement.trim()) {
			toast.error(m.taskboard_auto_decompose_empty_input());
			return;
		}

		if (!taskCount || taskCount < 1) {
			taskCount = 3;
		}

		const model = getCurrentModel();
		if (!model) {
			toast.error(m.toast_no_model());
			return;
		}

		const provider = getProviderForModel(model.id);

		isDecomposing = true;
		try {
			const tasks = await decomposeTasks(requirement.trim(), taskCount, model, provider);

			if (tasks.length > 0) {
				toast.success(m.taskboard_auto_decompose_success({ count: tasks.length.toString() }));
				onDecompose?.(tasks);
				open = false;
			} else {
				toast.error(m.taskboard_auto_decompose_error());
			}
		} catch (error) {
			console.error("Failed to decompose tasks:", error);
			toast.error(m.taskboard_auto_decompose_error());
		} finally {
			isDecomposing = false;
		}
	}

	function handleClose() {
		if (isDecomposing) return;
		onClose?.();
		open = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.isComposing) return;

		// Cmd/Ctrl+Enter to decompose
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleDecompose();
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="min-w-[500px] max-w-[600px] overflow-hidden ">
		<Dialog.Header>
			<Dialog.Title>{m.taskboard_auto_decompose_title()}</Dialog.Title>
			<Dialog.Description>{m.taskboard_auto_decompose_description()}</Dialog.Description>
		</Dialog.Header>

		<div class="flex flex-col gap-4 py-4 w-full overflow-hidden px-1">
			<!-- Requirement input -->
			<div class="flex flex-col gap-2">
				<div
					class={cn(
						"flex flex-col rounded-xl border p-3 pb-0",
						"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
						"bg-input",
					)}
				>
					<Textarea
						class={cn(
							"w-full min-h-[120px] max-h-[250px] resize-none p-0",
							"border-none shadow-none focus-within:ring-0 focus-within:outline-hidden focus-visible:ring-0",
						)}
						placeholder={m.taskboard_auto_decompose_input_placeholder()}
						bind:value={requirement}
						onkeydown={handleKeydown}
					/>
					<div class="h-3"></div>
				</div>
			</div>

			<!-- Task count input -->
			<div class="flex items-center gap-4">
				<Label class="whitespace-nowrap">
					{m.taskboard_auto_decompose_count_label()}
				</Label>
				<CompactNumberInput
					bind:count={taskCount}
					defaultCount={3}
					Icon={ListOrdered}
					tooltip={m.taskboard_auto_decompose_count_label()}
				/>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleClose} disabled={isDecomposing}>
				{m.text_button_cancel()}
			</Button>
			<Button
				variant="default"
				onclick={handleDecompose}
				disabled={isDecomposing || !requirement.trim()}
			>
				{#if isDecomposing}
					<Loader class="h-4 w-4 animate-spin mr-2" />
				{/if}
				{m.taskboard_auto_decompose_button()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
