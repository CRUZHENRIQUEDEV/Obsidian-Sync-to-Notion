import { requestUrl } from "obsidian";

/**
 * Cliente Notion simplificado que usa apenas requestUrl do Obsidian
 * para evitar problemas de CORS
 */
export default class NotionClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async createPageWithMarkdown(
    parentId: string,
    title: string,
    markdownContent: string
  ): Promise<string> {
    try {
      console.log(`Criando página "${title}" com conteúdo Markdown direto`);

      // Cria a página com o conteúdo Markdown como um bloco de código
      const pageData = {
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
            type: "code",
            code: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: markdownContent,
                  },
                },
              ],
              language: "markdown",
            },
          },
        ],
      };

      const params = {
        url: "https://api.notion.com/v1/pages",
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        contentType: "application/json",
        body: JSON.stringify(pageData),
      };

      const response = await requestUrl(params);

      if (response.status === 200) {
        const pageId = response.json.id;
        console.log(`Página criada com sucesso. ID: ${pageId}`);
        return pageId;
      } else {
        throw new Error(`Resposta inesperada: ${response.status}`);
      }
    } catch (error) {
      console.error(`Erro ao criar página com Markdown: ${error}`);
      throw error;
    }
  }

  // Adicionar ao arquivo notion-client.ts na classe NotionClient
  async sendRequest(
    endpoint: string,
    method: string,
    body?: any
  ): Promise<any> {
    return await this.obsidianRequest(endpoint, method, body);
  }

  /**
   * Verifica se uma página já existe no Notion com o mesmo título em um parent
   * Adicionar ao arquivo notion-client.ts
   */
  async pageExistsWithTitle(
    parentId: string,
    title: string
  ): Promise<string | null> {
    try {
      console.log(`Verificando se página "${title}" já existe em ${parentId}`);

      // Busca páginas filhas do parent
      const params = {
        url: `https://api.notion.com/v1/blocks/${parentId}/children?page_size=100`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Notion-Version": "2022-06-28",
        },
      };

      const response = await requestUrl(params);

      if (response.status === 200) {
        const pages = response.json.results.filter(
          (block: any) => block.type === "child_page"
        );

        // Procura uma página com o mesmo título (ignorando case)
        for (const page of pages) {
          if (
            page.child_page &&
            title.toLowerCase() === page.child_page.title?.toLowerCase()
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
   * Retorna o token de autenticação do Notion
   * Necessário para permitir requisições diretas no NotionSyncService
   */
  getToken(): string {
    return this.token;
  }

  /**
   * Método para manter compatibilidade com o código existente
   */
  getClient() {
    console.warn("getClient() está deprecado, use os métodos diretos");
    return {
      pages: {
        create: async (data: any) => {
          return await this.obsidianRequest("/pages", "POST", data);
        },
        update: async (data: any) => {
          return await this.obsidianRequest(
            `/pages/${data.page_id}`,
            "PATCH",
            data
          );
        },
        retrieve: async (data: any) => {
          return await this.obsidianRequest(`/pages/${data.page_id}`, "GET");
        },
      },
      blocks: {
        children: {
          list: async (data: any) => {
            return await this.obsidianRequest(
              `/blocks/${data.block_id}/children`,
              "GET"
            );
          },
          append: async (data: any) => {
            return await this.obsidianRequest(
              `/blocks/${data.block_id}/children`,
              "PATCH",
              data
            );
          },
        },
        delete: async (data: any) => {
          return await this.obsidianRequest(
            `/blocks/${data.block_id}`,
            "DELETE"
          );
        },
      },
      users: {
        me: async () => {
          return await this.obsidianRequest("/users/me", "GET");
        },
      },
    };
  }

  /**
   * Método auxiliar para fazer requisições via Obsidian requestUrl
   * para evitar problemas de CORS
   */
  private async obsidianRequest(
    endpoint: string,
    method: string,
    body?: any
  ): Promise<any> {
    const url = `https://api.notion.com/v1${endpoint}`;
    console.log(`Fazendo requisição ${method} para ${url}`);

    try {
      const params = {
        url: url,
        method: method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        contentType: "application/json",
        body: body ? JSON.stringify(body) : undefined,
      };

      console.log("Parâmetros da requisição:", JSON.stringify(params, null, 2));

      const response = await requestUrl(params);
      console.log(`Resposta recebida com status ${response.status}`);
      return response.json;
    } catch (error) {
      console.error(`Erro na requisição para ${url}:`, error);
      throw error;
    }
  }

  /**
   * Testa a conexão com a API do Notion
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log("Testando conexão com Notion...");
      console.log(
        "Usando token:",
        this.token ? `${this.token.substring(0, 4)}...` : "indefinido"
      );

      const response = await this.obsidianRequest("/users/me", "GET");
      console.log("API Response:", response);
      return true;
    } catch (error) {
      console.error("Erro de conexão:", error);
      return false;
    }
  }

  /**
   * Cria uma nova página no Notion usando requestUrl do Obsidian
   */
  async createPage(
    parentPageId: string,
    title: string,
    blocks: any[]
  ): Promise<string> {
    try {
      console.log(`Criando página "${title}" no parent ${parentPageId}`);

      const data = {
        parent: {
          page_id: parentPageId,
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
        children: blocks,
      };

      const response = await this.obsidianRequest("/pages", "POST", data);
      console.log(`Página criada com sucesso, ID: ${response.id}`);
      return response.id;
    } catch (error) {
      console.error(
        `Erro ao criar página "${title}" em ${parentPageId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtém informações sobre uma página do Notion
   */
  async getPage(pageId: string) {
    try {
      return await this.obsidianRequest(`/pages/${pageId}`, "GET");
    } catch (error) {
      console.error(`Erro ao obter página ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Atualiza o conteúdo de uma página existente
   */
  async updatePageContent(pageId: string, content: string) {
    try {
      console.log(`Atualizando conteúdo da página ${pageId}`);

      // Primeiro, limpar todos os blocos existentes
      await this.clearAllBlocks(pageId);

      // Depois, adicionar o novo conteúdo
      const blocks = [
        {
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
        },
      ];

      await this.obsidianRequest(`/blocks/${pageId}/children`, "PATCH", {
        children: blocks,
      });

      console.log(`Conteúdo da página atualizado com sucesso`);
    } catch (error) {
      console.error(`Erro ao atualizar conteúdo da página ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Obtém todos os blocos de uma página
   */
  async getBlocks(pageId: string) {
    try {
      return await this.obsidianRequest(`/blocks/${pageId}/children`, "GET");
    } catch (error) {
      console.error(`Erro ao obter blocos da página ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Remove todos os blocos de uma página
   */
  private async clearAllBlocks(pageId: string) {
    try {
      console.log(`Limpando blocos da página ${pageId}`);

      // Obtém todos os blocos existentes
      const response = await this.getBlocks(pageId);
      console.log(`Encontrados ${response.results.length} blocos para remover`);

      // Remove cada bloco
      for (const block of response.results) {
        await this.obsidianRequest(`/blocks/${block.id}`, "DELETE");
        // Pequeno delay para evitar rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(`Todos os blocos removidos com sucesso`);
    } catch (error) {
      console.error(`Erro ao limpar blocos da página ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Cria uma página de pasta no Notion
   */
  async createFolderPage(parentId: string, folderName: string) {
    try {
      console.log(`Criando pasta "${folderName}" no parent ${parentId}`);

      const data = {
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
      };

      const response = await this.obsidianRequest("/pages", "POST", data);
      console.log(`Pasta criada com sucesso, ID: ${response.id}`);
      return response.id;
    } catch (error) {
      console.error(`Erro ao criar pasta ${folderName} em ${parentId}:`, error);
      throw error;
    }
  }
}
