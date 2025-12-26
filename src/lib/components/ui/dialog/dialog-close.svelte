<script lang="ts">
	import { cn } from "$lib/utils";
	import { Dialog as DialogPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: className,
		...restProps
	}: DialogPrimitive.CloseProps = $props();
</script>

<DialogPrimitive.Close
	bind:ref
	data-slot="dialog-close"
	class={cn("cursor-pointer", className)}
	{...restProps}
/>
