tpack-modular
===========================================
[TPack](https://github.com/tpack/tpack/) 插件：解析模块依赖以及模块打包。

安装
-------------------------------
```
> npm install tpack-modular -g
```

使用
-------------------------------
### 解析模块依赖以及模块打包
```js
tpack.src("*").pipe(tpack.plugin("tpack-modular"));
```

### 源码映射表(Source Map)
本插件可生成源码映射表，用法见 [源码映射表](https://github.com/tpack/tpack/wiki/源码映射表)。

配置
-------------------------------
```js
tpack.src("*").pipe(require("tpack-modular"), {
    // 配置...
});
```