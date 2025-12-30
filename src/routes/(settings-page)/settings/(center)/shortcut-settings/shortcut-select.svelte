<script lang="ts">
	import * as Select from "$lib/components/ui/select/index.js";
	import { formatShortcutLabel, isMac } from "$lib/shortcut/shortcut-config";
	import { cn } from "$lib/utils";

	interface Props {
		value?: string[];
		onValueChange: (keys: string[]) => void;
		className?: string;
		disabled?: boolean;
	}

	let { value = $bindable([]), onValueChange, className, disabled = false }: Props = $props();

	const cmdKey = isMac ? "Cmd" : "Ctrl";

	const options = [
		{ id: "enter", keys: ["Enter"] },
		{ id: "cmd_enter", keys: [cmdKey, "Enter"] },
	];

	const isSameKeys = (a: string[], b: string[]) => {
		if (a.length !== b.length) return false;
		const sA = [...a].sort().join("|");
		const sB = [...b].sort().join("|");
		return sA === sB;
	};

	let selectedId = $derived.by(() => {
		const found = options.find((opt) => isSameKeys(opt.keys, value));
		return found ? found.id : "";
	});

	const displayLabel = $derived(formatShortcutLabel(value));

	const handleSelectChange = (newId: string) => {
		const opt = options.find((o) => o.id === newId);
		if (opt) {
			onValueChange(opt.keys);
		}
	};
</script>

<div class={cn("relative", className)}>
	<Select.Root type="single" value={selectedId} onValueChange={handleSelectChange} {disabled}>
		<Select.Trigger
			class="!bg-settings-sidebar-bg !h-settings-item text-setting-fg px-settings-item-x py-settings-item-y rounded-[10px] inset-ring-transparent transition-none hover:inset-ring-transparent w-full"
		>
			<span class="truncate">{displayLabel}</span>
		</Select.Trigger>
		<Select.Content>
			{#each options as option (option.id)}
				<Select.Item value={option.id} label={formatShortcutLabel(option.keys)}>
					{formatShortcutLabel(option.keys)}
				</Select.Item>
			{/each}
		</Select.Content>
	</Select.Root>
</div>
