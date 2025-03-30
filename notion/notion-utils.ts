/**
 * Sanitiza o conteúdo para garantir compatibilidade com a API do Notion
 * Remove ou substitui caracteres problemáticos
 */
function sanitizeContent(content: string): string {
  // Remove caracteres de controle invisíveis que podem causar problemas
  let sanitized = content.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

  // Limita o tamanho de parágrafos muito longos
  const MAX_PARAGRAPH_LENGTH = 1900;
  const paragraphs = sanitized.split("\n\n");
  const limitedParagraphs = paragraphs.map((p) => {
    if (p.length > MAX_PARAGRAPH_LENGTH) {
      return p.substring(0, MAX_PARAGRAPH_LENGTH) + "...";
    }
    return p;
  });

  return limitedParagraphs.join("\n\n");
}

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

/**
 * Processa e sanitiza blocos complexos que podem causar problemas na API
 */
export function sanitizeBlocks(blocks: any[]): any[] {
  return blocks.map((block) => {
    // Tratamento especial para blocos de código
    if (block.type === "code" && block.code?.rich_text?.[0]?.text?.content) {
      const content = block.code.rich_text[0].text.content;
      // Limitar tamanho e sanitizar
      if (content.length > 1900) {
        block.code.rich_text[0].text.content =
          content.substring(0, 1900) + "\n\n... (conteúdo truncado)";
      }

      // Escape de caracteres problemáticos em blocos de código
      block.code.rich_text[0].text.content =
        block.code.rich_text[0].text.content
          .replace(/\\/g, "\\\\") // Escape de backslashes
          .replace(/\u0000-\u001F/g, ""); // Remove caracteres de controle
    }

    // Tratamento para blocos de texto comuns
    if (
      block.type === "paragraph" &&
      block.paragraph?.rich_text?.[0]?.text?.content
    ) {
      const content = block.paragraph.rich_text[0].text.content;
      if (content.length > 1900) {
        block.paragraph.rich_text[0].text.content =
          content.substring(0, 1900) + "...";
      }
    }

    return block;
  });
}

/**
 * Versão melhorada da função markdownToNotionBlocks que lida melhor com conteúdo complexo
 */
export function enhancedMarkdownToNotionBlocks(markdownContent: string): any[] {
  // Sanitizar o conteúdo Markdown
  const sanitizedMarkdown = sanitizeContent(markdownContent);

  // Converter para blocos do Notion
  let rawBlocks = markdownToNotionBlocks(sanitizedMarkdown);

  // Processar blocos de código grandes
  rawBlocks = rawBlocks
    .map((block) => {
      if (
        block.type === "code" &&
        block.code?.rich_text?.[0]?.text?.content &&
        block.code.rich_text[0].text.content.length > 1800
      ) {
        // Dividir o conteúdo em partes menores
        const content = block.code.rich_text[0].text.content;
        const language = block.code.language;
        const parts = splitContentIntoChunks(content, 1800);

        // Criar múltiplos blocos de código
        return parts.map((part) => createCodeBlock(part, language));
      }

      return block;
    })
    .flat(); // Achatar o array para incluir todos os blocos de código divididos

  // Sanitizar os blocos resultantes
  return sanitizeBlocks(rawBlocks);
}

/**
 * Divide conteúdo em chunks menores, tentando quebrar em linhas para preservar formatação
 */
function splitContentIntoChunks(content: string, maxSize: number): string[] {
  const chunks = [];
  let start = 0;

  while (start < content.length) {
    // Tentar terminar na quebra de linha para preservar a formatação
    let end = start + maxSize;
    if (end < content.length) {
      const newlinePos = content.lastIndexOf("\n", end);
      if (newlinePos > start) {
        end = newlinePos;
      }
    } else {
      end = content.length;
    }

    chunks.push(content.substring(start, end));
    start = end + 1; // Pular a quebra de linha
  }

  return chunks;
}

/**
 * Versão melhorada da função markdownToNotionBlocks que lida melhor com conteúdo complexo
 */

/**
 * Escapa caracteres especiais em blocos de código para evitar problemas na API do Notion
 * @param content Conteúdo do bloco de código
 */
function escapeCodeContent(content: string): string {
  // Escape characters that might cause issues in Notion API
  return content
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/\n/g, "\\n") // Replace newlines with escaped newlines for JSON
    .replace(/\r/g, "\\r") // Replace carriage returns
    .replace(/\t/g, "\\t"); // Replace tabs
}

/**
 * Função auxiliar para criar um bloco de código corretamente
 */
/**
 * Função auxiliar para criar um bloco de código corretamente
 */
function createCodeBlock(content: string, language: string = ""): any {
  // Remover os delimitadores de código ```
  content = content.replace(/^```[\w-]*\n|```$/g, "");

  // Escapar caracteres problemáticos
  content = content
    .replace(/\\/g, "\\\\") // Escapar backslashes primeiro
    .replace(/"/g, '\\"') // Escapar aspas duplas
    .replace(/\t/g, "  "); // Substituir tabs por espaços

  // Verificar se a linguagem é suportada pelo Notion
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
 * Converte Markdown para blocos do Notion com tratamento especial para código XAML
 */
export function markdownToNotionBlocks(markdownContent: string): any[] {
  const blocks: any[] = [];
  const lines = markdownContent.split("\n");

  let currentParagraph = "";
  let inCodeBlock = false;
  let codeContent = "";
  let codeLanguage = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Process code blocks - this is a critical part for XAML and other problematic languages
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        // Start of code block
        inCodeBlock = true;

        // Add accumulated paragraph if it exists
        if (currentParagraph) {
          blocks.push(createParagraphBlock(currentParagraph));
          currentParagraph = "";
        }

        // Extract language
        codeLanguage = line.substring(3).trim();
        codeContent = "";
      } else {
        // End of code block
        inCodeBlock = false;

        // Create code block with special handling
        blocks.push(createCodeBlock(codeContent, codeLanguage));
        codeContent = "";
        codeLanguage = "";
      }
      continue;
    }

    // If we're in a code block, accumulate content
    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    // Process headings (h1, h2, h3)
    if (line.startsWith("# ")) {
      // Add accumulated paragraph if it exists
      if (currentParagraph) {
        blocks.push(createParagraphBlock(currentParagraph));
        currentParagraph = "";
      }

      // Add heading block
      blocks.push(createHeadingBlock(line.substring(2), 1));
      continue;
    }

    if (line.startsWith("## ")) {
      // Add accumulated paragraph if it exists
      if (currentParagraph) {
        blocks.push(createParagraphBlock(currentParagraph));
        currentParagraph = "";
      }

      // Add h2 heading block
      blocks.push(createHeadingBlock(line.substring(3), 2));
      continue;
    }

    if (line.startsWith("### ")) {
      // Add accumulated paragraph if it exists
      if (currentParagraph) {
        blocks.push(createParagraphBlock(currentParagraph));
        currentParagraph = "";
      }

      // Add h3 heading block
      blocks.push(createHeadingBlock(line.substring(4), 3));
      continue;
    }

    // Process unordered lists
    if (line.match(/^\s*[-*+]\s/)) {
      // Add accumulated paragraph if it exists
      if (currentParagraph) {
        blocks.push(createParagraphBlock(currentParagraph));
        currentParagraph = "";
      }

      // Extract list item content
      const itemContent = line.replace(/^\s*[-*+]\s/, "");
      blocks.push(createBulletListBlock(itemContent));
      continue;
    }

    // Process numbered lists
    if (line.match(/^\s*\d+\.\s/)) {
      // Add accumulated paragraph if it exists
      if (currentParagraph) {
        blocks.push(createParagraphBlock(currentParagraph));
        currentParagraph = "";
      }

      // Extract list item content
      const itemContent = line.replace(/^\s*\d+\.\s/, "");
      blocks.push(createNumberedListBlock(itemContent));
      continue;
    }

    // Process blank lines
    if (line.trim() === "") {
      // Add accumulated paragraph if it exists
      if (currentParagraph) {
        blocks.push(createParagraphBlock(currentParagraph));
        currentParagraph = "";
      }
      continue;
    }

    // For other content, accumulate as paragraphs
    if (currentParagraph) {
      currentParagraph += "\n" + line;
    } else {
      currentParagraph = line;
    }
  }

  // Check if we're still in a code block (malformed markdown)
  if (inCodeBlock && codeContent) {
    blocks.push(createCodeBlock(codeContent, codeLanguage));
  }

  // Add the last paragraph if it exists
  if (currentParagraph) {
    blocks.push(createParagraphBlock(currentParagraph));
  }

  return blocks;
}

/**
 * Creates a paragraph block for the Notion API
 */
function createParagraphBlock(content: string) {
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
 * Creates a heading block for the Notion API
 */
function createHeadingBlock(content: string, level: 1 | 2 | 3) {
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
 * Creates an unordered list item for the Notion API
 */
function createBulletListBlock(content: string) {
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
 * Creates a numbered list item for the Notion API
 */
function createNumberedListBlock(content: string) {
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
