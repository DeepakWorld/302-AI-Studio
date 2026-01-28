import { AiApplicationService, aiApplicationService } from "./ai-application-service";
import { AppService, appService } from "./app-service";
import { AttachmentsService, attachmentsService } from "./attachments-sevice";
import { BroadcastService, broadcastService } from "./broadcast-service";
import { CodeAgentService, codeAgentService } from "./code-agent-service";
import { DataService, dataService } from "./data-service";
import { DeepLinkService, deepLinkService } from "./deep-link-service";
import { EnvService, envService } from "./env-service";
import { ExternalLinkService, externalLinkService } from "./external-link-service";
import { GhostWindowService, ghostWindowService } from "./ghost-window-service";
import { McpService, mcpService } from "./mcp-service";
import { NotificationService, notificationService } from "./notification-service";
import { PluginService, pluginService } from "./plugin-service";
import { providerService, ProviderService } from "./provider-service";
import { RegistryService, registryService } from "./registry-service";
import { SchedulerService, schedulerService } from "./scheduler-service";
import { GeneralSettingsService, generalSettingsService } from "./settings-service";
import { ShortcutService, shortcutService } from "./shortcut-service";
import { SsoService, ssoService } from "./sso-service";
import { StorageService, storageService } from "./storage-service";
import { TabService, tabService } from "./tab-service";
import { ThreadService, threadService } from "./thread-service";
import { TrayService, trayService } from "./tray-service";
import { UpdaterService, updaterService } from "./updater-service";
import { WindowService, windowService } from "./window-service";

// Export service classes for type definitions
export {
	AiApplicationService,
	AppService,
	AttachmentsService,
	BroadcastService,
	CodeAgentService,
	DataService,
	DeepLinkService,
	EnvService,
	ExternalLinkService,
	GeneralSettingsService,
	GhostWindowService,
	McpService,
	NotificationService,
	PluginService,
	ProviderService,
	RegistryService,
	SchedulerService,
	ShortcutService,
	SsoService,
	StorageService,
	TabService,
	ThreadService,
	TrayService,
	UpdaterService,
	WindowService,
};

// Export service instances for use in IPC registration
export {
	aiApplicationService,
	appService,
	attachmentsService,
	broadcastService,
	codeAgentService,
	dataService,
	deepLinkService,
	envService,
	externalLinkService,
	generalSettingsService,
	ghostWindowService,
	mcpService,
	notificationService,
	pluginService,
	providerService,
	registryService,
	schedulerService,
	shortcutService,
	ssoService,
	storageService,
	tabService,
	threadService,
	trayService,
	updaterService,
	windowService,
};
