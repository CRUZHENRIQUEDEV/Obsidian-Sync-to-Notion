export interface NotionSyncSettings {
	notionToken: string;
	rootPageId: string;
	syncOnSave: boolean;
	excludeFolders: string[];
	lastSyncTimestamp: number;
}

export const DEFAULT_SETTINGS: NotionSyncSettings = {
	notionToken: '',
	rootPageId: '',
	syncOnSave: false,
	excludeFolders: [],
	lastSyncTimestamp: 0
}