import { markdownToBlocks } from "@tryfabric/martian";




/**
 * Divide um conteúdo grande em blocos menores para evitar limites da API
 */
export function splitIntoManageableBlocks(blocks: any[]): any[][] {
  const MAX_BLOCKS_PER_REQUEST = 40; // Notion tem limite de ~100 blocos por requisição
  const chunks = [];

  for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
    chunks.push(blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST));
  }

  return chunks;
}

export function sanitizeBlocks(blocks: any[]): any[] {
  return blocks
    .map((block, index) => {
      try {
        // Verifica se o bloco é do tipo que pode conter texto longo
        if (block.type === "paragraph" || block.type === "code") {
          const richText = block[block.type]?.rich_text;
          if (Array.isArray(richText)) {
            const totalLength = richText.reduce(
              (sum, rt) => sum + (rt.plain_text?.length || 0),
              0
            );

            // Limite arbitrário de 2000 caracteres por bloco (ajustável)
            if (totalLength > 2000) {
              console.warn(
                `Block #${index} (${block.type}) too long (${totalLength} chars). Splitting or ignoring.`
              );

              // Se quiser ignorar: return null;
              // Aqui podemos fatiar os textos (exemplo abaixo fatiando para 2000 caracteres)
              const splitText: string[] = [];
              let buffer = "";

              for (const rt of richText) {
                buffer += rt.plain_text;
                while (buffer.length >= 2000) {
                  splitText.push(buffer.slice(0, 2000));
                  buffer = buffer.slice(2000);
                }
              }
              if (buffer.length > 0) splitText.push(buffer);

              return splitText.map((text) => ({
                type: block.type,
                [block.type]: {
                  rich_text: [
                    {
                      type: "text",
                      text: { content: text },
                    },
                  ],
                },
              }));
            }
          }
        }

        return block;
      } catch (err) {
        console.warn(`Error sanitizing block at index ${index}`, err);
        return null;
      }
    })
    .flat() // para lidar com múltiplos blocos divididos
    .filter(Boolean); // remove nulos
}


/**
 * Converte Markdown para blocos do Notion usando @tryfabric/martian
 */
export function enhancedMarkdownToNotionBlocks(markdownContent: string): any[] {
  const blocks = markdownToBlocks(markdownContent);

  // Opcional: sanitizar se quiser truncar blocos grandes ou fazer logs
  return sanitizeBlocks(blocks);
}




/**
 * Processa links do formato Obsidian para formato compatível com Notion
 * @param content Conteúdo do arquivo com links do Obsidian
 * @param pageMap Mapa de caminhos do Obsidian para IDs do Notion
 */
export function processObsidianLinks(
  content: string,
  pageMap: Record<string, string>
): string {
  const linkRegex = /\[\[(.*?)(?:\|(.*?))?\]\]/g;
  let processedContent = content;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const fullMatch = match[0];
    const linkTarget = match[1];
    const linkText = match[2] || linkTarget;

    // Tenta encontrar o caminho completo do arquivo (pode ser com ou sem .md)
    const targetPathWithMd = `${linkTarget}.md`;
    const notionPageId = pageMap[linkTarget] || pageMap[targetPathWithMd];

    if (notionPageId) {
      // Formata o link para o Notion
      const notionLink = `[${linkText}](https://www.notion.so/${notionPageId.replace(
        /-/g,
        ""
      )})`;
      processedContent = processedContent.replace(fullMatch, notionLink);
    } else {
      // Se não encontrar o ID no Notion, transforma em texto simples
      processedContent = processedContent.replace(fullMatch, linkText);
    }
  }

  return processedContent;
}

/**
 * Cleans a Notion page ID (removes hyphens and extra characters)
 */
export function cleanPageId(pageId: string): string {
  // Remove non-alphanumeric characters (like hyphens)
  let cleanId = pageId.replace(/[^a-zA-Z0-9]/g, "");

  // Ensure ID has the correct length (32 characters)
  if (cleanId.length > 32) {
    cleanId = cleanId.substring(0, 32);
  }

  return cleanId;
}

/**
 * Extracts a page ID from a Notion URL
 */
export function extractPageIdFromUrl(url: string): string | null {
  // Notion URL pattern: https://www.notion.so/{workspace}/{page-id}
  const match = url.match(/notion\.so\/(?:[^/]+\/)?([a-zA-Z0-9]+)/);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

/**
 * Processes metadata properties from Markdown frontmatter
 */
export function processMarkdownFrontmatter(content: string): {
  metadata: Record<string, any>;
  content: string;
} {
  // Check if content has frontmatter (delimited by ---)
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      metadata: {},
      content: content,
    };
  }

  // Extract frontmatter and content
  const frontmatter = match[1];
  const mainContent = match[2];

  // Process frontmatter to get metadata
  const metadata: Record<string, any> = {};
  const lines = frontmatter.split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex !== -1) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      // Remove quotes if present
      metadata[key] = value.replace(/^["'](.*)["']$/, "$1");
    }
  }

  return {
    metadata,
    content: mainContent,
  };
}
