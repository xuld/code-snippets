
### 4. 开发服务器

执行 `Digo --server` 打开开发服务器：

```
> Digo --server
```

在服务器打开 http://localhost:8080/a.txt ，可以查看已处理过的代码。

[appveyor-url]: https://ci.appveyor.com/project/sokra/digo/branch/master
[appveyor-image]: https://ci.appveyor.com/api/projects/status/github/digojs/digo?svg=true
[david-url]: https://david-dm.org/digojs/digo
[david-image]: https://img.shields.io/david/digojs/digo.svg
[david-dev-url]: https://david-dm.org/digojs/digo#info=devDependencies
[david-dev-image]: https://david-dm.org/digojs/digo/dev-status.svg
[david-peer-url]: https://david-dm.org/digojs/digo#info=peerDependencies
[david-peer-image]: https://david-dm.org/digojs/digo/peer-status.svg
[nodei-image]: https://nodei.co/npm/digo.png?downloads=true&downloadRank=true&stars=true
[nodei-url]: https://www.npmjs.com/package/digo
[donate-url]: http://sokra.github.io/
[donate-image]: https://img.shields.io/badge/donate-sokra-brightgreen.svg
[gratipay-url]: https://gratipay.com/digo/
[gratipay-image]: https://img.shields.io/gratipay/digo.svg
[badginator-image]: https://badginator.herokuapp.com/digojs/digo.svg
[badginator-url]: https://github.com/defunctzombie/badginator

## 共同点
都能实现基本的项目构建功能，比如代码压缩、打包。

## 不同点
假设有以下需求：***.js 文件需要压缩成为 *.min.js**

如果仅实现压缩功能，那么用 gulp 是非常直观的：

	gulp.src('./js/*.js')
		.pipe(uglify())
		.pipe(rename('*.min.js'))
		.pipe(gulp.dest('./dist'))
		
那么问题来了：因为 js 文件地址改变了，html 中引用这些 js 文件的路径需要同步发生改变，因为 gulp 以任务为中心，每个任务是独立的。所以这样的需求在 gulp 是很难做到的。而且很多开发者还希望通过一个标记位快速在压缩和非压缩版切换调试，这在 gulp 更是难实现。因为：
gulp 的本质就是一个构建工具，它只负责生成，而不管生成的文件是怎么使用的。所以它是一个比较通用的工具。


tpack 则强调项目总体走势，它能一边负责生成文件，一边记录文件的走势。以便在处理 html 文件时，它能结果会被记录并在处理 html 时拿到。知道 js 文件的处理结果（如被压缩成了 *.min.js）

	tpack.src('./js/*.js')
		.pipe(uglify)
		.dest('./dist/$1.min.js')
	
	tpack.src('./html/*.html')
		.pipe(assets)
		
在处理 html 文件时之前 js 的处理。

tpack 在一定程度上考虑了前端项目的需求，并为这些需求提供了现成 API 方便实现。

TPack 和 Gulp 的区别
--------------------------------------------------------
1. TPack 删除了 Gulp 繁琐的异步任务、复杂的流概念。
用户只需关心单个文件如何处理即可定制发布。

2. Gulp 需要全局和本地各安装一遍。TPack 只需要在全局安装一次。

3. TPack 和 Gulp 的部分接口和功能类似，但是其生成的核心思路是不同的。

假如有文件 A, B, C 每个文件都需要经过 [编译] 和 [压缩] 两步处理。

Gulp 以任务为中心，最后文件的处理顺序为：

1. A -> [编译]
2. B -> [编译]
3. C -> [编译]
4. A -> [压缩]
5. B -> [压缩]
6. C -> [压缩]

TPack 以文件为中心，最后文件的处理顺序为：

1. A -> [编译]
2. A -> [压缩]
3. B -> [压缩]
4. B -> [编译]
5. C -> [编译]
6. C -> [压缩]

TPack 的设计思路可以让 TPack 拥有这些优势：

1. 文件之间发布独立，可以很方便地实现局部生成，加速生成效率。
2. 一个文件在生成时，可以等待另一个文件生成完成，这样可以很轻松地实现 HTML 内联的 `<style />` 标签，以另一个 CSS 文件处理。

Tpak vs Gulp
------------------------------------------------
### 相同点
两者都是基于 Node 开发的构建系统，
都具有任务系统，
且 API 相似，
使用方法类似。

### 设计思路：中式 vs 西式
我们先看一个形象的例子：
假如餐桌上有很多菜，
而每个客人也都有不同的口味，
如何有秩序地让每个客人都吃到各自想吃的菜？

有两种方案：
A. 西式：类似自助餐，每个客人自己取想吃的菜，吃完把盘子放回去。
B. 中式：菜一个个上，每上一菜时，想吃的客人动筷子，吃完后回收盘子上下一个菜。

Gulp 的做法类似方案 A：
每次以流的方式读取很多文件(`gulp.src()`)，
文件处理后继续以流的方式写入(`gulp.dest`)。

Tpak 的做法类似方案 B：
每个文件打开后，
会被若干规则处理个，
最后保存。

我们先看这个需求：
先把项目内的 .less 和 .sass 文件编译为 .css 文件然后再进行压缩。

使用 Gulp 每次读写很多文件：
```js
gulp.src("*.less").pipe(编译less).pipe(压缩).pipe(保存dest)
gulp.src("*.sass").pipe(编译less).pipe(压缩).pipe(保存dest)
```

而 Tpak 则会记忆文件的状态，所以“压缩”可以针对之前处理的结果统一进行：
```js
tpak.src("*.less").pipe(编译less)
tpak.src("*.sass").pipe(编译less)
tpak.src("*.css").pipe(压缩).pipe(保存dest)
```
如此，我们可以把不同的情况(可能既有 .less 又有 .sass)简化成一种情况(只有.css)方便后续处理。

同时，因为记忆了文件的状态，
插件可以很轻松地跟踪一个文件的变化，
方便实现类似 Webpack 的模块加载器功能,
这点 Gulp 是做不到的。

当然，不记忆状态也有优势：就是每个任务独立不干扰，不容易出现问题。

### 同步 vs 异步
Gulp 使用异步任务，Tpak 则使用同步。
使用异步可以增加性能，
使用同步则不容易出错。

根据实际测试，在 SSD 硬盘上，每处理 1000 个源文件，Tpak 比 Gulp 慢 7 秒，
考虑到实际一个项目一般不超过 100 个源文件，实际 Tpak 比 Gulp 约慢 1 秒，可以忽略。

### 插件和其它
显然 Tpak 在插件数目上远不如 Gulp，
但是 Tpak 内置了很多功能，
也提供了大部分前端项目所需的功能插件。

### 总结
如果你正在寻找一个**轻量的**、
**低成本**、
适合普通前端项目的构建工具，
可以尝试一下 Tpak。



增量生成
--------------------------------------------------------
使用增量生成可以避免每次重新生成所有文件，提高开发效率。

### 局部生成
默认地，执行 `tpack` 会只生成当前目录下的所有文件。

使用 `tpack *.txt` 可以只针对 `*.txt` 生成。

### 开发服务器
使用选项 `-s` 或 `--server` 可以启动开发服务器。

启动后，在浏览器打开 `http://localhost:8080/` 即可访问项目内的文件。

服务器端口默认为 8080，使用选项 `--port` 或在配置文件添加 `tpack.serverOptions.url = "http://0.0.0.0:80/";` 来指定服务器端口。

服务器默认为主动模式，使用选项 `--passive` 或在配置文件添加 `tpack.serverOptions.passive = true;` 切换为被动模式。两个模式的区别如下：

- 主动模式下，需要请求源文件，服务器会处理此文件并响应。
- 被动模式下，需要请求生成文件，服务器会监听所有文件并保存在内存中，收到请求后直接响应。

简单地说，假如项目里使用了 `.less`，开发时需要先生成 `.css`。那么在 `<link href="..." />` 中 `href` 的值，主动模式需要写 `.less` 的路径，而被动模式需要写 `.css` 的路径。

### 热加载
热加载技术可以让文件保存后，浏览器自动局部刷新，大幅提高开发效率。
启动服务器时，使用选项 `--hot` 或在配置文件添加 `tpack.serverOptions.hot = true;` 可以启动热加载。


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
