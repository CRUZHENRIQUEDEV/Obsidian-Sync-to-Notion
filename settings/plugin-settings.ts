export interface NotionSyncSettings {
  notionToken: string;
  rootPageId: string;
  syncOnSave: boolean;
  excludeFolders: string[];
  lastSyncTimestamp: number;
  fileTracking: Record<string, { hash: string; lastSync: number }>;
  pageMapping: Record<string, string>; // Caminho no Obsidian -> ID da página no Notion
}

export const DEFAULT_SETTINGS: NotionSyncSettings = {
  notionToken: "",
  rootPageId: "",
  syncOnSave: false,
  excludeFolders: [],
  lastSyncTimestamp: 0,
  fileTracking: {},
  pageMapping: {}, // Inicializar com um objeto vazio
};
