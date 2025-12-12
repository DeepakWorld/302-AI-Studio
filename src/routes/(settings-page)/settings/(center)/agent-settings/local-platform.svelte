<script lang="ts">
	import NoSupportIcon from "$lib/assets/icons/code-agent/not-support.svg";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { m } from "$lib/paraglide/messages";
</script>

<!-- Local Platform Empty State -->
<Empty.Root class="justify-start pt-8">
	<Empty.Content class="flex flex-col gap-0 items-center">
		<img src={NoSupportIcon} alt="Not supported" />
		<Empty.Description>
			{m.unsupport()}
		</Empty.Description>
	</Empty.Content>
</Empty.Root>
