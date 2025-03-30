"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tableCell = exports.tableRow = exports.table = exports.strikethrough = exports.orderedList = exports.unorderedList = exports.checkedListItem = exports.listItem = exports.blockquote = exports.math = exports.code = exports.heading = exports.thematicBreak = exports.link = exports.root = exports.paragraph = exports.inlineMath = exports.inlineCode = exports.strong = exports.emphasis = exports.image = exports.text = void 0;
function text(value) {
    return {
        type: 'text',
        value: value,
    };
}
exports.text = text;
function image(url, alt, title) {
    return {
        type: 'image',
        url: url,
        title: title,
    };
}
exports.image = image;
function emphasis(...children) {
    return {
        type: 'emphasis',
        children: children,
    };
}
exports.emphasis = emphasis;
function strong(...children) {
    return {
        type: 'strong',
        children: children,
    };
}
exports.strong = strong;
function inlineCode(value) {
    return {
        type: 'inlineCode',
        value: value,
    };
}
exports.inlineCode = inlineCode;
function inlineMath(value) {
    return {
        type: 'inlineMath',
        value,
    };
}
exports.inlineMath = inlineMath;
function paragraph(...children) {
    return {
        type: 'paragraph',
        children: children,
    };
}
exports.paragraph = paragraph;
function root(...children) {
    return {
        type: 'root',
        children: children,
    };
}
exports.root = root;
function link(url, ...children) {
    return {
        type: 'link',
        children: children,
        url: url,
    };
}
exports.link = link;
function thematicBreak() {
    return {
        type: 'thematicBreak',
    };
}
exports.thematicBreak = thematicBreak;
function heading(depth, ...children) {
    return {
        type: 'heading',
        depth: depth,
        children: children,
    };
}
exports.heading = heading;
function code(value, lang) {
    return {
        type: 'code',
        lang: lang,
        value: value,
    };
}
exports.code = code;
function math(value) {
    return {
        type: 'math',
        value,
    };
}
exports.math = math;
function blockquote(...children) {
    return {
        type: 'blockquote',
        children: children,
    };
}
exports.blockquote = blockquote;
function listItem(...children) {
    return {
        type: 'listitem',
        children: children,
    };
}
exports.listItem = listItem;
function checkedListItem(checked, ...children) {
    return {
        type: 'listitem',
        checked: checked,
        children: children,
    };
}
exports.checkedListItem = checkedListItem;
function unorderedList(...children) {
    return {
        type: 'list',
        children: children,
        ordered: false,
    };
}
exports.unorderedList = unorderedList;
function orderedList(...children) {
    return {
        type: 'list',
        children: children,
        start: 0,
        ordered: true,
    };
}
exports.orderedList = orderedList;
function strikethrough(...children) {
    return {
        type: 'delete',
        children: children,
    };
}
exports.strikethrough = strikethrough;
function table(...children) {
    return {
        type: 'table',
        children: children,
    };
}
exports.table = table;
function tableRow(...children) {
    return {
        type: 'tableRow',
        children: children,
    };
}
exports.tableRow = tableRow;
function tableCell(...children) {
    return {
        type: 'tableCell',
        children: children,
    };
}
exports.tableCell = tableCell;
//# sourceMappingURL=ast.js.map