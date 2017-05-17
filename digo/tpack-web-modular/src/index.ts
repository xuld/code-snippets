/*
 * Copyright (C) 2016 xuld<xuld@vip.qq.com>
 *
 * Permission is hereby granted, free of charge, to any person 
 * obtaining a copy of this software and associated documentation 
 * files (the "Software"), to deal in the Software without restriction, 
 * including without limitation the rights to use, copy, modify, merge, 
 * publish, distribute, sublicense, and/or sell copies of the Software, 
 * and to permit persons to whom the Software is furnished to do so, 
 * subject to the following conditions:
 *　
 * The above copyright notice and this permission notice shall be 
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY 
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, 
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE 
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
 *
 */

import {Builder} from "tpack/src/builder";
import {BuildFile} from "tpack/src/buildFile";

import {BuildModule, ModuleType, ModuleOptions} from "./module";

import {TextOptions} from "./text";
import {JsOptions} from "./js";
import {JsonOptions} from "./json";
import {CssOptions} from "./css";
import {HtmlOptions} from "./html";
import {XmlOptions} from "./xml";
import {AspOptions} from "./asp";

declare module "tpack/src/buildFile" {

    /**
     * 表示一个模块化的文件。
     */
    export interface BuildFile {

        /**
         * 获取当前文件对应的模块列表。
         */
        module: BuildModule;

    }

}

/**
 * 解析文件依赖。
 * @param file 要处理的文件。
 * @param options 相关的配置。
 */
module.exports = exports = function Modular(file: BuildFile, options: ModularOptions) {
    getModule(file, options, options.type).save();
};

/**
 * 表示模块化配置。
 */
export interface ModularOptions extends ModuleOptions, TextOptions, JsOptions, JsonOptions, CssOptions, HtmlOptions, XmlOptions, AspOptions {

    /**
     * 设置当前模块解析的类型。
     * @returns 可以是以下值：
     * - null: 根据扩展名自动决定。
     * - 函数：继承于 Module 类型的类，用于创建一个模块。
     * - "js"
     * - "json"
     * - "css"
     * - "html"
     * - "xml"
     * - "text"
     * - "image"
     * - "font"
     * - "binary"
     * @default null
     */
    type?: ModuleTypeOption;

}

/**
 * 设置模块类型的选项。
 */
export type ModuleTypeOption = typeof BuildModule | (new (file: BuildFile, options: ModularOptions) => BuildModule) | "resource" | "text" | "cStyleCode" | "lispStyleCode" | "js" | "json" | "css" | "html" | "xml" | "asp";

/**
 * 获取指定文件对应的模块。
 * @param file 要处理的文件。
 * @param options 创建模块的配置。
 * @param moduleType 解析模块的类型。
 * @returns 返回模块对象。
 */
export function getModule(file: BuildFile, options: ModularOptions, moduleType?: ModuleTypeOption) {

    // 不重复模块化。
    if (file.module) {
        return file.module;
    }

    // 决定模块类型。
    if (typeof moduleType !== "function") {
        switch (moduleType != null ? ModuleType[moduleType] : (exports.types[file.extension.toLowerCase()] || exports.types["*"])) {
            case ModuleType.js:
                moduleType = require("./js").JsBuildModule;
                break;
            case ModuleType.css:
                moduleType = require("./css").CssBuildModule;
                break;
            case ModuleType.html:
                moduleType = require("./html").HtmlBuildModule;
                break;
            case ModuleType.xml:
                moduleType = require("./xml").XmlBuildModule;
                break;
            case ModuleType.text:
                moduleType = require("./text").TextBuildModule;
                break;
            case ModuleType.json:
                moduleType = require("./json").JsonBuildModule;
                break;
            case ModuleType.asp:
                moduleType = require("./asp").AspBuildModule;
                break;
            default:
                moduleType = require("./module").BuildModule;
                break;
        }
    }

    // 新建模块。
    let module = file.module = new (moduleType as new (file: BuildFile, options: ModularOptions) => BuildModule)(file, options);
    module.load();
    return module;

}

/**
 * 默认模块类型映射表。
 */
export var types = {
    ".html": ModuleType.html,
    ".htm": ModuleType.html,
    ".inc": ModuleType.html,
    ".shtm": ModuleType.html,
    ".shtml": ModuleType.html,
    ".xml": ModuleType.xml,

    ".jsp": ModuleType.asp,
    ".asp": ModuleType.asp,
    ".php": ModuleType.asp,
    ".aspx": ModuleType.asp,
    ".tpl": ModuleType.asp,
    ".template": ModuleType.asp,

    ".cshtml": ModuleType.text,
    ".vbhtml": ModuleType.text,

    ".js": ModuleType.js,
    ".json": ModuleType.json,
    ".map": ModuleType.json,
    ".css": ModuleType.css,

    ".txt": ModuleType.text,
    ".text": ModuleType.text,
    ".md": ModuleType.text,
    ".log": ModuleType.text,

    ".c": ModuleType.text,
    ".cpp": ModuleType.text,
    ".cc": ModuleType.text,
    ".h": ModuleType.text,
    ".java": ModuleType.text,
    ".cs": ModuleType.text,

    ".lisp": ModuleType.text,
    ".vb": ModuleType.text,
    ".vbs": ModuleType.text,

    "*": ModuleType.binary
};
