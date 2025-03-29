import { TFile, TFolder, Vault } from 'obsidian';

export interface VaultFile {
    file: TFile;
    path: string;
    name: string;
    parent: string;
}

/**
 * Escaneia o vault do Obsidian e retorna todos os arquivos markdown
 * organizados com suas informações de caminho
 */
export async function scanVault(vault: Vault, excludeFolders: string[] = []): Promise<VaultFile[]> {
    const files: VaultFile[] = [];
    const markdownFiles = vault.getMarkdownFiles();

    for (const file of markdownFiles) {
        // Verifica se o arquivo está em uma pasta excluída
        if (isInExcludedFolder(file.path, excludeFolders)) {
            continue;
        }

        const pathParts = file.path.split('/');
        const fileName = pathParts.pop() || '';
        const parentPath = pathParts.join('/');

        files.push({
            file,
            path: file.path,
            name: fileName.replace('.md', ''),
            parent: parentPath
        });
    }

    return files;
}

/**
 * Verifica se um caminho está dentro de uma pasta excluída
 */
function isInExcludedFolder(path: string, excludeFolders: string[]): boolean {
    return excludeFolders.some(folder => 
        path === folder || 
        path.startsWith(folder + '/'));
}

/**
 * Gera um mapa de hierarquia com a estrutura de pastas
 */
export function buildFolderHierarchy(files: VaultFile[]): Record<string, string[]> {
    const hierarchy: Record<string, string[]> = {
        '': [] // Raiz
    };
    
    // Primeiro, construímos todas as pastas no mapa
    files.forEach(file => {
        const parts = file.parent.split('/');
        let currentPath = '';
        
        // Cria entrada para cada nível de pasta
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;
            
            const parentPath = parts.slice(0, i).join('/');
            const fullPath = parts.slice(0, i + 1).join('/');
            
            if (!hierarchy[parentPath]) {
                hierarchy[parentPath] = [];
            }
            
            if (!hierarchy[fullPath]) {
                hierarchy[fullPath] = [];
                if (!hierarchy[parentPath].includes(part)) {
                    hierarchy[parentPath].push(part);
                }
            }
        }
        
        // Adiciona o arquivo ao seu diretório pai
        if (!hierarchy[file.parent]) {
            hierarchy[file.parent] = [];
        }
        
        hierarchy[file.parent].push(file.name);
    });
    
    return hierarchy;
}