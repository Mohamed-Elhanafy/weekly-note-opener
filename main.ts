import { App, Plugin, PluginSettingTab, Setting, TFile, TFolder, Notice, moment, FuzzySuggestModal, TextComponent } from 'obsidian';

interface WeeklyNoteOpenerSettings {
	folder: string;
	dateFormat: string;
}

const DEFAULT_SETTINGS: WeeklyNoteOpenerSettings = {
	folder: '2 - areas/journals/weekly',
	dateFormat: 'YYYY-[W]ww'
}

// Folder suggestion modal
class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	private folders: TFolder[];
	private onChoose: (folder: TFolder) => void;

	constructor(app: App, onChoose: (folder: TFolder) => void) {
		super(app);
		this.onChoose = onChoose;
		this.folders = this.getAllFolders();
		this.setPlaceholder('Search for a folder...');
	}

	private getAllFolders(): TFolder[] {
		const folders: TFolder[] = [];
		const rootFolder = this.app.vault.getRoot();

		const collectFolders = (folder: TFolder) => {
			folders.push(folder);
			for (const child of folder.children) {
				if (child instanceof TFolder) {
					collectFolders(child);
				}
			}
		};

		collectFolders(rootFolder);
		return folders;
	}

	getItems(): TFolder[] {
		return this.folders;
	}

	getItemText(folder: TFolder): string {
		return folder.path || '/';
	}

	onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(folder);
	}
}

export default class WeeklyNoteOpener extends Plugin {
	settings: WeeklyNoteOpenerSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon('calendar-days', 'Open Weekly Note', (evt: MouseEvent) => {
			this.openWeeklyNote();
		});

		this.addCommand({
			id: 'open-weekly-note',
			name: 'Open Weekly Note',
			callback: () => {
				this.openWeeklyNote();
			}
		});

		this.addSettingTab(new WeeklyNoteOpenerSettingTab(this.app, this));
	}

	async openWeeklyNote() {
		const date = moment();
		const weekString = date.format(this.settings.dateFormat);
		const folderPath = this.settings.folder.replace(/\/$/, ''); // Remove trailing slash
		const filePath = `${folderPath}/${weekString}.md`;

		let file = this.app.vault.getAbstractFileByPath(filePath);

		if (!file) {
			// Check if folder exists
			const folder = this.app.vault.getAbstractFileByPath(folderPath);
			if (!folder) {
				try {
					await this.app.vault.createFolder(folderPath);
				} catch (e) {
					new Notice(`Failed to create folder: ${folderPath}`);
					return;
				}
			}

			// Create file
			try {
				file = await this.app.vault.create(filePath, `# ${weekString}

`);
				new Notice(`Created weekly note: ${weekString}`);
			} catch (e) {
				new Notice(`Failed to create file: ${filePath}`);
				console.error(e);
				return;
			}
		}

		if (file instanceof TFile) {
			await this.app.workspace.getLeaf(false).openFile(file);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class WeeklyNoteOpenerSettingTab extends PluginSettingTab {
	plugin: WeeklyNoteOpener;

	constructor(app: App, plugin: WeeklyNoteOpener) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: 'Weekly Note Opener Settings' });

		let folderTextComponent: TextComponent;

		new Setting(containerEl)
			.setName('Weekly Notes Folder')
			.setDesc('Path to the folder where weekly notes are stored.')
			.addText(text => {
				folderTextComponent = text;
				text
					.setPlaceholder('Example: 2 - areas/journals/weekly')
					.setValue(this.plugin.settings.folder)
					.onChange(async (value) => {
						this.plugin.settings.folder = value;
						await this.plugin.saveSettings();
					});
			})
			.addButton(button => button
				.setButtonText('Browse')
				.onClick(() => {
					new FolderSuggestModal(this.app, (folder) => {
						const folderPath = folder.path || '/';
						this.plugin.settings.folder = folderPath;
						folderTextComponent.setValue(folderPath);
						this.plugin.saveSettings();
					}).open();
				}));

		new Setting(containerEl)
			.setName('Date Format')
			.setDesc('Moment.js format for the weekly note filename.')
			.addText(text => text
				.setPlaceholder('Example: YYYY-[W]ww')
				.setValue(this.plugin.settings.dateFormat)
				.onChange(async (value) => {
					this.plugin.settings.dateFormat = value;
					await this.plugin.saveSettings();
				}));
	}
}

