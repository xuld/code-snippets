/**
 * 表示一个模块加载器。
 */
var __tpack__ = __tpack__ || {

    /**
     * 所有已加载的模块列表。
     * @type {{[url:string]: Module}}
     */
    modules: {},

    /**
     * 存储正在加载的模块列表。
     * @type {{[url:string]: exports=>void}}
     */
    _loadings: {},

    /**
     * 存储待应用的模块列表。
     */
    _pendings: [],

    /**
     * 定义一个模块。
     * @param {string} url? 模块的地址。
     * @param {Function} factory 模块的内容。
     */
    define: function (url, factory) {

        // 允许仅传递一个参数。
        if (!factory) factory = url, url = "";

        // 暂存模块。在 onload 中更新 url 为绝对路径并应用模块。
        __tpack__._pendings.push({ url: url, define: factory });

        /*@cc_on __tpack__._fetch(__tpack__.getCurrentScript());   @*/

        // 自动加载首个模块。
        if (!url) {
            /*@cc_on return __tpack__.get(__tpack__.getCurrentScript().toLowerCase());   @*/
            var script = document.getElementsByTagName("script");
            script = script[script.length - 1];
            if (script.src) {
                var callback = function () {
                    var url = /*@cc_on 1 ? __tpack__.getSrc(script) : @*/script.src;
                    __tpack__._fetch(url);
                    __tpack__.get(url.toLowerCase());
                };
                script.addEventListener("load", callback, false);
                script.addEventListener("error", callback, false);
            }
        }

    },

    /*@cc_on
    
    getCurrentScript: function () {
        var scripts = document.getElementsByTagName("script");
        for(var i = scripts.length - 1; i >= 0; i--) {
            if(scripts[i].readyState === "interactive") {
                return __tpack__.getSrc(scripts[i]);
            }
        }
        return __tpack__.getSrc(scripts[scripts.length - 1]);
    }, 
    
    getSrc: function (node, src) {
        src = src || "src";
        return node.getAttribute(src, 1) !== node.getAttribute(src, 4) ? node.getAttribute(src, 4) : node[src || src];
    },
    
    @*/

    /**
     * 取出加载队列的模块并加载。
     * @param baseUrl 应用每个模块的加载。
     */
    _fetch: function (baseUrl) {

        // 一次处理一个模块。
        var module = __tpack__._pendings.shift();
        if (module) {

            // 更新模块路径为绝对路径。
            module.url = __tpack__.resolve(baseUrl, module.url);

            // 保存到模块缓存。
            __tpack__.modules[module.url.toLowerCase()] = module;

            // 应用下一个模块。
            __tpack__._fetch(baseUrl);

        }

    },

    /**
     * 解析相对指定地址的绝对的路径。
     * @param {string} baseUrl 基地址。
     * @param {string} url 相对地址。
     * @returns {string} 返回绝对路径。
     */
    resolve: function (baseUrl, url) {
        if (!url) return baseUrl;
        var notAbsolute = !/^\/|\/\//.test(url);
        if (url.charCodeAt(0) !== 46/*.*/ && notAbsolute) return url;
        url = url.replace(/((?:^|\/|\\)[^\/\\\?#\.]+)([?#].*)?$/, "$1.js$2");
        var link = __tpack__._link || (__tpack__._link = document.createElement("a"));
        link.href = notAbsolute ? baseUrl.replace(/[?#].*$/, "") + "/../" + url : url;
        return /*@cc_on 1 ? __tpack__.getSrc(link, "href") : @*/link.href;
    },

    /**
     * 获取指定的模块导出对象。
     * @param {string} id 模块的键。
     * @returns {object} 返回模块的导出对象。
     */
    get: function (id) {
        var module = __tpack__.modules[id];
        if (!module) return;
        if (!module.hasOwnProperty("exports") && module.define) {
            module.exports = {};
            module.define.call(module.exports, module.require = function (url, callback) {
                return __tpack__.require(url, callback, module.url);
            }, module.exports, module);
        }
        if (module.exports && module.exports.__esModule && module.exports["default"]) {
            var obj = module.exports["default"], key;
            for (key in obj) module.exports[key] = obj[key];
        }
        return module.exports;
    },

    /**
     * 请求一个模块。
     * @param {string|string[]} url 模块的地址。如果同时请求多个模块则传递数组。
     * @param {Function} callback? 如果是异步请求，则传递一个回调。
     * @param {string} baseUrl 基地址。
     * @returns {object} 返回模块的导出对象。 
     */
    require: function (url, callback, baseUrl, sourceIndex) {

        // 同时载入多个模块。
        if (typeof url !== "string") {

            // 支持 require([], function() { })
            if (!url.length) return callback && callback.call(this);

            // 加载每个模块。
            for (var exportsList = [], left = url.length, i = 0; i < url.length; i++) {
                __tpack__.require(url[i], callback && function (sourceIndex, id) {
                    exportsList[sourceIndex] = id;
                    if (--left <= 0) {
                        for (var i = 0; i < exportsList.length; i++) {
                            exportsList[i] = __tpack__.get(exportsList[i]);
                        }
                        callback.apply(this, exportsList);
                    }
                }, baseUrl, i);
            }
            return;
        }

        // 计算模块的绝对路径和序号。
        url = __tpack__.resolve(baseUrl, url);
        var id = url.toLowerCase();

        // 模块已定义。
        if (__tpack__.modules.hasOwnProperty(id)) {

            // 同时加载模块化时统一回调。
            if (sourceIndex >= 0) return callback(sourceIndex, id);

            // 返回导出对象。
            var exports = __tpack__.get(id);
            callback && callback(exports);
            return exports;
        }

        // 模块正在加载。
        var oldLoading = __tpack__._loadings[id];
        __tpack__._loadings[id] = function () {

            // 应用模块加载。
            delete __tpack__._loadings[id];
            oldLoading && oldLoading();

            // 同时加载模块化时统一回调。
            sourceIndex >= 0 ? callback(sourceIndex, id) : (callback && callback(__tpack__.get(id)));
        };

        // 模块未加载才继续。
        if (!oldLoading) {

            var doc = document;
            var head = doc.head || doc.getElementsByTagName("head")[0] || doc.documentElement;

            if (/\.css(\?|#|$)/i.test(url)) {
                var link = doc.createElement('link');
                link.rel = 'stylesheet';
                link.href = url;
                link.onload = link.onerror = function () {
                    __tpack__._loadings[id] && __tpack__._loadings[id]();
                };
                return head.appendChild(link);
            }

            var script = doc.createElement("script");
            script.onload = script.onerror = function () {
                __tpack__._fetch(url);
                __tpack__._loadings[id] && __tpack__._loadings[id]();
            };
            script.async = true;
            script.src = url;

            /*@cc_on 
            script.onreadystatechange = function () {
                if (/loaded|complete/.test(script.readyState)) {
                    script.onload();
                    script.onload = script.onerror = script.onreadystatechange = null;
                    script = null;
                }
            };
    
            var baseElement = head.getElementsByTagName("base")[0];
            baseElement ? head.insertBefore(script, baseElement) : head.appendChild(script);
            return;
            @*/

            head.appendChild(script);

        }

    },

    /**
     * 插入一段 CSS 代码。
     * @param {string} css 插入的 CSS 代码。
     */
    insertStyle: function (css, basePath) {
        var style = document.createElement('style');
        var head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;
        head.insertBefore(style, head.firstChild);
        return style.innerHTML = css;
    }

};

__tpack__.define(function(require, exports, module) {
	__tpack__.define(function (require, exports, module) {
	    console.log("c");
	    require(["d.js", "lib3/e.js"], function (d, e) {
	        console.log(d);
	        e.e();
	        console.log(e.f);
	    });
	});
});
//# sourceMappingURL=c.js.map