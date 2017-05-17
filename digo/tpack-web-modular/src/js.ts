/**
 * @fileOverview 解析 JS 文件依赖。
 */

import * as FS from "fs";

import {BuildModule, ModuleType, UrlUsage} from "./module";
import {TextOptions, TextBuildModule, encodeString, decodeString, TextReplacement, TextDelayReplacement, Writer} from "./text";

/**
 * 表示一个 JS 模块。
 */
export class JsBuildModule extends TextBuildModule {

    /**
     * 获取当前解析模块的配置。
     */
    options: JsOptions;

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.js; }

    /**
     * 如果当前模块是具名模块，则返回模块名。
     */
    name: string;

    /**
     * 标记当前模块存在 AMD 相关变量（define）引用。
     */
    amdJs: boolean;

    /**
     * 标记当前模块存在 CommonJs 相关变量（require, exports，module）引用。
     */
    commonJs: boolean;

    /**
     * 标记当前模块是否需要包含加载器。
     */
    loader: boolean;

    /**
     * 当包含指定模块时执行。
     * @param module 被包含的模块。
     */
    protected onInclude(file: JsBuildModule) {
        super.onInclude(file);
        this.commonJs = this.commonJs || file.commonJs;
        this.amdJs = this.amdJs || file.amdJs;
        this.loader = this.loader || file.loader;
    }

    /**
     * 解析当前模块。
     */
    protected parse() {

        this.source.replace(/'((?:[^\\'\n\r\f]|\\[\s\S])*)'|"((?:[^\\"\n\f]|\\[\s\S])*)"|\/\/([^\n\f]+)|\/\*([\s\S]*?)(?:\*\/|$)|\brequire\s*\(\s*('(?:[^\\'\n\r\f]|\\[\s\S])*'|"(?:[^\\"\n\f]|\\[\s\S])*")\s*\)|\bdefine\s*\(\[\s*((?:(?:'(?:[^\\'\n\r\f]|\\[\s\S])*'|"(?:[^\\"\n\f]|\\[\s\S])*")\s*,\s*)*)\]|(require|exports|module|process|global|Buffer|setImmediate|clearImmediate|__dirname|__filename)\b/g, (source: string, singleString, doubleString: string, singleComment: string, multiComment: string, require: string, define: string, keyword: string, index: number) => {

            // '...', "..."
            if (singleString != null || doubleString != null) {
                return source;
            }

            // //..., /*...*/
            if (singleComment != null || multiComment != null) {
                this.parseComment(source, index, singleComment || multiComment);
                return source;
            }

            // require('...')
            if (require != null) {
                this.parseRequire(source, index, require);
                return source;
            }

            // define('...')
            if (define != null) {
                this.parseDefine(source, index, define);
                return source;
            }

            // define, require, exports, module, process, global, Buffer, setImmediate, clearImmediate, __dirname, __filename
            if (keyword != null) {
                this.parseKeyword(source, index, keyword);
                return source;
            }

            return source;
        });

        // 解析宏。
        this.parseSub();

    }

    /**
     * 解析 require(url)。
     * @param source 相关的代码片段。
     * @param index 代码片段在源文件的起始位置。
     * @param url 依赖的地址。
     */
    parseRequire(source: string, index: number, url: string) {
        this.commonJs = true;
        // require("path") => {global: true}
        // require("mymodule") => {global: true, file: ...}
        // require("./mymodule") => {file: ...}
        // require("ERROR") => {}
        let oldUrl = decodeString(url);
        let obj = this.resolveUrl(source, index, oldUrl, UrlUsage.require);
        if (!obj.module) return;
        this.require(obj.module);
        this.addReplacement(new TextDelayReplacement(index, index + source.length, module => {
            let newUrl = (obj.global || obj.alias ? obj.path : "./" + this.file.relative(obj.module.file)) + obj.query;
            let q = url[0];
            return source.substr(0, source.indexOf(q)) + encodeString(newUrl, q) + source.substr(source.lastIndexOf(q + 1));
        }));

    }

    /**
     * 解析 define([deps])。
     * @param source 相关的代码片段。
     * @param index 代码片段在源文件的起始位置。
     * @param deps 依赖的地址。
     */
    parseDefine(source: string, index: number, deps: string) {
        this.amdJs = true;
        // TODO: 支持载入 AMD define 模块。
    }

    /**
     * 存储已添加的符号。
     */
    private _parsedKeywords: string[];

    /**
     * 解析一个文件内的符号。
     * @param source 要处理的内容。
     * @param index 代码片段在源文件的起始位置。
     * @param keyword 要解析的符号。
     */
    parseKeyword(source: string, index: number, keyword: string) {

        if (this.options.keyword === false || this.options.keyword && this.options.keyword[keyword] === false) return;

        this._parsedKeywords = this._parsedKeywords || [];
        if (this._parsedKeywords.indexOf(keyword) >= 0) return;
        this._parsedKeywords.push(keyword);

        let requireModule: string;
        let prepend: string;

        switch (keyword) {
            case "define":
                this.amdJs = true;
                return;
            case "require":
            case "exports":
            case "module":
                this.commonJs = true;
                break;
            case "global":
                prepend = 'var global = (function(){return this;})();\n;';
                break;
            case "process":
                requireModule = "process";
                prepend = 'var Buffer = require("process");\n;';
                break;
            case "Buffer":
                requireModule = "buffer";
                prepend = 'var Buffer = require("buffer");\n;';
                break;
            case "setImmediate":
            case "clearImmediate":
                requireModule = "timers";
                prepend = `var ${keyword} = require("timers").${keyword};\n;`;
                break;
        }

        if (!this.options.resolve || this.options.resolve.native !== false) {
            if (requireModule) this.resolveRequire(source, index, requireModule);
            if (prepend) this.replacements.unshift(new TextReplacement(0, 0, prepend));
        } else if (prepend && !requireModule) {
            this.replacements.unshift(new TextReplacement(0, 0, prepend));
        }

    }

    /**
     * 写入一个模块。
     * @param writer 目标写入器。
     */
    protected writeHeader(writer: Writer) {
        // if (!this.options.output || this.options.output.prefix == null) {
        //     writer.writeText(`/* This file is generated by tpack at ${this.file.format("$NOW")}. DO NOT EDIT DIRECTLY!! */\n`);
        // }
        if (this.commonJs && !this.excluded.length) {
            writer.writeText(getLoader());
        }
    }

    /**
     * 写入一个模块。
     * @param writer 目标写入器。
     * @param module 要写入的模块。
     */
    protected writeModule(writer: Writer, module: TextBuildModule) {

        if (!this.commonJs) {
            writer.writeModule(module as TextBuildModule);
            return;
        }

        writer.writeText('\n\n__tpack__.define(');

        if (module !== this) {
            writer.writeText(JSON.stringify(((module as JsBuildModule).name ? (module as JsBuildModule).name : "./" + this.file.relative(module.file))) + ", ");
        }

        switch (module.type) {
            case ModuleType.js:
                writer.writeText('function(require, exports, module) {');
                writer.indentString = this.options.output && this.options.output.sourcePrefix != null ? this.options.output.sourcePrefix : "\t";
                writer.writeText('\n');
                writer.writeModule(module as TextBuildModule);
                writer.indentString = "";
                writer.writeText(`\n}`);
                break;
            case ModuleType.css:
                writer.writeText(`function(require, exports, module) {
    var style = document.createElement("style");
    module.exports = style.innerHTML = ${JSON.stringify(module.build())};
    var head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;
    head.appendChild(style);
}`);
                break;
            default:
                writer.writeText(`function(require, exports, module) { 
    module.exports = ${JSON.stringify(module.source)};
}`);
                break;
        }

        writer.writeText(`);`);
    }

}

/**
 * 表示 JS 模块的配置。
 */
export interface JsOptions extends TextOptions {

    /**
     * 指示如何解析代码内关键字。
     */
    keyword?: {

        /**
         * 全局模块。
         */
        global?: boolean;

        /**
         * process 模块。
         */
        process?: boolean;

        /**
         * Buffer 模块。
         */
        Buffer?: boolean;

        /**
         * __filename 模块。
         */
        __filename?: boolean;

        /**
         * __dirname 模块。
         */
        __dirname?: boolean;

        /**
         * setImmediate 模块。
         */
        setImmediate?: boolean;

        /**
         * Node 内置模块。
         */
        native?: boolean;

    };

    /**
     * 输出相关的设置。
     */
    loader?: {

        /**
         * 默认编译的库类型。可能的值有：
         * - var: var Library = xxx
         * - this: this["Library"] = xxx
         * - commonjs: exports["Library"] = xxx
         * - commonjs2: this.exports = xxx
         * - amd
         * - umd
         * @default "var"
         */
        libraryTarget?: string;

        /**
         * 在异步加载模块时，是否追加 cross-orign 属性。
         * @see https://developer.mozilla.org/en/docs/Web/HTML/Element/script#attr-crossorigin
         */
        crossOriginLoading?: boolean,

    }

    /**
     * 是否导出非相同类型的模块。
     */
    export?: {

    }

}

/**
 * 获取加载器源码。
 * @return 返回加载器源码。
 */
function getLoader() {
    if (!getLoader["_cache"]) {
        getLoader["_cache"] = FS.readFileSync(require.resolve("../require.js"), "utf-8");
    }
    return getLoader["_cache"] as string;
}
