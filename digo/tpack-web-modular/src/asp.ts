/**
 * @fileOverview 解析动态模板模块依赖。
 */

import {ModuleType} from "./module";
import {HtmlBuildModule, HtmlOptions} from "./html";

/**
 * 表示解析动态模板模块的配置。
 */
export interface AspOptions extends HtmlOptions {

}

/**
 * 表示一个动态模板模块。
 */
export class AspBuildModule extends HtmlBuildModule {

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.asp; }

    /**
     * 获取当前解析模块的配置。
     */
    options: AspOptions;

    /**
     * 负责解析当前模块。
     */
    protected parse() {
        this.source.replace(/<!--([\s\S]*?)(?:-->|$)|<(img|link|object|embed|audio|video|source|a|base|form|input)\b(?:'[^']*'|"[^"]*"|[^>])*>|(<style\b(?:'[^']*'|"[^"]*"|[^>])*>)([\s\S]*?)(<\/style(?:'[^']*'|"[^"]*"|[^>])*>|$)|(<script\b(?:'[^']*'|"[^"]*"|[^>])*>)([\s\S]*?)(<\/script(?:'[^']*'|"[^"]*"|[^>])*>|$)|<%([\s\S*]*?)(?:%>|$)|<\?([\s\S*]*?)(?:\?|$)>/ig, (source: string, comment: string, tag: string, styleStart: string, style: string, styleEnd: string, scriptStart: string, script: string, scriptEnd: string, aspTpl: string, phpTpl, index: number) => {

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
     * 判断指定的源码是否包含动态语言标记。
     * @param source 相关的代码片段。
     */
    hasAspTag(source: string) {
        return /<[%?]|[%?]>/.test(source);
    }

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
        if (this.hasAspTag(innerHTML)) {
            return;
        }
        super.parseInline(source, index, openTag, innerHTML, closeTag, ext);
    }

    /**
     * 解析 URL(url) 和 HTML/CSS 内联地址。
     * @param source 相关的代码片段。
     * @param index 片段在源文件的起始位置。
     * @param url 要解析的相对路径。
     * @param encoder 编码地址的回调函数。
     * @param inliner 当需要内联时的回调函数，返回内联的前后缀内容。
     * @param add 是否需要添加到替换列表。
     */
    protected parseUrl(source: string, index: number, url: string, encoder: (url: string) => string, inliner?: () => { prefix: string, postfix: string }, add?: boolean) {
        if (this.hasAspTag(url)) {
            return null;
        }
        return super.parseUrl(source, index, url, encoder, inliner, add);
    }

}
