import { App, PluginSettingTab, Setting } from 'obsidian';
import NotionSyncPlugin from '../main';
import { DEFAULT_SETTINGS } from './plugin-settings';

export default class SettingsTab extends PluginSettingTab {
	plugin: NotionSyncPlugin;

	constructor(app: App, plugin: NotionSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Notion Sync Settings' });

		new Setting(containerEl)
			.setName('Notion API Token')
			.setDesc('Notion integration token. Get it at https://www.notion.so/my-integrations')
			.addText(text => text
				.setPlaceholder('Secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
				.setValue(this.plugin.settings.notionToken)
				.onChange(async (value) => {
					this.plugin.settings.notionToken = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Root Page ID')
			.setDesc('ID of the Notion page where structure will be synced (format: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)')
			.addText(text => text
				.setPlaceholder('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
				.setValue(this.plugin.settings.rootPageId)
				.onChange(async (value) => {
					this.plugin.settings.rootPageId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sync on save')
			.setDesc('Automatically sync notes with Notion when they are saved')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncOnSave)
				.onChange(async (value) => {
					this.plugin.settings.syncOnSave = value;
					await this.plugin.saveSettings();
				}));

		// Configuração para o intervalo de sincronização automática
		const autoSyncSetting = new Setting(containerEl)
			.setName("Auto Sync Interval")
			.setDesc("Set interval in minutes for automatic synchronization (0 to disable)")
			.addSlider(slider => 
				slider
					.setLimits(0, 120, 5)
					.setValue(this.plugin.settings.autoSyncInterval)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.autoSyncInterval = value;
						await this.plugin.saveSettings();
						
						// Reinicia o temporizador se estiver ativo
						this.plugin.restartAutoSyncTimer();
						
						// Mostra o valor atual
						sliderValue.setText(value === 0 ? "Disabled" : `${value} minutes`);
					})
			)
			.addExtraButton(button => 
				button
					.setIcon("reset")
					.setTooltip("Reset to default")
					.onClick(async () => {
						this.plugin.settings.autoSyncInterval = DEFAULT_SETTINGS.autoSyncInterval;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		const sliderValue = containerEl.createEl("span");
		sliderValue.setText(
			this.plugin.settings.autoSyncInterval === 0 
				? "Disabled" 
				: `${this.plugin.settings.autoSyncInterval} minutes`
		);

		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc('List of folders to exclude from syncing (comma separated)')
			.addText(text => text
				.setPlaceholder('folder1, folder2/subfolder')
				.setValue(this.plugin.settings.excludeFolders.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.excludeFolders = value.split(',').map(folder => folder.trim()).filter(folder => folder);
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Help & Information' });
		
		const infoDiv = containerEl.createEl('div', { cls: 'setting-item-info' });
		infoDiv.createEl('p', { text: 'To use this plugin:' });
		
		const ul = infoDiv.createEl('ul');
		ul.createEl('li', { text: '1. Create a Notion integration and get the API token.' });
		ul.createEl('li', { text: '2. Share a Notion page with your integration (in the Notion interface).' });
		ul.createEl('li', { text: '3. Get the ID of the shared page from the URL.' });
		ul.createEl('li', { text: '4. Configure the options above and use the "Sync to Notion" command.' });
		
		const lastSyncDiv = containerEl.createEl('div', { cls: 'setting-item' });
		if (this.plugin.settings.lastSyncTimestamp) {
			const date = new Date(this.plugin.settings.lastSyncTimestamp);
			lastSyncDiv.createEl('p', { text: `Last sync: ${date.toLocaleString()}` });
		} else {
			lastSyncDiv.createEl('p', { text: 'No sync performed yet.' });
		}
	}
}