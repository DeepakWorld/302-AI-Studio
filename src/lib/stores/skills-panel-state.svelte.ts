/**
 * Skills Panel State Management
 *
 * 使用视图堆栈管理 Skills 面板内的导航状态
 * Skills 面板现在集成在 AgentPreviewPanel 的 Skills tab 中
 */

// 视图类型定义
export type SkillView =
	| { type: "list" }
	| { type: "detail"; skillName: string }
	| { type: "preview"; skillName: string } // 预览 skill 完整内容（只读）
	| { type: "edit"; skillName: string }
	| { type: "create-select" } // 选择创建方式
	| { type: "create-manual" }
	| { type: "create-upload" }
	| { type: "create-github" }
	| { type: "create-history" };

class SkillsPanelState {
	// 视图堆栈
	viewStack = $state<SkillView[]>([{ type: "list" }]);

	// 当前视图
	get currentView(): SkillView {
		return this.viewStack[this.viewStack.length - 1] ?? { type: "list" };
	}

	// 是否可以返回
	get canGoBack(): boolean {
		return this.viewStack.length > 1;
	}

	// 获取当前视图的标题 key
	get currentTitleKey(): string {
		switch (this.currentView.type) {
			case "list":
				return "title_skills_management";
			case "detail":
				return "skills_detail_title";
			case "preview":
				return "skills_preview_title";
			case "edit":
				return "text_button_edit";
			case "create-select":
				return "skills_create_title";
			case "create-manual":
				return "skills_create_manual";
			case "create-upload":
				return "skills_create_upload";
			case "create-github":
				return "skills_create_github";
			case "create-history":
				return "skills_create_history";
			default:
				return "title_skills_management";
		}
	}

	// 导航到新视图（压栈）
	push(view: SkillView) {
		this.viewStack = [...this.viewStack, view];
	}

	// 返回上一层（出栈）
	pop() {
		if (this.viewStack.length > 1) {
			this.viewStack = this.viewStack.slice(0, -1);
		}
	}

	// 跳转到指定层级（用于面包屑导航）
	goToLevel(index: number) {
		if (index >= 0 && index < this.viewStack.length) {
			this.viewStack = this.viewStack.slice(0, index + 1);
		}
	}

	// 替换当前视图
	replace(view: SkillView) {
		if (this.viewStack.length > 0) {
			this.viewStack = [...this.viewStack.slice(0, -1), view];
		} else {
			this.viewStack = [view];
		}
	}

	// 重置到列表视图
	reset() {
		this.viewStack = [{ type: "list" }];
	}

	// 导航到详情
	goToDetail(skillName: string) {
		this.push({ type: "detail", skillName });
	}

	// 导航到预览（只读查看完整内容）
	goToPreview(skillName: string) {
		this.push({ type: "preview", skillName });
	}

	// 导航到编辑
	goToEdit(skillName: string) {
		this.push({ type: "edit", skillName });
	}

	// 导航到创建选择
	goToCreateSelect() {
		this.push({ type: "create-select" });
	}

	// 导航到具体创建方式
	goToCreateMethod(method: "manual" | "upload" | "github" | "history") {
		const viewType = `create-${method}` as
			| "create-manual"
			| "create-upload"
			| "create-github"
			| "create-history";
		this.push({ type: viewType });
	}
}

export const skillsPanelState = new SkillsPanelState();
