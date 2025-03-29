import { Client } from '@notionhq/client';

/**
 * Cliente da API do Notion configurado com o token de autenticação
 */
export default class NotionClient {
    private client: Client;
    
    constructor(token: string) {
        this.client = new Client({
            auth: token,
        });
    }
    
    /**
     * Obtém o cliente da API do Notion
     */
    getClient(): Client {
        return this.client;
    }
    
    /**
     * Verifica se a conexão com a API do Notion está funcionando
     */
    async testConnection(): Promise<boolean> {
        try {
            // Tenta obter usuários para verificar se o token é válido
            const response = await this.client.users.list({});
            return response.results.length > 0;
        } catch (error) {
            console.error('Erro ao testar conexão com o Notion:', error);
            return false;
        }
    }
    
    /**
     * Obtém informações de uma página do Notion
     */
    async getPage(pageId: string) {
        try {
            return await this.client.pages.retrieve({
                page_id: pageId,
            });
        } catch (error) {
            console.error(`Erro ao obter página ${pageId}:`, error);
            throw error;
        }
    }
    
    /**
     * Cria uma nova página dentro de uma página existente
     */
    async createPage(parentPageId: string, title: string, content: string) {
        try {
            const response = await this.client.pages.create({
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
                // Este é um placeholder. Na implementação real, o conteúdo precisará ser 
                // convertido para o formato de blocos do Notion
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [
                                {
                                    type: 'text',
                                    text: {
                                        content,
                                    },
                                },
                            ],
                        },
                    },
                ],
            });
            
            return response;
        } catch (error) {
            console.error(`Erro ao criar página "${title}" em ${parentPageId}:`, error);
            throw error;
        }
    }
    
    /**
     * Atualiza o conteúdo de uma página existente
     */
    async updatePageContent(pageId: string, content: string) {
        try {
            // Primeiro, precisamos limpar todos os blocos existentes
            await this.clearAllBlocks(pageId);
            
            // Depois, adicionamos o novo conteúdo
            await this.client.blocks.children.append({
                block_id: pageId,
                children: [
                    {
                        object: 'block',
                        type: 'paragraph',
                        paragraph: {
                            rich_text: [
                                {
                                    type: 'text',
                                    text: {
                                        content,
                                    },
                                },
                            ],
                        },
                    },
                ],
            });
        } catch (error) {
            console.error(`Erro ao atualizar conteúdo da página ${pageId}:`, error);
            throw error;
        }
    }
    
    /**
     * Remove todos os blocos de uma página
     */
    private async clearAllBlocks(pageId: string) {
        try {
            // Obtém todos os blocos existentes
            const response = await this.client.blocks.children.list({
                block_id: pageId,
            });
            
            // Remove cada bloco
            for (const block of response.results) {
                await this.client.blocks.delete({
                    block_id: block.id,
                });
                
                // Pequeno delay para evitar rate limits
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (error) {
            console.error(`Erro ao limpar blocos da página ${pageId}:`, error);
            throw error;
        }
    }
}