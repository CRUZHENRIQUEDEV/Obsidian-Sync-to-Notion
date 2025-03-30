import { supportedCodeLang } from './common';
import { AppendBlockChildrenParameters } from '@notionhq/client/build/src/api-endpoints';
export declare type Block = AppendBlockChildrenParameters['children'][number];
export declare type BlockWithoutChildren = Exclude<(Block & {
    type: 'paragraph';
})['paragraph']['children'], undefined>[number];
export declare type RichText = (Block & {
    type: 'paragraph';
})['paragraph']['rich_text'][number];
export declare function paragraph(text: RichText[]): Block;
export declare function code(text: RichText[], lang?: supportedCodeLang): Block;
export declare function blockquote(text?: RichText[], children?: Block[]): Block;
export declare function image(url: string): Block;
export declare function table_of_contents(): Block;
export declare function headingOne(text: RichText[]): Block;
export declare function headingTwo(text: RichText[]): Block;
export declare function headingThree(text: RichText[]): Block;
export declare function bulletedListItem(text: RichText[], children?: BlockWithoutChildren[]): Block;
export declare function numberedListItem(text: RichText[], children?: BlockWithoutChildren[]): Block;
export declare function toDo(checked: boolean, text: RichText[], children?: BlockWithoutChildren[]): Block;
export declare function table(children: BlockWithoutChildren[], tableWidth: number): Block;
export declare function tableRow(cells?: RichText[][]): BlockWithoutChildren;
export declare function equation(value: string): Block;
