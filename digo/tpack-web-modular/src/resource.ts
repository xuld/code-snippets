
import {BuildFile} from "tpack/src/buildFile";

import {BuildModule, ModuleOptions, ModuleType} from "./module";

/**
 * 表示一个资源模块。
 */
export class ResourceModule extends BuildModule {

    /**
     * 获取当前模块在模块化之前的源文件。
     */
    get source() { return this.file; }

    /**
     * 当被子类重写时，负责解析当前模块。
     */
    protected parse() { }

    /**
     * 将模块信息保存到源文件。
     */
    save() { }

}

/**
 * 表示一个文本资源模块。
 */
export class TextResourceModule extends ResourceModule {

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.text; }

}

/**
 * 表示一个二进制资源模块。
 */
export class BinaryResourceModule extends ResourceModule {

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.binary; }

}

/**
 * 表示一个 JSON 资源模块。
 */
export class JsonResourceModule extends ResourceModule {

    /**
     * 获取当前模块的类型。
     */
    get type() { return ModuleType.json; }

}
