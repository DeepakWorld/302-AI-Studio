<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import { ChevronLeft, FileEdit, Link, MessageSquareText, Package, X } from "@lucide/svelte";
	import type { Component } from "svelte";
	import { toast } from "svelte-sonner";

	export type SkillCreateMethod = "manual" | "upload" | "github" | "history";

	interface CreateOption {
		id: SkillCreateMethod;
		icon: Component;
		titleKey: () => string;
		descKey: () => string;
	}

	interface Props {
		open: boolean;
		onOpenChange?: (open: boolean) => void;
		onCreate?: (method: SkillCreateMethod, data: unknown) => void;
	}

	let { open = $bindable(false), onOpenChange, onCreate }: Props = $props();

	let currentView = $state<"select" | SkillCreateMethod>("select");

	const createOptions: CreateOption[] = [
		{
			id: "manual",
			icon: FileEdit,
			titleKey: () => m.skills_create_manual(),
			descKey: () => m.skills_create_manual_desc(),
		},
		{
			id: "upload",
			icon: Package,
			titleKey: () => m.skills_create_upload(),
			descKey: () => m.skills_create_upload_desc(),
		},
		{
			id: "github",
			icon: Link,
			titleKey: () => m.skills_create_github(),
			descKey: () => m.skills_create_github_desc(),
		},
		{
			id: "history",
			icon: MessageSquareText,
			titleKey: () => m.skills_create_history(),
			descKey: () => m.skills_create_history_desc(),
		},
	];

	const currentOption = $derived(createOptions.find((opt) => opt.id === currentView));

	function resetState() {
		currentView = "select";
	}

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		// Delay reset to allow close animation to complete
		setTimeout(resetState, 150);
	}

	function handleOpenChange(v: boolean) {
		if (!v) {
			// Delay reset to allow close animation to complete
			setTimeout(resetState, 150);
		}
		onOpenChange?.(v);
	}

	function handleSelectOption(optionId: SkillCreateMethod) {
		currentView = optionId;
	}

	function handleBack() {
		currentView = "select";
	}

	function handleConfirmSelect() {
		toast.warning(m.skills_create_select_required());
	}

	function handleConfirmCreate() {
		// TODO: Implement actual creation logic
		onCreate?.(currentView as SkillCreateMethod, {});
		handleClose();
	}
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class=" rounded-2xl p-0 min-w-[600px]" showCloseButton={false}>
		{#if currentView === "select"}
			<!-- Selection View -->
			<div class="flex items-center justify-between border-b px-4 py-3">
				<span class="text-foreground text-base font-semibold">{m.skills_create_title()}</span>
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={handleClose}>
					<X class="h-4 w-4" />
				</Button>
			</div>

			<div class="px-6 py-6">
				<p class="text-muted-foreground mb-4 text-sm">{m.skills_create_select_method()}</p>

				<div class="grid grid-cols-2 gap-4">
					{#each createOptions as option (option.id)}
						<button
							type="button"
							class="flex flex-col items-center gap-2 rounded-xl border bg-transparent p-6 transition-colors hover:border-[#8B5CF6] hover:bg-[#F5F3FF] dark:hover:bg-violet-950/50"
							onclick={() => handleSelectOption(option.id)}
						>
							<div
								class="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl"
							>
								<option.icon class="h-6 w-6" />
							</div>
							<span class="text-foreground text-sm font-semibold">{option.titleKey()}</span>
							<span class="text-muted-foreground text-xs">{option.descKey()}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="flex gap-3 border-t px-6 py-4">
				<Button variant="outline" class="flex-1" onclick={handleClose}>
					{m.text_button_cancel()}
				</Button>
				<Button class="flex-1 bg-violet-500 hover:bg-violet-600" onclick={handleConfirmSelect}>
					{m.text_button_confirm()}
				</Button>
			</div>
		{:else}
			<!-- Secondary View (Placeholder) -->
			<div class="flex items-center justify-between border-b px-4 py-3">
				<Button
					variant="ghost"
					class="text-muted-foreground flex items-center text-center text-[14px]"
					size="sm"
					onclick={handleBack}
				>
					<ChevronLeft class="h-4 w-4" />
					{m.skills_back()}
				</Button>
				<span class="text-foreground text-base font-semibold">{currentOption?.titleKey()}</span>
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={handleClose}>
					<X class="h-4 w-4" />
				</Button>
			</div>

			<div class="flex flex-col items-center justify-center px-6 py-12">
				<div
					class="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
				>
					{#if currentOption}
						<currentOption.icon class="h-8 w-8" />
					{/if}
				</div>
				<p class="text-muted-foreground text-sm">{m.skills_create_coming_soon()}</p>
			</div>

			<div class="flex gap-3 border-t px-6 py-4">
				<Button variant="outline" class="flex-1" onclick={handleClose}>
					{m.text_button_cancel()}
				</Button>
				<Button class="flex-1 bg-violet-500 hover:bg-violet-600" onclick={handleConfirmCreate}>
					{m.text_button_confirm()}
				</Button>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
