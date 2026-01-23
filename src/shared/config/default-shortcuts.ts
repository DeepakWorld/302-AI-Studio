export type ShortcutAction =
	| "sendMessage"
	| "newChat"
	| "clearMessages"
	| "closeCurrentTab"
	| "closeOtherTabs"
	| "deleteCurrentThread"
	| "togglePlanMode"
	| "openSettings"
	| "toggleSidebar"
	| "toggleSidebarRight"
	| "stopGeneration"
	| "newTab"
	| "regenerateResponse"
	| "search"
	| "createBranch"
	| "toggleChatParametersPanel"
	| "restoreLastTab"
	| "screenshot"
	| "nextTab"
	| "previousTab"
	| "toggleModelPanel"
	| "toggleIncognitoMode"
	| "branchAndSend"
	| "switchToTab1"
	| "switchToTab2"
	| "switchToTab3"
	| "switchToTab4"
	| "switchToTab5"
	| "switchToTab6"
	| "switchToTab7"
	| "switchToTab8"
	| "switchToTab9";

export type CreateShortcutData = {
	id: string;
	order: number;
	keys: Set<string>;
	action: ShortcutAction;
	scope: "global" | "app";
	version: number;
};

export const DEFAULT_SHORTCUTS: CreateShortcutData[] = [
	{
		id: "sendMessage",
		order: 1,
		action: "sendMessage",
		keys: new Set(["Enter"]),
		scope: "app",
		version: 1,
	},
	{
		id: "clearMessages",
		order: 2,
		action: "clearMessages",
		keys: new Set(["Cmd", "L"]),
		scope: "app",
		version: 1,
	},
	{
		id: "regenerateResponse",
		order: 4,
		action: "regenerateResponse",
		keys: new Set(["Cmd", "R"]),
		scope: "app",
		version: 1,
	},
	{
		id: "createBranch",
		order: 5,
		action: "createBranch",
		keys: new Set(["Cmd", "Shift", "N"]),
		scope: "app",
		version: 1,
	},
	{
		id: "branchAndSend",
		order: 6,
		action: "branchAndSend",
		keys: new Set(["Cmd", "Shift", "Enter"]),
		scope: "app",
		version: 1,
	},
	{
		id: "search",
		order: 12,
		action: "search",
		keys: new Set(["Cmd", "F"]),
		scope: "app",
		version: 1,
	},
	{
		id: "newTab",
		order: 20,
		action: "newTab",
		keys: new Set(["Cmd", "T"]),
		scope: "app",
		version: 1,
	},
	{
		id: "closeCurrentTab",
		order: 21,
		action: "closeCurrentTab",
		keys: new Set(["Cmd", "W"]),
		scope: "app",
		version: 1,
	},
	{
		id: "closeOtherTabs",
		order: 22,
		action: "closeOtherTabs",
		keys: new Set(["Cmd", "Option", "W"]),
		scope: "app",
		version: 1,
	},
	{
		id: "nextTab",
		order: 25,
		action: "nextTab",
		keys: new Set(["Ctrl", "Tab"]),
		scope: "app",
		version: 1,
	},
	{
		id: "previousTab",
		order: 26,
		action: "previousTab",
		keys: new Set(["Ctrl", "Shift", "Tab"]),
		scope: "app",
		version: 1,
	},
	{
		id: "switchToTab1",
		order: 30,
		action: "switchToTab1",
		keys: new Set(["Cmd", "1"]),
		scope: "app",
		version: 1,
	},
	{
		id: "switchToTab2",
		order: 31,
		action: "switchToTab2",
		keys: new Set(["Cmd", "2"]),
		scope: "app",
		version: 1,
	},
	{
		id: "switchToTab3",
		order: 32,
		action: "switchToTab3",
		keys: new Set(["Cmd", "3"]),
		scope: "app",
		version: 1,
	},
	{
		id: "switchToTab4",
		order: 33,
		action: "switchToTab4",
		keys: new Set(["Cmd", "4"]),
		scope: "app",
		version: 1,
	},
	{
		id: "switchToTab5",
		order: 34,
		action: "switchToTab5",
		keys: new Set(["Cmd", "5"]),
		scope: "app",
		version: 1,
	},
	{
		id: "switchToTab6",
		order: 35,
		action: "switchToTab6",
		keys: new Set(["Cmd", "6"]),
		scope: "app",
		version: 1,
	},
	{
		id: "switchToTab7",
		order: 36,
		action: "switchToTab7",
		keys: new Set(["Cmd", "7"]),
		scope: "app",
		version: 1,
	},
	{
		id: "switchToTab8",
		order: 37,
		action: "switchToTab8",
		keys: new Set(["Cmd", "8"]),
		scope: "app",
		version: 1,
	},
	{
		id: "switchToTab9",
		order: 38,
		action: "switchToTab9",
		keys: new Set(["Cmd", "9"]),
		scope: "app",
		version: 1,
	},
	{
		id: "toggleSidebar",
		order: 40,
		action: "toggleSidebar",
		keys: new Set(["Cmd", "B"]),
		scope: "app",
		version: 1,
	},
	{
		id: "toggleSidebarRight",
		order: 41,
		action: "toggleSidebarRight",
		keys: new Set(["Cmd", "Shift", "B"]),
		scope: "app",
		version: 1,
	},
	{
		id: "toggleModelPanel",
		order: 42,
		action: "toggleModelPanel",
		keys: new Set(["Ctrl", "M"]),
		scope: "app",
		version: 2,
	},
	{
		id: "toggleIncognitoMode",
		order: 43,
		action: "toggleIncognitoMode",
		keys: new Set(["Cmd", "E"]),
		scope: "app",
		version: 1,
	},
	{
		id: "toggleChatParametersPanel",
		order: 44,
		action: "toggleChatParametersPanel",
		keys: new Set(["Cmd", "P"]),
		scope: "app",
		version: 1,
	},
	{
		id: "togglePlanMode",
		order: 45,
		action: "togglePlanMode",
		keys: new Set(["Shift", "Tab"]),
		scope: "app",
		version: 1,
	},
	{
		id: "openSettings",
		order: 50,
		action: "openSettings",
		keys: new Set(["Cmd", ","]),
		scope: "app",
		version: 1,
	},
	{
		id: "stopGeneration",
		order: 51,
		action: "stopGeneration",
		keys: new Set(["Cmd", "D"]),
		scope: "app",
		version: 1,
	},
	{
		id: "deleteCurrentThread",
		order: 52,
		action: "deleteCurrentThread",
		keys: new Set([]),
		scope: "app",
		version: 1,
	},
];
