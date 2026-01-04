<script lang="ts">
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { cn } from "$lib/utils";

	interface Props {
		checked: boolean;
		preview: string;
		roleLabel: string;
		onCheckedChange: () => void;
	}

	let { checked, preview, roleLabel, onCheckedChange }: Props = $props();
</script>

<label
	class={cn(
		"flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 mb-1 last:mb-0",
		checked && "bg-[#F7F7F7] dark:bg-muted rounded-[10px]",
	)}
>
	<div class="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
		<Checkbox {checked} {onCheckedChange} class="shrink-0" />
		<span class="truncate text-sm">{preview}</span>
	</div>
	<span class="text-sm text-muted-foreground shrink-0 ml-4">{roleLabel}</span>
</label>
