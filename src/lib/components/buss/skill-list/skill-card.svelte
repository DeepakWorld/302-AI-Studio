<script lang="ts">
	import Badge from "$lib/components/ui/badge/badge.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { m } from "$lib/paraglide/messages";
	import { Ellipsis, Loader2, Zap } from "@lucide/svelte";
	import type { Skill } from "@shared/types";

	interface Props {
		skill: Skill;
		isBuiltin: boolean;
		isUsed?: boolean;
		downloading?: boolean;
		onSelect?: (skill: Skill) => void;
		onUse?: (skill: Skill) => void;
		onRemove?: (skill: Skill) => void;
		onEdit?: (skill: Skill) => void;
		onDownload?: (skill: Skill) => void;
		onDelete?: (skill: Skill) => void;
	}

	const {
		skill,
		isBuiltin,
		isUsed = false,
		downloading = false,
		onSelect,
		onUse,
		onRemove,
		onEdit,
		onDownload,
		onDelete,
	}: Props = $props();

	// Built-in skills can only edit and download, user skills can also delete
	const canDelete = $derived(!isBuiltin && !!onDelete);
	const showMenu = $derived(!!onEdit || !!onDownload || canDelete);

	function handleCardClick() {
		onSelect?.(skill);
	}

	function handleUseClick(e: MouseEvent) {
		e.stopPropagation();
		onUse?.(skill);
	}

	function handleRemoveClick(e: MouseEvent) {
		e.stopPropagation();
		onRemove?.(skill);
	}
</script>

<button
	type="button"
	class="hover:border-primary group relative flex w-full cursor-pointer flex-col gap-3 rounded-lg border p-4 text-left transition-all hover:shadow-md"
	onclick={handleCardClick}
>
	<!-- Header: Icon, Name, Badge -->
	<div class="flex items-center gap-3">
		<!-- Default Icon -->
		<div class="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-lg">
			<Zap class="h-5 w-5" />
		</div>
		<!-- Name and Badge -->
		<div class="flex flex-col gap-1">
			<span class="font-semibold">{skill.name}</span>
			{#if isBuiltin}
				<Badge variant="secondary" class="w-fit text-xs">
					{m.skills_builtin()}
				</Badge>
			{/if}
		</div>
	</div>

	<!-- Description -->
	<p class="text-muted-foreground line-clamp-2 text-sm">
		{skill.description}
	</p>

	<!-- Footer: Use Button + Menu -->
	<div class="mt-auto flex items-center gap-2">
		{#if isUsed}
			{#if onRemove}
				<Button variant="destructive" class="flex-1" onclick={handleRemoveClick}>
					{m.skills_remove()}
				</Button>
			{/if}
		{:else if onUse}
			<Button
				variant="default"
				class="flex-1 bg-violet-500 hover:bg-violet-600"
				onclick={handleUseClick}
			>
				{m.skills_use()}
			</Button>
		{/if}
		<!-- Menu Button -->
		{#if showMenu}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="ml-auto" onclick={(e) => e.stopPropagation()}>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						<Button
							variant="ghost"
							size="icon-sm"
							class="text-muted-foreground hover:text-foreground h-8 w-8"
						>
							<Ellipsis class="h-4 w-4" />
						</Button>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-32">
						{#if onEdit}
							<DropdownMenu.Item onclick={() => onEdit(skill)}
								>{m.text_button_edit()}</DropdownMenu.Item
							>
						{/if}
						{#if onDownload}
							<DropdownMenu.Item
								disabled={downloading}
								onclick={() => onDownload(skill)}
								class={downloading ? "opacity-50" : ""}
							>
								{#if downloading}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								{/if}
								{m.skills_download()}
							</DropdownMenu.Item>
						{/if}
						{#if canDelete}
							<DropdownMenu.Item class="text-destructive" onclick={() => onDelete?.(skill)}>
								{m.text_button_delete()}
							</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		{/if}
	</div>
</button>
