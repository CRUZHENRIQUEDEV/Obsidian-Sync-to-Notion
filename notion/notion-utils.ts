/**
 * Utilities for processing and converting content between Obsidian Markdown format
 * and Notion API blocks
 */

/**
 * Converts Markdown content into Notion blocks
 * This is a simplified initial version that converts paragraphs and simple headings
 */
export function markdownToNotionBlocks(markdownContent: string): any[] {
  const blocks: any[] = [];
  const lines = markdownContent.split("\n");

  let currentParagraph = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

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

    // Process code blocks
    if (line.startsWith("```")) {
      // Add accumulated paragraph if it exists
      if (currentParagraph) {
        blocks.push(createParagraphBlock(currentParagraph));
        currentParagraph = "";
      }

      // Extract code block language
      const language = line.substring(3).trim();

      // Collect code block content
      let codeContent = "";
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith("```")) {
        codeContent += lines[j] + "\n";
        j++;
      }

      // Add code block
      blocks.push(createCodeBlock(codeContent, language));

      // Advance index to after the code block
      i = j;
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
 * Creates a code block for the Notion API
 */
function createCodeBlock(content: string, language: string = "") {
  return {
    object: "block",
    type: "code",
    code: {
      rich_text: [
        {
          type: "text",
          text: {
            content,
          },
        },
      ],
      language: language || "plain text",
    },
  };
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
