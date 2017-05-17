## Web 模块化

先来细数一下 Web 开发所碰到的问题：

1. 网站所需的源码变多，

随着网站规模的发展，网站的源码也越变的复杂。这就需要一个模块化系统来管理源码。

    var modular = require("tpack-modular");
    tpack.src("*").pipe(modular, {
        loader: function(file, options, builder) {
            return 'css';
        }
    });




### 模块类型
   
tpack 将所有模块分为以下类型：`html`, `js`, `css`, `json`, `image`, `font`, `media`, `resource`, `text`, `asset`。
不同的模块类型处理方式也不同。

tpack 默认可以为常用扩展名分配模块类型。也可以通过如下方法定制：

#### 通过扩展名分配

    tpack.src("*").pipe(modular, {
        types: {
            ".ts": "js"
        }
    });

#### 通过自定义函数分配

    tpack.src("*").pipe(modular, {
        getType: function(file, options, builder){
            if(file.extension == ".ts") {
                return "js"
            }
        }
    });



#### URL 后缀

为了避免 URL 被缓存，可以为 URL 添加后缀时间戳。

##### 统一设置

    tpack.src("*").pipe(modular, {
        appendUrl: "_=<md5>"
    });

##### 单独设置

    <img src="a.jpg?_=<md5>">

##### 自定义

在任意位置，可以使用 __postfix 代替生成的后缀。

### 文件包含

  #include 直接包含：不检查重复依赖
  #require 依赖包含：去除重复依赖



  xfly 内置插件提供了最常用的几个功能。本文主要介绍这些功能的具体使用方法。

## 代码内联
此功能主要由 xfly-assets 插件提供。

所有内联功能既可以使用包含指令 #include 声明或者在原 URL 后追加 __inline 表示。

#### HTML 内联外部 HTML

    <!-- #include inc.html -->
    <!-- #include virtual="inc.html" -->
    <link rel="html" type="text/html" href="inc.html?__inline">

#### HTML 内联外部文件

    <script type="text/javascript" src="inc.js?__inline"></script>
    <link rel="stylesheet" type="text/css" href="inc.css?__inline">
    <style>@import url(inc.css?__inline)</style>
    <img src="images/logo.png?u=2&__inline"/>

#### CSS 内联外部图片

    /* #include ../img.png */
    body { background: url(../img.png?__inline); }

内联后，图片地址会被打包成 base64 地址。

#### JS 内联外部图片

    // #include ../img.png
    var bodyUrl = "http://.../foo.png?__inline";

### 使用 __inline 后缀

在 URL 后追加 __inline，那么这个文件在发布后会被内联。

#### CSS 内联外部图片

    body { background: url(../img.png?__inline); }

### 排除文件

内联时，可以使用 #exclude 指令排除个别文件

    /* #exclude ../img.png */


## ES6 和模块化（AMD/CMD）
此功能主要由 xfly-requirex 插件提供。

结合 es6 语法，模块依赖代码可写为：

    export function x(){}  // 导出函数

    import x from './x.js' // 导入函数

发布后，它们将变成：

    define('x.js', [], function(){
        var module = { exports: {} }, exports = module.exports;
        exports.x = function x(){ };  // 导出函数
        return module;
    })

    define('y.js', ['./x.js'], function(x){
        var module = { exports: {} }, exports = module.exports;
        return module;
    })

## 代码压缩
此功能主要由 xfly-compress-css 和 xfly-compress-js 插件提供。

默认地，xfly 使用 UglyJS 和 CleanCSS 两个热门库实现压缩。
