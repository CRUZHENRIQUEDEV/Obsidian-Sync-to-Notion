import { Vault, requestUrl } from "obsidian";
import NotionClient from "./notion-client";
import {
  processMarkdownFrontmatter,
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
   * Sincroniza todos os arquivos, ignorando o histórico de sincronização anterior
   * Adicionar na classe NotionSyncService
   */
  async syncFilesToNotionFull(files: VaultFile[], vault: Vault): Promise<void> {
    console.log(
      `Iniciando sincronização completa de ${files.length} arquivos...`
    );

    // Testa a conexão com a API do Notion
    const isConnected = await this.notionClient.testConnection();
    if (!isConnected) {
      throw new Error(
        "Falha na conexão com a API do Notion. Verifique seu token."
      );
    }
    console.log("Conexão com a API do Notion estabelecida com sucesso.");

    // Limpa o cache de páginas
    this.pageCache = {};

    // Lista de caminhos de arquivos existentes para limpeza
    const existingPaths = files.map((file) => file.path);
    this.fileTracker.cleanupDeletedFiles(existingPaths);

    try {
      // Limpa todas as páginas da página raiz
      console.log(`Limpando todas as páginas da raiz ${this.rootPageId}...`);
      await this.clearAllPagesFromRoot();
      console.log("Páginas existentes removidas com sucesso");

      // Ordena as pastas para garantir que sejam criadas em ordem alfanumérica
      const sortedFiles = this.sortFilesByPath(files);

      // Recria a estrutura de pastas
      await this.ensureFolderStructure(sortedFiles);
      console.log("Estrutura de pastas recriada com sucesso");

      // Sincroniza cada arquivo
      console.log(`Processando ${files.length} arquivos...`);
      let successCount = 0;
      let errorCount = 0;

      for (const file of sortedFiles) {
        try {
          // Pula arquivos que não são Markdown
          if (!file.path.endsWith(".md")) {
            console.log(`Ignorando arquivo não-Markdown: ${file.path}`);
            continue;
          }

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

          // Cria a página no Notion
          const parentId = this.getParentPageId(file.parent);
          if (!parentId) {
            console.warn(`Pai não encontrado para ${file.path}, usando raiz`);
          }

          const pageParentId = parentId || this.rootPageId;
          console.log(`Criando na página pai: ${pageParentId}`);

          // Usar o método para criar páginas formatadas
          const notionPageId = await this.createNotionPageRobust(
            pageParentId,
            file.name,
            contentWithProcessedLinks,
            metadata
          );

          // Armazena no cache
          this.pageCache[file.path] = notionPageId;
          console.log(`Página criada com ID: ${notionPageId}`);

          // Atualiza o rastreamento do arquivo
          await this.fileTracker.updateFileTracking(file.file, vault);

          successCount++;
          console.log(
            `==== Arquivo sincronizado com sucesso: ${file.path} ====`
          );
        } catch (error) {
          errorCount++;
          console.error(`Erro ao sincronizar arquivo ${file.path}:`, error);
          // Continua com o próximo arquivo
        }
      }

      console.log(
        `Sincronização completa concluída! Arquivos: ${successCount} sincronizados, ${errorCount} erros`
      );
    } catch (error) {
      console.error("Erro durante a sincronização completa:", error);
      throw error;
    }
  }

  /**
   * Limpa todas as páginas da raiz
   * Adicionar na classe NotionSyncService
   */
  private async clearAllPagesFromRoot(): Promise<void> {
    try {
      console.log(`Obtendo páginas filhas de ${this.rootPageId}...`);

      // Busca todas as páginas filhas da raiz
      const childPages = await this.getAllChildPages(this.rootPageId);
      console.log(`Encontradas ${childPages.length} páginas para remover`);

      // Remove cada página
      for (const pageId of childPages) {
        try {
          await this.archivePage(pageId);
          console.log(`Página ${pageId} arquivada com sucesso`);
          // Pequeno delay para evitar rate limits
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Erro ao arquivar página ${pageId}:`, error);
          // Continua mesmo se houver erro
        }
      }
    } catch (error) {
      console.error("Erro ao limpar páginas da raiz:", error);
      throw error;
    }
  }

  /**
   * Obtém todas as páginas filhas de um parent
   * Adicionar na classe NotionSyncService
   */
  private async getAllChildPages(parentId: string): Promise<string[]> {
    try {
      const pageIds: string[] = [];
      let hasMore = true;
      let cursor: string | undefined;

      // Busca paginada para garantir que todas as páginas sejam encontradas
      while (hasMore) {
        const params: any = {
          url: `https://api.notion.com/v1/blocks/${parentId}/children?page_size=100`,
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.notionClient.getToken()}`,
            "Notion-Version": "2022-06-28",
          },
        };

        // Adiciona cursor de paginação se necessário
        if (cursor) {
          params.url += `&start_cursor=${cursor}`;
        }

        const response = await requestUrl(params);

        if (response.status === 200) {
          const data = response.json;

          // Filtra apenas blocos do tipo página
          const pages = data.results.filter(
            (block: any) => block.type === "child_page"
          );

          // Adiciona os IDs ao array
          for (const page of pages) {
            pageIds.push(page.id);
          }

          // Verifica se há mais páginas
          hasMore = data.has_more;
          cursor = data.next_cursor;
        } else {
          throw new Error(`Erro ao buscar páginas: ${response.status}`);
        }
      }

      return pageIds;
    } catch (error) {
      console.error(`Erro ao obter páginas filhas de ${parentId}:`, error);
      throw error;
    }
  }

  /**
   * Arquiva uma página do Notion
   * Adicionar na classe NotionSyncService
   */
  private async archivePage(pageId: string): Promise<void> {
    try {
      const params = {
        url: `https://api.notion.com/v1/pages/${pageId}`,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.notionClient.getToken()}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        contentType: "application/json",
        body: JSON.stringify({
          archived: true,
        }),
      };

      const response = await requestUrl(params);

      if (response.status !== 200) {
        throw new Error(`Erro ao arquivar página: ${response.status}`);
      }
    } catch (error) {
      console.error(`Erro ao arquivar página ${pageId}:`, error);
      throw error;
    }
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
          "Notion-Version": "2022-06-28",
        },
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
   * Parser simplificado de Markdown para blocos do Notion
   * Adicionar à classe NotionSyncService
   */
  private parseMarkdownToBlocks(markdown: string): any[] {
    const blocks: any[] = [];

    // Normalização do texto
    const normalizedMd = markdown
      .replace(/\r\n/g, "\n") // Normaliza quebras de linha
      .replace(/\t/g, "    "); // Converte tabs em espaços

    const lines = normalizedMd.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Blocos de código
      if (line.startsWith("```")) {
        const langMatch = line.match(/^```(\w*)/);
        const language = langMatch ? langMatch[1] : "";

        let codeContent = "";
        i++; // Pula a linha de abertura

        const startLine = i; // Guarda onde começa o conteúdo

        // Coleta o conteúdo até encontrar a linha de fechamento
        while (i < lines.length && !lines[i].startsWith("```")) {
          if (i > startLine) codeContent += "\n";
          codeContent += lines[i];
          i++;
        }

        i++; // Pula a linha de fechamento

        // Adiciona bloco de código com o conteúdo completo
        blocks.push({
          type: "code",
          code: {
            rich_text: [
              {
                type: "text",
                text: { content: codeContent },
              },
            ],
            language: language || "plain text",
          },
        });

        continue;
      }

      // Cabeçalhos (h1, h2, h3)
      if (line.startsWith("# ")) {
        blocks.push({
          type: "heading_1",
          heading_1: {
            rich_text: [
              {
                type: "text",
                text: { content: line.substring(2) },
              },
            ],
          },
        });
        i++;
        continue;
      }

      if (line.startsWith("## ")) {
        blocks.push({
          type: "heading_2",
          heading_2: {
            rich_text: [
              {
                type: "text",
                text: { content: line.substring(3) },
              },
            ],
          },
        });
        i++;
        continue;
      }

      if (line.startsWith("### ")) {
        blocks.push({
          type: "heading_3",
          heading_3: {
            rich_text: [
              {
                type: "text",
                text: { content: line.substring(4) },
              },
            ],
          },
        });
        i++;
        continue;
      }

      // Listas não ordenadas
      if (/^\s*[-*+]\s/.test(line)) {
        const content = line.replace(/^\s*[-*+]\s/, "");
        blocks.push({
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              {
                type: "text",
                text: { content },
              },
            ],
          },
        });
        i++;
        continue;
      }

      // Listas ordenadas
      if (/^\s*\d+\.\s/.test(line)) {
        const content = line.replace(/^\s*\d+\.\s/, "");
        blocks.push({
          type: "numbered_list_item",
          numbered_list_item: {
            rich_text: [
              {
                type: "text",
                text: { content },
              },
            ],
          },
        });
        i++;
        continue;
      }

      // Linha horizontal
      if (/^-{3,}$|^_{3,}$|^\*{3,}$/.test(line)) {
        blocks.push({
          type: "divider",
          divider: {},
        });
        i++;
        continue;
      }

      // Parágrafos
      // Acumula linhas em um único parágrafo até encontrar uma linha em branco
      if (line.trim() !== "") {
        let paragraphContent = line;
        i++;

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

        blocks.push({
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: paragraphContent },
              },
            ],
          },
        });

        continue;
      }

      // Linhas em branco
      i++;
    }

    // Adiciona o objeto necessário para cada bloco
    return blocks.map((block) => ({
      object: "block",
      ...block,
    }));
  }

  /**
   * Método otimizado para criar páginas no Notion com máxima fidelidade
   * Substituir na classe NotionSyncService
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

      // 2. Usar o parser otimizado para blocos Notion
      const blocks = this.parseMarkdownToBlocks(markdownContent);

      // 3. Adicionar os blocos em lotes para evitar limitações da API
      const MAX_BLOCKS_PER_REQUEST = 30; // Reduzido para maior segurança
      for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
        const blockBatch = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);

        try {
          await this.appendBlocksWithRetry(pageId, blockBatch);
          // Maior delay entre requisições para maior segurança
          await new Promise((resolve) => setTimeout(resolve, 500));
          console.log(
            `Lote ${Math.floor(i / MAX_BLOCKS_PER_REQUEST) + 1}/${Math.ceil(
              blocks.length / MAX_BLOCKS_PER_REQUEST
            )} adicionado`
          );
        } catch (appendError) {
          console.error(
            `Erro ao adicionar lote ${i / MAX_BLOCKS_PER_REQUEST + 1}:`,
            appendError
          );
          console.error(appendError);
          // Tenta com lotes menores em caso de erro
          try {
            for (const block of blockBatch) {
              await this.appendBlocksWithRetry(pageId, [block]);
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          } catch (finalError) {
            console.error(
              "Falha em adicionar blocos individualmente:",
              finalError
            );
          }
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
    const headingType = `heading_${level}` as
      | "heading_1"
      | "heading_2"
      | "heading_3";

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
