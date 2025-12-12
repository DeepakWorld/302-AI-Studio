/**
 * Constants for agent-preview module
 */

export const DEFAULT_WORKSPACE_PATH = "/home/user/workspace";

export const TAB_PREVIEW = "preview";
export const TAB_CODE = "code";
export const TAB_TERMINAL = "terminal";

export type TabType = typeof TAB_PREVIEW | typeof TAB_CODE | typeof TAB_TERMINAL;

export const DEVICE_MODE_DESKTOP = "desktop";
export const DEVICE_MODE_MOBILE = "mobile";

export type DeviceMode = typeof DEVICE_MODE_DESKTOP | typeof DEVICE_MODE_MOBILE;
