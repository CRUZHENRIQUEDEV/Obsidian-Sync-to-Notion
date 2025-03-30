"use strict";
// This script is responsible for generating src/notion/languageMap.json
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.languages = void 0;
/* eslint-disable node/no-unpublished-import */
const linguist_languages_1 = __importDefault(require("linguist-languages"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.languages = {
    abap: linguist_languages_1.default.ABAP,
    arduino: undefined,
    bash: linguist_languages_1.default.Shell,
    basic: linguist_languages_1.default.BASIC,
    c: linguist_languages_1.default.C,
    clojure: linguist_languages_1.default.Clojure,
    coffeescript: linguist_languages_1.default.CoffeeScript,
    'c++': linguist_languages_1.default['C++'],
    'c#': linguist_languages_1.default['C#'],
    css: linguist_languages_1.default.CSS,
    dart: linguist_languages_1.default.Dart,
    diff: linguist_languages_1.default.Diff,
    docker: linguist_languages_1.default.Dockerfile,
    elixir: linguist_languages_1.default.Elixir,
    elm: linguist_languages_1.default.Elm,
    erlang: linguist_languages_1.default.Erlang,
    flow: undefined,
    fortran: linguist_languages_1.default.Fortran,
    'f#': linguist_languages_1.default['F#'],
    gherkin: linguist_languages_1.default.Gherkin,
    glsl: linguist_languages_1.default.GLSL,
    go: linguist_languages_1.default.Go,
    graphql: linguist_languages_1.default.GraphQL,
    groovy: linguist_languages_1.default.Groovy,
    haskell: linguist_languages_1.default.Haskell,
    html: linguist_languages_1.default.HTML,
    java: linguist_languages_1.default.Java,
    javascript: linguist_languages_1.default.JavaScript,
    json: linguist_languages_1.default.JSON,
    julia: linguist_languages_1.default.Julia,
    kotlin: linguist_languages_1.default.Kotlin,
    latex: linguist_languages_1.default.TeX,
    less: linguist_languages_1.default.Less,
    lisp: linguist_languages_1.default['Common Lisp'],
    livescript: linguist_languages_1.default.LiveScript,
    lua: linguist_languages_1.default.Lua,
    makefile: linguist_languages_1.default.Makefile,
    markdown: linguist_languages_1.default.Markdown,
    markup: undefined,
    matlab: linguist_languages_1.default.MATLAB,
    mermaid: undefined,
    nix: linguist_languages_1.default.Nix,
    'objective-c': linguist_languages_1.default['Objective-C'],
    ocaml: linguist_languages_1.default.OCaml,
    pascal: linguist_languages_1.default.Pascal,
    perl: linguist_languages_1.default.Perl,
    php: linguist_languages_1.default.PHP,
    'plain text': undefined,
    powershell: linguist_languages_1.default.PowerShell,
    prolog: linguist_languages_1.default.Prolog,
    protobuf: linguist_languages_1.default['Protocol Buffer'],
    python: linguist_languages_1.default.Python,
    r: linguist_languages_1.default.R,
    reason: linguist_languages_1.default.Reason,
    ruby: linguist_languages_1.default.Ruby,
    rust: linguist_languages_1.default.Rust,
    sass: linguist_languages_1.default.Sass,
    scala: linguist_languages_1.default.Scala,
    scheme: linguist_languages_1.default.Scheme,
    scss: linguist_languages_1.default.SCSS,
    shell: linguist_languages_1.default.Shell,
    sql: linguist_languages_1.default.SQL,
    swift: linguist_languages_1.default.Swift,
    typescript: linguist_languages_1.default.TypeScript,
    'vb.net': linguist_languages_1.default['Visual Basic .NET'],
    verilog: linguist_languages_1.default.Verilog,
    vhdl: linguist_languages_1.default.VHDL,
    'visual basic': undefined,
    webassembly: linguist_languages_1.default.WebAssembly,
    xml: linguist_languages_1.default.XML,
    yaml: linguist_languages_1.default.YAML,
    'java/c/c++/c#': linguist_languages_1.default.Java, // Other languages have their own tag
};
const map = {};
Object.entries(exports.languages).forEach(([notionKey, value]) => {
    [value].flat().filter(e => !!e).forEach(lang => {
        var _a;
        map[lang.aceMode] = notionKey;
        (_a = lang.aliases) === null || _a === void 0 ? void 0 : _a.forEach(alias => {
            map[alias] = notionKey;
        });
    });
});
fs_1.default.writeFileSync(path_1.default.join(__dirname, '../src/notion/languageMap.json'), JSON.stringify(map, null, 2));
//# sourceMappingURL=languageMap.js.map