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
const src_1 = require("../src");
const notion = __importStar(require("../src/notion"));
const fs_1 = __importDefault(require("fs"));
const notion_1 = require("../src/notion");
describe('markdown converter', () => {
    describe('markdownToBlocks', () => {
        it('should convert markdown to blocks', () => {
            const text = `
hello _world_ 
*** 
## heading2
* [x] todo
`;
            const actual = (0, src_1.markdownToBlocks)(text);
            const expected = [
                notion.paragraph([
                    notion.richText('hello '),
                    notion.richText('world', { annotations: { italic: true } }),
                ]),
                notion.headingTwo([notion.richText('heading2')]),
                notion.toDo(true, [notion.richText('todo')]),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should deal with code - use plain text by default', () => {
            const text = `
## Code
\`\`\`
const hello = "hello";
\`\`\`
`;
            const actual = (0, src_1.markdownToBlocks)(text);
            const expected = [
                notion.headingTwo([notion.richText('Code')]),
                notion.code([notion.richText('const hello = "hello";')], 'plain text'),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should deal with code - handle Notion highlight keys', () => {
            const text = `
## Code
\`\`\` webassembly
const hello = "hello";
\`\`\`
`;
            const actual = (0, src_1.markdownToBlocks)(text);
            const expected = [
                notion.headingTwo([notion.richText('Code')]),
                notion.code([notion.richText('const hello = "hello";')], 'webassembly'),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should deal with code - handle Linguist highlight keys', () => {
            const text = `
## Code
\`\`\` ts
const hello = "hello";
\`\`\`
`;
            const actual = (0, src_1.markdownToBlocks)(text);
            const expected = [
                notion.headingTwo([notion.richText('Code')]),
                notion.code([notion.richText('const hello = "hello";')], 'typescript'),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should deal with complex items', () => {
            const text = fs_1.default.readFileSync('test/fixtures/complex-items.md').toString();
            const actual = (0, src_1.markdownToBlocks)(text);
            const expected = [
                notion.headingOne([notion.richText('Images')]),
                notion.paragraph([notion.richText('This is a paragraph!')]),
                notion.blockquote([], [notion.paragraph([notion.richText('Quote')])]),
                notion.paragraph([notion.richText('Paragraph')]),
                notion.image('https://url.com/image.jpg'),
                notion.table_of_contents(),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should break up large elements', () => {
            const text = fs_1.default.readFileSync('test/fixtures/large-item.md').toString();
            const actual = (0, src_1.markdownToBlocks)(text);
            const textArray = actual[1].type === 'paragraph'
                ? actual[1].paragraph.rich_text
                : { length: -1 };
            expect(textArray.length).toStrictEqual(9);
        });
        it('should deal with lists', () => {
            const text = fs_1.default.readFileSync('test/fixtures/list.md').toString();
            const actual = (0, src_1.markdownToBlocks)(text);
            const expected = [
                notion.headingOne([notion.richText('List')]),
                notion.bulletedListItem([notion.richText('Item 1')], 
                // @ts-expect-error This problem is being addressed in issue #15 (https://github.com/tryfabric/martian/issues/15)
                [notion.bulletedListItem([notion.richText('Sub Item 1')])]),
                notion.bulletedListItem([notion.richText('Item 2')]),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should deal with tables', () => {
            const text = fs_1.default.readFileSync('test/fixtures/table.md').toString();
            const actual = (0, src_1.markdownToBlocks)(text);
            const expected = [
                notion.headingOne([notion.richText('Table')]),
                notion.table([
                    notion.tableRow([
                        [notion.richText('First Header')],
                        [notion.richText('Second Header')],
                    ]),
                    notion.tableRow([
                        [notion.richText('Content Cell')],
                        [notion.richText('Content Cell')],
                    ]),
                    notion.tableRow([
                        [notion.richText('Content Cell')],
                        [notion.richText('Content Cell')],
                    ]),
                ], 2),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should convert markdown to blocks - deal with images - strict mode', () => {
            const text = fs_1.default.readFileSync('test/fixtures/images.md').toString();
            const actual = (0, src_1.markdownToBlocks)(text, { strictImageUrls: true });
            const expected = [
                notion.headingOne([notion.richText('Images')]),
                notion.paragraph([
                    notion.richText('This is an image in a paragraph '),
                    notion.richText(', which isnt supported in Notion.'),
                ]),
                notion.image('https://image.com/url.jpg'),
                notion.image('https://image.com/paragraph.jpg'),
                notion.paragraph([notion.richText('https://image.com/blah')]),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should convert markdown to blocks - deal with images - not strict mode', () => {
            const text = fs_1.default.readFileSync('test/fixtures/images.md').toString();
            const actual = (0, src_1.markdownToBlocks)(text, { strictImageUrls: false });
            const expected = [
                notion.headingOne([notion.richText('Images')]),
                notion.paragraph([
                    notion.richText('This is an image in a paragraph '),
                    notion.richText(', which isnt supported in Notion.'),
                ]),
                notion.image('https://image.com/url.jpg'),
                notion.image('https://image.com/paragraph.jpg'),
                notion.image('https://image.com/blah'),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should parse math', () => {
            const text = fs_1.default.readFileSync('test/fixtures/math.md').toString();
            const actual = (0, src_1.markdownToBlocks)(text);
            const expected = [
                notion.paragraph([
                    notion.richText('Lift('),
                    notion.richText('L', { type: 'equation' }),
                    notion.richText(') can be determined by Lift Coefficient ('),
                    notion.richText('C_L', { type: 'equation' }),
                    notion.richText(') like the following\nequation.'),
                ]),
                notion.equation('L = \\frac{1}{2} \\rho v^2 S C_L\\\\\ntest'),
            ];
            expect(actual).toStrictEqual(expected);
        });
    });
    describe('markdownToRichText', () => {
        it('should convert markdown to rich text', () => {
            const text = 'hello [_url_](https://example.com)';
            const actual = (0, src_1.markdownToRichText)(text);
            const expected = [
                notion.richText('hello '),
                notion.richText('url', {
                    annotations: { italic: true },
                    url: 'https://example.com',
                }),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should convert markdown with multiple newlines to rich text', () => {
            const text = 'hello\n\n[url](http://google.com)';
            const actual = (0, src_1.markdownToRichText)(text);
            const expected = [
                notion.richText('hello'),
                notion.richText('url', {
                    url: 'http://google.com',
                }),
            ];
            expect(actual).toStrictEqual(expected);
        });
        it('should truncate items when options.notionLimits.truncate = true', () => {
            const text = Array(notion_1.LIMITS.RICH_TEXT_ARRAYS + 10)
                .fill('a *a* ')
                .join('');
            const actual = {
                default: (0, src_1.markdownToRichText)(text),
                explicit: (0, src_1.markdownToRichText)(text, { notionLimits: { truncate: true } }),
            };
            expect(actual.default.length).toBe(notion_1.LIMITS.RICH_TEXT_ARRAYS);
            expect(actual.explicit.length).toBe(notion_1.LIMITS.RICH_TEXT_ARRAYS);
        });
        it('should not truncate items when options.notionLimits.truncate = false', () => {
            const text = Array(notion_1.LIMITS.RICH_TEXT_ARRAYS + 10)
                .fill('a *a* ')
                .join('');
            const actual = (0, src_1.markdownToRichText)(text, {
                notionLimits: { truncate: false },
            });
            expect(actual.length).toBeGreaterThan(notion_1.LIMITS.RICH_TEXT_ARRAYS);
        });
        it('should call the callback when options.notionLimits.onError is defined', () => {
            const text = Array(notion_1.LIMITS.RICH_TEXT_ARRAYS + 10)
                .fill('a *a* ')
                .join('');
            const spy = jest.fn();
            (0, src_1.markdownToRichText)(text, {
                notionLimits: { onError: spy },
            });
            expect(spy).toBeCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(expect.any(Error));
        });
        it('should ignore unsupported elements by default', () => {
            const text1 = '# Header first\nOther text', text2 = 'Other text\n# Header second';
            const actual1 = (0, src_1.markdownToRichText)(text1), actual2 = (0, src_1.markdownToRichText)(text2);
            const expected = [notion.richText('Other text')];
            expect(actual1).toStrictEqual(expected);
            expect(actual2).toStrictEqual(expected);
        });
        it("should ignore unsupported elements when nonInline = 'ignore'", () => {
            const text = '# Header first\nOther text';
            const actual = (0, src_1.markdownToRichText)(text, { nonInline: 'ignore' });
            const expected = [notion.richText('Other text')];
            expect(actual).toStrictEqual(expected);
        });
        it("should throw when there's an unsupported element and nonInline = 'throw'", () => {
            const text = '# Header first\nOther text';
            expect(() => (0, src_1.markdownToRichText)(text, { nonInline: 'throw' })).toThrow();
            expect(() => (0, src_1.markdownToRichText)(text, { nonInline: 'ignore' })).not.toThrow();
        });
    });
});
//# sourceMappingURL=integration.spec.js.map