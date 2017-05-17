
模块化功能
-------------------------------
要使用模块化功能，需要在配置文件中添加：

    tpack.src("*").pipe(require("tpack-modular"));

### 1. HTML

在 HTML 中可以内联外部文件：

    <!-- #include virtual="header.inc" -->

更多说明和用法见 [HTML处理](https://github.com/tpack/tpack-modular/wiki/html)

### 2. JS

#### 同步加载

1. 文件 a.js：

    module.exports = function(){ alert("a"); };

2. 文件 b.js：

    var a = require("./a.js");
    a();

3. 打包后，b.js 会变成：

    var __tpack__ = __tpack__ || { ... };

    __tpack__.define("a.js", function(require, exports, module){
        module.exports = function(){
            alert("a");
        };
    });

    __tpack__.define(function(require, exports, module){ 
        var a = require("./a.js");
        a();
    });

#### 异步加载

4. 文件 d.js：

    require("./c.js", function(c){
        alert(c);
    });

打包后，d.js 不会包含 c.js，c.js 会在执行时会动态加载。

更多说明和用法见 [Js 模块化](https://github.com/tpack/tpack-modular/wiki/js)

### 3. 时间戳

使用如下配置，可以将 a.js 改为 a.js?_=2e24a3。

    tpack.src("*").pipe(require("tpack-modular"), {
        url: {
            append: "_=$MD5"
        }
    });

更多说明和用法见 [时间戳](https://github.com/tpack/tpack-modular/wiki/url)

### 3. 内联文件

    <script src="a.js?$INLINE"></script>

发布后：

    <script>
        /* a.js 的源码 */
    </script>



路径支持

TPack 中可以使用以下格式的路径：

以 . 开头表示相对路径。
以 / 开头表示相对于 tpack.srcPath 的绝对路径。
否则如果是在 require 上下文，则遵循 CommonJs 模块搜索方案查找。
否则作为相对路径。
