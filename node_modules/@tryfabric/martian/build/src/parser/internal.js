"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRichText = exports.parseBlocks = void 0;
const notion = __importStar(require("../notion"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const notion_1 = require("../notion");
function ensureLength(text, copy) {
    const chunks = text.match(/[^]{1,2000}/g) || [];
    return chunks.flatMap((item) => notion.richText(item, copy));
}
function ensureCodeBlockLanguage(lang) {
    if (lang) {
        lang = lang.toLowerCase();
        return (0, notion_1.isSupportedCodeLang)(lang) ? lang : notion.parseCodeLanguage(lang);
    }
    return undefined;
}
function parseInline(element, options) {
    var _a;
    const copy = {
        annotations: {
            ...((_a = options === null || options === void 0 ? void 0 : options.annotations) !== null && _a !== void 0 ? _a : {}),
        },
        url: options === null || options === void 0 ? void 0 : options.url,
    };
    switch (element.type) {
        case 'text':
            return ensureLength(element.value, copy);
        case 'delete':
            copy.annotations.strikethrough = true;
            return element.children.flatMap(child => parseInline(child, copy));
        case 'emphasis':
            copy.annotations.italic = true;
            return element.children.flatMap(child => parseInline(child, copy));
        case 'strong':
            copy.annotations.bold = true;
            return element.children.flatMap(child => parseInline(child, copy));
        case 'link':
            copy.url = element.url;
            return element.children.flatMap(child => parseInline(child, copy));
        case 'inlineCode':
            copy.annotations.code = true;
            return [notion.richText(element.value, copy)];
        case 'inlineMath':
            return [notion.richText(element.value, { ...copy, type: 'equation' })];
        default:
            return [];
    }
}
function parseImage(image, options) {
    var _a;
    // https://developers.notion.com/reference/block#image-blocks
    const allowedTypes = [
        '.png',
        '.jpg',
        '.jpeg',
        '.gif',
        '.tif',
        '.tiff',
        '.bmp',
        '.svg',
        '.heic',
    ];
    function dealWithError() {
        return notion.paragraph([notion.richText(image.url)]);
    }
    try {
        if ((_a = options.strictImageUrls) !== null && _a !== void 0 ? _a : true) {
            const parsedUrl = new url_1.URL(image.url);
            const fileType = path_1.default.extname(parsedUrl.pathname);
            if (allowedTypes.includes(fileType)) {
                return notion.image(image.url);
            }
            else {
                return dealWithError();
            }
        }
        else {
            return notion.image(image.url);
        }
    }
    catch (error) {
        return dealWithError();
    }
}
function parseParagraph(element, options) {
    // Paragraphs can also be legacy 'TOC' from some markdown, so we check first
    const mightBeToc = element.children.length > 2 &&
        element.children[0].type === 'text' &&
        element.children[0].value === '[[' &&
        element.children[1].type === 'emphasis';
    if (mightBeToc) {
        const emphasisItem = element.children[1];
        const emphasisTextItem = emphasisItem.children[0];
        if (emphasisTextItem.value === 'TOC') {
            return [notion.table_of_contents()];
        }
    }
    // Notion doesn't deal with inline images, so we need to parse them all out
    // of the paragraph into individual blocks
    const images = [];
    const paragraphs = [];
    element.children.forEach(item => {
        if (item.type === 'image') {
            images.push(parseImage(item, options));
        }
        else {
            const richText = parseInline(item);
            if (richText.length) {
                paragraphs.push(richText);
            }
        }
    });
    if (paragraphs.length) {
        return [notion.paragraph(paragraphs.flat()), ...images];
    }
    else {
        return images;
    }
}
function parseBlockquote(element, options) {
    const children = element.children.flatMap(child => parseNode(child, options));
    return notion.blockquote([], children);
}
function parseHeading(element) {
    const text = element.children.flatMap(child => parseInline(child));
    switch (element.depth) {
        case 1:
            return notion.headingOne(text);
        case 2:
            return notion.headingTwo(text);
        default:
            return notion.headingThree(text);
    }
}
function parseCode(element) {
    const text = ensureLength(element.value);
    const lang = ensureCodeBlockLanguage(element.lang);
    return notion.code(text, lang);
}
function parseList(element, options) {
    return element.children.flatMap(item => {
        const paragraph = item.children.shift();
        if (paragraph === undefined || paragraph.type !== 'paragraph') {
            return [];
        }
        const text = paragraph.children.flatMap(child => parseInline(child));
        // Now process any of the children
        const parsedChildren = item.children.flatMap(child => parseNode(child, options));
        if (element.start !== null && element.start !== undefined) {
            return [notion.numberedListItem(text, parsedChildren)];
        }
        else if (item.checked !== null && item.checked !== undefined) {
            return [notion.toDo(item.checked, text, parsedChildren)];
        }
        else {
            return [notion.bulletedListItem(text, parsedChildren)];
        }
    });
}
function parseTableCell(node) {
    return [node.children.flatMap(child => parseInline(child))];
}
function parseTableRow(node) {
    const tableCells = node.children.flatMap(child => parseTableCell(child));
    return [notion.tableRow(tableCells)];
}
function parseTable(node) {
    var _a;
    // The width of the table is the amount of cells in the first row, as all rows must have the same number of cells
    const tableWidth = ((_a = node.children) === null || _a === void 0 ? void 0 : _a.length)
        ? node.children[0].children.length
        : 0;
    const tableRows = node.children.flatMap(child => parseTableRow(child));
    return [notion.table(tableRows, tableWidth)];
}
function parseMath(node) {
    const textWithKatexNewlines = node.value.split('\n').join('\\\\\n');
    return notion.equation(textWithKatexNewlines);
}
function parseNode(node, options) {
    switch (node.type) {
        case 'heading':
            return [parseHeading(node)];
        case 'paragraph':
            return parseParagraph(node, options);
        case 'code':
            return [parseCode(node)];
        case 'blockquote':
            return [parseBlockquote(node, options)];
        case 'list':
            return parseList(node, options);
        case 'table':
            return parseTable(node);
        case 'math':
            return [parseMath(node)];
        default:
            return [];
    }
}
function parseBlocks(root, options) {
    var _a, _b, _c, _d;
    const parsed = root.children.flatMap(item => parseNode(item, options || {}));
    const truncate = !!((_b = (_a = options === null || options === void 0 ? void 0 : options.notionLimits) === null || _a === void 0 ? void 0 : _a.truncate) !== null && _b !== void 0 ? _b : true), limitCallback = (_d = (_c = options === null || options === void 0 ? void 0 : options.notionLimits) === null || _c === void 0 ? void 0 : _c.onError) !== null && _d !== void 0 ? _d : (() => { });
    if (parsed.length > notion_1.LIMITS.PAYLOAD_BLOCKS)
        limitCallback(new Error(`Resulting blocks array exceeds Notion limit (${notion_1.LIMITS.PAYLOAD_BLOCKS})`));
    return truncate ? parsed.slice(0, notion_1.LIMITS.PAYLOAD_BLOCKS) : parsed;
}
exports.parseBlocks = parseBlocks;
function parseRichText(root, options) {
    var _a, _b, _c, _d;
    const richTexts = [];
    root.children.forEach(child => {
        if (child.type === 'paragraph')
            child.children.forEach(child => richTexts.push(...parseInline(child)));
        else if ((options === null || options === void 0 ? void 0 : options.nonInline) === 'throw')
            throw new Error(`Unsupported markdown element: ${JSON.stringify(child)}`);
    });
    const truncate = !!((_b = (_a = options === null || options === void 0 ? void 0 : options.notionLimits) === null || _a === void 0 ? void 0 : _a.truncate) !== null && _b !== void 0 ? _b : true), limitCallback = (_d = (_c = options === null || options === void 0 ? void 0 : options.notionLimits) === null || _c === void 0 ? void 0 : _c.onError) !== null && _d !== void 0 ? _d : (() => { });
    if (richTexts.length > notion_1.LIMITS.RICH_TEXT_ARRAYS)
        limitCallback(new Error(`Resulting richTexts array exceeds Notion limit (${notion_1.LIMITS.RICH_TEXT_ARRAYS})`));
    return (truncate ? richTexts.slice(0, notion_1.LIMITS.RICH_TEXT_ARRAYS) : richTexts).map(rt => {
        var _a;
        if (rt.type !== 'text')
            return rt;
        if (rt.text.content.length > notion_1.LIMITS.RICH_TEXT.TEXT_CONTENT) {
            limitCallback(new Error(`Resulting text content exceeds Notion limit (${notion_1.LIMITS.RICH_TEXT.TEXT_CONTENT})`));
            if (truncate)
                rt.text.content =
                    rt.text.content.slice(0, notion_1.LIMITS.RICH_TEXT.TEXT_CONTENT - 3) + '...';
        }
        if (((_a = rt.text.link) === null || _a === void 0 ? void 0 : _a.url) &&
            rt.text.link.url.length > notion_1.LIMITS.RICH_TEXT.LINK_URL)
            // There's no point in truncating URLs
            limitCallback(new Error(`Resulting text URL exceeds Notion limit (${notion_1.LIMITS.RICH_TEXT.LINK_URL})`));
        // Notion equations are not supported by this library, since they don't exist in Markdown
        return rt;
    });
}
exports.parseRichText = parseRichText;
//# sourceMappingURL=internal.js.map