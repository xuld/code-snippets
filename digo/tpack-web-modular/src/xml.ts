/**
 * @fileOverview 解析 XML 模块依赖。
 */

import {ModuleType} from "./module";
import {TextBuildModule, TextOptions} from "./text";

/**
 * 表示一个 XML 模块。
 */
export class XmlBuildModule extends TextBuildModule {

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.xml; }

    /**
     * 获取当前解析模块的配置。
     */
    options: XmlOptions;

    /**
     * 负责解析当前模块。
     */
    protected parse() {
        this.source.replace(/<!--([\s\S]*?)(?:-->|$)/ig, (source: string, comment: string, tag: string, styleStart: string, style: string, styleEnd: string, scriptStart: string, script: string, scriptEnd: string, index: number) => {
            this.parseComment(source, index, comment);
            return source;
        });

        this.parseSub();
    }

}

/**
 * 表示解析 XML 模块的配置。
 */
export interface XmlOptions extends TextOptions {

}
