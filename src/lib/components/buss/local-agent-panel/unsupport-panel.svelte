<script lang="ts">
	import NoSupportIcon from "$lib/assets/icons/code-agent/not-support.svg";
	import * as Empty from "$lib/components/ui/empty";
	import { m } from "$lib/paraglide/messages";
</script>

<Empty.Root>
	<Empty.Content class="h-[200px] flex flex-col gap-4 items-center justify-center">
		<img src={NoSupportIcon} alt="Not supported" />
		<Empty.Description>
			{m.unsupport()}
		</Empty.Description>
	</Empty.Content>
</Empty.Root>
