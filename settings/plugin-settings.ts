export interface NotionSyncSettings {
  notionToken: string;
  rootPageId: string;
  syncOnSave: boolean;
  autoSyncInterval: number; // Intervalo em minutos (0 = desativado)
  excludeFolders: string[];
  lastSyncTimestamp: number;
  fileTracking: Record<string, { hash: string; lastSync: number }>;
  pageMapping: Record<string, string>; // Caminho no Obsidian -> ID da página no Notion
}

export const DEFAULT_SETTINGS: NotionSyncSettings = {
  notionToken: "",
  rootPageId: "",
  syncOnSave: false,
  autoSyncInterval: 0, // Desativado por padrão
  excludeFolders: [],
  lastSyncTimestamp: 0,
  fileTracking: {},
  pageMapping: {}, // Inicializar com um objeto vazio
};
