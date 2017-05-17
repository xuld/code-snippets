
/**
 * 表示一个缓存数据。
 */
export interface CacheData {

    /**
     * 获取当前生成器的版本。
     */
    version: string;

    /**
     * 获取当前缓存数据针对的项目文件夹。
     */
    rootDir: string;

    /**
     * 获取文件比较的算法。
     */
    comparison: utility.FileComparion;

    /**
     * 配置文件校验码。
     */
    config: string;

    /**
     * 获取缓存的所有数据。
     */
    files: { [path: string]: string };

}

// 定义所有命令行参数。
// order 规范：
// 0-9：命令行全局命令。
// 10-19：智能提示全局命令。
// 20-29：调试全局命令。
// 50-59：配置相关全局命令。
// 100-999：生成配置。
// 1000-1999：任务配置。
var optionList = {

    "--lang": {
        order: 0,
        description: "Specify the ui language. e.g. 'zh-cn'.",
        execute: function (lang) {
            try {
                tpack.dict = require(Path.resolve(__dirname, "../../tpack-lang-" + lang));
            } catch (e) {
                try {
                    tpack.dict = require(Path.resolve(__dirname, "../../" + lang));
                } catch (e2) {
                    try {
                        tpack.dict = require(lang);
                    } catch (e3) {
                        tpack.fatal("Cannot load language package '{lang}': {error}", { lang: lang, error: e3 });
                    }
                }
            }
        }
    },

    "--default": {
        order: 51,
        description: "Use default configs if local config file is not found.",
        execute: function () { }
    },

    "--no-require-global": {
        order: 99,
        description: "Disable requiring global modules from config file.",
        execute: function () { }
    },

    "-g": "--global",
    "--global": {
        order: 100,
        description: "Process files in whole project instead of current directory.",
        execute: function () { }
    },

    "--pipe": {
        order: 100,
        description: "Specify the processors for all files. Seperated by ',' or ';'.",
        execute: function (plugin) {
            var rule = tpack.src("*");
            plugin.split(/[,;]\s*/).forEach(function (plugin) {
                rule.pipe(tpack.plugin(plugin));
            });
        }
    },

    "--file": {
        order: 100,
        description: "Specify the file to process. Seperated by ',' or ';'.",
        execute: function (path) { tpack.filters = path.split(/[,;]\s*/); }
    },

    "--allow-external": {
        order: 100,
        description: "Allow saving files outside of output directory.",
        execute: function () { tpack.allowExternal = true; }
    },

    "--skip-file-error": {
        order: 100,
        description: "Skip file errors.",
        execute: function () { tpack.fileErrorAction = tpack.FileErrorAction['continue']; }
    },

    "-b": "--build",
    "--build": {
        order: 1020,
        description: "Build all files once.",
        execute: function () { tpack.build(); }
    },

    "--no-clean": {
        order: 100,
        description: "Do not clean output directory before building.",
        execute: function () { tpack.disableClean = true; }
    },

    "-o": "--out",
    "--out": {
        order: 100,
        description: "Specify the output directory.",
        execute: function (path) { tpack.destPath = path; }
    },

    "--dependency": {
        order: 1010,
        description: "Print dependencies of files in preview mode.",
        execute: function () { tpack.dependency = true; }
    },

    "-s": "--server",
    "--server": {
        order: 1040,
        description: "Start a dev-server.",
        execute: function () { tpack.startServer(); }
    },

    "--port": {
        order: 101,
        description: "Specify the port of dev-server.",
        execute: function (port) {
            var portNumber = +port;
            if (!(portNumber >= 0 && portNumber < 65536)) {
                tpack.fatal("Server port must be in range 0 to 65535.");
                return false;
            }
            tpack.serverOptions.url = "http://0.0.0.0:" + port;
        }
    },

    "--url": {
        order: 100,
        description: "Specify the url of dev-server.",
        execute: function (url) { tpack.serverOptions.url = url; }
    },

    "--passive": {
        order: 100,
        description: "Enable passive mode for dev-server.",
        execute: function () { tpack.serverOptions.passive = true; }
    },

    "--hot": {
        order: 100,
        description: "Enable hot loader for dev-server.",
        execute: function () { tpack.serverOptions.hot = true; }
    }

};

/**
 * 存储即时任务中已选中的文件。
 */
var selectedFiles: FileList;

/**
 * 获取已选中的文件列表。
 */
function getSelectedFiles() {
    if (!selectedFiles) selectedFiles = builder.src("*");
    return selectedFiles;
}

/**
 * 获取命令行配置。
 */
export const argv: { [key: string]: any; } = utility.parseArgv();

// 已解析的命令行参数。
var options = { length: 0 };

// 记录缺少参数的选项。
var missingArgument;

// 所有已知选项组成的单链表，所有选项都按 order 排序。
var knownOptions;

// 解析命令行参数。
// argvs = ["node.exe", "(root)/tpack/bin/tpack", ...]
for (var argvs = process.argv, i = 2; i < argvs.length; i++) {

    // 非选项。
    var argv = argvs[i];
    if (argv.charCodeAt(0) !== 45/*-*/) {
        options[options.length++] = argv;
        continue;
    }

    // 未知选项。为了支持插件自定义选项，这里不报错并继续解析选项值。
    var option = optionList[argv];
    if (!option) {
        options[argv] = i + 1 < argvs.length && argvs[i + 1].charCodeAt(0) !== 45/*-*/ ? argvs[++i] : true;
        continue;
    }

    // 读取选项名，应用选项别名。
    var optionName = argv;
    if (typeof option === "string") option = optionList[optionName = option];

    // 解析参数值，根据已知选项的参数个数。
    var optionValue;
    if (!option.execute.length) {
        optionValue = true;
    } else if (i + 1 < argvs.length) {
        optionValue = argvs[++i];
    } else {
        missingArgument = argv;
        continue;
    }

    // 保存参数值。
    options[argv] = optionValue;

    // 根据 order 插入到合适位置。
    if (knownOptions && option.order > knownOptions.option.order) {
        var node = knownOptions;
        for (; node.next && option.order > node.next.option.order; node = node.next);
        node.next = { option: option, value: optionValue, next: node.next };
    } else {
        knownOptions = { option: option, value: optionValue, next: knownOptions };
    }

}

// 执行所有命令(order < 100)。
for (; knownOptions && knownOptions.option.order < 100; knownOptions = knownOptions.next) {
    if (knownOptions.option.execute(knownOptions.value) === false) {
        return;
    }
}

// 处理缺少参数的选项。
// 推迟到这里提示，以便先加载语言包。
if (missingArgument) {
    tpack.fatal("Option '{option}' expects an argument.", { option: missingArgument });
    return;
}

// 查找配置文件。
if (!tpack.configPath) {
    tpack.configPath = searchDirs("tpack.config.js");

    // 当设置 --pipe 或 --dest 时，不需要配置。
    if (!tpack.configPath && !options["--default"] && !tpack.rules.length && tpack.srcPath.toLowerCase() === tpack.destPath.toLowerCase()) {
        tpack.fatal("Cannot find 'tpack.config.js'. Run 'tpack --init' to create here.");
        return;
    }
}

// 自动追加默认任务名。
if (!options.length || /[\.\*\?\/]/.test(options[0])) {
    Array.prototype.unshift.call(options, "default");
}

// 载入全局模块。
if (!options["--no-require-global"]) {
    try {
        require("require-global")([Path.join(__dirname, "../..")]);
    } catch (e) { }
}

// 执行配置文件。
if (tpack.configPath) {
    if (!tpack.loadConfig(tpack.configPath)) return;
} else if (options["--default"]) {
    require("./tpack.config.js");
}

// 执行所有设置(order >= 100 && order < 1000)。
for (; knownOptions && knownOptions.option.order < 1000; knownOptions = knownOptions.next) {
    if (knownOptions.option.execute(knownOptions.value) === false) {
        return;
    }
}

// 自动设置过滤器。
var global = options["--global"] || options["-g"];
if (options.length > 1) {
    if (global) {
        tpack.fatal("Option '{option}' and path filters cannot be used at same time.", { option: options["--global"] ? "--global" : "-g" });
        return;
    }
    tpack.filters = Array.prototype.slice.call(options, 1);
} else if (!global && process.cwd().toLowerCase() !== tpack.basePath.toLowerCase()) {
    tpack.filters = [process.cwd()];
}

// 执行任务。
if (!tpack.task(options[0], options)) { printList("Defined Tasks", tpack.tasks); return; }

// 如果用户定义了规则但未执行任何操作，则自动执行。
if (tpack.currentAction == null && (tpack.rules.length || tpack.srcPath.toLowerCase() !== tpack.destPath.toLowerCase())) {

    // 执行所有任务(order >= 1000)。
    for (; knownOptions; knownOptions = knownOptions.next) {
        if (knownOptions.option.execute(knownOptions.value) === false) {
            return;
        }
    }

    // 默认执行生成。
    if (tpack.currentAction == null) tpack.build();

}

/**
 * 在当前文件夹及上级文件夹中搜索包含指定路径的文件夹。
 * @param {string} name 要搜索的文件夹路径。
 * @returns {string} 实际位置。
 */
function searchDirs(name) {
    var path;
    var dir = process.cwd();
    while (!FS.existsSync(path = Path.join(dir, name))) {
        var prevDir = dir;
        dir = Path.dirname(dir);
        if (prevDir.length === dir.length) {
            return null;
        }
    }
    return path;
}

/**
 * 打印列表。
 * @param {string} title 列表标题。
 * @param {Object} list 列表项。
 */
function printList(title, list) {

    // 收集所有有效键的所有别名。
    var groups = {};
    for (var key in list) {
        var actual = typeof list[key] === "string" ? list[key] : key;
        if (groups.hasOwnProperty(actual)) {
            groups[actual].push(key);
        } else {
            groups[actual] = [key];
        }
    }

    // 格式化为文本。
    var formated = [];
    for (var key in groups) {
        var description = list[key] && list[key].description;
        if (description === null) continue;
        var t = "  " + groups[key].join(", ");
        if (description) {
            t += "                        ".substr(t.length) || "  ";
            t += tpack.dict[description] || description;
        }
        formated.push(t);
    }

    // 打印。
    tpack.log(tpack.format("\n{title}:\n\n{list}", {
        title: tpack.dict[title] || title,
        list: formated.join("\n")
    }));
}

/**
 * 表示一个生成器。
 */
export class Builder extends EventEmitter {

    // #region 缓存

    /**
     * 存储缓存数据的地址。如果地址为空则不使用缓存文件。
     */
    private _cacheFile = "";

    /**
     * 获取缓存数据的地址。如果地址为空则不使用缓存文件。
     */
    get cacheFile() { return this._cacheFile; }

    /**
     * 设置缓存数据的地址。如果地址为空则不使用缓存文件。
     */
    set cacheFile(value) {
        this._cacheFile = (value || "").replace(/\{(\w+)\}/g, (all: string, word: string) => {
            switch (word) {
                case "PROJECT":
                    return path.basename(this.rootDir);
                case "TEMP":
                    return os.tmpdir();
                case "USER":
                    return os.homedir();
                default:
                    return process.env[word] || all;
            }
        });
    }

    /**
     * 获取所有缓存数据。
     */
    private _cacheData: CacheData;

    /**
     * 获取当前生成器的版本。
     */
    get version(): string { return require("../package.json").version; }

    /**
     * 获取或设置比较文件使用的算法。
     */
    comparison: utility.FileComparion;

    /**
     * 载入缓存数据。
     */
    loadCache() {
        if (!this.cacheFile) {
            return;
        }

        // 读取缓存文件。
        let cacheDataString: string;
        try {
            cacheDataString = fs.readFileSync(this.cacheFile, "utf-8");
        } catch (e) {
            this.log("Error loading cache file '{file}': {error}", { file: this.cacheFile, error: e }, LogLevel.verbose);
            return;
        }

        // 解析缓存文件。
        let cacheData: CacheData;
        try {
            cacheData = JSON.parse(cacheDataString);
        } catch (e2) {
            this.log("Error parse cache file '{file}': {error}", { file: this.cacheFile, error: e2 }, LogLevel.verbose);
            return;
        }

        // 确认缓存文件。
        if (cacheData.version !== this.version ||
            cacheData.rootDir !== this.rootDir ||
            cacheData.comparison !== this.comparison) {

        }

    }

    /**
     * 获取或设置在文件出现错误时的行为。
     */
    fileErrorAction = FileErrorAction.break;

    // #region 源映射

    /**
     * 存储源映射相关配置。
     */
    private _sourceMapOptions = {

        /**
         * 是否启用源映射。
         */
        enabled: false,

        /**
         * 需要生成源映射的源文件筛选表达式。
         */
        test: /\.(js|css)$/i,

        /**
         * 源映射保存路径。其中 $(basename)$(ext) 表示源文件名。
         * 可以设置为自定义函数，用于根据源文件返回源映射路径。
         */
        name: "" as string | ((path: string, file: BuildFile) => string),

        /**
         * 用于生成源码本身路径的回调函数。
         */
        mapSources: null as (sourcePath: string) => string,

        /**
         * 源映射中引用源的跟地址。
         */
        sourceRoot: "",

        /**
         * 是否在源映射内包含文件。
         */
        includeFile: true,

        /**
         * 是否在源映射内包含源码。
         */
        includeSources: false,

        /**
         * 是否在源文件中内联源映射。
         */
        inline: false,

        /**
         * 是否在源文件追加对源码表的引用地址。
         */
        emitSourceMapUrl: true,

        /**
         * 源映射的编码。
         */
        encoding: "utf-8",

        /**
         * 引用源码表的地址前缀。
         */
        sourceMapUrlPrefix: "",

        /**
         * 生成原目标的回调函数。
         */
        mapSourceMapUrl: null as (url: string) => string,

    }

    /**
     * 获取源映射相关配置。
     */
    get sourceMapOptions() { return this._sourceMapOptions; }

    /**
     * 设置源映射相关配置。
     */
    set sourceMapOptions(value) { Object.assign(this._sourceMapOptions, value); }

    /**
     * 获取是否输出源映射。
     */
    get sourceMap() { return this.currentAction !== WorkingMode.clean && this.sourceMapOptions.enabled }

    /**
     * 设置是否输出源映射。
     */
    set sourceMap(value) { this.sourceMapOptions.enabled = value; }

    // #endregion

    // #region 插件支持

    /**
     * 存储生成时使用的会话对象。
     */
    private _sessionStorage: { [key: string]: any };

    /**
     * 存储生成时使用的会话对象编号。
     */
    private _sessionStorageVersion: number;

    /**
     * 获取存储当前生成信息的会话对象。
     */
    get sessionStorage() {
        if (!this._sessionStorage || this._sessionStorageVersion < this.buildVersion) {
            this._sessionStorageVersion = this.buildVersion;
            this._sessionStorage = {};
        }
        return this._sessionStorage;
    }

    /**
     * 存储所有 MIME 类型表。格式如: {".js": "text/javascript"}
     */
    private _mimeTypes: {};

    /**
     * 获取当前生成器使用的所有 MIME 类型表。格式如: {".js": "text/javascript"}
     */
    get mimeTypes() {
        if (this._mimeTypes == null) {
            let mimeTypes = this._mimeTypes = require("mime-db");
            for (let key in mimeTypes) {
                if (mimeTypes[key].extensions) {
                    mimeTypes[key].extensions.forEach(ext => {
                        mimeTypes['.' + ext] = key;
                    });
                }
            }

            // 修复 JS 的 MimeType。
            mimeTypes["text/javascript"].extensions = mimeTypes["application/javascript"].extensions;
            mimeTypes[".js"] = "text/javascript";

        }
        return this._mimeTypes;
    }

    /**
     * 根据 MIME 类型获取扩展名。
     * @param mimeType 要获取的 MIME 类型。
     * @returns 返回扩展名。
     */
    getExtByMimeType(mimeType: string) {
        let obj = this.mimeTypes[mimeType];
        return "." + (obj && obj.extensions ? obj.extensions[0] : mimeType.replace(/^.*\//, ""));
    }

    /**
     * 根据扩展名获取 MIME 类型。
     * @param ext 要获取扩展名，包含前导点。
     * @returns 返回  MIME 类型。
     */
    getMimeTypeByExt(ext: string) {
        return this.mimeTypes[ext] || ext.replace(".", "application/x-");
    }

    // #endregion

    // #region 预览和清理

    /**
     * 判断或设置是否在预览生成时打印依赖项。
     */
    dependency = false;

    /**
     * 预览项目生成。
     */
    preview() {

        // 开始预览。
        this.currentAction = WorkingMode.preview;
        this.startTimer();
        this.reset();

        let oldDisableProgress = this.disableProgress;
        this.disableProgress = true;
        this.info(this.basePath === this.destPath ? "{time}Preview '{basePath}'..." : "{time}Preview '{basePath}' -> '{destPath}'...", this);

        // 生成所有文件。
        this.walk("", name => {
            let file = this.buildFile(name);
            this.onFileSave(file);
            if (this.dependency) {
                // TODO: 打印依赖树。
            }
        });

        // 更新成功后回调。
        this.info("{time}Preview done! (Elapsed: {elapsed}, File: {buildFileCount}, Error: {errorCount}, Warning: {warningCount})", this);
        this.disableProgress = oldDisableProgress;

    }

    /**
     * 清理项目。
     */
    clean() {

        // 开始清理。
        this.currentAction = WorkingMode.clean;
        this.startTimer();
        this.reset();

        // 全局模式并且目标文件夹是独立的，则直接清空文件夹。
        if (this.global && !containsDir(this.destPath, this.srcPath)) {
            this.progress(this.format("Cleaning '{destPath}'", this));
            IO.cleanDir(this.destPath, true);
            this.success("{time}Clean Success! ({elapsed} elapsed)", this);
            this.progress(null);
            return;
        }

        // 由于有限定条件或目标文件夹和源文件夹在一起，不能直接直接删除目标文件夹。
        // 重新生成每个文件并执行清理。

        // 生成每个文件并清理。
        this.walk("", name => { this.buildFile(name).clean(); });

        // 清理成功后回调。
        this.success("{time}Clean Success! ({elapsed} elapsed, {buildFileCount} file(s) cleaned)", this);
        this.progress(null);

    }

    // #endregion

    // #region 监听

    /**
     * 存储当前监听的选项。
     */
    private _watchOptions = {

        /**
         * 获取或设置是否在初始化文件时保存文件。
         */
        initSave: true,

        /**
         * 获取或设置是否监听包含文件。
         */
        includes: true,

        /**
         * 删除文件时同时删除空的父文件夹。
         */
        deleteDir: true,

        /**
         * 获取或设置是否监听外部导入文件。
         */
        imported: true

    };

    /**
     * 获取当前监听的选项。
     */
    get watchOptions() { return this._watchOptions; }

    /**
     * 设置当前监听的选项。
     */
    set watchOptions(value) { Object.assign(this._watchOptions, value); }

    /**
     * 存储当前使用的监听器。
     */
    private _watcher: Watcher;

    /**
     * 监听当前项目的改动并实时生成。
     * @return 返回对应的监听器。
     */
    watch() {
        return this._watcher || (this._watcher = new ((require("./watcher").Watcher) as typeof Watcher)(this));
    }

    /**
     * 当监听开始时回调。
     * @param watcher 当前的监听器。
     */
    onWatchStart(watcher: Watcher) {
        this.trigger("watchstart", watcher);
        this.info("{time}Start Watching '{srcPath}'...", this);
    }

    /**
     * 当监听开始时回调。
     * @param watcher 当前的监听器。
     */
    onWatchStop(watcher: Watcher) {
        this.trigger("watchstop", watcher);
        this.info("{time}Stop Watching '{srcPath}'.", this);
    }

    /**
     * 当监听错误时回调。
     * @param watcher 当前的监听器。
     * @param e 错误信息。
     */
    onWatchError(watcher: Watcher, e: NodeJS.ErrnoException) {
        this.trigger("watcherror", watcher, e);
        this.fatal("{time}Watching '{srcPath}' Error: {error}", { time: this.time, srcPath: this.srcPath, error: e });
    }

    /**
     * 当监听的文件发生改变准备重新生成时回调。
     * @param path 监听改变的原始路径。
     * @param event 监听改变的事件名。
     */
    onWatchChange(path: string, event: string) {
        this.log(`\u001b[36m${this.time}${this.buildVersion} ${this.dict[event] || event}: ${path}\u001b[0m`, LogLevel.progress);
    }

    /**
     * 当监听的文件发生改变时回调。
     * @param names 同时发生改变的文件名称列表。列表首项表示第一个改变的文件。
     */
    onWatchSave(names: string[]) {
        this.trigger("watchsave", names);
    }

    /**
     * 当监听的文件删除时回调。
     * @param names 同时发生改变的文件名称列表。列表首项表示第一个清理的文件。
     */
    onWatchDelete(names: string[]) {
        this.trigger("watchdelete", names);
    }

    // #endregion

    // #region 服务器

    // #endregion

}

/**
 * 表示当文件生成出现错误时的处理方式。
 */
export enum FileErrorAction {

    /**
     * 终止处理当前文件。
     */
    break,

    /**
     * 忽略并继续处理。
     */
    continue,

    /**
     * 终止整个操作。
     */
    throw,

}

/**
 * 表示一个生成文件。
 */
export class BuildFile {

    // #region 生成需要

    /**
     * 存储当前文件的生成版本。
     */
    buildVersion: number;

    /**
     * 判断当前文件已经被处理。
     */
    processed: boolean;

    /**
     * 获取当前正在执行的规则。
     */
    rule: BuildRule;

    /**
     * 获取当前文件执行当前规则前的名称。
     */
    initalName: string;

    // #endregion

    // #region 日志

    /**
     * 获取当前文件累积的所有错误信息。
     */
    errors: BuildError[];

    /**
     * 获取当前文件累积的错误数。
     */
    get errorCount() { return this.errors && this.errors.length; }

    /**
     * 记录当前文件生成时发生的错误。
     * @param error 错误对象。
     * @return 如果错误被忽略则返回空，否则返回错误对象。
     */
    error(error?: any) {
        let err = new BuildError(this, error);
        if (!this.builder.onFileError(this, err)) {
            return;
        }
        if (this.errors) {
            this.errors.push(err);
        } else {
            this.errors = [err];
        }
        return err;
    }

    /**
     * 获取当前文件累积的所有警告信息。
     */
    warnings: BuildError[];

    /**
     * 获取当前文件累积的警告数。
     */
    get warningCount() { return this.warnings && this.warnings.length; }

    /**
     * 记录当前文件生成时发生的警告。
     * @param error 错误对象。
     * @return 如果警告被忽略则返回空，否则返回错误对象。
     */
    warning(error?: any) {
        let err = new BuildError(this, error);
        if (!this.builder.onFileWarning(this, err)) {
            return;
        }
        if (this.warnings) {
            this.warnings.push(err);
        } else {
            this.warnings = [err];
        }
        return err;
    }

    // #endregion

    // #region 插件支持

    /**
     * 判断当前文件是否是文本文件。
     */
    get isText() { return this._srcContent != null || this._destContent != null || /^text\/|^application\/(?:javascript|json)/.test(this.mimeType); }

    /**
     * 判断当前文件是否是二进制文件。
     */
    get isBinary() { return !this.isText; }

    /**
     * 获取当前文件的 MIME 类型。
     */
    get mimeType() { return this.builder.getMimeTypeByExt(this.extension); }

    /**
     * 根据当前文件的信息格式化指定的字符串。
     * @param value 要格式化的字符串。
     * @returns 返回格式化后的字符串。
     */
    format(value: string) {
        return value.replace(/\$\{(\w+)\}/g, (all, macro) => {
            switch (macro) {
                case "basename": return path.basename(this.name);
                case "ext": return this.extension;
                case "dir": return path.dirname(this.name);
                case "name": return this.name;
                case "path": return this.path;

                case "version": return this.buildVersion;
                case "hash":
                    return this.builder.sessionStorage["_hash"] || (this.builder.sessionStorage["_hash"] = this.buildVersion.toString(16) + (+new Date()).toString(16) + (~~(Math.random() * 1000)).toString(16));
                case "md5": return this.getMd5().substr(0, 8);

                case "user": return process.env.USERNAME;

                case "date": {
                    let date: Date = this.builder.sessionStorage["_date"] || (this.builder.sessionStorage["_date"] = new Date());
                    return `${date.getFullYear()}${padZero(date.getMonth() + 1)}${padZero(date.getDate())}`;
                }
                case "time": {
                    let date: Date = this.builder.sessionStorage["_date"] || (this.builder.sessionStorage["_date"] = new Date());
                    return `${date.getFullYear()}${padZero(date.getMonth() + 1)}${padZero(date.getDate())}${padZero(date.getHours())}${padZero(date.getMinutes())}${padZero(date.getSeconds())}`;
                }
                case "timestamp": {
                    let date: Date = this.builder.sessionStorage["_date"] || (this.builder.sessionStorage["_date"] = new Date());
                    return (+date).toString();
                }

                case "today": {
                    let date = new Date();
                    return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())}`;
                }
                case "now": {
                    let date = new Date();
                    return `${date.getFullYear()}-${padZero(date.getMonth() + 1)}-${padZero(date.getDate())} ${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
                }

                default:
                    return all;
            }
        });
    }

    // #endregion

    // #region 文本内容

    /**
     * 在当前文件指定位置插入内容。
     * @param index 要插入的位置。
     * @param value 要插入的内容。
     * @param source 插入内容的来源。
     * @param line 插入内容的在源文件的行号。
     * @param column 插入内容的在源文件的列号。
     */
    insert(index: number, value: string, source?: string | BuildFile, line?: number, column?: number) {
        this.content = this.content.substr(0, index) + value + this.content.substr(index);
        // TODO: 支持 sourceMap
        return this;
    }

    /**
     * 在当前文件末尾插入内容。
     * @param value 要插入的内容。
     * @param source 插入内容的来源。
     * @param line 插入内容的在源文件的行号。
     * @param column 插入内容的在源文件的列号。
     */
    append(value: string, source?: string | BuildFile, line?: number, column?: number) {
        this.content += value;
        // 更新源映射。
        if (this.sourceMapData) {
            // TODO: 支持 sourceMap
            //    const SourceMap = require("source-map");
            //    let map = new SourceMap.SourceMapGenerator(this._sourceMapData);
            //    let mapping: any = {
            //        generated: this.indexToLocation(this.content.length)
            //    };
            //    mapping.generated.column--;
            //    if (source) {
            //        mapping.source = source instanceof BuildFile ? source.srcName : source;
            //        mapping.original = {
            //            line: line || 1,
            //            column: (column || 1) - 1
            //        };
            //    }
            //    map.addMapping(mapping);
            //    this._sourceMapData = map.toJSON();
        }
        return this;
    }

    /**
     * 在当前文件前尾插入内容。
     * @param value 要插入的内容。
     * @param source 插入内容的来源。
     * @param line 插入内容的在源文件的行号。
     * @param column 插入内容的在源文件的列号。
     */
    prepend(value: string, source?: string | BuildFile, line?: number, column?: number) {
        return this.insert(0, value, source, line, column);
    }

    /**
     * 删除当前文件指定位置区间的内容。
     * @param startIndex 要删除的起始位置。
     * @param endIndex 要删除的结束位置（不含位置本身）。
     */
    remove(startIndex: number, endIndex: number) {
        this.content = this.content.substr(0, startIndex) + this.content.substr(endIndex);
        // 更新源映射。
        if (this.sourceMapData) {
            // TODO: 支持 sourceMap
        }
        return this;
    }

    /**
     * 替换当前文件的内容。
     * @param searchValue 要替换的源。
     * @param replaceValue 替换的目标。
     * @param source 替换内容的来源。
     * @param line 替换内容的在源文件的行号。
     * @param column 替换内容的在源文件的列号。
     * @returns this
     */
    replace(searchValue: string | RegExp, replaceValue: string | ((match: string, ...rest: string[]) => string), source?: string | BuildFile, line?: number, column?: number) {
        this.content = this.content.replace(searchValue as any, replaceValue as any);
        // 更新源映射。
        if (this.sourceMapData) {
            // TODO: 支持 sourceMap
        }
        return this;
    }

    // #endregion

}

/**
 * 表示一条生成规则。
 * @remark
 * 一条规则可以添加若干处理器。
 * 所有匹配当前规则的文件都会被添加的处理器处理。
 */
export class BuildRule {

    // #region 筛选和忽略

    /**
     * 获取当前规则所属的生成器。
     */
    builder: Builder;

    /**
     * 获取或设置当前规则的筛选列表。列表可以包含通配符、正则表达式、自定义函数或以上组合的列表。
     */
    filters: PatternSet;

    /**
     * 初始化新的规则。
     * @param builder 所属的生成器。
     * @param filters 筛选列表。列表可以包含通配符、正则表达式、自定义函数或以上组合的列表。
     */
    constructor(builder: Builder, filters: PatternSet) {
        this.builder = builder;
        this.filters = filters;
    }

    /**
     * 获取或设置当前规则的忽略列表。列表可以包含通配符、正则表达式、函数或以上模式组成的数组。
     */
    ignores: PatternSet;

    /**
     * 添加忽略的文件或文件夹。
     * @param patterns 要忽略的文件或文件夹名称。可以使用通配符、正则表达式、函数或以上模式组成的数组。
     */
    ignore(...patterns: Pattern[]): this;

    /**
     * 添加忽略的文件或文件夹。
     * @param patterns 要忽略的文件或文件夹名称。可以使用通配符、正则表达式、函数或以上模式组成的数组。
     */
    ignore() {
        if (this.ignores) {
            Array.prototype.push.apply(this.ignores, arguments);
            delete this.ignores.compiled;
        } else {
            this.ignores = Array.prototype.slice.call(arguments, 0);
        }
        return this;
    }

    /**
     * 判断指定的文件或文件夹是否被忽略。
     * @param name 要判断的文件或文件夹名称。
     * @returns 如果指定的文件或文件夹名称已被忽略则返回 true，否则返回 false。
     */
    ignored(name: string) {
        return this.ignores && this.ignores.length ? (this.ignores.compiled || (this.ignores.compiled = compilePatterns(this.ignores.map(pattern => typeof pattern === "string" ? this.builder.toName(pattern) : pattern)))).call(this, name) as boolean : false;
    }

    /**
     * 测试指定的名称是否匹配当前规则。
     * @param name 要测试的名称。
     * @returns 如果匹配则返回 true，否则返回 false。
     */
    match(name: string): boolean;

    /**
     * 测试指定的名称是否匹配当前规则，并替换为新名称。
     * @param name 要测试的名称。
     * @param target 要替换的目标名称。其中 $0, $1... 会被替换为原通配符匹配的内容。
     * @returns 如果匹配则返回 @target，其中 $0, $1... 会被替换为原通配符匹配的内容，否则返回 null。
     */
    match(name: string, target: string): string;

    /**
     * 测试指定的名称是否匹配当前规则，并替换为新名称。
     * @param name 要测试的名称。
     * @param target 要替换的目标名称。其中 $0, $1... 会被替换为原通配符匹配的内容。
     * @returns 如果匹配则返回 @target，其中 $0, $1... 会被替换为原通配符匹配的内容，否则返回 null。
     */
    match(name: string, target?: string) {
        return this.ignored(name) ?
            target != null ? null : false :
            (this.filters.compiled || (this.filters.compiled = compilePatterns(this.filters.map(pattern => typeof pattern === "string" ? this.builder.toName(pattern) : pattern)))).call(this, name, target);
    }

    /**
     * 遍历当前规则匹配的所有文件。
     * @param callback 遍历函数。
     */
    walk(callback: (name: string) => void) {
        this.builder.walk("", name => {
            if (this.match(name)) {
                callback.call(this, name);
            }
        });
    }

    // #endregion

    // #region 处理器

    /**
     * 获取当前规则所有的处理器。
     */
    processors: ({ processor: Processor, options: Object })[] = [];

    /**
     * 为当前规则添加一个处理器。
     * @param processor 要添加的处理器。
     * @param options 传递给处理器的只读配置对象。
     */
    pipe(processor: Processor, options?: Object) {
        let rule = this as BuildRule;

        // 聚合处理器：合并匹配的所有文件。
        if (processor.join) {

            // 创建聚合目标规则。
            rule = new JoinBuildRule(this.builder, this.filters);

            // 添加原规则的处理器：任一文件处理时，都将驱动执行聚合规则。
            this.pipe(function join(file) {
                (rule as JoinBuildRule).execute(file);
            });

        }

        // 加入处理器。
        rule.processors.push({
            processor: processor,
            options: options == null ? EMPTY_OPTIONS : Object.freeze(options)
        });

        return rule;
    }

    /**
     * 清空当前规则的所有处理器。
     */
    clear() {
        this.processors.length = 0;
        return this;
    }

    // #endregion

    // #region 预设处理器

    /**
     * 添加一个设置目标路径的处理器。
     * @param name 要设置的目标路径。目标路径可以是字符串（其中 $N 表示匹配的模式)。
     */
    dest(name?: string) {

        // 忽略空目标。
        if (!name) return this;

        // 删除前导 / 。
        if (name.charCodeAt(0) === 47/*/*/) name = name.substr(1);

        // 如果 @name 以 / 结尾表示目标是文件夹，则追加文件名。
        if (name.charCodeAt(name.length - 1) === 47/*/*/) {
            name += typeof this.filters[0] === "string" ? (this.filters[0] as string).indexOf("*.") >= 0 ? "$1$EXT" : (this.filters[0] as string).indexOf('*') >= 0 ? "$1" : "$0" : "$0";
        }

        // 添加重命名函数。
        return this.pipe(function dest(file) {
            let targetName = file.format(file.rule.match(file.initalName, name) || name);
            file.name = targetName.charCodeAt(0) === 46/*.*/ ? Path.join(file.name, targetName).replace(/\\/g, "/") : targetName;
        }) as this;

    }

    /**
     * 添加一个设置扩展名的处理器。
     * @param ext 要设置的扩展名。
     */
    extension(ext: string) {
        return this.pipe(function extension(file) {
            file.extension = ext;
        }) as this;
    }

    /**
     * 添加一个复制当前文件的处理器。
     */
    copy() {
        let rule = new JoinBuildRule(this.builder, this.filters);
        this.pipe(function copy(file) {
            let newFile = rule.file = file.copy();
            file.builder.processFileWithRule(newFile, rule);
            file.relate(newFile);
        });
        return rule as BuildRule;
    }

    /**
     * 添加一个保存文件的处理器。
     */
    save() { return this.pipe(function save(file) { file.save(); }) as this; }

    /**
     * 添加一个清理文件的处理器。
     */
    clean() { return this.pipe(function clean(file) { file.clean(); }) as this; }

    // #endregion

    // #region 文本文件

    /**
     * 添加一个在当前文件指定位置插入内容的处理器。
     * @param index 要插入的位置。
     * @param value 要插入的内容。
     * @param source 插入内容的来源。
     * @param line 插入内容的在源文件的行号。
     * @param column 插入内容的在源文件的列号。
     */
    insert(index: number, value: string, source?: string | BuildFile, line?: number, column?: number) {
        return this.pipe(function insert(file) { file.insert(index, value, source, line, column); }) as this;
    }

    /**
     * 添加一个在文件末尾插入内容的处理器。
     * @param value 要插入的内容。
     * @param source 插入内容的来源。
     * @param line 插入内容的在源文件的行号。
     * @param column 插入内容的在源文件的列号。
     */
    append(value: string, source?: string | BuildFile, line?: number, column?: number) {
        return this.pipe(function append(file) { file.append(value, source, line, column); }) as this;
    }

    /**
     * 添加一个在文件开头插入内容的处理器。
     * @param value 要插入的内容。
     * @param source 插入内容的来源。
     * @param line 插入内容的在源文件的行号。
     * @param column 插入内容的在源文件的列号。
     */
    prepend(value: string, source?: string | BuildFile, line?: number, column?: number) {
        return this.pipe(function prepend(file) { file.prepend(value, source, line, column); }) as this;
    }

    /**
     * 添加一个删除文指定位置区间内容的处理器。
     * @param startIndex 要删除的起始位置。
     * @param endIndex 要删除的结束位置（不含位置本身）。
     */
    remove(startIndex: number, endIndex?: number) {
        return this.pipe(function remove(file) { file.remove(startIndex, endIndex); }) as this;
    }

    /**
     * 添加一个替换文件内容的处理器。
     * @param searchValue 要替换的源。
     * @param replaceValue 替换的目标。
     * @param source 替换内容的来源。
     * @param line 替换内容的在源文件的行号。
     * @param column 替换内容的在源文件的列号。
     */
    replace(searchValue: string | RegExp, replaceValue: string | ((match: string, ...rest: string[]) => string), source?: string | BuildFile, line?: number, column?: number) {
        return this.pipe(function replace(file) { file.replace(searchValue, replaceValue, source, line, column); }) as this;
    }

    // #endregion

    // #region 分支流程

    /**
     * 如果当前规则是子规则，则返回其父规则。
     */
    parent: BuildRule;

    /**
     * 如果当前规则是子规则的否则部分，则返回其否则部分。
     */
    private _else: BuildRule;

    /**
     * 创建一个子规则，只有满足条件的文件才会继续处理。
     * @param pattern 要匹配的模式。可以使用通配符、正则表达式、自定义函数或以上组合的列表。
     */
    if(pattern: Pattern) {
        let rule = new BuildRule(this.builder, this.filters);
        rule.parent = this.pipe(function branch(file) {
            if (file.match(pattern)) {
                file.builder.processFileWithRule(file, rule);
            } else if (rule._else) {
                file.builder.processFileWithRule(file, rule._else);
            }
        });
        return rule;
    }

    /**
     * 创建一个剩余子规则，不满足之前所有自规则的文件都才会继续处理。
     * @param pattern 要匹配的筛选器。可以使用通配符、正则表达式、自定义函数或以上组合的列表。
     */
    elseIf(pattern: Pattern) {
        let rule = this.else().if(pattern);
        rule.parent = this.parent;
        return rule;
    }

    /**
     * 创建一个剩余子规则，不满足之前所有自规则的文件都才会继续处理。
     */
    else() {
        if (!this.parent) {
            throw new Error("rule.else() can only be used after rule.if()");
        }
        let rule = this._else = new BuildRule(this.builder, this.filters);
        rule.parent = this.parent;
        return rule;
    }

    /**
     * 退出当前 if() 或 else() 逻辑。
     */
    endIf() {
        if (!this.parent) {
            throw new Error("rule.end() can only be used after rule.if()");
        }
        return this.parent;
    }

    // #endregion

}

/**
 * 表示一个文件。
 * @remark
 * 文件具体可以是物理文件或动态创建的文件。
 * 一个文件会被若干处理器处理，并在处理完成后一次性写入硬盘。
 */
export class File {

    // #region 属性

    /**
     * 获取当前文件所属的生成器。
     */
    readonly builder: builder.Builder;

    /**
     * 初始化新的文件。
     * @param builder 文件所属的生成器。
     * @param name 文件的名称。名称是相对于 `builder.rootDir` 的路径。
     * @param data 如果文件是动态创建的，则设置文件的内容。
     * @example new File(builder, "a.txt"); // 打开硬盘上的 a.txt 文件。
     * @example new File(builder, "a.txt", "a"); // 动态创建 a.txt 文件，内容为 a。
     */
    constructor(builder: builder.Builder, name: string, data?: string | Buffer) {
        this.builder = builder;
        this.destName = name || "";
        if (data != null) {
            this.data = data;
        } else {
            this.srcName = this.destName;
        }
    }

    /**
     * 判断当前文件是否是动态生成的。
     */
    get generated() { return !this.srcName; }

    /**
     * 获取当前文件的字符串形式。
     */
    toString() {
        return this.generated ?
            (builder.format("(Generated)")) + (builder.getDisplayName(this.destName)) :
            (builder.getDisplayName(this.srcName));
    }

    // #endregion

}

/**
 * 表示一个文件列表。
 * @remark 文件列表可用于批量处理文件。
 */
export class FileList extends Array<File> {

    // #region 属性

    /**
     * 获取或设置当前文件列表的匹配器。
     */
    matcher: utility.Matcher;

    /**
     * 初始化新的文件列表。
     * @param matcher 当前文件列表的匹配器。
     */
    constructor(matcher?: utility.Matcher) {
        super();
        this.matcher = matcher;
    }

    /**
     * 获取当前列表中的指定文件。
     */
    get(path: string) {
        for (const file of this) {
            if (file.path === path) {
                return file;
            }
        }
    }

    /**
     * 筛选当前文件列表并返回一个新的文件列表。
     * @param matchers 用于筛选文件的通配符、正则表达式、函数或以上组合的数组。
     * @returns 返回一个文件列表对象。
     */
    src(...matchers: utility.Pattern[]) {
        const matcher = new utility.Matcher(matchers);
        const result = new FileList(matcher);
        for (const file of this) {
            if (matcher.test(file.path)) {
                result.push(file);
            }
        }
        return result;
    }

    // #endregion

    // #region 生成

    /**
     * 获取或设置当前列表的生成结果列表。
     */
    result: FileList;

    /**
     * 对所有文件执行指定的处理器。
     * @param processor 要执行的处理器。
     * @param options 传递给处理器的只读配置对象。
     */
    pipe(processor: Processor | string, options?: any) {
        for (const file of this) {
            file.pipe(processor, options, this);
            if (this.result) {
                const result = this.result;
                delete this.result;
                return result;
            }
        }
        return this;
    }

    /**
     * 将所有文件移动到指定的文件夹。
     * @param dir 要保存的目标文件文件夹。如果为空则保存到原文件夹。
     */
    dest(dir?: string | ((name: string, file: File) => string)) {
        for (const file of this) {
            let dest: string;
            if (dir) {
                dest = file.name;
                const base = this.matcher.base;
                if (base && utility.startsWith(dest, base)) {
                    dest = dest.substr(base.length);
                } else {
                    dest = utility.relativePath(builder.rootDir, dest);
                }
                if (typeof dir === "function") {
                    dest = dir(dest, file);
                } else {
                    dest = utility.resolvePath(dir, dest);
                }
            }
            file.dest(dest);
        }
        return this;
    }

    /**
     * 删除所有源文件。
     * @param deleteDir 指示是否删除空的父文件夹。默认为 true。
     */
    delete(deleteDir: boolean) {
        for (const file of this) {
            file.delete(deleteDir);
        }
    }

    // #endregion

}

/**
 * 表示一个文件列表。
 * @remark 文件列表可用于批量处理文件。
 */
export class FileList extends Array<File> {

    // #region 属性

    /**
     * 获取当前文件列表所属的生成器。
     */
    readonly builder: builder.Builder;

    /**
     * 获取或设置当前文件列表的匹配器。
     */
    matcher: utility.Matcher;

    /**
     * 初始化新的文件列表。
     * @param builder 当前文件列表所属的生成器。
     * @param matcher 当前文件列表的匹配器。
     */
    constructor(builder: builder.Builder, matcher?: utility.Matcher) {
        super();
        this.builder = builder;
        this.matcher = matcher;
    }

    // #endregion

}

/**
 * 表示 JavaScript 宿主程序。
 */
export enum JavaScriptHost {

    /**
     * 未知宿主。
     */
    unknown,

    /**
     * 浏览器。
     */
    browser,

    /**
     * NodeJs。
     */
    node,

    /**
     * Windows Jscript。
     */
    jscript,

    /**
     * FiberJs。
     */
    fiber,

}

/**
 * 获取当前正在使用的 JavaScript 宿主程序。
 */
export function getJavaScriptHost() {
    return JavaScriptHost.node;
}

/**
 * 记录即将执行一个异步任务。
 * @param callback 异步任务完成时的回调函数。
 * @param message 任务内容。
 * @param args 格式化参数。*message* 中 `{x}` 会被替换为 `args.x` 的值。
 * @return 返回一个函数，通过调用此函数可通知当前异步任务已完成。
 */
export function async<T extends Function>(callback?: T, message?: string, args?: Object): T {
    const taskId = begin(message, args);
    return <any>function asyncBound() {
        end(taskId);
        return callback && callback.apply(this, arguments);
    };
}

export enum SourceMapQuality {

    none,

    lineOnly,

    full,

}
/**
 * 获取或设置日志的保存地址。如果地址为空则不保存日志文件。
 */
export var logFile = "";

/**
 * 写入日志到日志文件。
 * @param message 要记录的日志内容。
 */
export function writeLogFile(message: string) {
    if (logFile) {
        utility.appendFile(logFile, `[${utility.formatDate()}]${utility.removeColor(message)}\n`);
    }
}

// 保存日志文件。
if (logFile) writeLogFile(LogLevel[level].toUpperCase() + ": " + message);

/**
 * 判断或设置是否启用调试模式。
 */
export var debug = process.execArgv.indexOf("--debug") >= 0 || process.execArgv.indexOf("--debug-brk") >= 0;

/**
 * 设置是否启用调试模式。
 */
debug: boolean;

            case "debug":
if ((debug = value) && !('logFile' in configs)) {
    logFile = "digo.debug.log";
}
break;

/**
 * 顺序执行所有任务。
 */
series(...tasks: ((() => void) | string)[]) {
    for (let i = 0; i < tasks.length; i++) {
        this.then(typeof tasks[i] === "string" ? () => {
            this.task(tasks[i] as string);
        } : tasks[i] as () => void);
    }
    return this;
}

/**
 * 同时执行所有任务。
 */
parallel(...tasks: ((() => void) | string)[]) {
    for (let i = 0; i < tasks.length; i++) {
        if (typeof tasks[i] === "string") {
            this.task(tasks[i] as string);
        } else {
            (tasks[i] as () => void).call(this);
        }
    }
    return this;
}

/**
 * 为路径末尾追加 /。
 * @param path 要处理的路径。
 * @returns 已处理的路径。
 */
function appendSlash(path: string) {
    return path.endsWith("/") ? path : path + "/";
}

/**
 * 为路径头尾追加 /。
 * @param path 要处理的路径。
 * @returns 已处理的路径。
 */
function prependSlash(path: string) {
    return path.startsWith("/") ? path : "/" + path;
}

/**
 * 判断一个名称是否表示特定的文件。
 * @param name 要判断的名称或数组。
 * @returns
 */
export function isSpecified(name: string | string[] | IArguments): boolean {
    return !name || (typeof name === "string" ? !/[\*\+\?]/.test(name) : typeof name === "object" && name.length <= 1 && isSpecified(name[0]));
}

configFile = digo.argv["--config"] || search("digo.config", [".ts", ".coffee", ".js"]);
if (fs.existsSync(configFile)) {
    digo.fatal("Error: File '{config}' exists already. Nothing done.", { config });
    return false;
}

if (!type) {
    question(`Input a number of template below: 
                1. Empty config.
                2. WebSite: Basic supports.
                3. WebApp: Support commonjs style require.
                4. WebApp with React.
                5. WebApp with Vue.
                6. NodeJS
                `, optionList["--init"].execute);
    return false;
}

const config = digo.configFile || digo.resolve("digo.config.js");
if (fs.existsSync(config)) {
    digo.fatal("File '{config}' exists already. Nothing done.", { config });
    return false;
}

try {
    require("tutils/node/io").copyFile(require.resolve("./tpack.config.js"), config);
} catch (e) {
    digo.fatal("Cannot create file '{config}'. {error}", { config: config, error: e });
    return false;
}

// 从错误对象提取信息。
const error: any = this.error;
if (error) {
    if (this.message == undefined) this.message = error.message || error.msg || error.description || error.toString();
    if (this.path == undefined) this.path = error.path || error.fileName || error.filename || error.filepath || error.file;
    if (this.startLine == undefined) {
        const line = +(error.startLine || error.line || error.linenumber || error.lineno || error.row);
        if (line > 0) {
            this.startLine = line - 1;
        }
    }
    if (this.startLine != undefined && this.startColumn == undefined) {
        const column = +(error.startColumn + 1 || error.column + 1 || error.col + 1 || error.colno + 1);
        if (column > 0) {
            this.startColumn = column - 1;
        }
    }
}
