/**
 * @fileOverview 解析文本模块。
 */

import {SourceMapGenerator} from "source-map";

import {BuildFile} from "tpack/src/buildFile";

import {ModuleOptions, BuildModule, ModuleType, UrlInfo, UrlUsage, processQuery} from "./module";

/**
 * 表示一个文本模块。
 */
export class TextBuildModule extends BuildModule {

    // #region 核心

    /**
     * 获取当前模块的解析配置。
     */
    options: TextOptions;

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.text; }

    /**
     * 存储当前模块的源码。
     */
    private _source: string;

    /**
     * 获取当前模块的源码。
     */
    get source() {
        if (this._source == null) {
            this._source = this.file.content;
            // 忽略 UTF8 BOM 字符。
            if (this._source.charCodeAt(0) === 65279) {
                this._source = this._source.substr(1);
            }
            this.replacements = [];
        }
        return this._source;
    }

    // #endregion

    // #region 替换列表

    /**
     * 获取当前模块的替换列表。
     */
    replacements: Replacement[];

    /**
     * 最后一次替换记录的结束位置。
     */
    private _lastReplacementEndIndex: number;

    /**
     * 插入一个替换记录。
     * @param replacement 要插入的替换记录。
     * @return 返回插入的位置，如果插入失败则返回 -1。
     */
    protected addReplacement(replacement: Replacement) {

        console.assert(replacement.startIndex <= replacement.endIndex);
        console.assert(replacement.endIndex <= this.source.length);

        // 如果最新替换记录在最末尾，则快速插入。
        if (replacement.startIndex >= this._lastReplacementEndIndex) {
            this._lastReplacementEndIndex = replacement.endIndex;
            return this.replacements.push(replacement);
        }

        // 根据排序规则查找插入点。
        let p = this.replacements.length;
        while (p) {
            let r = this.replacements[p - 1];
            if (replacement.startIndex >= r.startIndex) {
                // 无法插入到上一个替换点中间：忽略当前更新操作。
                if (replacement.startIndex < r.endIndex || (p < this.replacements.length && replacement.endIndex > this.replacements[p].startIndex)) {
                    return -1;
                }
                break;
            }
            p--;
        }

        // 插入到指定位置。
        this._lastReplacementEndIndex = replacement.endIndex;
        this.replacements.splice(p, 0, replacement);
        return p;
    }

    /**
     * 统计隐藏的次数。
     */
    private _hideCount;

    /**
     * 开始一个隐藏区域。隐藏区域内的代码会被删除。
     * @param index 区域的索引。
     */
    protected beiginHiddenRegion(index) {
        if (this._hideCount === 0) {
            this.replacements.push(new TextReplacement(index, this.source.length + 1, ""));
        }
        this._hideCount++;
    }

    /**
     * 退出隐藏区域。
     * @param index 区域的索引。
     */
    protected endHiddenRegion(index) {
        this._hideCount--;
        if (this._hideCount === 0) {
            this.replacements[this.replacements.length - 1].endIndex = index;
        }
    }

    // #endregion

    // #region 解析和生成

    /**
     * 将模块信息保存到源文件。
     */
    save() {

        // 未重写 parse 函数，无需更新内容。
        if (this.parse === super.parse) {
            return;
        }

        // 生成文件。
        this.file.setContentDelay(() => this.build());

    }

    /**
     * 打包生成当前文件。
     */
    build() {

        // 生成最终内容。
        let options = this.options.output;
        let writer = (options && options.sourceMap != null ? options.sourceMap : this.file.sourceMap) && (this.type === ModuleType.js || this.type === ModuleType.css) ? new SourceMapWriter(this) : new Writer(this);

        // 写入文件头。
        this.writeHeader(writer);
        if (options && options.prefix) {
            writer.writeText(this.file.format(options.prefix));
        }

        // 写入依赖模块。
        let moduleList = this.getRequireList();
        for (let i = 0; i < moduleList.length; i++) {
            let module = moduleList[i];

            if (options && options.modulePrefix) {
                writer.writeText(module.file.format(options.modulePrefix));
            }

            if (i > 0 && options && options.moduleSeperator !== "") {
                writer.writeText(options.moduleSeperator || "\n");
            }

            this.writeModule(writer, module);

            if (options && options.modulePostfix) {
                writer.writeText(module.file.format(options.modulePostfix));
            }

        }

        if (options && options.postfix) {
            writer.writeText(this.file.format(options.postfix));
        }

        // 保存生成内容。
        this.file.sourceMapData = writer["sourceMap"] ? writer["sourceMap"].toJSON() : null;
        return writer.toString();
    }

    /**
     * 写入一个模块。
     * @param writer 目标写入器。
     */
    protected writeHeader(writer: Writer) { }

    /**
     * 写入一个模块。
     * @param writer 目标写入器。
     * @param module 要写入的模块。
     */
    protected writeModule(writer: Writer, module: BuildModule) {
        writer.writeModule(module as TextBuildModule);
    }

    // #endregion

    // #region 地址

    /**
     * 解析 $URL(url) 和 HTML/CSS 内联地址。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param url 要解析的相对路径。
     * @param encoder 编码地址的回调函数。
     * @param textInliner 当以文本格式内联时的回调函数，自定义前后缀。
     */
    protected parseUrl(source: string, index: number, url: string, encoder: (url: string) => string, textInliner?: () => { prefix: string, postfix: string }) {

        // 禁止解析地址。
        let options = this.options.url;
        if (options === false) return;

        // 解析地址。
        let obj = this.resolveUrl(source, index, url, UrlUsage.inline);
        if (!obj.module) return;

        let endIndex = index + source.length;

        // 处理内联。
        let inlineLimit = processQuery(obj, "INLINE");
        if (inlineLimit == null && options && options.inline != null) {
            inlineLimit = options.inline as any;
            if (typeof inlineLimit === "function") inlineLimit = (options.inline as ((file: BuildFile, urlInfo: UrlInfo) => boolean | number))(this.file, obj) as number;
            if (typeof inlineLimit === "boolean") inlineLimit = inlineLimit ? -1 : 0;
        }

        // 内联。
        if (inlineLimit < 0 || inlineLimit && obj.module.file.buffer.length < inlineLimit) {
            this.file.include(obj.module.url, "Modular:$INLINE");

            if (textInliner) {
                let prefixAndPostfix = textInliner();
                this.addReplacement(new TextReplacement(index, endIndex, prefixAndPostfix.prefix));
                this.addReplacement(new ModuleReplacement(endIndex, endIndex, obj.module as TextBuildModule));
                this.addReplacement(new TextReplacement(endIndex, endIndex, prefixAndPostfix.postfix));
            } else {
                this.addReplacement(new TextDelayReplacement(index, endIndex, module => encoder(obj.module.file.getBase64Url())));
            }

            return;
        }

        // 不内联。
        this.addReplacement(obj.alias ?
            new TextReplacement(index, endIndex, encoder(obj.path)):
            new TextDelayReplacement(index, endIndex, module => encoder(module.buildUrl(obj))));

    }

    /**
     * 生成最终保存到文件的地址。
     * @param urlInfo 解析返回的地址信息。
     * @return 返回生成的地址。
     */
    protected buildUrl(urlInfo: UrlInfo) {

        let obj: UrlInfo = {
            path: urlInfo.path,
            query: (urlInfo.module || this).file.format(urlInfo.query),
            module: urlInfo.module
        };

        let options = this.options.url;

        // 添加后缀，如果格式化过参数有变化，则说明后缀已包含在参数，无需重复追加后缀。
        if (obj.query === urlInfo.query) {
            let postfix = options && options.postfix;
            if (postfix && processQuery(obj, "POSTFIX") !== 0) {
                if (typeof postfix === "function") postfix = (postfix as ((file: BuildFile, urlInfo: UrlInfo) => string)).call(options, this.file, obj) || "";
                if (postfix) {
                    obj.query += (obj.query ? '&' : '?') + (urlInfo.module || this).file.format(postfix.toString());
                }
            }
        }

        if (options) {

            // 自定义逻辑。
            if (options.build) {
                let r = options.build(this.file, obj);
                if (r != null) return r;
            }

            // 尝试使用公开路径。
            let pathLower = obj.path.toLowerCase();
            for (let prefix in options.public) {
                if (pathLower.startsWith(prefix.toLowerCase())) {
                    return options.public[prefix] + obj.path.substr(prefix.length) + obj.query;
                }
            }
        }

        // 使用相对地址。
        return (urlInfo.module ? this.file.relative(urlInfo.module.file) : obj.path) + obj.query;
    }

    // #endregion

    // #region 注释和宏

    /**
     * 解析一段注释。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param comment 要解析的注释内容。
     */
    protected parseComment(source: string, index: number, comment: string) {

        // 判断选项。
        let options = this.options.comment;
        if (options === false) return;

        // 解析注释内指令。
        comment = comment.replace(/#(include|exclude|require|target|if|else|elif|endif|region|endregion|error|warn)\b(.*)/g, (all, name, arg) => {
            switch (name) {
                case "include":
                    if (!options || options.include !== false) {
                        let related = this.resolveInclude(source, index, trimQuotes(arg));
                        if (related) {
                            this.addReplacement(new ModuleReplacement(index, index, related as TextBuildModule));
                            return "";
                        }
                    }
                    break;
                case "require":
                    if (!options || options.require !== false) {
                        if (this.resolveRequire(source, index, trimQuotes(arg)) != null) {
                            return "";
                        }
                    }
                    break;
                case "exclude":
                    if (!options || options.exclude !== false) {
                        if (this.resolveExclude(source, index, trimQuotes(arg)) != null) {
                            return "";
                        }
                    }
                    break;
                case "target":
                    if (!options || options.type !== false) {
                        if (this.resolveTarget(source, index, trimQuotes(arg)) == null) {
                            return "";
                        }
                    }
                    break;
                case "if":
                    if (!options || options.if !== false) {
                        this.resolveIfDirective(source, index, arg);
                        return "";
                    }
                    break;
                case "elif":
                    if (!options || options.if !== false) {
                        this.resolveElifDirective(source, index, arg);
                        return "";
                    }
                    break;
                case "else":
                    if (!options || options.if !== false) {
                        this.resolveElseDirective(source, index);
                        return "";
                    }
                    break;
                case "endif":
                    if (!options || options.if !== false) {
                        this.resolveEndIfDirective(source, index);
                        return "";
                    }
                    break;
                case "region":
                    if (!options || options.region !== false) {
                        this.resolveRegionDirective(source, index, arg);
                    }
                    break;
                case "endregion":
                    if (!options || options.region !== false) {
                        this.resolveEndRegionDirective(source, index);
                    }
                    break;
                case "error":
                    if (!options || options.error !== false) {
                        this.resolveErrorDirective(source, index, trimQuotes(arg));
                    }
                    break;
                case "warning":
                    if (!options || options.warning !== false) {
                        this.resolveWarningDirective(source, index, trimQuotes(arg));
                    }
                    break;
            }
            return all;
        }).trim();

        // 删除仅包含指令的注释。
        if (!comment) {
            this.addReplacement(new TextReplacement(index, index + source.length, ""));
        }

    }

    /**
     * 解析 #include url 和 INCLUDE(url)。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param url 包含的地址。
     * @returns 返回包含的模块。如果解析错误则返回 @null。
     */
    protected resolveInclude(source: string, index: number, url: string) {
        let obj = this.resolveUrl(source, index, url, UrlUsage.local);
        if (!obj.module) return null;
        if (!this.include(obj.module)) {
            this.reportError(source, index, "Circular include with '{name}'.", { name: obj.module.file.displayName });
            return null;
        }
        return obj.module;
    }

    /**
     * 解析 #require url。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param url 依赖的地址。
     * @returns 返回依赖的模块。如果解析错误则返回 @null。
     */
    protected resolveRequire(source: string, index: number, url: string) {
        // require("path") => {global: true}
        // require("mymodule") => {global: true, file: ...}
        // require("./mymodule") => {file: ...}
        // require("ERROR") => {}
        let obj = this.resolveUrl(source, index, url, UrlUsage.require);
        if (!obj.module) return null;
        this.require(obj.module);
        return obj.module;
    }

    /**
     * 解析 #exclude url。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param url 排除的地址。
     * @returns 返回排除的模块。如果解析错误则返回 @null。
     */
    protected resolveExclude(source: string, index: number, url: string) {
        let obj = this.resolveUrl(source, index, url, UrlUsage.require);
        if (!obj.module) return null;
        this.exclude(obj.module);
        return obj.module;
    }

    /**
     * 存储 #if 堆栈。
     */
    private _ifStack: { item: IfStackItem, value: boolean }[];

    /**
     * 解析 #if expression。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param expression 宏表达式。
     */
    protected resolveIfDirective(source: string, index: number, expression: string) {
        let value = this.resolveMacro(source, index, expression) !== false;

        // 执行 #if
        if (this._ifStack) this._ifStack.unshift({ item: IfStackItem.if, value: value });
        else this._ifStack = [{ item: IfStackItem.if, value: value }];

        // 进入 #if false
        if (!value) this.beiginHiddenRegion(index);
    }

    /**
     * 解析 #elif expression。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param expression 宏表达式。
     */
    protected resolveElifDirective(source: string, index: number, expression: string) {
        if (!this._ifStack || this._ifStack[0].item !== IfStackItem.if) {
            this.reportError(source, index, "Mismatched #elif directive. Are you missing a #if?");
            return;
        }

        // 执行 #else
        this.resolveElseDirective(source, index);

        // 更新为 #elif
        this._ifStack[0].item = IfStackItem.elif;

        // 执行 #if
        this.resolveIfDirective(source, index, expression);
    }

    /**
     * 解析 #else。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     */
    protected resolveElseDirective(source: string, index: number) {
        if (!this._ifStack || this._ifStack[0].item !== IfStackItem.if) {
            this.reportError(source, index, "Mismatched #else directive. Are you missing a #if?");
            return;
        }

        // 退出 #if false
        if (!this._ifStack[0].value) this.endHiddenRegion(index + source.length);

        // 执行 #else
        this._ifStack[0].item = IfStackItem.else;
        this._ifStack[0].value = !this._ifStack[0].value;

        // 进入 #else false
        if (!this._ifStack[0].value) this.beiginHiddenRegion(index);
    }

    /**
     * 解析 #endif。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     */
    protected resolveEndIfDirective(source: string, index: number) {
        if (!this._ifStack || (this._ifStack[0].item !== IfStackItem.if && this._ifStack[0].item !== IfStackItem.else)) {
            this.reportError(source, index, "Mismatched #endif directive. Are you missing a #if?");
            return;
        }

        // 退出 #if false 或 #else false
        if (!this._ifStack.shift().value) this.endHiddenRegion(index + source.length);

        // 删除自动追加的 #elif
        while (this._ifStack.length && this._ifStack[0].item === IfStackItem.elif) {
            if (!this._ifStack.shift().value) this.endHiddenRegion(index + source.length);
        }

    }

    /**
     * 解析 #region name。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param name 区域名。
     */
    protected resolveRegionDirective(source: string, index: number, name: string) {
        let value = this.options.regions ? this.options.regions[name.trim()] !== false : true;

        // 执行 #region
        if (this._ifStack) this._ifStack.unshift({ item: IfStackItem.region, value: value });
        else this._ifStack = [{ item: IfStackItem.region, value: value }];

        // 进入 #region false
        if (!value) this.beiginHiddenRegion(index);
    }

    /**
     * 解析 #endregion。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     */
    protected resolveEndRegionDirective(source: string, index: number) {
        if (!this._ifStack || this._ifStack[0].item !== IfStackItem.region) {
            this.reportError(source, index, "Mismatched #endregion directive. Are you missing a #region?");
            return;
        }
        // 退出 #region false
        if (!this._ifStack.shift().value) this.endHiddenRegion(index + source.length);
    }

    /**
     * 解析 #error message。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param message 语句的参数。
     */
    protected resolveErrorDirective(source: string, index: number, message: string) {
        this.reportError(source, index, message, [this.file.displayName]);
    }

    /**
     * 解析 #warning message。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param message 语句的参数。
     * @return 返回宏编译结果。
     */
    protected resolveWarningDirective(source: string, index: number, message: string) {
        this.reportError(source, index, message, [this.file.displayName], true);
    }

    /**
     * 解析代码中的宏。
     */
    protected parseSub() {

        // 判断选项。
        let options = this.options.sub;
        if (options === false) return;

        // 解析常量。
        this.source.replace(/\$(URL|INCLUDE|MACRO)\s*\(\s*('(?:[^\\'\n\r\f]|\\[\s\S])*'|"(?:[^\\"\n\f]|\\[\s\S])*"|[^)\r\n]*)\s*\)/g, (source: string, sub: string, arg: string, index: number) => {
            let argValue = decodeString(arg);

            switch (sub) {
                case "URL":
                    if (!options || options.url !== false) {
                        this.parseUrl(argValue, index, argValue, url => encodeString(url, arg));
                    }
                    break;
                case "INCLUDE":
                    if (!options || options.include !== false) {
                        let related = this.resolveInclude(source, index, argValue);
                        if (related) {
                            this.addReplacement(this.type === related.type && related instanceof TextBuildModule ?
                                new ModuleReplacement(index, index + source.length, related as TextBuildModule) :
                                new TextDelayReplacement(index, index + source.length, () => encodeString(related.source, arg))
                            );
                        }
                    }
                    break;
                case "MACRO":
                    if (!options || options.macro !== false) {
                        this.addReplacement(new TextReplacement(index, index + source.length, encodeString(this.resolveMacro(source, index, argValue), arg)));
                    }
                    break;
            }

            return source;
        });

    }

    /**
     * 解析 $MACRO(name)
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param expression 要执行的宏表达式。
     * @returns 返回表达式的返回值。
     */
    protected resolveMacro(source: string, index: number, expression: string) {

        // 简单宏名称。
        if (/^[a-zA-Z$_][\w$]*$/.test(expression)) {
            return this.getDefined(expression);
        }

        // 复杂表达式。
        try {
            return eval(expression.replace(/[a-zA-Z$_][\w$]*/g, name => JSON.stringify(this.getDefined(name))));
        } catch (e) {
            this.reportError(source, index, "Cannot evaluate expression: '{expression}'. {error}", { expression, error: e }, false, e);
            return null;
        }
    }

    /**
     * 获取预定义的宏。
     * @param name 要获取的宏名称。
     * @return 返回宏对应的值。如果宏未定义则返回 @undefined。
     */
    protected getDefined(name: string) {
        let defines = this.options.defines;
        if (!defines || !defines.hasOwnProperty(name)) return undefined;
        let value = defines[name] as any;
        if (typeof value === "function") value = value.call(defines, this.file);
        return value;
    }

    // #endregion

}

/**
 * 表示解析文本模块的配置。
 */
export interface TextOptions extends ModuleOptions {

    /**
     * 是否解析地址。
     * @default true
     */
    url?: {

        /**
         * 是否内联地址。
         * @returns 可能值有：
         * - false(默认): 不内联。
         * - true：内联。
         * - 数字：当文件大小不超过指定字节数则内联，否则不内联。
         * - 函数：自定义是否内联的函数。函数参数为：
         * * @param file 地址所在文件。
         * * @param url 要解析的相对地址。
         * * @param urlInfo 地址信息。
         * * @returns 返回布尔值表示是否内联。
         * @default false
         */
        inline?: boolean | number | ((file: BuildFile, urlInfo: UrlInfo) => boolean | number);

        /**
         * 追加地址后缀。
         * @returns 可能值有：
         * - 一个字符串，字符串可以包含 $MD5 等标记。支持的标记有：
         * * + $MD5: 替换成文件的 MD5 值。
         * * + $HASH: 本次生成的哈希值。
         * * + $DATE: 替换成当前时间。
         * - 一个函数，函数参数为：
         * * @param file 地址所在文件。
         * * @param urlInfo 地址信息。
         * * @returns 返回后缀字符串。
         */
        postfix?: string | ((file: BuildFile, urlInfo: UrlInfo) => string);

        /**
         * 生成最终地址的回调函数。该函数允许自定义最终保存到文件时使用的地址。
         * @param file 地址所在文件。
         * @param urlInfo 包含地址相关信息。
         */
        build?: (file: BuildFile, urlInfo: UrlInfo) => string;

        /**
         * 设置各个路径发布后的地址。
         * @example
         * 如设置为 {"assets": "http://cdn.com/assets"}
         */
        public?: { [url: string]: string }

    };

    /**
     * 是否解析注释内指令（如 #include）。
     * @default true
     */
    comment?: {

        /**
         * 是否解析 #include 指令。
         * @default true
         */
        include?: boolean;

        /**
         * 是否解析 #exclude 指令。
         * @default true
         */
        exclude?: boolean;

        /**
         * 是否解析 #require 指令。
         * @default true
         */
        require?: boolean;

        /**
         * 是否解析 #type 指令。
         * @default true
         */
        type?: boolean;

        /**
         * 是否解析 #if 指令。
         * @default true
         */
        if?: boolean;

        /**
         * 是否解析 #region 指令。
         * @default true
         */
        region?: boolean;

        /**
         * 是否解析 #error 指令。
         * @default true
         */
        error?: boolean;

        /**
         * 是否解析 #warning 指令。
         * @default true
         */
        warning?: boolean;

    };

    /**
     * 是否解析全局宏（如 $INCLUDE）。
     */
    sub?: {

        /**
         * 是否解析 $URL 常量。
         * @default true
         */
        url?: boolean;

        /**
         * 是否解析 $INCLUDE 常量。
         * @default true
         */
        include?: boolean;

        /**
         * 解析 $MACRO 常量的值。
         * @default true
         */
        macro?: boolean;

    };

    /**
     * 宏列表。
     * @remark 
     * 如设置为 `{IE6: false}` 时，代码中 #if IE6 和 #endif 之间的部分会被删除。
     * 在代码中使用 $MACRO("IE6") 获取到此处设置的值。
     */
    defines?: { [name: string]: string | boolean | ((file: File) => string | boolean) };

    /**
     * 区列表。
     * @remark
     * 如设置为 `{IE6: false}` 时，代码中所有 #region IE6 和 #endregion 之间的部分会被删除。
     */
    regions?: { [name: string]: boolean };

    /**
     * 输出相关的设置。
     */
    output?: {

        /**
         * 设置是否生成源码映射表。
         */
        sourceMap?: boolean;

        /**
         * 在最终输出目标文件时追加的前缀。
         * @default "/* This file is generated by tpack at $NOW. DO NOT EDIT DIRECTLY!! *\/"
         */
        prefix?: string,

        /**
         * 在最终输出目标文件时追加的后缀。
         * @default ""
         */
        postfix?: string,

        /**
         * 在每个依赖模块之间插入的代码。
         * @default "\n"
         */
        moduleSeperator?: string,

        /**
         * 在每个依赖模块前插入的代码。
         * @default ""
         */
        modulePrefix?: string,

        /**
         * 在每个依赖模块后插入的代码。
         */
        modulePostfix?: string,

        /**
         * 在每行源文件前插入的代码。
         * @default "\t"
         */
        sourcePrefix?: string

    }

}

/**
 * 获取当前预处理指令堆栈的值。
 */
export enum IfStackItem {

    /**
     * #if
     */
    if,

    /**
     * #elif
     */
    elif,

    /**
     * #else
     */
    else,

    /**
     * #region
     */
    region,

}

// #region 替换

/**
 * 表示一个替换记录。
 */
export abstract class Replacement {

    /**
     * 获取当前替换记录的类型。
     */
    type: ReplaceType;

    /**
     * 获取当前替换记录在原始内容的起始位置。
     */
    startIndex: number;

    /**
     * 获取当前替换记录在原始内容的结束位置（不包括结束位置）。
     */
    endIndex: number;

    /**
     * 获取当前替换记录的数据。数据意义根据类型决定。
     */
    data: string | BuildModule | ((module: TextBuildModule) => string);

    /**
     * 初始化新的替换项。
     * @param startIndex 原始内容的起始位置。
     * @param endIndex 原始内容的结束位置（不包括结束位置）。
     * @param data 替换的数据。数据意义根据类型决定。
     */
    constructor(startIndex: number, endIndex: number, data: string | BuildModule | ((module: TextBuildModule) => string)) {
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.data = data;
    }

}

/**
 * 表示一个替换记录类型。
 */
export enum ReplaceType {

    /**
     * 替换为文本。
     */
    text,

    /**
     * 替换为指定模块内容。
     */
    module,

    /**
     * 包含替换的文本。文本的内容由合并时计算
     */
    textDelay

}

/**
 * 表示一个文本替换记录。
 */
export class TextReplacement extends Replacement {

    /**
     * 获取当前替换记录的类型。
     */
    get type() { return ReplaceType.text }

    /**
     * 获取当前替换记录的数据。数据意义根据类型决定。
     */
    data: string;

}

/**
 * 表示一个文本替换记录。
 */
export class ModuleReplacement extends Replacement {

    /**
     * 获取当前替换记录的类型。
     */
    get type() { return ReplaceType.module }

    /**
     * 获取当前替换记录的数据。数据意义根据类型决定。
     */
    data: TextBuildModule;

}

/**
 * 表示一个文本替换记录。
 */
export class TextDelayReplacement extends Replacement {

    /**
     * 获取当前替换记录的类型。
     */
    get type() { return ReplaceType.textDelay }

    /**
     * 获取当前替换记录的数据。数据意义根据类型决定。
     */
    data: (module: TextBuildModule) => string;

}

// #endregion

// #region 输出器

/**
 * 表示一个模块生成器。
 */
export class Writer {

    // #region 核心

    /**
     * 获取或设置目标模块。
     */
    module: TextBuildModule;

    /**
     * 获取或设置每行的缩进字符串。
     */
    indentString: string;

    /**
     * 最终生成的字符串缓存。
     */
    protected buffer = "";

    /**
     * 初始化新的生成器。
     * @param module 目标模块。
     * @param lineBreak 换行符。
     */
    constructor(module: TextBuildModule) {
        this.module = module;
    }

    /**
     * 返回当前生成的代码。
     * @returns 返回完整的代码。
     */
    toString() { return this.buffer; }

    /**
     * 底层实现写入一段文本。子类可以重写此函数以自定义写入逻辑。
     * @param source 要写入的内容。
     * @param module 内容所属的模块。 
     * @param index 内容在所属模块中的原始位置。 
     */
    protected append(source: string, module?: TextBuildModule, index?: number) {
        // 追加缩进字符串。
        if (this.indentString) {
            source = source.replace(/\r\n?|\n/g, "$&" + this.indentString);
        }
        this.buffer += source;
    }

    // #endregion

    // #region 写入 API

    /**
     * 写入一个模块。
     * @param module 要写入的模块。 
     */
    writeModule(module: TextBuildModule) {

        // 当前模块未作修改：全部写入。
        if (!module.replacements || !module.replacements.length) {
            this.append(module.source, module, 0);
            return;
        }

        let p = 0;
        for (let i = 0; i < module.replacements.length; i++) {
            let replacement = module.replacements[i];

            // 输出上一次替换到这次更新记录中间的普通文本。
            replacement.startIndex > p && this.append(module.source.substring(p, replacement.startIndex), module, p);

            // 输出本次替换。
            switch (replacement.type) {
                case ReplaceType.text:
                    this.append((replacement as TextReplacement).data, module, replacement.startIndex);
                    break;
                case ReplaceType.module:
                    this.writeModule((replacement as ModuleReplacement).data);
                    break;
                case ReplaceType.textDelay:
                    this.append((replacement as TextDelayReplacement).data(this.module), module, replacement.startIndex);
                    break;
            }

            // 更新最后一次替换位置。
            p = replacement.endIndex;
        }

        // 输出最后一段文本。
        module.source.length > p && this.append(module.source.substring(p), module, p);
    }

    /**
     * 写入一段文本。
     * @param value 要写入的文本。 
     */
    writeText(value: string) {
        this.append(value);
    }

    // #endregion

}

/**
 * 表示一个支持源码映射表的模块生成器。
 */
export class SourceMapWriter extends Writer {

    /**
     * 存储当前使用的源码映射表生成器。
     */
    _map = new SourceMapGenerator();

    /**
     * 获取当前的源码映射表。
     * @returns 返回源码映射表字符串。 
     */
    get sourceMap() { return this._map; }

    /**
     * 存储当前源码位置。
     */
    _sourcePos = { line: 1, column: 0 };

    /**
     * 底层实现写入一段文本。子类可以重写此函数以自定义写入逻辑。
     * @param source 要写入的内容。
     * @param module 内容所属的模块。 
     * @param index 内容在所属模块中的原始位置。 
     */
    protected append(source: string, module?: BuildModule, index?: number) {

        // 写入映射表。
        if (module) {
            this._map.addMapping({
                source: module.url,
                original: module.indexToLocation(index),
                generated: this._sourcePos
            });
        }

        // 不换行直接写入，更新列号。
        if (!/[\r\n]/.test(source)) {
            this.buffer += source;
            this._sourcePos.column += source.length;
            return;
        }

        // 写入多行，更新行列号。
        let lastIndex = 0;
        let result = source.replace(/\r\n?|\n/g, (all: string, index: number) => {
            this._sourcePos.line++;
            lastIndex = index + all.length;
            return this.indentString ? all + this.indentString : all;
        });
        this._sourcePos.column = source.length - lastIndex + (this.indentString ? this.indentString.length : 0);
        this.buffer += result;
    }

}

// #endregion

// #region 底层工具函数

/**
 * 解码一个字符串。
 * @param value 要解码的字符串。
 * @returns 返回处理后的字符串。
 */
export function decodeString(value: string) {
    switch (value.charCodeAt(0)) {
        case 34/*"*/:
            try {
                return JSON.parse(value) as string;
            } catch (e) {
                return value.substr(1, value.length - 2);
            }
        case 39/*'*/:
            try {
                return eval(value) as string;
            } catch (e) {
                return value.substr(1, value.length - 2);
            }
        default:
            return value.trim();
    }
}

/**
 * 编码一个字符串。
 * @param value 要编码的字符串。
 * @param quote 使用的引号字符。
 * @returns 返回处理后的字符串。
 */
export function encodeString(value: string, quote: string) {
    switch (quote.charCodeAt(0)) {
        case 34/*"*/:
            return JSON.stringify(value);
        case 39/*'*/:
            value = JSON.stringify(value);
            return "'" + value.substr(1, value.length - 2).replace(/'/g, '\\\'') + "'";
        default:
            return value.indexOf(')') >= 0 ? JSON.stringify(value) : value;
    }
}

/**
 * 清除括号或引号。
 * @param value 要处理的字符串。 
 * @returns 返回处理好的字符串。
 */
export function trimQuotes(value: string) {

    // 提取引号内容。
    let m = /'(?:[^\\'\n\r\f]|\\[\s\S])*'|"(?:[^\\"\n\f]|\\[\s\S])*"/.exec(value);
    if (m) return decodeString(m[0]);

    // 提取括号内容。
    m = /\((.*)\)/.exec(value);
    if (m) return m[1];

    // 忽略前导等号。
    return value.replace(/^\s*=/, "").trim();
}

// #endregion