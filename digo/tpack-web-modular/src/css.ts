/**
 * @fileOverview 解析 CSS 模块。
 */

import {ModuleType, UrlUsage} from "./module";
import {TextOptions, TextBuildModule, encodeString, decodeString, TextReplacement} from "./text";

/**
 * 表示一个 CSS 生成模块。
 */
export class CssBuildModule extends TextBuildModule {

    /**
     * 获取当前解析模块的配置。
     */
    options: CssOptions;

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.css; }

    /**
     * 负责解析当前模块的语法。
     */
    protected parse() {

        // 解析文件。
        this.source.replace(/\/\*([\s\S]*?)(?:\*\/|$)|(@import\s+url|\burl|\bsrc\s*=\s*)\s*\(\s*("(?:[^\\"\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|[^\)\r\n]*)\s*\)\s*;?|\bsrc\s*=\s*([^\)\},\s]*)/g, (source: string, comment: string, func: string, arg: string, srcArg: string, index: number) => {

            // /* ... */
            if (comment) {
                this.parseComment(source, index, comment);
                return source;
            }

            // @import url(...);, url(...), src=...
            if (func) {

                // @import url(...);
                if (func.charCodeAt(0) === 64 /*@*/) {
                    this.parseImport(source, index, arg);
                    return source;
                }

                // url(...)
                this.parseUrl(source, index, decodeString(arg), url => source.substr(0, source.indexOf('(') + 1) + encodeString(url, arg) + source.substr(source.lastIndexOf(')')));
                return source;
            }

            // src=...
            if (srcArg) {
                this.parseUrl(source, index, srcArg, url => srcArg.substr(0, arg.indexOf('=') + 1) + encodeString(url, srcArg));
                return source;
            }

            return source;
        });

        // 解析宏。
        this.parseSub();

    }

    /**
     * 解析一个文件内的 @import 指令。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param arg 要解析的地址。
     */
    protected parseImport(source: string, index: number, arg: string) {

        // 禁止解析。
        let options = this.options.import;
        if (options === false || options === "none") return;

        let url = decodeString(arg);

        // 如果不内联 @import，则仅作为普通地址解析。
        if (options === "url") {
            this.parseUrl(source, index, url, url => source.substr(0, source.indexOf("(") + 1) + encodeString(url, arg) + source.substr(source.lastIndexOf(")")));
            return;
        }
        
        // NOTE: @import url(...) 不支持 $INLINE。

        // 内联：解析地址。
        let obj = this.resolveUrl(source, index, url, UrlUsage.inline);
        if (obj.module) {
            this.require(obj.module);
            this.addReplacement(new TextReplacement(index, index + source.length, ""));
        }

    }

}

/**
 * 表示解析 CSS 生成模块的配置。
 */
export interface CssOptions extends TextOptions {

    /**
     * 处理 @import 的方式。
     * - true/"inline": 内联 @import。
     * - "url": 更新引用地址。
     * - false/"none": 不处理。
     * @default "inline"
     */
    import?: "inline" | "none" | "url" | boolean;

}
