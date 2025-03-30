import { Vault, requestUrl } from "obsidian";
import NotionClient from "./notion-client";
import {
  markdownToNotionBlocks,
  processMarkdownFrontmatter,
  processObsidianLinks,
  enhancedMarkdownToNotionBlocks,
  sanitizeBlocks,
  splitIntoManageableBlocks,
} from "./notion-utils";
import { VaultFile } from "../utils/vault-scanner";
import { FileTracker } from "../utils/sync-persistence";

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
  private fileTracker: FileTracker;

  constructor(
    notionToken: string,
    rootPageId: string,
    fileTracking: Record<string, { hash: string; lastSync: number }> = {}
  ) {
    this.notionClient = new NotionClient(notionToken);
    this.rootPageId = rootPageId;
    this.fileTracker = new FileTracker(fileTracking);
  }

  /**
   * Método aprimorado para criar páginas no Notion com melhor formatação
   * Adicionar na classe NotionSyncService
   */
  private async createFormattedNotionPage(
    parentId: string,
    title: string,
    markdownContent: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      console.log(`Criando página formatada "${title}" no parent ${parentId}`);

      // 1. Criar a página com propriedades mas sem conteúdo
      const pageProperties: any = {
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

      // Adicionar metadados como propriedades
      for (const [key, value] of Object.entries(metadata)) {
        if (!key.trim()) continue;
        pageProperties[key] = {
          rich_text: [
            {
              type: "text",
              text: {
                content: String(value).substring(0, 1900),
              },
            },
          ],
        };
      }

      // Criar página base
      const pageData = {
        parent: {
          page_id: parentId,
        },
        properties: pageProperties,
      };

      const createParams = {
        url: "https://api.notion.com/v1/pages",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        contentType: "application/json",
        body: JSON.stringify(pageData),
      };

      const createResponse = await requestUrl(createParams);

      if (createResponse.status !== 200) {
        throw new Error(`Falha ao criar página: ${createResponse.status}`);
      }

      const pageId = createResponse.json.id;
      console.log(`Página base criada com ID: ${pageId}`);

      // 2. Converter o markdown para blocos do Notion de forma otimizada
      const blocks = await this.convertMarkdownToEnhancedBlocks(
        markdownContent
      );

      // 3. Adicionar os blocos em lotes para evitar limitações da API
      const MAX_BLOCKS_PER_REQUEST = 40;
      for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
        const blockBatch = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);

        try {
          await this.appendBlocksWithRetry(pageId, blockBatch);
          // Pequeno delay entre requisições para evitar rate limits
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (appendError) {
          console.error(
            `Erro ao adicionar lote ${i / MAX_BLOCKS_PER_REQUEST + 1}:`,
            appendError
          );
          // Continua mesmo com erro em um lote
        }
      }

      return pageId;
    } catch (error) {
      console.error(`Erro ao criar página formatada ${title}:`, error);
      throw error;
    }
  }

  /**
   * Converte markdown para blocos do Notion com melhor fidelidade
   * Adicionar na classe NotionSyncService
   */
  private async convertMarkdownToEnhancedBlocks(
    markdown: string
  ): Promise<any[]> {
    // Preparamos o conteúdo markdown para processamento
    const processedMarkdown = markdown
      .replace(/\r\n/g, "\n") // Normaliza quebras de linha
      .replace(/\t/g, "    "); // Converte tabs em espaços

    const blocks = [];

    // Dividir o conteúdo em blocos lógicos
    const lines = processedMarkdown.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Bloco de código
      if (line.startsWith("```")) {
        const codeInfo = line.slice(3).trim();
        const language = codeInfo || "plain text";

        let codeContent = "";
        i++;

        // Coleta todo o conteúdo do bloco de código até encontrar o fechamento
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeContent += lines[i] + "\n";
          i++;
        }

        // Pula a linha de fechamento
        if (i < lines.length) {
          i++;
        }

        // Adiciona o bloco de código com a formatação correta
        blocks.push(this.createOptimizedCodeBlock(codeContent, language));
        continue;
      }

      // Cabeçalhos
      if (line.startsWith("# ")) {
        blocks.push(this.createHeadingBlock(line.slice(2), 1));
        i++;
        continue;
      }

      if (line.startsWith("## ")) {
        blocks.push(this.createHeadingBlock(line.slice(3), 2));
        i++;
        continue;
      }

      if (line.startsWith("### ")) {
        blocks.push(this.createHeadingBlock(line.slice(4), 3));
        i++;
        continue;
      }

      // Listas não ordenadas
      if (/^\s*[-*+]\s/.test(line)) {
        const match = /^\s*/.exec(line);
        const indentLevel = match ? match[0].length : 0;
        const itemContent = line.replace(/^\s*[-*+]\s/, "");

        blocks.push(this.createBulletListBlock(itemContent));
        i++;
        continue;
      }

      // Listas ordenadas
      if (/^\s*\d+\.\s/.test(line)) {
        const itemContent = line.replace(/^\s*\d+\.\s/, "");

        blocks.push(this.createNumberedListBlock(itemContent));
        i++;
        continue;
      }

      // Linha horizontal
      if (/^-{3,}$|^_{3,}$|^\*{3,}$/.test(line)) {
        blocks.push({
          object: "block",
          type: "divider",
          divider: {},
        });
        i++;
        continue;
      }

      // Parágrafos (incluindo linhas em branco)
      let paragraphContent = line;
      i++;

      // Acumula linhas em um único parágrafo até encontrar uma linha em branco
      while (
        i < lines.length &&
        lines[i].trim() !== "" &&
        !lines[i].startsWith("#") &&
        !lines[i].startsWith("```") &&
        !lines[i].match(/^\s*[-*+]\s/) &&
        !lines[i].match(/^\s*\d+\.\s/)
      ) {
        paragraphContent += "\n" + lines[i];
        i++;
      }

      // Se for um parágrafo com conteúdo, adiciona ao bloco
      if (paragraphContent.trim() !== "") {
        blocks.push(this.createParagraphBlock(paragraphContent));
      } else {
        // Linhas em branco são puladas
        i++;
      }
    }

    return blocks;
  }

  /**
   * Cria um bloco de código otimizado para o Notion
   * Adicionar na classe NotionSyncService
   */
  private createOptimizedCodeBlock(
    content: string,
    language: string = "plain text"
  ): any {
    // Lista de linguagens suportadas pelo Notion
    const supportedLanguages = [
      "abap",
      "arduino",
      "bash",
      "basic",
      "c",
      "clojure",
      "coffeescript",
      "cpp",
      "csharp",
      "css",
      "dart",
      "diff",
      "docker",
      "elixir",
      "elm",
      "erlang",
      "flow",
      "fortran",
      "fsharp",
      "gherkin",
      "glsl",
      "go",
      "graphql",
      "groovy",
      "haskell",
      "html",
      "java",
      "javascript",
      "json",
      "julia",
      "kotlin",
      "latex",
      "less",
      "lisp",
      "livescript",
      "lua",
      "makefile",
      "markdown",
      "markup",
      "matlab",
      "mermaid",
      "nix",
      "objective-c",
      "ocaml",
      "pascal",
      "perl",
      "php",
      "plain text",
      "powershell",
      "prolog",
      "protobuf",
      "python",
      "r",
      "reason",
      "ruby",
      "rust",
      "sass",
      "scala",
      "scheme",
      "scss",
      "shell",
      "sql",
      "swift",
      "typescript",
      "vb.net",
      "verilog",
      "vhdl",
      "visual basic",
      "webassembly",
      "xml",
      "yaml",
    ];

    const normalizedLanguage = language.toLowerCase().trim();
    const finalLanguage = supportedLanguages.includes(normalizedLanguage)
      ? normalizedLanguage
      : "plain text";

    return {
      object: "block",
      type: "code",
      code: {
        rich_text: [
          {
            type: "text",
            text: {
              content: content.trim(),
            },
          },
        ],
        language: finalLanguage,
      },
    };
  }

  /**
   * Método para adicionar blocos com retry
   * Adicionar na classe NotionSyncService
   */
  private async appendBlocksWithRetry(
    pageId: string,
    blocks: any[]
  ): Promise<void> {
    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
      try {
        const params = {
          url: `https://api.notion.com/v1/blocks/${pageId}/children`,
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.notionClient.getToken()}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          contentType: "application/json",
          body: JSON.stringify({
            children: blocks,
          }),
        };

        const response = await requestUrl(params);

        if (response.status === 200) {
          console.log(`Blocos adicionados com sucesso à página ${pageId}`);
          return;
        } else {
          throw new Error(`Erro ao adicionar blocos: ${response.status}`);
        }
      } catch (error) {
        retryCount++;
        console.error(`Tentativa ${retryCount} falhou: ${error.message}`);

        if (retryCount >= MAX_RETRIES) {
          throw error;
        }

        // Backoff exponencial
        const delay = 500 * Math.pow(2, retryCount);
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Reduz o tamanho do bloco se necessário
        if (blocks.length > 10) {
          blocks = blocks.slice(0, blocks.length / 2);
          console.log(
            `Reduzindo para ${blocks.length} blocos na próxima tentativa`
          );
        }
      }
    }
  }

  /**
   * Verifica se uma página já existe no Notion por título dentro de um parent
   * Adicionar na classe NotionSyncService
   */
  private async doesPageExistByTitle(
    parentId: string,
    title: string
  ): Promise<string | null> {
    try {
      console.log(
        `Verificando se a página "${title}" já existe em ${parentId}`
      );

      // Busca páginas filhas do parent
      const params = {
        url: `https://api.notion.com/v1/blocks/${parentId}/children?page_size=100`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
        },
      };

      const response = await requestUrl(params);

      if (response.status === 200) {
        const pages = response.json.results.filter(
          (block: any) => block.type === "child_page"
        );

        // Normaliza o título para comparação case-insensitive
        const normalizedTitle = title.toLowerCase().trim();

        // Procura uma página com o mesmo título
        for (const page of pages) {
          if (
            page.child_page &&
            page.child_page.title &&
            page.child_page.title.toLowerCase().trim() === normalizedTitle
          ) {
            console.log(`Página "${title}" encontrada com ID: ${page.id}`);
            return page.id;
          }
        }
      }

      console.log(`Página "${title}" não encontrada em ${parentId}`);
      return null;
    } catch (error) {
      console.error(`Erro ao verificar existência da página ${title}:`, error);
      return null;
    }
  }

  /**
   * Retorna o estado atual do rastreamento de arquivos
   */
  getFileTracking(): Record<string, { hash: string; lastSync: number }> {
    return this.fileTracker.getAllTracking();
  }

  /**
   * Sincroniza arquivos do Obsidian com o Notion
   * Substituir na classe NotionSyncService
   */
  async syncFilesToNotion(files: VaultFile[], vault: Vault): Promise<void> {
    console.log(`Iniciando sincronização de ${files.length} arquivos...`);

    // Testa a conexão com a API do Notion
    const isConnected = await this.notionClient.testConnection();
    if (!isConnected) {
      throw new Error(
        "Falha na conexão com a API do Notion. Verifique seu token."
      );
    }
    console.log("Conexão com a API do Notion estabelecida com sucesso.");

    // Lista de caminhos de arquivos existentes para limpeza
    const existingPaths = files.map((file) => file.path);
    this.fileTracker.cleanupDeletedFiles(existingPaths);

    // Ordena as pastas para garantir que sejam criadas em ordem alfanumérica
    const sortedFiles = this.sortFilesByPath(files);

    // Mapeia as pastas criando a estrutura no Notion
    await this.ensureFolderStructure(sortedFiles);
    console.log("Estrutura de pastas criada com sucesso");

    // Sincroniza cada arquivo
    console.log(`Processando ${files.length} arquivos...`);
    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let existingCount = 0;

    for (const file of sortedFiles) {
      try {
        // Pula arquivos que não são Markdown
        if (!file.path.endsWith(".md")) {
          console.log(`Ignorando arquivo não-Markdown: ${file.path}`);
          continue;
        }

        const parentId = this.getParentPageId(file.parent) || this.rootPageId;

        // 1. Verifica se a página já existe pelo título no Notion
        const existingPageId = await this.doesPageExistByTitle(
          parentId,
          file.name
        );

        if (existingPageId && !this.pageCache[file.path]) {
          // Se existe no Notion mas não no cache, adicione ao cache
          console.log(
            `Página "${file.name}" já existe no Notion. Adicionando ao cache.`
          );
          this.pageCache[file.path] = existingPageId;
          existingCount++;
          continue;
        }

        // 2. Verifica se já existe no cache e se foi modificada
        if (this.pageCache[file.path]) {
          const hasChanged = await this.fileTracker.hasFileChanged(
            file.file,
            vault
          );

          if (!hasChanged) {
            console.log(
              `Arquivo não modificado desde a última sincronização: ${file.path}`
            );
            skippedCount++;
            continue;
          }

          // Verifica se a página existe no Notion
          const pageExists = await this.doesNotionPageExist(
            this.pageCache[file.path]
          );

          if (!pageExists) {
            // Se a página foi excluída no Notion, remova do cache
            console.log(
              `Página para ${file.path} foi excluída no Notion. Será recriada.`
            );
            delete this.pageCache[file.path];
          }
        }

        // 3. Processa e sincroniza o arquivo
        console.log(`==== Sincronizando arquivo: ${file.path} ====`);

        // Lê o conteúdo do arquivo
        const content = await vault.read(file.file);

        // Processa o conteúdo e extrai metadados
        const { metadata, content: processedContent } =
          processMarkdownFrontmatter(content);

        // Processa links do Obsidian
        const contentWithProcessedLinks = await this.processLinksInContent(
          processedContent,
          files,
          vault
        );

        // Se a página já existe no cache, atualiza
        if (this.pageCache[file.path]) {
          // Primeiro limpa os blocos existentes
          await this.clearAllBlocks(this.pageCache[file.path]);

          // Converte o conteúdo para blocos e adiciona
          const blocks = await this.convertMarkdownToEnhancedBlocks(
            contentWithProcessedLinks
          );

          // Adiciona os blocos em lotes
          const MAX_BLOCKS_PER_REQUEST = 40;
          for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
            const blockBatch = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);
            await this.appendBlocksWithRetry(
              this.pageCache[file.path],
              blockBatch
            );
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          console.log(`Página ${file.path} atualizada com sucesso`);
        } else {
          // Cria uma nova página com formatação aprimorada
          const notionPageId = await this.createFormattedNotionPage(
            parentId,
            file.name,
            contentWithProcessedLinks,
            metadata
          );

          // Armazena no cache
          this.pageCache[file.path] = notionPageId;
          console.log(`Página criada com ID: ${notionPageId}`);
        }

        // Atualiza o rastreamento do arquivo
        await this.fileTracker.updateFileTracking(file.file, vault);

        successCount++;
        console.log(`==== Arquivo sincronizado com sucesso: ${file.path} ====`);
      } catch (error) {
        errorCount++;
        console.error(`Erro ao sincronizar arquivo ${file.path}:`, error);
        // Continua com o próximo arquivo
      }
    }

    console.log(
      `Sincronização concluída! Arquivos: ${successCount} sincronizados, ${existingCount} existentes, ${skippedCount} ignorados (sem alterações), ${errorCount} erros`
    );
  }


  /**
 * Verifica se a página do Notion existe
 * Adicionar na classe NotionSyncService
 */
private async doesNotionPageExist(pageId: string): Promise<boolean> {
    try {
      console.log(`Verificando se a página ${pageId} existe no Notion...`);
      
      const params = {
        url: `https://api.notion.com/v1/pages/${pageId}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28"
        }
      };
      
      const response = await requestUrl(params);
      return response.status === 200;
    } catch (error) {
      // Se receber erro 404, a página não existe mais
      if (error.status === 404) {
        console.log(`Página ${pageId} não existe mais no Notion`);
        return false;
      }
      
      console.error(`Erro ao verificar existência da página ${pageId}:`, error);
      // Em caso de outros erros, assumimos que a página existe para evitar duplicações
      return true;
    }
  }

  /**
 * Cria um bloco de parágrafo
 * Adicionar na classe NotionSyncService
 */
private createParagraphBlock(content: string): any {
    return {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          {
            type: "text",
            text: {
              content,
            },
          },
        ],
      },
    };
  }
  
  /**
   * Cria um bloco de cabeçalho
   * Adicionar na classe NotionSyncService
   */
  private createHeadingBlock(content: string, level: 1 | 2 | 3): any {
    const headingType = `heading_${level}` as "heading_1" | "heading_2" | "heading_3";
    
    return {
      object: "block",
      type: headingType,
      [headingType]: {
        rich_text: [
          {
            type: "text",
            text: {
              content,
            },
          },
        ],
      },
    };
  }
  
  /**
   * Cria um item de lista não ordenada
   * Adicionar na classe NotionSyncService
   */
  private createBulletListBlock(content: string): any {
    return {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [
          {
            type: "text",
            text: {
              content,
            },
          },
        ],
      },
    };
  }
  
  /**
   * Cria um item de lista ordenada
   * Adicionar na classe NotionSyncService
   */
  private createNumberedListBlock(content: string): any {
    return {
      object: "block",
      type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [
          {
            type: "text",
            text: {
              content,
            },
          },
        ],
      },
    };
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
    // Ordenando alfanumericamente para garantir que 00, 01, 02 apareçam na ordem correta
    const sortedFolders = Array.from(folders).sort((a, b) => {
      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    console.log(`Processando ${sortedFolders.length} pastas...`);
    for (const folderPath of sortedFolders) {
      try {
        const parts = folderPath.split("/");
        const folderName = parts[parts.length - 1];

        // Se for o primeiro nível, o pai é a raiz
        if (parts.length === 1) {
          if (!this.pageCache[folderPath]) {
            // Verifica se a pasta já existe
            const existingFolderId = await this.doesFolderExistInNotion(
              this.rootPageId,
              folderName
            );

            if (existingFolderId) {
              console.log(
                `Usando pasta existente de primeiro nível: ${folderName} (${existingFolderId})`
              );
              this.pageCache[folderPath] = existingFolderId;
            } else {
              console.log(`Criando pasta de primeiro nível: ${folderName}`);
              const notionPageId = await this.notionClient.createFolderPage(
                this.rootPageId,
                folderName
              );
              this.pageCache[folderPath] = notionPageId;
            }
          }
        } else {
          // Se for um nível mais profundo, o pai é a pasta anterior
          const parentPath = parts.slice(0, -1).join("/");
          const parentId = this.pageCache[parentPath];

          if (parentId) {
            if (!this.pageCache[folderPath]) {
              // Verifica se a pasta já existe
              const existingFolderId = await this.doesFolderExistInNotion(
                parentId,
                folderName
              );

              if (existingFolderId) {
                console.log(
                  `Usando subpasta existente: ${folderName} em ${parentPath} (${existingFolderId})`
                );
                this.pageCache[folderPath] = existingFolderId;
              } else {
                console.log(`Criando subpasta: ${folderName} em ${parentPath}`);
                const notionPageId = await this.notionClient.createFolderPage(
                  parentId,
                  folderName
                );
                this.pageCache[folderPath] = notionPageId;
              }
            }
          } else {
            console.warn(
              `Pasta pai não encontrada para ${folderPath}, usando raiz`
            );

            // Verifica se existe no nível raiz
            const existingFolderId = await this.doesFolderExistInNotion(
              this.rootPageId,
              folderName
            );

            if (existingFolderId) {
              console.log(
                `Usando pasta existente na raiz: ${folderName} (${existingFolderId})`
              );
              this.pageCache[folderPath] = existingFolderId;
            } else {
              const notionPageId = await this.notionClient.createFolderPage(
                this.rootPageId,
                folderName
              );
              this.pageCache[folderPath] = notionPageId;
            }
          }
        }
      } catch (error) {
        console.error(`Erro ao criar estrutura para ${folderPath}:`, error);
      }
    }
  }

  /**
   * Verifica se uma pasta já existe no Notion
   * Esta função deve ser adicionada ao arquivo notion-sync-service.ts
   */
  private async doesFolderExistInNotion(
    parentId: string,
    folderName: string
  ): Promise<string | null> {
    try {
      console.log(
        `Verificando se a pasta "${folderName}" já existe em ${parentId}`
      );

      // Busca páginas filhas do parent
      const params = {
        url: `https://api.notion.com/v1/blocks/${parentId}/children?page_size=100`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
        },
      };

      const response = await requestUrl(params);

      if (response.status === 200) {
        const pages = response.json.results.filter(
          (block: any) => block.type === "child_page"
        );

        // Procura uma página com o mesmo título
        for (const page of pages) {
          if (
            page.child_page?.title === folderName ||
            (page.id &&
              page.child_page &&
              folderName.toLowerCase() === page.child_page.title?.toLowerCase())
          ) {
            console.log(`Pasta "${folderName}" encontrada com ID: ${page.id}`);
            return page.id;
          }
        }
      }

      console.log(`Pasta "${folderName}" não encontrada em ${parentId}`);
      return null;
    } catch (error) {
      console.error(
        `Erro ao verificar existência da pasta ${folderName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Ordena os arquivos por caminho para garantir ordem alfanumérica correta
   */
  private sortFilesByPath(files: VaultFile[]): VaultFile[] {
    return [...files].sort((a, b) => {
      // Primeiro comparar os caminhos de pasta
      if (a.parent !== b.parent) {
        return a.parent.localeCompare(b.parent, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      }

      // Se estiverem na mesma pasta, comparar os nomes dos arquivos
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }

  /**
   * Processa links do Obsidian no conteúdo
   * Converte [[arquivo]] ou [[arquivo|texto]] para links internos do Notion
   */
  private async processLinksInContent(
    content: string,
    files: VaultFile[],
    vault: Vault
  ): Promise<string> {
    // Regex para encontrar links do Obsidian: [[arquivo]] ou [[arquivo|texto]]
    const linkRegex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;
    let processedContent = content;
    let match;

    const linkMap = new Map<string, string>();

    // Mapear todos os arquivos para facilitar a busca
    for (const file of files) {
      if (file.path.endsWith(".md")) {
        const baseName = file.path.substring(0, file.path.length - 3); // Remove a extensão .md
        linkMap.set(file.name, file.path);
        linkMap.set(baseName, file.path);
      }
    }

    // Substituir todos os links do Obsidian por links do Notion
    while ((match = linkRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const linkTarget = match[1];
      const linkText = match[2] || linkTarget;

      // Verifica se o link aponta para um arquivo que temos
      const targetPath = linkMap.get(linkTarget);

      if (targetPath && this.pageCache[targetPath]) {
        // Temos o arquivo e já temos o ID da página do Notion
        const notionPageId = this.pageCache[targetPath];
        console.log(`Convertendo link para ${linkTarget} -> ${notionPageId}`);

        // No lugar de substituir por texto, manteremos o link para ser processado
        // pela função markdownToNotionBlocks para criar um link do Notion
        const notionLink = `[${linkText}](https://www.notion.so/${notionPageId.replace(
          /-/g,
          ""
        )})`;
        processedContent = processedContent.replace(fullMatch, notionLink);
      } else {
        // Não encontramos o arquivo ou ainda não foi sincronizado, manter como texto
        processedContent = processedContent.replace(fullMatch, linkText);
      }
    }

    return processedContent;
  }

  /**
   * Cria uma página no Notion usando abordagem robusta para conteúdo complexo
   */
  private async createNotionPageRobust(
    parentId: string,
    title: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      console.log(`Criando página "${title}" no parent ${parentId}`);

      // Processar o conteúdo de forma mais robusta
      const enhancedBlocks = enhancedMarkdownToNotionBlocks(content);
      const blockChunks = splitIntoManageableBlocks(enhancedBlocks);

      // Preparar propriedades
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
        if (!key.trim()) continue;
        properties[key] = {
          rich_text: [
            {
              type: "text",
              text: {
                content: String(value).substring(0, 1900), // Limite de tamanho
              },
            },
          ],
        };
      }

      // Criar página com o primeiro lote de blocos ou vazia
      const initialBlocks = blockChunks.length > 0 ? blockChunks[0] : [];

      const data = {
        parent: {
          page_id: parentId,
        },
        properties: properties,
        children: initialBlocks,
      };

      // Tentar criação com conteúdo completo
      try {
        const params = {
          url: "https://api.notion.com/v1/pages",
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.notionClient.getToken()}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          contentType: "application/json",
          body: JSON.stringify(data),
        };

        console.log(`Enviando requisição para criar página: ${title}`);
        const response = await requestUrl(params);

        if (response.status === 200) {
          const pageId = response.json.id;
          console.log(`Página criada com sucesso. ID: ${pageId}`);

          // Adicionar blocos restantes
          if (blockChunks.length > 1) {
            for (let i = 1; i < blockChunks.length; i++) {
              await this.appendBlocksSafely(pageId, blockChunks[i]);
              // Aguardar um pouco entre requisições para evitar rate limits
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
          }

          return pageId;
        } else {
          throw new Error(`Resposta inesperada: ${response.status}`);
        }
      } catch (error) {
        console.error(`Erro na criação completa: ${error.message}`);
        throw error; // Permitir fallback
      }
    } catch (error) {
      console.error(`Erro criando página ${title}: ${error.message}`);

      // Fallback: criar página com conteúdo mínimo
      try {
        console.log(`Tentando criar página ${title} com conteúdo mínimo`);

        const minimalData = {
          parent: {
            page_id: parentId,
          },
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
          children: [
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [
                  {
                    type: "text",
                    text: {
                      content:
                        "Este conteúdo foi simplificado devido à complexidade do original.",
                    },
                  },
                ],
              },
            },
          ],
        };

        const params = {
          url: "https://api.notion.com/v1/pages",
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.notionClient.getToken()}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          contentType: "application/json",
          body: JSON.stringify(minimalData),
        };

        const response = await requestUrl(params);

        if (response.status === 200) {
          const pageId = response.json.id;
          console.log(`Página criada com conteúdo mínimo. ID: ${pageId}`);
          return pageId;
        } else {
          throw new Error(`Falha no fallback: ${response.status}`);
        }
      } catch (finalError) {
        console.error(`Erro final: ${finalError.message}`);
        throw finalError;
      }
    }
  }

  /**
   * Método existente de criação de página com requestUrl
   */
  private async createNotionPageWithRequestUrl(
    parentId: string,
    title: string,
    blocks: any[],
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      console.log(
        `Criando página "${title}" no parent ${parentId} (via requestUrl)`
      );

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

      // Verifica se existem blocos muito grandes ou problemáticos
      // Notion tem limite de tamanho para cada requisição
      const MAX_BLOCKS_PER_REQUEST = 50;
      const chunkedBlocks = [];

      // Divide os blocos em grupos de MAX_BLOCKS_PER_REQUEST
      for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
        chunkedBlocks.push(blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST));
      }

      // Preparar dados para a requisição inicial (com os primeiros blocos ou vazio)
      const initialBlocks = chunkedBlocks.length > 0 ? chunkedBlocks[0] : [];

      // Sanitiza os blocos para evitar problemas com caracteres especiais
      const sanitizedBlocks = initialBlocks.map((block) => {
        // Tratamento especial para blocos de código
        if (
          block.type === "code" &&
          block.code?.rich_text?.[0]?.text?.content
        ) {
          // Limita o tamanho do conteúdo de código para evitar problemas
          const content = block.code.rich_text[0].text.content;
          if (content.length > 2000) {
            block.code.rich_text[0].text.content =
              content.substring(0, 2000) +
              "\n\n... (conteúdo truncado devido a limitações da API)";
          }
        }
        return block;
      });

      const data = {
        parent: {
          page_id: parentId,
        },
        properties: properties,
        children: sanitizedBlocks,
      };

      // Configurar parâmetros da requisição
      const params = {
        url: "https://api.notion.com/v1/pages",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        contentType: "application/json",
        body: JSON.stringify(data),
      };

      console.log(`Enviando requisição para criar página: ${title}`);
      const response = await requestUrl(params);

      if (response.status !== 200) {
        console.error(
          `Erro ao criar página (status ${response.status}):`,
          response.text
        );

        // Tenta uma abordagem simplificada sem blocos
        console.log("Tentando criar página sem blocos de conteúdo...");

        const simplifiedData = {
          parent: {
            page_id: parentId,
          },
          properties: properties,
          children: [
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [
                  {
                    type: "text",
                    text: {
                      content:
                        "Conteúdo não foi possível sincronizar devido a limitações da API.",
                    },
                  },
                ],
              },
            },
          ],
        };

        const simplifiedParams = {
          ...params,
          body: JSON.stringify(simplifiedData),
        };

        const fallbackResponse = await requestUrl(simplifiedParams);

        if (fallbackResponse.status !== 200) {
          throw new Error(
            `Falha ao criar página simplificada: ${fallbackResponse.status}`
          );
        }

        const responseJson = fallbackResponse.json;
        console.log(
          `Página criada com conteúdo limitado. ID: ${responseJson.id}`
        );

        // Se tiver blocos adicionais, tenta adicioná-los depois
        if (chunkedBlocks.length > 1) {
          try {
            for (let i = 1; i < chunkedBlocks.length; i++) {
              await this.appendBlocksToPage(responseJson.id, chunkedBlocks[i]);
            }
          } catch (appendError) {
            console.error(
              "Não foi possível adicionar todos os blocos:",
              appendError
            );
          }
        }

        return responseJson.id;
      }

      const responseJson = response.json;
      console.log(`Página criada com sucesso. ID: ${responseJson.id}`);

      // Se tiver mais blocos para adicionar, faz em requisições separadas
      if (chunkedBlocks.length > 1) {
        try {
          for (let i = 1; i < chunkedBlocks.length; i++) {
            await this.appendBlocksToPage(responseJson.id, chunkedBlocks[i]);
          }
        } catch (appendError) {
          console.error(
            "Não foi possível adicionar todos os blocos:",
            appendError
          );
        }
      }

      return responseJson.id;
    } catch (error) {
      console.error(`Erro ao criar página ${title} em ${parentId}:`, error);

      // Tentativa final com conteúdo mínimo
      try {
        console.log("Tentativa final: criando página com conteúdo mínimo");

        const minimalData = {
          parent: {
            page_id: parentId,
          },
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
        };

        const minimalParams = {
          url: "https://api.notion.com/v1/pages",
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.notionClient.getToken()}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          contentType: "application/json",
          body: JSON.stringify(minimalData),
        };

        const lastResortResponse = await requestUrl(minimalParams);

        if (lastResortResponse.status === 200) {
          const responseJson = lastResortResponse.json;
          console.log(
            `Página criada com conteúdo mínimo. ID: ${responseJson.id}`
          );
          return responseJson.id;
        }
      } catch (finalError) {
        console.error("Falha na tentativa final:", finalError);
      }

      throw error;
    }
  }

  /**
   * Adiciona blocos a uma página existente de forma segura
   */
  private async appendBlocksSafely(
    pageId: string,
    blocks: any[]
  ): Promise<void> {
    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
      try {
        const sanitizedBlocks = sanitizeBlocks(blocks);

        const params = {
          url: `https://api.notion.com/v1/blocks/${pageId}/children`,
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.notionClient.getToken()}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          contentType: "application/json",
          body: JSON.stringify({
            children: sanitizedBlocks,
          }),
        };

        const response = await requestUrl(params);

        if (response.status === 200) {
          console.log(`Blocos adicionados com sucesso à página ${pageId}`);
          return;
        } else {
          throw new Error(`Erro ao adicionar blocos: ${response.status}`);
        }
      } catch (error) {
        retryCount++;
        console.error(`Tentativa ${retryCount} falhou: ${error.message}`);

        if (retryCount >= MAX_RETRIES) {
          console.error(`Excedidas ${MAX_RETRIES} tentativas. Desistindo.`);
          throw error;
        }

        // Esperar um pouco antes de tentar novamente (com backoff exponencial)
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * Math.pow(2, retryCount))
        );

        // Reduzir o número de blocos pela metade se estamos tendo problemas
        if (blocks.length > 5) {
          console.log(
            `Reduzindo número de blocos de ${blocks.length} para ${Math.floor(
              blocks.length / 2
            )}`
          );
          blocks = blocks.slice(0, Math.floor(blocks.length / 2));
        }
      }
    }
  }

  /**
   * Adiciona blocos a uma página existente
   */
  private async appendBlocksToPage(
    pageId: string,
    blocks: any[]
  ): Promise<void> {
    try {
      console.log(`Adicionando ${blocks.length} blocos à página ${pageId}`);

      // Sanitiza os blocos
      const sanitizedBlocks = blocks.map((block) => {
        // Tratamento especial para blocos de código
        if (
          block.type === "code" &&
          block.code?.rich_text?.[0]?.text?.content
        ) {
          // Limita o tamanho do conteúdo de código
          const content = block.code.rich_text[0].text.content;
          if (content.length > 2000) {
            block.code.rich_text[0].text.content =
              content.substring(0, 2000) +
              "\n\n... (conteúdo truncado devido a limitações da API)";
          }
        }
        return block;
      });

      const appendParams = {
        url: `https://api.notion.com/v1/blocks/${pageId}/children`,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        contentType: "application/json",
        body: JSON.stringify({
          children: sanitizedBlocks,
        }),
      };

      const response = await requestUrl(appendParams);

      if (response.status !== 200) {
        console.error(
          `Erro ao adicionar blocos (status ${response.status}):`,
          response.text
        );
        throw new Error(`Falha ao adicionar blocos: ${response.status}`);
      }

      console.log(`Blocos adicionados com sucesso à página ${pageId}`);
    } catch (error) {
      console.error(`Erro ao adicionar blocos à página ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Método atualizado para atualizar páginas existentes de forma robusta
   */
  private async updateNotionPageRobust(
    pageId: string,
    title: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      console.log(`Atualizando página: ${pageId} com título: ${title}`);

      // Atualiza o título
      const updateParams = {
        url: `https://api.notion.com/v1/pages/${pageId}`,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        contentType: "application/json",
        body: JSON.stringify({
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
        }),
      };

      await requestUrl(updateParams);
      console.log(`Título da página atualizado para: ${title}`);

      // Limpa todos os blocos existentes
      await this.clearAllBlocks(pageId);

      // Processa o conteúdo de forma robusta
      const enhancedBlocks = enhancedMarkdownToNotionBlocks(content);
      const blockChunks = splitIntoManageableBlocks(enhancedBlocks);

      // Adiciona os blocos em chunks
      for (let i = 0; i < blockChunks.length; i++) {
        await this.appendBlocksSafely(pageId, blockChunks[i]);
        // Pequeno delay entre requisições
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      console.log(`Página ${pageId} atualizada com sucesso`);
    } catch (error) {
      console.error(`Erro ao atualizar página ${pageId}:`, error);

      // Tentar uma abordagem simplificada
      try {
        console.log("Tentando atualizar apenas com conteúdo básico...");
        const basicBlock = {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: {
                  content:
                    "Este conteúdo foi simplificado devido à complexidade do original.",
                },
              },
            ],
          },
        };

        await this.appendBlocksSafely(pageId, [basicBlock]);
        console.log("Página atualizada com conteúdo simplificado");
      } catch (fallbackError) {
        console.error("Falha completa ao atualizar página:", fallbackError);
        throw error;
      }
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
      console.log(`Atualizando página: ${pageId} com título: ${title}`);

      // Atualiza o título usando requestUrl
      const updateParams = {
        url: `https://api.notion.com/v1/pages/${pageId}`,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        contentType: "application/json",
        body: JSON.stringify({
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
        }),
      };

      await requestUrl(updateParams);
      console.log(`Título da página atualizado para: ${title}`);

      // Limpa todos os blocos existentes
      await this.clearAllBlocks(pageId);

      // Adiciona os novos blocos
      const appendParams = {
        url: `https://api.notion.com/v1/blocks/${pageId}/children`,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        contentType: "application/json",
        body: JSON.stringify({
          children: blocks,
        }),
      };

      await requestUrl(appendParams);
      console.log(`Novos blocos adicionados à página ${pageId}`);

      console.log(`Página ${pageId} atualizada com sucesso`);
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
      console.log(`Limpando blocos da página ${pageId}`);

      // Obtém todos os blocos existentes
      const listParams = {
        url: `https://api.notion.com/v1/blocks/${pageId}/children`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
        },
      };

      const response = await requestUrl(listParams);
      const blocks = response.json.results;
      console.log(`Encontrados ${blocks.length} blocos para remover`);

      // Remove cada bloco
      for (const block of blocks) {
        const deleteParams = {
          url: `https://api.notion.com/v1/blocks/${block.id}`,
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${this.notionClient.getToken()}`,
            "Notion-Version": "2022-06-28",
          },
        };

        await requestUrl(deleteParams);

        // Pequeno delay para evitar rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(`Todos os blocos da página ${pageId} removidos com sucesso`);
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
