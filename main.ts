import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
  } from "obsidian";
  import NotionSyncService from "./notion/notion-sync-service";
  import { scanVault } from "./utils/vault-scanner";
  import {
	NotionSyncSettings,
	DEFAULT_SETTINGS,
  } from "./settings/plugin-settings";
  import SettingsTab from "./settings/settings-tab";
  
  /**
   * Normaliza um ID ou URL do Notion
   */
  function normalizeNotionPageId(input: string): string {
	if (input.includes("notion.so")) {
	  const match = input.match(/([a-f0-9]{32})|([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/);
	  if (match) {
		return match[0].replace(/-/g, "");
	  }
	}
  
	return input.replace(/[^a-f0-9]/gi, "");
  }
  
  export default class NotionSyncPlugin extends Plugin {
	settings: NotionSyncSettings;
	notionSyncService: NotionSyncService;
  
	async onload() {
	  console.log("🟡 Plugin Notion Sync carregando...");
	  await this.loadSettings();
  
	  if (this.settings.notionToken && this.settings.rootPageId) {
		const cleanPageId = normalizeNotionPageId(this.settings.rootPageId);
		this.notionSyncService = new NotionSyncService(
		  this.settings.notionToken,
		  cleanPageId
		);
		console.log("✅ Serviço do Notion inicializado.");
	  } else {
		console.warn("⚠️ Token ou Root Page ID não configurados.");
	  }
  
	  this.addCommand({
		id: "sync-to-notion",
		name: "Sync to Notion",
		callback: async () => {
		  console.log("🚀 Comando 'Sync to Notion' iniciado...");
		  if (!this.settings.notionToken || !this.settings.rootPageId) {
			new Notice(
			  "Please configure the Notion API token and Root Page ID in the plugin settings."
			);
			return;
		  }
  
		  try {
			new Notice("Starting synchronization with Notion...");
  
			const files = await scanVault(
			  this.app.vault,
			  this.settings.excludeFolders
			);
			console.log(`📁 Arquivos encontrados para sync: ${files.length}`);
  
			await this.notionSyncService.syncFilesToNotion(files, this.app.vault);
  
			this.settings.lastSyncTimestamp = Date.now();
			await this.saveSettings();
  
			console.log("✅ Sincronização concluída com sucesso.");
			new Notice("Notion synchronization completed successfully!");
		  } catch (error) {
			console.error("❌ Erro durante sincronização:", error);
			new Notice(`Sync error: ${error.message}`);
		  }
		},
	  });
  
	  this.addSettingTab(new SettingsTab(this.app, this));
  
	  if (this.settings.syncOnSave) {
		console.log("🔁 Auto-sync ativado. Escutando modificações...");
		this.registerEvent(
		  this.app.vault.on("modify", async (file) => {
			if (!(file instanceof TFile) || file.extension !== "md") return;
			if (!this.settings.syncOnSave) return;
			if (!this.settings.notionToken || !this.settings.rootPageId) return;
  
			if (
			  this.settings.excludeFolders.some(
				(folder) =>
				  file.path === folder || file.path.startsWith(folder + "/")
			  )
			) {
			  return;
			}
  
			try {
			  const pathParts = file.path.split("/");
			  const parentPath = pathParts.slice(0, -1).join("/");
  
			  const vaultFile = {
				file: file,
				path: file.path,
				name: file.basename,
				parent: parentPath,
			  };
  
			  console.log(`📌 Auto-sync para o arquivo: ${file.path}`);
			  await this.notionSyncService.syncFilesToNotion(
				[vaultFile],
				this.app.vault
			  );
  
			  new Notice(`File "${file.basename}" synced to Notion`);
			} catch (error) {
			  console.error(`❌ Erro ao sincronizar automaticamente ${file.path}:`, error);
			}
		  })
		);
	  }
	}
  
	onunload() {
	  console.log("🔴 Plugin Notion Sync descarregado.");
	}
  
	async loadSettings() {
	  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	  console.log("⚙️ Configurações carregadas:", this.settings);
	}
  
	async saveSettings() {
	  await this.saveData(this.settings);
  
	  if (this.settings.notionToken && this.settings.rootPageId) {
		const cleanPageId = normalizeNotionPageId(this.settings.rootPageId);
		this.notionSyncService = new NotionSyncService(
		  this.settings.notionToken,
		  cleanPageId
		);
		console.log("✅ Serviço do Notion reinicializado após salvar configs.");
	  }
	}
  }
  