<script lang="ts" module>
	export interface SelectOption {
		label: string;
		value: string;
		key?: string;
		extra?: string;
	}

	interface Props {
		name: string;
		value: string;
		options: SelectOption[];
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
	import { formatDateTimeShort } from "$lib/utils/date-format";

	let {
		name,
		value = $bindable(),
		options,
		placeholder,
		class: className,
		contentClass,
		disabled,
		onValueChange,
	}: Props = $props();

	function getLabel(val: string) {
		return options.find((option) => option.value === val)?.label || val;
	}

	function formatExtra(extra?: string): string {
		if (!extra) return "";
		return formatDateTimeShort(extra) || extra;
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
		{#if options.length === 0}
			<Empty.Root>
				<Empty.Content>
					<Empty.Description>
						{m.select_no_options()}
					</Empty.Description>
				</Empty.Content>
			</Empty.Root>
		{:else}
			{#each options as option (option.key || option.value)}
				{#if option.extra}
					<Select.Item value={option.value} label={option.label} title={option.label}>
						<span class="flex w-full items-center justify-between min-w-0">
							<span class="truncate" title={option.label}>{option.label}</span>
							<span class="ml-2 text-xs text-muted-foreground shrink-0"
								>{formatExtra(option.extra)}</span
							>
						</span>
					</Select.Item>
				{:else}
					<Select.Item value={option.value} label={option.label} title={option.label}>
						<span class="truncate" title={option.label}>{option.label}</span>
					</Select.Item>
				{/if}
			{/each}
		{/if}
	</Select.Content>
</Select.Root>
