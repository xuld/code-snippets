/**
 * @fileOverview 模块基类。
 */

import * as Path from "path";

import * as IO from "tutils/node/io";

import { BuildFile } from "tpack/src/buildFile";

/**
 * 表示一个生成模块。
 * @remark
 * 任何一个文件都可以解析为模块。模块和文件一一对应。
 */
export class BuildModule {

    // #region 基本属性

    /**
     * 获取当前模块的源文件。
     */
    file: BuildFile;

    /**
     * 获取当前模块的解析配置。
     */
    options: ModuleOptions;

    /**
     * 初始化新的模块。
     * @param file 源文件。
     * @param options 解析配置。
     */
    constructor(file: BuildFile, options: ModuleOptions) {
        this.file = file;
        this.options = options;
    }

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.binary; }

    /**
     * 获取当前模块的地址。
     */
    get url() { return this.file.srcPath; }

    /**
     * 获取当前模块的源码。
     */
    get source() { return this.file.getBase64Url(); }

    // #endregion

    // #region 解析

    /**
     * 从文件载入模块信息。
     */
    load() {

        // 跳过解析当前模块。
        if (this.options.noParse) {
            return;
        }

        // 设置解析目标。
        if (this.options.target) {
            this.resolveTarget("<config section: target>", 0, this.options.target);
        }

        // 应用依赖和排除项。
        for (let url in this.options.require) {
            let obj = this.resolveUrl("<config section: require>", 0, url, UrlUsage.require);
            if (obj.module) {
                if (this.options.require[url] !== false) {
                    this.require(obj.module);
                } else {
                    this.exclude(obj.module);
                }
            }
        }

        // 开始更新。
        this.parse();

    }

    /**
     * 解析当前模块。
     */
    protected parse() { }

    /**
     * 将模块信息保存到源文件。
     */
    save() { }

    // #endregion

    // #region 解析工具函数

    /**
     * 报告错误或警告。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param message 错误的信息。
     * @param args 格式化参数。如设置 {a:1}，那么 @message 中的 {a} 会被替换为 1。
     * @param warning 是否弱化错误为警告。
     * @param error 原始错误信息。
     */
    protected reportError(source: string, index: number, message: string, args?: Object, warning?: boolean, error?: Error) {
        message = this.file.builder.format(message, args);
        let startLoc = this.indexToLocation(index);
        let endLoc = this.indexToLocation(index + source.length);
        warning ?
            this.file.warning({
                name: "ModularWarning",
                error: error,
                message: message,
                fileName: this.url,
                startLine: startLoc.line,
                startColumn: startLoc.column,
                endLine: endLoc.line,
                endColumn: endLoc.column
            }) :
            this.file.error({
                name: "ModularError",
                error: error,
                message: message,
                fileName: this.url,
                startLine: startLoc.line,
                startColumn: startLoc.column,
                endLine: endLoc.line,
                endColumn: endLoc.column
            });
    }

    /**
     * 解析当前模块内指定相对地址实际所表示的地址。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param url 要处理的相对地址。
     * @param usage 地址的使用场景。
     * @returns 返回一个对象。
     */
    protected resolveUrl(source: string, index: number, url: string, usage: UrlUsage) {

        let options = this.options.resolve;

        // 自定义解析函数。
        if (options && options.parse) {
            url = options.parse(this.file, url, usage) || url;
        }

        // 拆分 ? 前后
        let p = url.search(/[?#]/);
        let result: UrlInfo = p >= 0 ? { path: url.substr(0, p), query: url.substr(p) } : { path: url, query: "" };

        // 不处理此地址。
        if (options === false || processQuery(result, "RESOLVE") === 0) {
            return result;
        }

        let local = result.path;

        // 应用路径别名。
        if (options && options.alias) {
            let pathLower = result.path.toLowerCase();
            for (let alias in options.alias) {
                if (pathLower.startsWith(alias.toLowerCase())) {
                    result.alias = true;
                    let prefix = options.alias[alias];
                    let postfx = result.path.substr(alias.length);
                    local = /^\w+:|^\/\//.test(prefix) ?
                        prefix + postfx :
                        Path.resolve(this.file.builder.basePath, prefix, postfx);
                    break;
                }
            }
        }

        // 网络地址。
        if (/^\w+:|^\/\//.test(local)) {
            if (usage === UrlUsage.local && (!options || options.nonLocal !== "ignore")) {
                this.reportError(source, index, "Cannot parse non-local file: '{url}'.", { url }, options && options.nonLocal === "warning");
            }
            return result;
        }

        let resolved: string;

        // 以 require() 方式解析。
        if (usage === UrlUsage.require && (!options || options.commonJs !== false)) {

            // 标记是否完全按 nodejs 方式搜索模块。
            let nodejs = this.target === ModuleTarget.nodejs;

            let extensions = options && options.extensions || (nodejs ? ["", ".node", ".json", ".js"] : ["", ".json", ".js", ".css", ".tpl"]);

            // 区分搜索相对路径还是全局模块。
            let c = result.path.charCodeAt(0);
            if (c === 46 /*.*/ || c === 47 /*/*/) {
                resolved = tryExtensions(local = this.file.resolve(local), extensions);
            } else {

                // 标记模块来自全局。
                result.global = true;

                // 内置模块。
                if (!options || options.native !== false) {
                    if (nodejs) {
                        try {
                            if (require.resolve(local) === local) {
                                return result;
                            }
                        } catch (e) { }
                    } else {
                        try {
                            resolved = require("node-libs-browser")[local];
                        } catch (e) { }
                    }
                }

                // node_modules。
                if (resolved == null) {
                    resolved = tryPackage(this.file.srcDirPath, local, options && options.modulesDirectories || (nodejs ? ["node_modules"] : ["web_modules", "node_modules"]), options && options.packageMains || (nodejs ? ["main"] : ["browser", "web", "browserify", "main"]), extensions);
                }

                // 根目录。
                if (resolved == null && options && options.root != null) {
                    if (typeof options.root === "string") {
                        resolved = tryExtensions(Path.resolve(this.file.builder.basePath, options.root, local), extensions);
                    } else {
                        for (let i = 0; i < options.root.length; i++) {
                            if ((resolved = tryExtensions(Path.resolve(this.file.builder.basePath, options.root[i], local), extensions)) != null) {
                                break;
                            }
                        }
                    }

                }

            }

        } else {
            local = this.file.resolve(local);
            resolved = IO.existsFile(local) ? local : null;
        }

        // fallback。
        if (!resolved && options && options.fallback) {
            local = options.fallback(this.file, url, usage);
            resolved = IO.existsFile(local) ? local : null;
        }

        // 最终没找到模块。
        if (!resolved) {
            if (!options || options.notFound !== "ignore") {
                this.reportError(source, index, usage === UrlUsage.require ? "Cannot find module: '{url}'." : "Cannot find file: '{url}'.", { url: local }, usage === UrlUsage.inline || options && options.notFound === "warning");
            }
            return result;
        }

        // 获取对应模块。
        result.module = require("./index").getModule(this.file.builder.getFile(this.file.builder.toName(resolved)), options);
        return result;
    }

    /**
     * 获取当前生成的类型。
     */
    target: ModuleTarget;

    /**
     * 解析 #target target。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param target 设置的类型。
     * @returns 解析后的模块类型。如果解析错误则返回 @null。
     */
    protected resolveTarget(source: string, index: number, target: string) {
        target = target.toLowerCase();
        if (!ModuleTarget[target]) {
            this.reportError(source, index, "Invalid target: '{target}'. Supported targets are list below: {supportedTarget}.", { target, supportedTarget: "'browser', 'nodejs'" }, true);
            return ModuleTarget.browser;
        }
        return this.target = ModuleTarget[target] as ModuleTarget;
    }

    // #endregion

    // #region 行号

    /**
     * 存储当前文件的索引信息。
     */
    _indexes: number[];

    /**
     * 存储当前查找行列号的游标。
     */
    _indexesCursor: number;

    /**
     * 计算指定索引对应的行列号。
     * @param index 要检查的索引。
     * @returns 返回对应的行列号。
     */
    indexToLocation(index: number) {
        if (!(index > 0)) {
            return { line: 1, column: 0 };
        }
        let indexes = this._indexes;
        if (!indexes) {
            this._indexes = indexes = [0];
            this._indexesCursor = 0;

            // 计算每行的长度。
            this.source.replace(/\r\n?|\n/g, (all, index: number) => {
                indexes.push(all.length + index);
                return "";
            });
        }
        let cursor = this._indexesCursor;

        // 确保游标所在位置在大于索引的最小位置。
        while (indexes[cursor] <= index) cursor++;
        while (cursor >= indexes.length || indexes[cursor] > index) cursor--;

        // 更新游标并返回位置。
        this._indexesCursor = cursor;
        return { line: cursor + 1, column: index - indexes[cursor] };
    }

    // #endregion

    // #region 依赖关系

    /**
     * 获取当前文件包含的所有模块（包括间接包含项）。
     */
    included: BuildModule[] = [];

    /**
     * 获取当前文件依赖的所有模块（包括间接依赖项）。
     */
    required: BuildModule[] = [];

    /**
     * 获取当前文件排除的所有模块（包括间接排除项）。
     */
    excluded: BuildModule[] = [];

    /**
     * 包含一个模块。
     * @param module 要包含的模块。
     * @return 如果已成功包含则返回 @true，否则表示存在循环包含，返回 @false。
     */
    include(module: BuildModule) {

        // 不处理自身。
        if (this === module) {
            return false;
        }

        // 不重复处理，模块允许重复包含。
        if (this.included.indexOf(module) >= 0) {
            return true;
        }

        let result = true;

        // 处理依赖项。
        for (let i = 0; i < module.included.length; i++) {
            let r = module.included[i];
            if (r === this) {
                result = false;
                continue;
            }
            if (this.included.indexOf(r) >= 0) {
                continue;
            }
            this.included.push(r);
            this.onInclude(r);
        }

        // 处理目标文件。
        this.included.push(module);
        this.onInclude(module);
        this.file.include(module.url, "Modular:include");
        return result;
    }

    /**
     * 当包含指定模块时执行。
     * @param module 被包含的模块。
     */
    protected onInclude(file: BuildModule) {
        for (let i = 0; i < file.required.length; i++) {
            this.require(file.required[i]);
        }
        for (let i = 0; i < file.excluded.length; i++) {
            this.exclude(file.excluded[i]);
        }
    }

    /**
     * 依赖一个模块。
     * @param module 要依赖的模块。
     */
    require(module: BuildModule) {

        // 不处理自身，不重复依赖。
        if (this === module || this.required.indexOf(module) >= 0) {
            return;
        }

        // 处理依赖项。
        for (let i = 0; i < module.required.length; i++) {
            let r = module.required[i];
            if (r === this || this.required.indexOf(r) >= 0) {
                continue;
            }
            this.required.push(r);
        }

        // 依赖目标文件。
        this.required.push(module);
        this.file.include(module.url, "Modular:require");
    }

    /**
     * 排除一个模块。
     * @param file 要排除的模块。
     */
    exclude(module: BuildModule) {

        // 不处理自身，不重复依赖。
        if (this === module || this.required.indexOf(module) >= 0) {
            return;
        }

        // 排除文件的依赖项。
        for (let i = 0; i < module.required.length; i++) {
            if (module.required[i] !== this) {
                let m = module.required[i];
                if (this.excluded.indexOf(m) < 0) {
                    this.excluded.push(m);
                }
            }
        }
        for (let i = 0; i < module.excluded.length; i++) {
            if (module.excluded[i] !== this) {
                let m = module.excluded[i];
                if (this.excluded.indexOf(m) < 0) {
                    this.excluded.push(m);
                }
            }
        }

        // 排除目标文件。
        this.excluded.push(module);

    }

    /**
     * 获取最终的文件依赖列表。
     */
    getRequireList() {
        let result = new Array<BuildModule>();
        for (let i = 0; i < this.required.length; i++) {
            let module = this.required[i];
            if (this.excluded.indexOf(module) < 0) {
                result.push(module);
            }
        }
        result.push(this);
        return result;
    }

    // #endregion

}

/**
 * 表示模块的公共解析配置。
 */
export interface ModuleOptions {

    /**
     * 是否跳过解析当前模块。
     */
    noParse?: boolean;

    /**
     * 手动指定当前模块的依赖列表。
     * @example 手动包含 ./a.js，手动排除 ./b：
     * {"./a.js": true, "./b": false} 
     */
    require?: { [modulePath: string]: boolean };

    /**
     * 当前模块的生成目标环境。
     * @default "browser"
     * @returns 有效的值为：
     * - "browser": 浏览器
     * - "nodejs": NodeJs 包
     */
    target?: string;

    /**
     * 解析地址相关配置。
     */
    resolve?: {

        /**
         * 自定义预处理地址的函数。
         * @param file 地址所在文件。
         * @param url 要解析的相对地址。
         * @param usage 地址的使用场景。
         * @returns 返回解析好的地址。
         * @default null
         * @example 将地址中 ~/ 更换为绝对地址以便解析：
         * ```
         * {
         *      parse: function(file, url, usage){
         *          return url.replace(/^~\//, "");
         *      }
         * }
         * ```
         */
        parse?: (file: BuildFile, url: string, usage: UrlUsage) => string;

        /**
         * 设置基路径的别名。
         * @remark
         * 键为虚拟目录时，必须前缀 /，值是相对于 tpack.basePath 的物理路径或 http: 开头的完整 HTTP 路径。
         * @example 当设置 `{"/virtual": "assets"}` 时，路径 /virtual/a.js 将解析为 根路径/assets/a.js
         */
        alias?: { [virtual: string]: string };

        /**
         * 设置如何处理非本地路径（包括 http: 开头的远程路径和 C: 开头的本地绝对路径）。可能值有：
         * - "error": 报错。
         * - "warning": 警告。
         * - "ignore": 忽略。
         * @default "error"
         */
        nonLocal?: "error" | "warning" | "ignore";

        /**
         * 是否启用类似 commonJs 的模块搜索方式。
         * @default true
         * @remark 设置为 @false，则全部地址都使用相对路径方式解析。
         */
        commonJs?: boolean;

        /**
         * 自动追加的扩展名。仅当启用 CommonJs 时支持。
         * @default ["", ".node", ".json", ".js"]
         */
        extensions?: string[];

        /**
         * 指示是否搜索 Node 内置模块。仅当启用 CommonJs 时支持。
         */
        native?: boolean;

        /**
         * 搜索的模块路径。仅当启用 CommonJs 时支持。
         * @default ["web_modules", "node_modules"]
         * @remark 如当设置为 node_modules 时，假设当前文件是 D:\work\www\main.js, 则会依次搜索以下路径：
         * - D:\work\www\node_modules
         * - D:\work\node_modules
         * - D:\node_modules
         */
        modulesDirectories?: string[];

        /**
         * 检查 package.json 中这些字段以搜索入口。仅当启用 CommonJs 时支持。
         * @default ["browser", "web", "browserify", "main"]
         */
        packageMains?: string[];

        /**
         * 全局搜索路径。仅当启用 CommonJs 时支持。
         * @remark 路径为相对于 tpack.basePath 的相对路径。
         */
        root?: string | string[];

        /**
         * 当找不到模块时的回调函数。
         * @param file 要处理的文件。
         * @param url 搜索的模块路径。
         * @param usage 地址的使用场景。
         * @returns 返回解析好的绝对路径。如果解析失败则返回 @null。
         */
        fallback?: (file: BuildFile, url: string, usage: UrlUsage) => string;

        /**
         * 设置如何处理无效的本地地址。可能值有：
         * - "error": 报错。
         * - "warning": 警告。
         * - "ignore": 忽略。
         * @default "error"
         */
        notFound?: "error" | "warning" | "ignore";

    };

    /**
     * 处理地址相关配置。
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
        inline?: boolean | null | number | ((file: BuildFile, urlInfo: UrlInfo) => boolean | number);

        /**
         * 设置各个路径发布后的地址。
         * @example
         * ```json
         * { replace: {"assets": "http://cdn.com/assets"} }
         * ```
         */
        replace?: { [url: string]: string }

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
        append?: string | ((file: BuildFile, urlInfo: UrlInfo) => string);

        /**
         * 生成最终地址的回调函数。该函数允许自定义最终保存到文件时使用的地址。
         * @param file 地址所在文件。
         * @param urlInfo 包含地址相关信息。
         */
        format?: (file: BuildFile, urlInfo: UrlInfo) => string;

    };

}

/**
 * 表示模块类型。
 */
export enum ModuleType {

    /**
     * 二进制模块。
     */
    binary,

    /**
     * 文本模块。
     */
    text,

    /**
     * JavaScript 模块。
     */
    js,

    /**
     * JSON 模块。
     */
    json,

    /**
     * CSS 模块。
     */
    css,

    /**
     * HTML 模块。
     */
    html,

    /**
     * XML 模块。
     */
    xml,

    /**
     * ASP 模块。
     */
    asp,

}

/**
 * 表示模块生成类型。
 */
export enum ModuleTarget {

    /**
     * 浏览器。
     */
    browser,

    /**
     * NodeJs 模块。
     */
    nodejs

}

/**
 * 表示地址的使用场景。
 */
export enum UrlUsage {

    /**
     * 表示代码中的内联地址，可以指向一个本地文件或网络文件。
     */
    inline,

    /**
     * 表示一个本地文件。
     */
    local,

    /**
     * 表示一个本地模块。
     */
    require

}

/**
 * 表示地址解析结果。
 */
export interface UrlInfo {

    /**
     * 获取路径参数部分。
     */
    path: string;

    /**
     * 获取查询参数部分。
     */
    query: string;

    /**
     * 如果存在，则返回对应的模块。
     */
    module?: BuildModule;

    /**
     * 判断当前模块是否包含别名部分。
     */
    alias?: boolean;

    /**
     * 判断当前模块是否来自全局依赖。
     */
    global?: boolean;

}

/**
 * 处理地址中的查询字符串。
 * @param obj 地址对象。处理完成之后地址将更新。
 * @param name 参数名。
 * @returns 返回检索的值。如果参数为数字，则返回值，如果参数为 true/yes/on 则返回 -1。如果不存在参数则返回 @null。
 */
export function processQuery(obj: UrlInfo, name: string) {
    if (obj.query) {
        let cache = processQuery["_cache"] || (processQuery["_cache"] = { __proto__: null });
        let re = cache[name] || (cache[name] = new RegExp("(\\?|&)\\$" + name + "(=([^&]*))?(&|$)", "i"));
        let m = re.exec(obj.query);
        if (m) {
            obj.query = obj.query.replace(re, "$1").replace(/\?&?$/, "");
            let v = m[2];
            return !v || /^(true|yes|on)$/i.test(v) ? -1 : +v || 0;
        }
    }
    return null;
}

/**
 * 搜索 node_modules 下的模块路径。
 * @param dirPath 要搜索的文件夹路径。
 * @param modulesDirectory 要搜索的模块文件夹。
 * @param name 要搜索的文件名。
 * @param packageMains 要搜索的包主名。
 * @param extensions 要搜索的扩展名。
 * @returns 返回添加扩展名的路径。
 */
function tryPackage(dirPath: string, name: string, modulesDirectories: string[], packageMains: string[], extensions: string[]) {

    // dirPath: D:/work/
    // name: tpack/lib/builder

    // D:/work/node_modules/
    for (let i = 0; i < modulesDirectories.length; i++) {
        let p = Path.join(dirPath, modulesDirectories[i]);
        if (IO.existsDir(p)) {

            // D:/work/node_modules/tpack/lib/builder/
            p = Path.join(p, name);

            // D:/work/node_modules/tpack/lib/builder.js
            let r = tryExtensions(p, extensions);
            if (r) return r;

            // D:/work/node_modules/tpack/lib/builder/
            if (IO.existsDir(p)) {

                // D:/work/node_modules/tpack/lib/builder/package.json
                if (IO.existsFile(r = Path.join(p, "package.json"))) {
                    let packageObj;
                    try {
                        packageObj = require(r);
                    } catch (e) { }

                    if (packageObj) {
                        for (let i = 0; i < packageMains.length; i++) {
                            let packageMain = packageMains[i];
                            if (IO.existsFile(r = Path.join(p, packageObj[packageMain]))) {
                                return r;
                            }
                        }
                    }

                }

                // D:/work/node_modules/tpack/lib/builder/index.js
                for (let j = 0; j < extensions.length; j++) {
                    if (IO.existsFile(r = Path.join(p, "index" + extensions[j]))) {
                        return r;
                    }
                }

            }

        }
    }

    // D:/
    let r = Path.dirname(dirPath);
    if (r.length !== dirPath.length) {
        return tryPackage(r, name, modulesDirectories, packageMains, extensions);
    }

    return null;
}

/**
 * 搜索追加扩展名的路径。
 * @param path 要搜索的路径。
 * @param extensions 要搜索的扩展名。
 * @returns 返回添加扩展名的路径。
 */
function tryExtensions(path: string, extensions: string[]) {
    for (let i = 0; i < extensions.length; i++) {
        let p = path + extensions[i];
        if (IO.existsFile(p)) {
            return p;
        }
    }
    return null;
}
