import type { RichText } from './blocks';
/**
 * The limits that the Notion API uses for property values.
 * @see https://developers.notion.com/reference/request-limits#limits-for-property-values
 */
export declare const LIMITS: {
    PAYLOAD_BLOCKS: number;
    RICH_TEXT_ARRAYS: number;
    RICH_TEXT: {
        TEXT_CONTENT: number;
        LINK_URL: number;
        EQUATION_EXPRESSION: number;
    };
};
export interface RichTextOptions {
    type?: 'text' | 'equation';
    annotations?: {
        bold?: boolean;
        italic?: boolean;
        strikethrough?: boolean;
        underline?: boolean;
        code?: boolean;
        color?: string;
    };
    url?: string;
}
export declare function richText(content: string, options?: RichTextOptions): RichText;
export declare const SUPPORTED_CODE_BLOCK_LANGUAGES: readonly ["abap", "arduino", "bash", "basic", "c", "clojure", "coffeescript", "c++", "c#", "css", "dart", "diff", "docker", "elixir", "elm", "erlang", "flow", "fortran", "f#", "gherkin", "glsl", "go", "graphql", "groovy", "haskell", "html", "java", "javascript", "json", "julia", "kotlin", "latex", "less", "lisp", "livescript", "lua", "makefile", "markdown", "markup", "matlab", "mermaid", "nix", "objective-c", "ocaml", "pascal", "perl", "php", "plain text", "powershell", "prolog", "protobuf", "python", "r", "reason", "ruby", "rust", "sass", "scala", "scheme", "scss", "shell", "sql", "swift", "typescript", "vb.net", "verilog", "vhdl", "visual basic", "webassembly", "xml", "yaml", "java/c/c++/c#"];
export declare type supportedCodeLang = typeof SUPPORTED_CODE_BLOCK_LANGUAGES[number];
export declare function isSupportedCodeLang(lang: string): lang is supportedCodeLang;
