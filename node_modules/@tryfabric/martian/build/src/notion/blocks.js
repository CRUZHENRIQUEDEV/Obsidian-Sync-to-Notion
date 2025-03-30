"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.equation = exports.tableRow = exports.table = exports.toDo = exports.numberedListItem = exports.bulletedListItem = exports.headingThree = exports.headingTwo = exports.headingOne = exports.table_of_contents = exports.image = exports.blockquote = exports.code = exports.paragraph = void 0;
const common_1 = require("./common");
function paragraph(text) {
    return {
        object: 'block',
        type: 'paragraph',
        paragraph: {
            rich_text: text,
        },
    };
}
exports.paragraph = paragraph;
function code(text, lang = 'plain text') {
    return {
        object: 'block',
        type: 'code',
        code: {
            rich_text: text,
            language: lang,
        },
    };
}
exports.code = code;
function blockquote(text = [], children = []) {
    return {
        object: 'block',
        type: 'quote',
        quote: {
            // By setting an empty rich text we prevent the "Empty quote" line from showing up at all
            rich_text: text.length ? text : [(0, common_1.richText)('')],
            // @ts-expect-error Typings are not perfect
            children,
        },
    };
}
exports.blockquote = blockquote;
function image(url) {
    return {
        object: 'block',
        type: 'image',
        image: {
            type: 'external',
            external: {
                url: url,
            },
        },
    };
}
exports.image = image;
function table_of_contents() {
    return {
        object: 'block',
        type: 'table_of_contents',
        table_of_contents: {},
    };
}
exports.table_of_contents = table_of_contents;
function headingOne(text) {
    return {
        object: 'block',
        type: 'heading_1',
        heading_1: {
            rich_text: text,
        },
    };
}
exports.headingOne = headingOne;
function headingTwo(text) {
    return {
        object: 'block',
        type: 'heading_2',
        heading_2: {
            rich_text: text,
        },
    };
}
exports.headingTwo = headingTwo;
function headingThree(text) {
    return {
        object: 'block',
        type: 'heading_3',
        heading_3: {
            rich_text: text,
        },
    };
}
exports.headingThree = headingThree;
function bulletedListItem(text, children = []) {
    return {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
            rich_text: text,
            children: children.length ? children : undefined,
        },
    };
}
exports.bulletedListItem = bulletedListItem;
function numberedListItem(text, children = []) {
    return {
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
            rich_text: text,
            children: children.length ? children : undefined,
        },
    };
}
exports.numberedListItem = numberedListItem;
function toDo(checked, text, children = []) {
    return {
        object: 'block',
        type: 'to_do',
        to_do: {
            rich_text: text,
            checked: checked,
            children: children.length ? children : undefined,
        },
    };
}
exports.toDo = toDo;
function table(children, tableWidth) {
    return {
        object: 'block',
        type: 'table',
        table: {
            table_width: tableWidth,
            has_column_header: true,
            children: (children === null || children === void 0 ? void 0 : children.length) ? children : [],
        },
    };
}
exports.table = table;
function tableRow(cells = []) {
    return {
        object: 'block',
        type: 'table_row',
        table_row: {
            cells: cells.length ? cells : [],
        },
    };
}
exports.tableRow = tableRow;
function equation(value) {
    return {
        type: 'equation',
        equation: {
            expression: value,
        },
    };
}
exports.equation = equation;
//# sourceMappingURL=blocks.js.map