
/**
 * 解析一个文件内的符号。
 * @param module 要处理的模块。
 * @param options 相关的选项。
 * @param content 要处理的内容。
 * @param index 内容在源码的起始位置。
 * @param symbol 要解析的符号。
 */
function parseSymbol(module: Module, options: Options, content: string, index: number, symbol: string) {
    switch (symbol) {
        case "define":
            module.commonJs = false;
            break;
        case "require":
        case "exports":
        case "module":
            if (!options.js || options.js.symbol !== false) {
                module.commonJs = true;
            }
            break;
        case "global":
            module.replacements.unshift(new TextReplacement(0, 0, `var ${symbol} = (function(){return this;})();\n`));
            break;
        case "process":
            if (!options.resolve || options.resolve.native !== false) {
                let obj = resolveUrl(module, options, content, index, "process", UrlUsage.require);
                if (obj.module) module.require(obj.module);
                module.replacements.unshift(new TextReplacement(0, 0, `var process = require("process");\n`));
            }
            break;
        case "Buffer":
            if (!options.resolve || options.resolve.native !== false) {
                let obj = resolveUrl(module, options, content, index, "buffer", UrlUsage.require);
                if (obj.module) module.require(obj.module);
                module.replacements.unshift(new TextReplacement(0, 0, `var Buffer = require("buffer");\n`));
            }
            break;
        case "setImmediate":
        case "clearImmediate":
            if (!options.resolve || options.resolve.native !== false) {
                let obj = resolveUrl(module, options, content, index, "timers", UrlUsage.require);
                if (obj.module) module.require(obj.module);
                module.replacements.unshift(new TextReplacement(0, 0, `var ${symbol} = require("timers").${symbol};\n`));
            }
            break;
    }

}
