<script lang="ts">
	import Label from "$lib/components/ui/label/label.svelte";
	import { Switch } from "$lib/components/ui/switch";

	interface Props {
		label: string;
		id?: string;
		checked?: boolean;
		onCheckedChange?: (checked: boolean) => void;
	}

	let {
		label,
		id = crypto.randomUUID(),
		checked = $bindable(false),
		onCheckedChange,
	}: Props = $props();

	function handleCheckedChange(newChecked: boolean) {
		checked = newChecked;
		onCheckedChange?.(newChecked);
	}
</script>

<div
	class="h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y flex w-full items-center justify-between"
>
	<Label for={id} class="text-sm font-normal">{label}</Label>
	<Switch
		{id}
		class="data-[state=unchecked]:border-settings-switch-border cursor-pointer"
		{checked}
		onCheckedChange={handleCheckedChange}
	/>
</div>
