<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState, type SkillView } from "$lib/stores/skills-panel-state.svelte";
	import { ChevronRight, Pin, X } from "@lucide/svelte";

	interface Props {
		currentView: SkillView;
		viewStack: SkillView[];
		canGoBack: boolean;
		isPinned: boolean;
		onBack: () => void;
		onClose: () => void;
		onTogglePin: () => void;
		// 用于编辑视图显示 skill 名称
		skillName?: string;
		// 控制是否显示 Pin 和 Close 按钮（在集成到预览面板时隐藏）
		showPinButton?: boolean;
		showCloseButton?: boolean;
	}

	let {
		currentView,
		viewStack,
		canGoBack,
		isPinned,
		onBack,
		onClose,
		onTogglePin,
		skillName = "",
		showPinButton = true,
		showCloseButton = true,
	}: Props = $props();

	// 获取视图的标题（用于面包屑显示）
	function getViewTitle(view: SkillView): string {
		switch (view.type) {
			case "list":
				return "Skills";
			case "detail":
				return view.skillName;
			case "preview":
				return m.label_tab_preview();
			case "edit":
				return m.text_button_edit();
			case "create-select":
				return m.skills_create_title();
			case "create-manual":
				return m.skills_create_manual();
			case "create-upload":
				return m.skills_create_upload();
			case "create-github":
				return m.skills_create_github();
			case "create-history":
				return m.skills_create_history();
			default:
				return "Skills";
		}
	}

	// 处理面包屑点击
	function handleBreadcrumbClick(index: number) {
		skillsPanelState.goToLevel(index);
	}
</script>

<div class="flex h-10 items-center justify-between border-b px-4">
	<!-- 左侧：面包屑导航 -->
	<div class="flex h-8 min-w-0 flex-1 items-center overflow-hidden">
		<nav class="flex items-center gap-1 text-sm">
			{#each viewStack as view, index (index)}
				{#if index > 0}
					<ChevronRight class="h-3 w-3 shrink-0 text-muted-foreground" />
				{/if}
				{#if index === viewStack.length - 1}
					<!-- 当前页面：不可点击 -->
					<span class="truncate font-medium text-foreground">
						{getViewTitle(view)}
					</span>
				{:else}
					<!-- 可点击的面包屑项 -->
					<button
						type="button"
						class="truncate text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
						onclick={() => handleBreadcrumbClick(index)}
					>
						{getViewTitle(view)}
					</button>
				{/if}
			{/each}
		</nav>
	</div>

	<!-- 右侧：Pin 和关闭按钮 -->
	<div class="flex h-8 shrink-0 items-center gap-1">
		{#if showPinButton}
			<Button
				variant="ghost"
				size="icon"
				class="h-8 w-8 {isPinned ? 'text-primary' : ''}"
				onclick={onTogglePin}
				title={isPinned ? "Unpin" : "Pin"}
			>
				<Pin class="h-4 w-4 {isPinned ? 'fill-current' : ''}" />
			</Button>
		{/if}
		{#if showCloseButton}
			<Button variant="ghost" size="icon" class="h-8 w-8" onclick={onClose}>
				<X class="h-4 w-4" />
			</Button>
		{/if}
	</div>
</div>
