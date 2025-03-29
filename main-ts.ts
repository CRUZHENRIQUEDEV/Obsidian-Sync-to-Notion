import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import NotionSyncService from './notion/notionSyncService';
import { scanVault } from './utils/vaultScanner';
import { NotionSyncSettings, DEFAULT_SETTINGS } from './settings/pluginSettings';
import SettingsTab from './settings/settingsTab';

export default class NotionSyncPlugin extends Plugin {
	settings: NotionSyncSettings;
	notionSyncService: NotionSyncService;

	async onload() {
		await this.loadSettings();
		
		// Inicializa o serviço Notion quando as configurações estiverem carregadas
		if (this.settings.notionToken && this.settings.rootPageId) {
			this.notionSyncService = new NotionSyncService(
				this.settings.notionToken,
				this.settings.rootPageId
			);
		}

		// Adiciona o comando para sincronizar com o Notion
		this.addCommand({
			id: 'sync-to-notion',
			name: 'Sincronizar com Notion',
			callback: async () => {
				if (!this.settings.notionToken || !this.settings.rootPageId) {
					new Notice('Por favor, configure o token da API do Notion e o ID da página raiz nas configurações do plugin.');
					return;
				}

				try {
					new Notice('Iniciando sincronização com o Notion...');
					
					// Escaneia o vault para pegar todos os arquivos markdown
					const files = await scanVault(this.app.vault);
					
					// Sincroniza os arquivos com o Notion
					await this.notionSyncService.syncFilesToNotion(files, this.app.vault);
					
					new Notice('Sincronização com o Notion concluída com sucesso!');
				} catch (error) {
					console.error('Erro durante a sincronização:', error);
					new Notice(`Erro durante a sincronização: ${error.message}`);
				}
			}
		});

		// Adiciona a aba de configurações
		this.addSettingTab(new SettingsTab(this.app, this));
	}

	onunload() {
		// Limpeza ao desativar o plugin
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// Reinicializa o serviço Notion quando as configurações mudarem
		if (this.settings.notionToken && this.settings.rootPageId) {
			this.notionSyncService = new NotionSyncService(
				this.settings.notionToken,
				this.settings.rootPageId
			);
		}
	}
}