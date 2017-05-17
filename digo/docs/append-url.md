# 使用 TPack 追加时间戳

使用时间戳可以有效解决每次发布后因为用户浏览器缓存带来的问题。

## 1. 基本用法

### 1.1 追加到 URL 末尾

    tpack.src("*.html", "*.htm").pipe(require("tpack-assets"), {
        appendUrl: "v=<md5_6>"
    });

效果：将 `<script src="file.js">` 更新为 `<script src="file.js?v=7d9dc2">` 。

### 1.2 追加到文件名

    tpack.src("*.*").dest("$1_<md5_6>.$2");
   
效果：将 `file.js` 更名为 `file_7d9dc2.js` 。
 
由于 js 等路径发生改变，建议同时更新 HTML 文件中对路径的引用：

    tpack.src("*.html").pipe(require("tpack-assets"));
    
## 2. 更多时间戳格式

除了上述例子中使用的 `<md5_6>` 还可以使用以下格式：

- `<md5>`: 如 0cc175b9c0f1b6a831c399e269772661
- `<md5_8>`: 8 位 MD5 值，如 0cc175b9
- `<MD5>`: 大写 MD5 值，如 0CC175B9C0F1B6A831C399E269772661
- `<date>`: 如：20160101
- `<time>`: 如：201601010000000
- `<yyyyMMddHHmmss>`: 如：201601010000000
- `<yyyy-MM-dd>`: 如：2016-01-01
- 自定义版本号：

```
// 追加到 URL 末尾:
var version = require("package.json").version;
tpack.src("*.html", "*.htm").pipe(require("tpack-assets"), {
    appendUrl: function(file){
        return "v" + version;
    }
});
```

```
// 追加到文件名
var version = require("package.json").version;
tpack.src("*.*").pipe(function(file){
    file.path = file.path.replace(/\.\w+$/, "v" + version  "$&");
});
```

## 3. 更新路径

默认地，tpack-assets 插件会更新以下路径：

- HTML 文件：

    - `<script src="..">` 和 `<script data-src="..">`
    - `<link href="...">` 和 `<link data-href="..">`
	- `<a href="...">` 和 `<a data-href="..">`
	- `<img srcset="...">`
	- `<param name="src" value="...">`
	- `src="..."` 和 `data-src=".."`
	- `href="..."` 和 `data-href=".."`

- CSS 文件：

	- `@import url(...)`
	- `url(...)`

- JS 文件：

	- `require("...")`

如果需要处理其它地址，可以在路径后追加 __url，如：

	<img data-error-img="error.jpg?__url">
	
## 4. API：获取生成的时间戳

    tpack.src("*.*").pipe(function(file){
        var v = file.formatName("<md5_6>");
        console.log(v); 
    });
    
当一个文件被追加时间戳后，通过 `file.path` 可以获取最新的文件名。
    