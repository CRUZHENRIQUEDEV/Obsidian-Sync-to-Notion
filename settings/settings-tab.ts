import { App, PluginSettingTab, Setting } from 'obsidian';
import NotionSyncPlugin from '../main';

export default class SettingsTab extends PluginSettingTab {
	plugin: NotionSyncPlugin;

	constructor(app: App, plugin: NotionSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Configurações de Sincronização com o Notion' });

		new Setting(containerEl)
			.setName('Token da API do Notion')
			.setDesc('Token de integração do Notion. Obtenha em https://www.notion.so/my-integrations')
			.addText(text => text
				.setPlaceholder('Secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
				.setValue(this.plugin.settings.notionToken)
				.onChange(async (value) => {
					this.plugin.settings.notionToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('ID da Página Raiz')
			.setDesc('ID da página do Notion onde a estrutura será sincronizada (formato: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)')
			.addText(text => text
				.setPlaceholder('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
				.setValue(this.plugin.settings.rootPageId)
				.onChange(async (value) => {
					this.plugin.settings.rootPageId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sincronizar ao salvar')
			.setDesc('Sincroniza automaticamente as notas com o Notion quando elas são salvas')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncOnSave)
				.onChange(async (value) => {
					this.plugin.settings.syncOnSave = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Pastas excluídas')
			.setDesc('Lista de pastas para excluir da sincronização (separadas por vírgula)')
			.addText(text => text
				.setPlaceholder('pasta1, pasta2/subpasta')
				.setValue(this.plugin.settings.excludeFolders.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.excludeFolders = value.split(',').map(folder => folder.trim()).filter(folder => folder);
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Ajuda e Informações' });
		
		const infoDiv = containerEl.createEl('div', { cls: 'setting-item-info' });
		infoDiv.createEl('p', { text: 'Para utilizar este plugin:' });
		
		const ul = infoDiv.createEl('ul');
		ul.createEl('li', { text: '1. Crie uma integração no Notion e obtenha o token de API.' });
		ul.createEl('li', { text: '2. Compartilhe uma página do Notion com sua integração (na interface do Notion).' });
		ul.createEl('li', { text: '3. Obtenha o ID da página compartilhada da URL.' });
		ul.createEl('li', { text: '4. Configure as opções acima e use o comando "Sincronizar com Notion".' });
		
		const lastSyncDiv = containerEl.createEl('div', { cls: 'setting-item' });
		if (this.plugin.settings.lastSyncTimestamp) {
			const date = new Date(this.plugin.settings.lastSyncTimestamp);
			lastSyncDiv.createEl('p', { text: `Última sincronização: ${date.toLocaleString()}` });
		} else {
			lastSyncDiv.createEl('p', { text: 'Nenhuma sincronização realizada ainda.' });
		}
	}
}