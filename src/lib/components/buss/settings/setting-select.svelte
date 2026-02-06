<script lang="ts" module>
	export interface SelectOption {
		label: string;
		value: string;
		key?: string;
		extra?: string;
	}

	export interface GroupedSelectOption {
		groupKey: string;
		groupLabel: string;
		items: SelectOption[];
	}

	export interface GroupedSelectData {
		standalone?: SelectOption[];
		groups: GroupedSelectOption[];
	}

	interface Props {
		name: string;
		value: string;
		options?: SelectOption[];
		groupedOptions?: GroupedSelectData;
		placeholder?: string;
		class?: string;
		contentClass?: string;
		disabled?: boolean;
		onValueChange?: (value: string) => void;
	}
</script>

<script lang="ts">
	import * as Empty from "$lib/components/ui/empty/index.js";

	import * as Select from "$lib/components/ui/select/index.js";
	import { m } from "$lib/paraglide/messages";
	import { cn } from "$lib/utils";

	let {
		name,
		value = $bindable(),
		options,
		groupedOptions,
		placeholder,
		class: className,
		contentClass,
		disabled,
		onValueChange,
	}: Props = $props();

	// Compute all options for label lookup
	const allOptions = $derived.by(() => {
		if (groupedOptions) {
			const standalone = groupedOptions.standalone || [];
			const grouped = groupedOptions.groups.flatMap((g) => g.items);
			return [...standalone, ...grouped];
		}
		return options || [];
	});

	// Check if we have any options
	const hasOptions = $derived.by(() => {
		if (groupedOptions) {
			const standaloneCount = groupedOptions.standalone?.length || 0;
			const groupedCount = groupedOptions.groups.reduce((acc, g) => acc + g.items.length, 0);
			return standaloneCount + groupedCount > 0;
		}
		return (options?.length || 0) > 0;
	});

	function getLabel(val: string) {
		return allOptions.find((option) => option.value === val)?.label || val;
	}

	function formatExtra(extra?: string): string {
		return extra || "";
	}
</script>

<Select.Root type="single" {name} bind:value {onValueChange} {disabled}>
	<Select.Trigger
		class={cn(
			"!bg-settings-item-bg dark:!bg-settings-item-bg data-[size=default]:h-settings-item w-full min-w-0",
			className,
		)}
		{disabled}
		title={value ? getLabel(value) : placeholder}
	>
		<span class="truncate min-w-0" title={value ? getLabel(value) : placeholder}>
			{placeholder && !value ? placeholder : getLabel(value)}
		</span>
	</Select.Trigger>
	<Select.Content class={contentClass}>
		{#if !hasOptions}
			<Empty.Root>
				<Empty.Content>
					<Empty.Description>
						{m.select_no_options()}
					</Empty.Description>
				</Empty.Content>
			</Empty.Root>
		{:else if groupedOptions}
			<!-- Standalone items (e.g., "New Session") -->
			{#if groupedOptions.standalone}
				{#each groupedOptions.standalone as option (option.key || option.value)}
					{@render selectItem(option)}
				{/each}
			{/if}
			<!-- Grouped items -->
			{#each groupedOptions.groups as group (group.groupKey)}
				{#if group.items.length > 0}
					<Select.Group>
						<Select.GroupHeading>{group.groupLabel}</Select.GroupHeading>
						{#each group.items as option (option.key || option.value)}
							{@render selectItem(option)}
						{/each}
					</Select.Group>
				{/if}
			{/each}
		{:else if options}
			{#each options as option (option.key || option.value)}
				{@render selectItem(option)}
			{/each}
		{/if}
	</Select.Content>
</Select.Root>

{#snippet selectItem(option: SelectOption)}
	{#if option.extra}
		{@const extraText = formatExtra(option.extra)}
		{@const combinedTitle = `${option.label} (${extraText})`}
		<Select.Item value={option.value} label={option.label} title={combinedTitle}>
			<span class="flex w-full items-center justify-between min-w-0 gap-2">
				<span class="truncate flex-1 basis-1/2 min-w-0 text-left" title={combinedTitle}>
					{option.label}
				</span>
				<span
					class="truncate basis-1/2 min-w-0 text-right text-xs text-muted-foreground shrink-0"
					title={combinedTitle}
				>
					{extraText}
				</span>
			</span>
		</Select.Item>
	{:else}
		<Select.Item value={option.value} label={option.label} title={option.label}>
			<span class="truncate" title={option.label}>{option.label}</span>
		</Select.Item>
	{/if}
{/snippet}
