/**
 * @fileOverview 解析 HTML 模块依赖。
 */

import {ModuleType} from "./module";
import {TextBuildModule, TextReplacement, ModuleReplacement, TextDelayReplacement} from "./text";
import {XmlOptions, XmlBuildModule} from "./xml";

/**
 * 表示一个 HTML 模块。
 */
export class HtmlBuildModule extends XmlBuildModule {

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.html; }

    /**
     * 获取当前模块的内容类型。
     */
    get contentType() { return ModuleType.text; }

    /**
     * 获取当前解析模块的配置。
     */
    options: HtmlOptions;

    /**
     * 负责解析当前模块。
     */
    protected parse() {
        // |<%[\s\S*]*?(?:%>|$)|<\?[\s\S*]*?(?:\?|$)>
        this.source.replace(/<!--([\s\S]*?)(?:-->|$)|<(img|link|object|embed|audio|video|source|a|base|form|input)\b(?:'[^']*'|"[^"]*"|[^>])*>|(<style\b(?:'[^']*'|"[^"]*"|[^>])*>)([\s\S]*?)(<\/style(?:'[^']*'|"[^"]*"|[^>])*>|$)|(<script\b(?:'[^']*'|"[^"]*"|[^>])*>)([\s\S]*?)(<\/script(?:'[^']*'|"[^"]*"|[^>])*>|$)/ig, (source: string, comment: string, tag: string, styleStart: string, style: string, styleEnd: string, scriptStart: string, script: string, scriptEnd: string, index: number) => {

            // <!-- -->
            if (comment != null) {
                this.parseComment(source, index, comment);
                return source;
            }

            // <img>, <link>, <object>, <embed>, <audio>, <video>, <source>, <a>, <base>, <form>, <input>
            if (tag != null) {
                this.parseSrc(source, index, tag);
                return source;
            }

            // <style>
            if (styleStart != null) {
                this.parseStyle(source, index, styleStart, style, styleEnd);
                return source;
            }

            // <script>
            if (scriptStart != null) {
                this.parseScript(source, index, scriptStart, script, scriptEnd);
                return source;
            }

            return source;
        });

        // 解析宏。
        this.parseSub();

    }

    /**
     * 解析一个 &lt;script&gt; 标签。
     * @param source 相关的代码片段。
     * @param index 代码片段在源文件的起始位置。
     * @param openTag 开始标签部分。
     * @param innerHTML 主体内容。
     * @param closeTag 结束标签部分。
     */
    protected parseScript(source: string, index: number, openTag: string, innerHTML: string, closeTag: string) {

        // <script src>
        let src = getAttr(openTag, "src");
        if (src != null) {
            if (this.parseTagOption(source, index, "src", openTag, innerHTML, closeTag)) return;
            this.parseUrl(source, index, src, url => setAttr(openTag, "src", url) + innerHTML + closeTag, () => ({
                prefix: removeAttr(openTag, "src"),
                postfix: closeTag
            }));
            return;
        }

        if (this.parseTagOption(source, index, "script", openTag, innerHTML, closeTag)) return;
        let type = getAttr(openTag, "type");
        this.parseInline(source, index, openTag, innerHTML, closeTag, type && type !== "text/javascript" ? this.file.builder.getExtByMimeType(type) : ".js");
    }

    /**
     * 解析一个 &lt;style&gt; 标签。
     * @param source 相关的代码片段。
     * @param index 代码片段在源文件的起始位置。
     * @param openTag 开始标签部分。
     * @param innerHTML 主体内容。
     * @param closeTag 结束标签部分。
     */
    protected parseStyle(source: string, index: number, openTag: string, innerHTML: string, closeTag: string) {
        if (this.parseTagOption(source, index, "style", openTag, innerHTML, closeTag)) return;
        let type = getAttr(openTag, "type");
        this.parseInline(source, index, openTag, innerHTML, closeTag, type && type !== "text/css" ? this.file.builder.getExtByMimeType(type) : ".css");
    }

    /**
     * 存储当前内联标签的序号。
     */
    private _inlineCounter: number;

    /**
     * 解析 &lt;script&gt; 或 &lt;style&gt; 标签的内容。
     * @param source 相关的代码片段。
     * @param index 代码片段在源文件的起始位置。
     * @param openTag 开始标签部分。
     * @param innerHTML 主体内容。
     * @param closeTag 结束标签部分。
     * @param ext 内联扩展名。
     */
    protected parseInline(source: string, index: number, openTag: string, innerHTML: string, closeTag: string, ext: string) {

        let endIndex = index + source.length;

        // 创建虚拟文件。
        let builder = this.file.builder;
        var related = builder.createFile(this.file.name + "#inline" + (this._inlineCounter = (this._inlineCounter + 1) || 1) + ext, innerHTML);
        builder.processFile(related);
        let module = require("./index").getModule(related, this.options) as TextBuildModule;

        // 内联模块。
        this.addReplacement(new TextReplacement(index, endIndex, openTag));
        this.addReplacement(new ModuleReplacement(endIndex, endIndex, module as TextBuildModule));
        this.addReplacement(new TextReplacement(endIndex, endIndex, closeTag));
    }

    /**
     * 解析一个 HTML 标签。
     * @param source 相关的代码片段。
     * @param index 代码片段在源文件的起始位置。
     * @param tagName 解析的标签名。
     */
    protected parseSrc(source: string, index: number, tagName: string) {

        // 处理配置。
        if (this.parseTagOption(source, index, "src", source, "", "")) return;

        // <a href>, <base href>
        if (/^(?:a|base)$/i.test(tagName)) {
            let href = getAttr(source, "href");
            if (href) this.parseUrl(source, index, href, url => setAttr(source, "href", url));
            return;
        }

        // <link href>
        if (/^link$/i.test(tagName)) {
            let href = getAttr(source, "href");
            if (href) this.parseUrl(source, index, href, url => setAttr(source, "href", url), () => getAttr(source, "rel") === "stylesheet" && {
                prefix: removeAttr(removeAttr(source.replace(/link/i, "style").replace(/\s*\/>$/, ">"), "href"), "rel") + "\n",
                postfix: "\n</style>"
            });
            return;
        }

        // <form action>
        if (/^form$/i.test(tagName)) {
            let action = getAttr(source, "action");
            if (action) this.parseUrl(source, index, action, url => setAttr(source, "action", url));
            return;
        }

        // <input formaction>
        if (/^input$/i.test(tagName)) {
            let formaction = getAttr(source, "formaction");
            if (formaction) this.parseUrl(source, index, formaction, url => setAttr(source, "formaction", url));
            return;
        }

        // <object data>
        if (/^object$/i.test(tagName)) {
            let data = getAttr(source, "data");
            if (data) this.parseUrl(source, index, data, url => setAttr(source, "data", url));
            return;
        }

        let replacements = [];
        let src: string;

        // TODO: 支持多属性。

        // <* src>
        if (src = getAttr(source, "src")) {
            let replacement = this.parseUrl(source, index, src, url => setAttr(source, "src", url), null, false);
            if (replacement) replacements.push(replacement);
        }

        // <* data-src>
        if (src = getAttr(source, "data-src")) {
            let replacement = this.parseUrl(source, index, src, url => setAttr(source, "data-src", url), null, false);
            if (replacement) replacements.push(replacement);
        }

        // <img srcset>
        if (/^img$/i.test(tagName) && (src = getAttr(source, "srcset"))) {
            // http://www.webkit.org/demos/srcset/
            // <img src="image-src.png" srcset="image-1x.png 1x, image-2x.png 2x, image-3x.png 3x, image-4x.png 4x">
            let urls = [];
            let tpl = src.replace(/((?:^|,)\s*)(.*)(\s+\dx)/g, (srcAll: string, prefix: string, url: string, postfix: string) => {
                let id = urls.length;
                urls[id] = url;
                let replacement = this.parseUrl(source, index, url, url => {
                    // 更新当前索引的值并重新更新属性。
                    urls[id] = url;
                    return setAttr(source, "srcset", tpl.replace(/__TPACK__MARKER__(\d+)/g, (_, n) => urls[n]));
                }, null, false);
                if (replacement) replacements.push(replacement);
                return prefix + "__TPACK__MARKER__" + id + postfix;
            });
        }

        switch (replacements.length) {
            case 0:
                break;
            case 1:
                this.addReplacement(replacements[0]);
                break;
            default:
                this.addReplacement(new TextDelayReplacement(index, index + source.length, m => {
                    for (let i = 0; i < replacements.length; i++) {
                        source = replacements[i].data(m);
                    }
                    return source;
                }));
                break;
        }

    }

    /**
     * 解析标签配置的值。
     * @param source 相关的代码片段。
     * @param index 代码片段在源文件的起始位置。
     * @param key 读取的配置键。
     * @param openTag 开始标签部分。
     * @param innerHTML 主体内容。
     * @param closeTag 结束标签部分。
     * @returns 如果已解析完成则返回 @true，否则返回 @false。
     */
    protected parseTagOption(source: string, index: number, key: string, openTag: string, innerHTML: string, closeTag: string) {

        // 检查 $CHECK 属性。
        let check = getAttr(openTag, "$CHECK");
        if (/^(false|no|none|0|disabled?)$/i.test(check)) {
            this.addReplacement(new TextReplacement(index, index + source.length, removeAttr(openTag, "$CHECK") + innerHTML + closeTag));
            return true;
        }

        let options = this.options.tag;
        if (options === false) return true;
        if (!options) return false;
        let value = options[key];
        if (typeof value === "function") value = value.call(options, openTag, innerHTML, closeTag);
        return !value;
    }

}

/**
 * 表示解析 HTML 模块的配置。
 */
export interface HtmlOptions extends XmlOptions {

    /**
     * 设置是否解析 HTML 标签。
     * @default true
     */
    tag?: {

        /**
         * 是否解析 &lt;style&gt; 标签。
         * @default true
         * @return 可能值有：
         * - true：全部解析。
         * - false: 全部不解析。
         * - 函数: 仅当函数返回 true 时解析。
         */
        style?: boolean | ((openTag: string, innerHTML: string, closeTag: string) => boolean);

        /**
         * 是否解析内联的 &lt;script&gt; 标签。
         * @default true
         * @return 可能值有：
         * - true：全部解析。
         * - false: 全部不解析。
         * - 函数: 仅当函数返回 true 时解析。
         */
        script?: boolean | ((openTag: string, innerHTML: string, closeTag: string) => boolean);

        /**
         * 是否解析 src, href 等包含地址的属性。
         * @default true
         * @return 可能值有：
         * - true：全部解析。
         * - false: 全部不解析。
         * - 函数: 仅当函数返回 true 时解析。
         */
        src?: boolean | ((openTag: string, innerHTML: string, closeTag: string) => boolean);

    }

}

// #region 读写属性

/**
 * 获取 HTML 标签的属性。
 * @param tag HTML 标签。
 * @param attrName 属性名。
 */
function getAttr(tag: string, attrName: string) {
    let m = getAttrRegExp(attrName).exec(tag);
    return m ? decodeHTML(m[4] != null ? m[4] : m[5] != null ? m[5] : m[3]) : null;
}

/**
 * 解码 HTML 特殊字符。
 * @param value 要解码的字符串。
 * @returns 返回已解码的字符串。
 * @example decodeHTML("&lt;a&gt;&lt;/a&gt;") // &amp;lt;a&amp;gt;&amp;lt;/a&amp;gt;
 */
function decodeHTML(value: string) {
    return value.replace(/&(#(\d{1,4})|\w+);/g, (_, word, unicode) => unicode ? String.fromCharCode(+unicode) : {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '\"'
    }[word] || word);
}

/**
 * 设置 HTML 标签的属性。
 * @param tag HTML 标签。
 * @param attrName 属性名。
 * @param attrValue 属性值。
 */
function setAttr(tag: string, attrName: string, attrValue: string) {
    let found = false;
    tag = tag.replace(getAttrRegExp(attrName), (all, name, eq, value, double, single) => {
        found = true;
        return buildAttr(name, eq || "=", attrValue, double, single);
    });
    return found ? tag : tag.replace(/^<[^\s]+\b/, all => all + " " + buildAttr(attrName, "=", attrValue, true, false));
}

/**
 * 构建属性字符串。
 * @param attrName 属性名。
 * @param eq 等号。
 * @param attrValue 属性值。
 * @param double 是否使用双引号。
 * @param single 是否使用单引号。
 */
function buildAttr(attrName: string, eq: string, attrValue: string, double: boolean, single: boolean) {
    return double ? attrName + eq + '"' + attrValue.replace(/"/g, "&quot;") + '"' :
        single ? attrName + eq + "'" + attrValue.replace(/'/g, "&#39;") + "'" :
            /[>\s="']/.test(attrValue) ? buildAttr(attrName, eq, attrValue, attrValue.indexOf('"') < 0, true) :
                attrName + eq + attrValue;
}

/**
 * 删除 HTML 标签的属性。
 * @param tag HTML 标签。
 * @param attrName 属性名。
 */
function removeAttr(tag: string, attrName: string) {
    return tag.replace(getAttrRegExp(attrName), "");
}

/**
 * 获取解析指定属性的正则表达式。
 * @param attrName 属性名。
 */
function getAttrRegExp(attrName: string) {
    let cache = getAttrRegExp["_cache"] || (getAttrRegExp["_cache"] = {});
    return cache[attrName] as RegExp || (cache[attrName] = new RegExp("(\\s" + attrName + ')(?:(\\s*=\\s*)("([^"]*)"|\'([^\']*)\'|[^\\s>]*))?', "i"));
}

// #endregion