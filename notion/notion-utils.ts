/**
 * Utilitários para processar e converter conteúdo entre o formato Markdown do Obsidian
 * e os blocos usados pela API do Notion
 */

/**
 * Converte um conteúdo Markdown em blocos do Notion
 * Esta é uma versão inicial simplificada que converte parágrafos e títulos simples
 */
export function markdownToNotionBlocks(markdownContent: string): any[] {
    const blocks: any[] = [];
    const lines = markdownContent.split('\n');
    
    let currentParagraph = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
            // Garantir que o ID tenha o tamanho correto (32 caracteres)
    if (cleanId.length > 32) {
        cleanId = cleanId.substring(0, 32);
    }
    
    return cleanId;
}

/**
 * Extrai o ID da página de uma URL do Notion
 */
export function extractPageIdFromUrl(url: string): string | null {
    // Padrão de URL do Notion: https://www.notion.so/{workspace}/{page-id}
    const match = url.match(/notion\.so\/(?:[^/]+\/)?([a-zA-Z0-9]+)/);
    
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

/**
 * Processa propriedades de metadados do frontmatter do Markdown
 */
export function processMarkdownFrontmatter(content: string): { 
    metadata: Record<string, any>;
    content: string;
} {
    // Verifica se o conteúdo possui frontmatter (delimitado por ---)
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return {
            metadata: {},
            content: content
        };
    }
    
    // Extrai frontmatter e conteúdo
    const frontmatter = match[1];
    const mainContent = match[2];
    
    // Processa o frontmatter para obter os metadados
    const metadata: Record<string, any> = {};
    const lines = frontmatter.split('\n');
    
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            
            // Remove aspas se presentes
            metadata[key] = value.replace(/^["'](.*)["']$/, '$1');
        }
    }
    
    return {
        metadata,
        content: mainContent
    };
} Processa cabeçalhos (h1, h2, h3)
        if (line.startsWith('# ')) {
            // Adiciona o parágrafo acumulado se existir
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            
            // Adiciona o bloco de título
            blocks.push(createHeadingBlock(line.substring(2), 1));
            continue;
        }
        
        if (line.startsWith('## ')) {
            // Adiciona o parágrafo acumulado se existir
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            
            // Adiciona o bloco de título h2
            blocks.push(createHeadingBlock(line.substring(3), 2));
            continue;
        }
        
        if (line.startsWith('### ')) {
            // Adiciona o parágrafo acumulado se existir
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            
            // Adiciona o bloco de título h3
            blocks.push(createHeadingBlock(line.substring(4), 3));
            continue;
        }
        
        // Processa listas não ordenadas
        if (line.match(/^\s*[-*+]\s/)) {
            // Adiciona o parágrafo acumulado se existir
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            
            // Extrai o conteúdo do item da lista
            const itemContent = line.replace(/^\s*[-*+]\s/, '');
            blocks.push(createBulletListBlock(itemContent));
            continue;
        }
        
        // Processa listas numeradas
        if (line.match(/^\s*\d+\.\s/)) {
            // Adiciona o parágrafo acumulado se existir
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            
            // Extrai o conteúdo do item da lista
            const itemContent = line.replace(/^\s*\d+\.\s/, '');
            blocks.push(createNumberedListBlock(itemContent));
            continue;
        }
        
        // Processa blocos de código
        if (line.startsWith('```')) {
            // Adiciona o parágrafo acumulado se existir
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            
            // Extrai a linguagem do bloco de código
            const language = line.substring(3).trim();
            
            // Coleta o conteúdo do bloco de código
            let codeContent = '';
            let j = i + 1;
            while (j < lines.length && !lines[j].startsWith('```')) {
                codeContent += lines[j] + '\n';
                j++;
            }
            
            // Adiciona o bloco de código
            blocks.push(createCodeBlock(codeContent, language));
            
            // Avança o índice para depois do bloco de código
            i = j;
            continue;
        }
        
        // Processa linhas em branco
        if (line.trim() === '') {
            // Adiciona o parágrafo acumulado se existir
            if (currentParagraph) {
                blocks.push(createParagraphBlock(currentParagraph));
                currentParagraph = '';
            }
            continue;
        }
        
        // Para outros conteúdos, acumula como parágrafos
        if (currentParagraph) {
            currentParagraph += '\n' + line;
        } else {
            currentParagraph = line;
        }
    }
    
    // Adiciona o último parágrafo se existir
    if (currentParagraph) {
        blocks.push(createParagraphBlock(currentParagraph));
    }
    
    return blocks;
}

/**
 * Cria um bloco de parágrafo para a API do Notion
 */
function createParagraphBlock(content: string) {
    return {
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
    };
}

/**
 * Cria um bloco de título para a API do Notion
 */
function createHeadingBlock(content: string, level: 1 | 2 | 3) {
    const headingType = `heading_${level}` as 'heading_1' | 'heading_2' | 'heading_3';
    
    return {
        object: 'block',
        type: headingType,
        [headingType]: {
            rich_text: [
                {
                    type: 'text',
                    text: {
                        content,
                    },
                },
            ],
        },
    };
}

/**
 * Cria um item de lista não ordenada para a API do Notion
 */
function createBulletListBlock(content: string) {
    return {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
            rich_text: [
                {
                    type: 'text',
                    text: {
                        content,
                    },
                },
            ],
        },
    };
}

/**
 * Cria um item de lista numerada para a API do Notion
 */
function createNumberedListBlock(content: string) {
    return {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
            rich_text: [
                {
                    type: 'text',
                    text: {
                        content,
                    },
                },
            ],
        },
    };
}

/**
 * Cria um bloco de código para a API do Notion
 */
function createCodeBlock(content: string, language: string = '') {
    return {
        object: 'block',
        type: 'code',
        code: {
            rich_text: [
                {
                    type: 'text',
                    text: {
                        content,
                    },
                },
            ],
            language: language || 'plain text',
        },
    };
}

/**
 * Limpa o ID da página do Notion (remove hífens e caracteres extra)
 */
export function cleanPageId(pageId: string): string {
    // Remove caracteres não alfanuméricos (como hífens)
    let cleanId = pageId.replace(/[^a-zA-Z0-9]/g, '');
    
    //