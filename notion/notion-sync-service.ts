import { Vault } from "obsidian";
import NotionClient from "./notion-client";
import {
  markdownToNotionBlocks,
  processMarkdownFrontmatter,
} from "./notion-utils";
import { VaultFile } from "../utils/vault-scanner";

interface PageCache {
  [path: string]: string; // Caminho no Obsidian -> ID da página no Notion
}

/**
 * Serviço responsável por sincronizar arquivos do Obsidian com o Notion
 */
export default class NotionSyncService {
  private notionClient: NotionClient;
  private rootPageId: string;
  private pageCache: PageCache = {};

  constructor(notionToken: string, rootPageId: string) {
    this.notionClient = new NotionClient(notionToken);
    this.rootPageId = rootPageId;
  }

  /**
   * Sincroniza arquivos do Obsidian com o Notion
   */
  async syncFilesToNotion(files: VaultFile[], vault: Vault): Promise<void> {
    // Testa a conexão com a API do Notion
    const isConnected = await this.notionClient.testConnection();
    if (!isConnected) {
      throw new Error(
        "Falha na conexão com a API do Notion. Verifique seu token."
      );
    }

    // Mapeia as pastas criando a estrutura no Notion
    await this.ensureFolderStructure(files);

    // Sincroniza cada arquivo
    for (const file of files) {
      try {
        // Lê o conteúdo do arquivo
        const content = await vault.read(file.file);

        // Processa o conteúdo e extrai metadados
        const { metadata, content: processedContent } =
          processMarkdownFrontmatter(content);

        // Converte o conteúdo para blocos do Notion
        const blocks = markdownToNotionBlocks(processedContent);

        // Verifica se já existe uma página para este arquivo
        if (this.pageCache[file.path]) {
          // Atualiza a página existente
          await this.updateNotionPage(
            this.pageCache[file.path],
            file.name,
            blocks
          );
        } else {
          // Cria uma nova página
          const parentId = this.getParentPageId(file.parent);
          if (!parentId) {
            console.warn(`Pai não encontrado para ${file.path}, usando raiz`);
          }

          const notionPageId = await this.createNotionPage(
            parentId || this.rootPageId,
            file.name,
            blocks,
            metadata
          );

          // Armazena no cache
          this.pageCache[file.path] = notionPageId;
        }
      } catch (error) {
        console.error(`Erro ao sincronizar arquivo ${file.path}:`, error);
        // Continua com o próximo arquivo
      }
    }
  }

  /**
   * Garante que a estrutura de pastas exista no Notion
   */
  private async ensureFolderStructure(files: VaultFile[]): Promise<void> {
    // Extrai todas as pastas únicas
    const folders = new Set<string>();

    for (const file of files) {
      if (file.parent) {
        // Adiciona cada segmento do caminho
        const parts = file.parent.split("/");
        let currentPath = "";

        for (let i = 0; i < parts.length; i++) {
          if (parts[i]) {
            if (currentPath) {
              currentPath += "/";
            }
            currentPath += parts[i];
            folders.add(currentPath);
          }
        }
      }
    }

    // Cria as pastas no Notion, começando pelas pastas de nível mais alto
    const sortedFolders = Array.from(folders).sort(
      (a, b) => (a.match(/\//g) || []).length - (b.match(/\//g) || []).length
    );

    for (const folderPath of sortedFolders) {
      try {
        const parts = folderPath.split("/");
        const folderName = parts[parts.length - 1];

        // Se for o primeiro nível, o pai é a raiz
        if (parts.length === 1) {
          if (!this.pageCache[folderPath]) {
            const notionPageId = await this.createFolderPage(
              this.rootPageId,
              folderName
            );
            this.pageCache[folderPath] = notionPageId;
          }
        } else {
          // Se for um nível mais profundo, o pai é a pasta anterior
          const parentPath = parts.slice(0, -1).join("/");
          const parentId = this.pageCache[parentPath];

          if (parentId) {
            if (!this.pageCache[folderPath]) {
              const notionPageId = await this.createFolderPage(
                parentId,
                folderName
              );
              this.pageCache[folderPath] = notionPageId;
            }
          } else {
            console.warn(
              `Pasta pai não encontrada para ${folderPath}, usando raiz`
            );
            const notionPageId = await this.createFolderPage(
              this.rootPageId,
              folderName
            );
            this.pageCache[folderPath] = notionPageId;
          }
        }
      } catch (error) {
        console.error(`Erro ao criar estrutura para ${folderPath}:`, error);
      }
    }
  }

  /**
   * Cria uma página de pasta no Notion
   */
  private async createFolderPage(
    parentId: string,
    folderName: string
  ): Promise<string> {
    try {
      const response = await this.notionClient.getClient().pages.create({
        parent: {
          page_id: parentId,
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: folderName,
                },
              },
            ],
          },
        },
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: `Pasta sincronizada do Obsidian: ${folderName}`,
                  },
                },
              ],
            },
          },
        ],
      });

      return response.id;
    } catch (error) {
      console.error(`Erro ao criar pasta ${folderName} em ${parentId}:`, error);
      throw error;
    }
  }

  /**
   * Cria uma página de nota no Notion
   */
  private async createNotionPage(
    parentId: string,
    title: string,
    blocks: any[],
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      // Preparar propriedades com base nos metadados
      const properties: any = {
        title: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      };

      // Adicionar outras propriedades com base nos metadados
      for (const [key, value] of Object.entries(metadata)) {
        // Ignora chaves vazias
        if (!key.trim()) continue;

        // Adiciona como texto (simplificado - no futuro podemos melhorar isso)
        properties[key] = {
          rich_text: [
            {
              type: "text",
              text: {
                content: String(value),
              },
            },
          ],
        };
      }

      const response = await this.notionClient.getClient().pages.create({
        parent: {
          page_id: parentId,
        },
        properties,
        children: blocks,
      });

      return response.id;
    } catch (error) {
      console.error(`Erro ao criar página ${title} em ${parentId}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza uma página existente no Notion
   */
  private async updateNotionPage(
    pageId: string,
    title: string,
    blocks: any[]
  ): Promise<void> {
    try {
      // Atualiza o título
      await this.notionClient.getClient().pages.update({
        page_id: pageId,
        properties: {
          title: {
            title: [
              {
                text: {
                  content: title,
                },
              },
            ],
          },
        },
      });

      // Limpa todos os blocos existentes
      await this.clearAllBlocks(pageId);

      // Adiciona os novos blocos
      await this.notionClient.getClient().blocks.children.append({
        block_id: pageId,
        children: blocks,
      });
    } catch (error) {
      console.error(`Erro ao atualizar página ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Remove todos os blocos de uma página
   */
  private async clearAllBlocks(pageId: string): Promise<void> {
    try {
      // Obtém todos os blocos existentes
      const response = await this.notionClient
        .getClient()
        .blocks.children.list({
          block_id: pageId,
        });

      // Remove cada bloco
      for (const block of response.results) {
        await this.notionClient.getClient().blocks.delete({
          block_id: block.id,
        });

        // Pequeno delay para evitar rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Erro ao limpar blocos da página ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém o ID da página pai com base no caminho
   */
  private getParentPageId(parentPath: string): string | null {
    if (!parentPath || parentPath === "") {
      return this.rootPageId;
    }

    return this.pageCache[parentPath] || null;
  }
}
