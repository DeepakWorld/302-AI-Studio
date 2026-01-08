<script lang="ts">
	import Badge from "$lib/components/ui/badge/badge.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import Switch from "$lib/components/ui/switch/switch.svelte";
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
		onForceUseToggle?: (skill: Skill, forceUse: boolean) => void;
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
		onForceUseToggle,
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

	function handleForceUseChange(checked: boolean) {
		onForceUseToggle?.(skill, checked);
	}
</script>

<button
	type="button"
	class="group relative flex h-full w-full cursor-pointer flex-col rounded-xl border border-border p-5 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
	onclick={handleCardClick}
>
	<!-- Header: Icon + Info + Menu -->
	<div class="mb-4 flex items-start gap-3">
		<!-- Icon Container -->
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
		>
			<Zap class="h-5 w-5" />
		</div>
		<!-- Info Section -->
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<div class="flex items-center justify-between gap-2">
				<h3 class="truncate font-semibold leading-tight text-foreground" title={skill.name}>
					{skill.name}
				</h3>
				<!-- Menu Button -->
				{#if showMenu}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="shrink-0" onclick={(e) => e.stopPropagation()}>
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								<Button
									variant="ghost"
									size="icon-sm"
									class="h-7 w-7 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
								>
									<Ellipsis class="h-4 w-4" />
								</Button>
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end" class="w-32">
								{#if onEdit}
									<DropdownMenu.Item onclick={() => onEdit(skill)}>
										{m.text_button_edit()}
									</DropdownMenu.Item>
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
			{#if isBuiltin}
				<Badge variant="secondary" class="w-fit px-1.5 py-0.5 text-[10px] font-medium">
					{m.skills_builtin()}
				</Badge>
			{/if}
		</div>
	</div>

	<!-- Body: Description -->
	<div class="mb-4 flex-1">
		<p class="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
			{skill.description}
		</p>
	</div>

	<!-- Footer: Status + Action -->
	<div class="flex items-center justify-between pt-3">
		<!-- Left: Status Indicator -->
		<div class="text-xs font-medium">
			{#if isUsed}
				<span class="flex items-center gap-1.5 text-primary">
					<span class="h-1.5 w-1.5 rounded-full bg-primary"></span>
					{m.text_label_model_enabled()}
				</span>
			{/if}
		</div>

		<!-- Right: Actions -->
		<div class="flex items-center gap-2">
			{#if isUsed}
				<!-- Force Use Toggle -->
				{#if onForceUseToggle}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="flex items-center gap-2" onclick={(e) => e.stopPropagation()}>
						<span class="text-xs text-muted-foreground">{m.skills_force_use()}</span>
						<Switch
							checked={skill.forceUse ?? false}
							onCheckedChange={handleForceUseChange}
							class="border-border"
						/>
					</div>
				{/if}
				{#if onRemove}
					<Button
						variant="ghost"
						size="sm"
						class="h-8 px-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
						onclick={handleRemoveClick}
					>
						{m.skills_remove()}
					</Button>
				{/if}
			{:else if onUse}
				<Button size="sm" class="h-8 px-4" onclick={handleUseClick}>
					{m.skills_use()}
				</Button>
			{/if}
		</div>
	</div>
</button>
