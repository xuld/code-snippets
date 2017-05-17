
import {ModuleType} from "./module";
import {TextBuildModule, TextOptions} from "./text";

/**
 * 表示一个 C 风格代码模块。
 */
export class JsonBuildModule extends TextBuildModule {

    /**
     * 获取当前解析模块的配置。
     */
    options: JsonOptions;

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.json; }

}

/**
 * 表示解析 C 风格代码模块的配置。
 */
export interface JsonOptions extends TextOptions {

}
