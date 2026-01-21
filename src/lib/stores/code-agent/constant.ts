import type { Skill } from "@shared/types";

export const BUILTIN_SKILLS: Skill[] = [
	{
		name: "algorithmic-art",
		description:
			"Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this when users request creating art using code, generative art, algorithmic art, flow fields, or particle systems. Create original algorithmic art rather than copying existing artists' work to avoid copyright violations.",
		description_zh:
			"使用 p5.js 和种子随机性以及交互式参数探索来创建算法艺术。当用户请求使用代码、生成艺术、算法艺术、流场或粒子系统来创作艺术时使用此项。创作原创算法艺术，避免抄袭现有艺术家的作品，以避免版权侵权。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "brand-guidelines",
		description:
			"Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having Anthropic's look-and-feel. Use it when brand colors or style guidelines, visual formatting, or company design standards apply.",
		description_zh:
			"应用 Anthropic 的官方品牌色彩和字体，适用于任何可能受益于 Anthropic 外观风格的产物。当品牌色彩或风格指南、视觉格式或公司设计标准适用时使用。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "canvas-design",
		description:
			"Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when the user asks to create a poster, piece of art, design, or other static piece. Create original visual designs, never copying existing artists' work to avoid copyright violations.",
		description_zh:
			"使用设计理念，在 .png 和 .pdf 文档中创建精美的视觉艺术。当用户要求创建海报、艺术品、设计或其他静态作品时，您应该运用此技能。创作原创视觉设计，切勿模仿现有艺术家的作品，以避免版权侵权。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "doc-coauthoring",
		description:
			"Guide users through a structured workflow for co-authoring documentation. Use when user wants to write documentation, proposals, technical specs, decision docs, or similar structured content. This workflow helps users efficiently transfer context, refine content through iteration, and verify the doc works for readers. Trigger when user mentions writing docs, creating proposals, drafting specs, or similar documentation tasks.",
		description_zh:
			"指导用户完成协作编写文档的结构化工作流。当用户希望编写文档、提案、技术规范、决策文档或类似的结构化内容时使用。此工作流可帮助用户有效传递上下文、通过迭代改进内容并验证文档是否适用于读者。当用户提到编写文档、创建提案、起草规范或类似的文档任务时触发。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "docx",
		description:
			"Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction. When Claude needs to work with professional documents (.docx files) for: (1) Creating new documents, (2) Modifying or editing content, (3) Working with tracked changes, (4) Adding comments, or any other document tasks",
		description_zh:
			"全面的文档创建、编辑和分析，支持修订跟踪、批注、格式保留和文本提取。当 Claude 需要处理专业文档（.docx 文件）时，可以用于：(1) 创建新文档，(2) 修改或编辑内容，(3) 处理修订跟踪，(4) 添加批注，或任何其他文档任务。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "frontend-design",
		description:
			"Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.",
		description_zh:
			"创建具有高设计质量的独特、生产级的 àå前端界面。当用户要求构建 àå Web 组件、页面、àå 制品、àå 海报或 àå 应用程序（示例包括 àå 网站、àå 登陆页、àå 仪表板、àå React 组件、àå HTML/CSS 布局，或在 àå 样式化/美化任何 àå Web UI 时）时，àå 使用此 àå 技能。àå 生成 àå 富有创意、àå 精致的代码和 àå UI àå 设计，àå 避免 àå 通用的 àå AI àå 美学。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "internal-comms",
		description:
			"A set of resources to help me write all kinds of internal communications, using the formats that my company likes to use. Claude should use this skill whenever asked to write some sort of internal communications (status reports, leadership updates, 3P updates, company newsletters, FAQs, incident reports, project updates, etc.).",
		description_zh:
			"一套资源，帮助我撰写各种内部沟通内容，使用我公司偏好的格式。Claude 应该在被要求撰写任何内部沟通内容时（状态报告、领导层更新、第三方更新、公司通讯、常见问题解答、事件报告、项目更新等）使用此技能。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "mcp-builder",
		description:
			"Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with external services through well-designed tools. Use when building MCP servers to integrate external APIs or services, whether in Python (FastMCP) or Node/TypeScript (MCP SDK).",
		description_zh:
			"用于创建高质量 MCP（模型上下文协议）服务器的指南，该服务器通过精心设计的工具使 LLM 能够与外部服务进行交互。在构建 MCP 服务器以集成外部 API 或服务时使用，无论是使用 Python (FastMCP) 还是 Node/TypeScript (MCP SDK)。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "pdf",
		description:
			"Comprehensive PDF manipulation toolkit for extracting text and tables, creating new PDFs, merging/splitting documents, and handling forms. When Claude needs to fill in a PDF form or programmatically process, generate, or analyze PDF documents at scale.",
		description_zh:
			"用于提取文本和表格、创建新 PDF、合并/拆分文档以及处理表单的综合 PDF 操作工具包。适用于 Claude 需要填写 PDF 表单或以编程方式大规模处理、生成或分析 PDF 文档的情况。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "pptx",
		description:
			"Presentation creation, editing, and analysis. When Claude needs to work with presentations (.pptx files) for: (1) Creating new presentations, (2) Modifying or editing content, (3) Working with layouts, (4) Adding comments or speaker notes, or any other presentation tasks",
		description_zh:
			"演示文稿创建、编辑和分析。当 Claude 需要处理演示文稿（.pptx 文件）时，用于：(1) 创建新演示文稿，(2) 修改或编辑内容，(3) 处理布局，(4) 添加评论或演讲者备注，或任何其他演示文稿任务",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "skill-creator",
		description:
			"Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations.",
		description_zh:
			"创建有效技能的指南。当用户想要创建新技能（或更新现有技能）以通过专业知识、工作流或工具集成来扩展 Claude 的功能时，应使用此技能。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "slack-gif-creator",
		description:
			'Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools, and animation concepts. Use when users request animated GIFs for Slack like "make me a GIF of X doing Y for Slack."',
		description_zh:
			"用于创建针对 Slack 优化的 GIF 动画的知识和实用程序。提供约束、验证工具和动画概念。当用户请求类似“为我制作一个 X 做 Y 的 GIF 用于 Slack”的 GIF 动画时使用。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "template-skill",
		description: "Replace with description of the skill and when Claude should use it.",
		description_zh: "替换为技能的描述以及 Claude 何时应使用该技能。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "theme-factory",
		description:
			"Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing pages, etc. There are 10 pre-set themes with colors/fonts that you can apply to any artifact that has been creating, or can generate a new theme on-the-fly.",
		description_zh:
			"用于通过主题为构件添加样式的工具包。这些构件可以是幻灯片、文档、报告、HTML 登陆页等。有 10 种预设主题（包含颜色/字体），您可以将其应用于已创建的任何构件，或者即时生成新主题。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "web-artifacts-builder",
		description:
			"Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web technologies (React, Tailwind CSS, shadcn/ui). Use for complex artifacts requiring state management, routing, or shadcn/ui components - not for simple single-file HTML/JSX artifacts.",
		description_zh:
			"用于使用现代前端 Web 技术（React、Tailwind CSS、shadcn/ui）创建复杂、多组件 claude.ai HTML 工件的工具集。适用于需要状态管理、路由或 shadcn/ui 组件的复杂工件，不适用于简单的单文件 HTML/JSX 工件。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "webapp-testing",
		description:
			"Toolkit for interacting with and testing local web applications using Playwright. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and viewing browser logs.",
		description_zh:
			"用于使用 Playwright 与本地 Web 应用程序交互和测试的工具包。支持验证前端功能、调试 UI 行为、捕获浏览器屏幕截图和查看浏览器日志。",
		isBuiltin: true,
		forceUse: false,
	},
	{
		name: "xlsx",
		description:
			"Comprehensive spreadsheet creation, editing, and analysis with support for formulas, formatting, data analysis, and visualization. When Claude needs to work with spreadsheets (.xlsx, .xlsm, .csv, .tsv, etc) for: (1) Creating new spreadsheets with formulas and formatting, (2) Reading or analyzing data, (3) Modify existing spreadsheets while preserving formulas, (4) Data analysis and visualization in spreadsheets, or (5) Recalculating formulas",
		description_zh:
			"全面的电子表格创建、编辑和分析，支持公式、格式、数据分析和可视化。当 Claude 需要处理电子表格（.xlsx, .xlsm, .csv, .tsv 等）时，用于：（1）创建带有公式和格式的新电子表格，（2）读取或分析数据，（3）修改现有电子表格同时保留公式，（4）电子表格中的数据分析和可视化，或（5）重新计算公式。",
		isBuiltin: true,
		forceUse: false,
	},
] as const;
