import type * as notion from './notion';
import { BlocksOptions, RichTextOptions } from './parser/internal';
/**
 * Parses Markdown content into Notion Blocks.
 *
 * @param body Any Markdown or GFM content
 * @param options Any additional option
 */
export declare function markdownToBlocks(body: string, options?: BlocksOptions): notion.Block[];
/**
 * Parses inline Markdown content into Notion RichText objects.
 * Only supports plain text, italics, bold, strikethrough, inline code, and hyperlinks.
 *
 * @param text any inline Markdown or GFM content
 * @param options Any additional option
 */
export declare function markdownToRichText(text: string, options?: RichTextOptions): notion.RichText[];
