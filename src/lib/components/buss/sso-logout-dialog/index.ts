import SsoLogoutDialog from "./sso-logout-dialog.svelte";

export interface SsoLogoutOptions {
	unlinkApiKey: boolean;
	clearSessions: boolean;
	clearMcpServers: boolean;
}

export { SsoLogoutDialog };
