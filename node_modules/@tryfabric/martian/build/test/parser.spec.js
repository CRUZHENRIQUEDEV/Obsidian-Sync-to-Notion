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
Object.defineProperty(exports, "__esModule", { value: true });
const md = __importStar(require("../src/markdown"));
const markdown_1 = require("../src/markdown");
const notion = __importStar(require("../src/notion"));
const internal_1 = require("../src/parser/internal");
describe('gfm parser', () => {
    const options = { allowUnsupportedObjectType: false, strictImageUrls: true };
    it('should parse paragraph with nested annotations', () => {
        const ast = md.root(md.paragraph(md.text('Hello '), md.emphasis(md.text('world '), md.strong(md.text('foo'))), md.text('! '), md.inlineCode('code')));
        const actual = (0, internal_1.parseBlocks)(ast, options);
        const expected = [
            notion.paragraph([
                notion.richText('Hello '),
                notion.richText('world ', {
                    annotations: { italic: true },
                }),
                notion.richText('foo', {
                    annotations: { italic: true, bold: true },
                }),
                notion.richText('! '),
                notion.richText('code', {
                    annotations: { code: true },
                }),
            ]),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse text with hrefs and annotations', () => {
        const ast = md.root(md.paragraph(md.text('hello world '), md.link('https://example.com', md.text('this is a '), md.emphasis(md.text('url'))), md.text(' end')));
        const actual = (0, internal_1.parseBlocks)(ast, options);
        const expected = [
            notion.paragraph([
                notion.richText('hello world '),
                notion.richText('this is a ', {
                    url: 'https://example.com',
                }),
                notion.richText('url', {
                    annotations: { italic: true },
                    url: 'https://example.com',
                }),
                notion.richText(' end'),
            ]),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse thematic breaks', () => {
        const ast = md.root(md.paragraph(md.text('hello')), md.thematicBreak(), md.paragraph(md.text('world')));
        const actual = (0, internal_1.parseBlocks)(ast, options);
        const expected = [
            notion.paragraph([notion.richText('hello')]),
            notion.paragraph([notion.richText('world')]),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse headings', () => {
        const ast = md.root(md.heading(1, md.text('heading1')), md.heading(2, md.text('heading2')), md.heading(3, md.text('heading3')), md.heading(4, md.text('heading4')));
        const actual = (0, internal_1.parseBlocks)(ast, options);
        const expected = [
            notion.headingOne([notion.richText('heading1')]),
            notion.headingTwo([notion.richText('heading2')]),
            notion.headingThree([notion.richText('heading3')]),
            notion.headingThree([notion.richText('heading4')]),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse code block and set the language to plain text if none is provided', () => {
        const ast = md.root(md.paragraph(md.text('hello')), md.code('const foo = () => {}', undefined));
        const actual = (0, internal_1.parseBlocks)(ast);
        const expected = [
            notion.paragraph([notion.richText('hello')]),
            notion.code([notion.richText('const foo = () => {}')], 'plain text'),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse code block and set the proper language', () => {
        const ast = md.root(md.paragraph(md.text('hello')), md.code('public class Foo {}', 'java'));
        const actual = (0, internal_1.parseBlocks)(ast, options);
        const expected = [
            notion.paragraph([notion.richText('hello')]),
            notion.code([notion.richText('public class Foo {}')], 'java'),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse code block and set the language to plain text if it is not supported by Notion', () => {
        const ast = md.root(md.paragraph(md.text('hello')), md.code('const foo = () => {}', 'not-supported'));
        const actual = (0, internal_1.parseBlocks)(ast);
        const expected = [
            notion.paragraph([notion.richText('hello')]),
            notion.code([notion.richText('const foo = () => {}')], 'plain text'),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse block quote', () => {
        const ast = md.root(md.blockquote(md.heading(1, md.text('hello'), md.emphasis(md.text('world')))));
        const actual = (0, internal_1.parseBlocks)(ast, options);
        const expected = [
            notion.blockquote([], [
                notion.headingOne([
                    notion.richText('hello'),
                    notion.richText('world', {
                        annotations: { italic: true },
                    }),
                ]),
            ]),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse list', () => {
        const ast = md.root(md.paragraph(md.text('hello')), md.unorderedList(md.listItem(md.paragraph(md.text('a'))), md.listItem(md.paragraph(md.emphasis(md.text('b')))), md.listItem(md.paragraph(md.strong(md.text('c'))))), md.orderedList(md.listItem(md.paragraph(md.text('d')))));
        const actual = (0, internal_1.parseBlocks)(ast, options);
        const expected = [
            notion.paragraph([notion.richText('hello')]),
            notion.bulletedListItem([notion.richText('a')]),
            notion.bulletedListItem([
                notion.richText('b', { annotations: { italic: true } }),
            ]),
            notion.bulletedListItem([
                notion.richText('c', { annotations: { bold: true } }),
            ]),
            notion.numberedListItem([notion.richText('d')]),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse github extensions', () => {
        const ast = md.root(md.paragraph(md.link('https://example.com', md.text('https://example.com'))), md.paragraph(md.strikethrough(md.text('strikethrough content'))), md.table(md.tableRow(md.tableCell(md.text('a')), md.tableCell(md.text('b')), md.tableCell(md.text('c')), md.tableCell(md.text('d')))), md.unorderedList(md.checkedListItem(false, md.paragraph(md.text('to do'))), md.checkedListItem(true, md.paragraph(md.text('done')))));
        const actual = (0, internal_1.parseBlocks)(ast, options);
        const expected = [
            notion.paragraph([
                notion.richText('https://example.com', {
                    url: 'https://example.com',
                }),
            ]),
            notion.paragraph([
                notion.richText('strikethrough content', {
                    annotations: { strikethrough: true },
                }),
            ]),
            notion.table([
                notion.tableRow([
                    [notion.richText('a')],
                    [notion.richText('b')],
                    [notion.richText('c')],
                    [notion.richText('d')],
                ]),
            ], 4),
            notion.toDo(false, [notion.richText('to do')]),
            notion.toDo(true, [notion.richText('done')]),
        ];
        expect(actual).toStrictEqual(expected);
    });
    it('should parse rich text', () => {
        const ast = md.root(md.paragraph(md.text('a'), md.strong(md.emphasis(md.text('b')), md.text('c')), md.link('https://example.com', (0, markdown_1.text)('d'))));
        const actual = (0, internal_1.parseRichText)(ast);
        const expected = [
            notion.richText('a'),
            notion.richText('b', { annotations: { italic: true, bold: true } }),
            notion.richText('c', { annotations: { bold: true } }),
            notion.richText('d', { url: 'https://example.com' }),
        ];
        expect(actual).toStrictEqual(expected);
    });
});
//# sourceMappingURL=parser.spec.js.map