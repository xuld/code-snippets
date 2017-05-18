
    //     /**
    //      * 通过代理方式请求原始数据。
    //      * @param target 代理的目标地址。
    //      * @param url 请求的原始地址。
    //      * @param request 当前的请求对象。
    //      * @param response 当前的响应对象。
    //      */
    //     protected proxy(target: string, name: string, url: Url.Url, request: Http.IncomingMessage, response: Http.ServerResponse) {

    //         // 解析目标地址。
    //         let targetUrl = Url.parse(target);
    //         targetUrl.protocol = targetUrl.protocol || url.protocol;
    //         targetUrl.query = url.query;

    //         let https = targetUrl.protocol === "https:";

    //         let headers = Object.assign({}, request.headers);
    //         headers["host"] = targetUrl.host;
    //         delete headers['accept-encoding'];

    //         let req = ((https ? require('https') : require('http')).request as typeof Http.request)({
    //             protocol: targetUrl.protocol,
    //             host: targetUrl.hostname,
    //             port: +targetUrl.port || (https ? 443 : 80),
    //             path: targetUrl.path,
    //             method: request.method,
    //             headers: headers,
    //             agent: this.builder.serverOptions.agent as Http.Agent
    //         }, res => {

    //             // 支持 302 跳转。
    //             // TODO: 处理重复 302 跳转。
    //             if (res.statusCode === 302 && res.headers.location) {
    //                 this.proxy(res.headers.location, name, url, request, response);
    //                 return;
    //             }

    //             let output = res;

    //             // GZip 解压。
    //             switch (res.headers['content-encoding']) {
    //                 case 'gzip':
    //                     output = output.pipe(require("zlib").createGunzip());
    //                     break;
    //                 case 'deflate':
    //                     output = output.pipe(require("zlib").createInflate());
    //                     break;
    //             }

    //             // 读取响应数据。
    //             let buffers: Buffer[] = [];
    //             output.on('data', (chunk: Buffer) => { buffers.push(chunk); });
    //             output.on('end', () => {

    //                 // 远程服务器返回 300 以上表示错误。
    //                 if (res.statusCode >= 300 && res.statusCode !== 304) {
    //                     response.writeHead(res.statusCode, res.headers);
    //                     for (let i = 0; i < buffers.length; i++) {
    //                         response.write(buffers[i]);
    //                     }
    //                     response.end();
    //                     return;
    //                 }

    //                 let file = this.builder.createFile(name, Buffer.concat(buffers));
    //                 this.builder.processFile(file);
    //                 this.writeFile(file, res.headers['content-type'], response);
    //             });
    //         });
    //         req.on('error', (e: NodeJS.ErrnoException) => { this.onError(e); });
    //         req.end();
    //     }

    //     /**
    //      * 存储所有已编译的代理服务器。
    //      */
    //     private _proxies: { filter: CompiledPattern, target: string }[];

    //     /**
    //      * 当前请求的地址出现错误时执行。
    //      * @param statusCode 请求的错误码。
    //      * @param path 请求地址解析物理的地址。
    //      * @param name 请求地址的名称。
    //      * @param url 请求的原始地址。
    //      * @param request 当前的请求对象。
    //      * @param response 当前的响应对象。
    //      */
    //     protected onRequestError(statusCode: number, path: string, name: string, url: Url.Url, request: Http.IncomingMessage, response: Http.ServerResponse) {
    //         response.writeHead(statusCode);
    //         let message = `${statusCode} - ${http.STATUS_CODES[statusCode]}: ${htmlEncode(path)}`;
    //         response.end(`<!doctype html>
    //     <html>
    //     <head>
    //         <meta charset="utf-8">
    //         <title>${message}</title>
    //     </head>
    //     <body>
    //         <pre>${message}</pre>
    //     </body>
    //     </html>`, this.builder.encoding);
    //     }

    //     /**
    //      * 被动模式处理指定的请求。
    //      * @param request 当前的请求对象。
    //      * @param response 当前的响应对象。
    //      */
    //     protected onRequestPassive(request: Http.IncomingMessage, response: Http.ServerResponse) {

    //         // 解析地址。
    //         let url = Url.parse(request.url);
    //         let name = this.builder.toName(url.pathname.substr(this.rootPath.length));

    //         // 检查是否使用代理。
    //         if (this._proxies) {
    //             for (let i = 0; i < this._proxies.length; i++) {
    //                 let p = this._proxies[i];
    //                 let target = p.filter.call(this.builder, name, p.target);
    //                 if (target != null) {
    //                     this.proxy(target, name, url, request, response);
    //                     return;
    //                 }
    //             }
    //         }

    //         // 正在请求存在的文件，则执行生成。
    //         let path = this.builder.toPath(name);
    //         let fs: FS.Stats;
    //         try {
    //             fs = FS.statSync(path);
    //         } catch (e) {
    //             if ((e as NodeJS.ErrnoException).code === "ENOENT") {
    //                 this.onRequestError(404, path, name, url, request, response);
    //             } else if ((e as NodeJS.ErrnoException).code === "EPERM") {
    //                 this.onRequestError(403, path, name, url, request, response);
    //             } else {
    //                 this.onRequestError(500, path, name, url, request, response);
    //             }
    //             return;
    //         }

    //         // 目录浏览。
    //         if (fs.isDirectory()) {

    //             // 修复 /path/to 为 /path/to/
    //             if (url.pathname.charCodeAt(url.pathname.length - 1) !== 47 /*/*/) {
    //                 let newUrl = request.url + "/";
    //                 response.writeHead(302, {
    //                     location: newUrl
    //                 });
    //                 response.end(`Object Moved To <a herf="${newUrl}">${newUrl}</a>`);
    //                 return;
    //             }

    //             this.listDir(path, name, url, request, response);
    //             return;
    //         }

    //         // 生成文件并返回。
    //         this.builder.reset();
    //         let file = this.builder.buildFile(name);
    //         let contentType = this.builder.getMimeTypeByExt(file.extension);
    //         if (contentType.startsWith("text/")) {
    //             contentType += "; charset=" + this.builder.encoding;
    //         }
    //         this.writeFile(file, contentType, response);

    //     }

    //     /**
    //      * 主动模式处理指定的请求。
    //      * @param request 当前的请求对象。
    //      * @param response 当前的响应对象。
    //      */
    //     protected onRequestActive(request: Http.IncomingMessage, response: Http.ServerResponse) {

    //         // 解析地址。
    //         let url = Url.parse(request.url);
    //         let name = this.builder.toName(url.pathname.substr(this.rootPath.length));

    //         // 检查是否使用代理。
    //         if (this._proxies) {
    //             for (let i = 0; i < this._proxies.length; i++) {
    //                 let p = this._proxies[i];
    //                 let target = p.filter.call(this.builder, name, p.target);
    //                 if (target != null) {
    //                     this.proxy(target, name, url, request, response);
    //                     return;
    //                 }
    //             }
    //         }

    //         // 正在请求存在的文件，则执行生成。
    //         let path = this.builder.toPath(name);
    //         let fs: FS.Stats;
    //         try {
    //             fs = FS.statSync(path);
    //         } catch (e) {
    //             if ((e as NodeJS.ErrnoException).code === "ENOENT") {
    //                 this.onRequestError(404, path, name, url, request, response);
    //             } else if ((e as NodeJS.ErrnoException).code === "EPERM") {
    //                 this.onRequestError(403, path, name, url, request, response);
    //             } else {
    //                 this.onRequestError(500, path, name, url, request, response);
    //             }
    //             return;
    //         }

    //         // 目录浏览。
    //         if (fs.isDirectory()) {

    //             // 修复 /path/to 为 /path/to/
    //             if (url.pathname.charCodeAt(url.pathname.length - 1) !== 47 /*/*/) {
    //                 let newUrl = request.url + "/";
    //                 response.writeHead(302, {
    //                     location: newUrl
    //                 });
    //                 response.end(`Object Moved To <a herf="${newUrl}">${newUrl}</a>`);
    //                 return;
    //             }

    //             this.listDir(path, name, url, request, response);
    //             return;
    //         }

    //         // 生成文件并返回。
    //         this.builder.reset();
    //         let file = this.builder.buildFile(name);
    //         let contentType = this.builder.getMimeTypeByExt(file.extension);
    //         if (contentType.startsWith("text/")) {
    //             contentType += "; charset=" + this.builder.encoding;
    //         }
    //         this.writeFile(file, contentType, response);

    //     }

    //     /**
    //      * 列出文件夹目录。
    //      * @param path 请求地址解析物理的地址。
    //      * @param name 请求地址的名称。
    //      * @param url 请求的原始地址。
    //      * @param request 当前的请求对象。
    //      * @param response 当前的响应对象。
    //      */
    //     protected listDir(path: string, name: string, url: Url.Url, request: Http.IncomingMessage, response: Http.ServerResponse) {
    //         this.onRequestError(402, path, name, url, request, response);
    //     }

    //     // /**
    //     //  * 初始化新的服务器。
    //     //  */
    //     // constructor() {

    //     //     // 编译代理服务器。
    //     //     for (let p in this.builder.serverOptions.proxy) {
    //     //         let target = this.builder.serverOptions.proxy[p];
    //     //         if (target && target.charCodeAt(target.length - 1) === 47 /*/*/) {
    //     //             target += p.indexOf("*.") >= 0 ? "$1" + Path.extname(p) : p.indexOf('*') >= 0 ? "$1" : "$0";
    //     //         }
    //     //         this._proxies = this._proxies || [];
    //     //         this._proxies.push({ filter: compilePatterns([p]), target: target })
    //     //     }

    //     // }


// //     /**
// //      * 存储服务器相关选项。
// //      */
// //     private _serverOptions = {

// //     /**
// //      * 服务器的监听地址。其中，0.0.0.0 表示监听所有 IP 地址。端口设置为 0 表示随机端口。
// //      */
// //     url: "http://0.0.0.0:8080/",

// //     /**
// //      * 指示是否使用被动模式。
// //      */
// //     passive: false,

// //     /**
// //      * 服务器代理。
// //      */
// //     proxy: {} as { [path: string]: string },

// //     /**
// //      * 代理服务器使用的代理地址。
// //      */
// //     agent: null as HttpAgent | HttpsAgent

// // };

// /**
//  * 启动服务器并打开首页。服务器可以拦截所有请求并根据当前设置的规则处理后响应。
//  * @param port 服务器的端口。
//  * @param url 服务器的地址。
//  * @param options 服务器的选项。
//  * @returns 返回服务器对象。
//  */
// openServer() {
//     var server = this.startServer();
//     (require("child_process").exec as typeof exec)("start " + server.url, (error) => { error && this.fatal(error.toString()); });
//     return server;
// }

// /**
//  * 表示一个开发服务器。
//  */
// export class Server {

//     /**
//      * 获取当前服务器所属的生成器。
//      */
//     builder: Builder;

//     /**
//      * 获取当前服务器的主页地址。
//      */
//     url: string;

//     /**
//      * 获取当前服务器的跟路径。
//      */
//     rootPath = "";

//     /**
//      * 存储底层 HTTP 服务器。
//      */
//     private _server: Http.Server;

//     /**
//      * 当服务器启动时回调。
//      */
//     protected onStart() {
//         this.builder.onServerStart(this);
//     }

//     /**
//      * 当服务器停止时回调。
//      */
//     protected onStop() {
//         this.builder.onServerStop(this);
//     }

//     /**
//      * 当服务器错误时执行。
//      */
//     protected onError(e: NodeJS.ErrnoException) {
//         this.builder.onServerError(this, e);
//     }

//     /**
//      * 被动模式处理指定的请求。
//      * @param request 当前的请求对象。
//      * @param response 当前的响应对象。
//      */
//     protected onRequestPassive(request: Http.IncomingMessage, response: Http.ServerResponse) {

//         // 解析地址。
//         let url = Url.parse(request.url);
//         let name = this.builder.toName(url.pathname.substr(this.rootPath.length));

//         // 检查是否使用代理。
//         if (this._proxies) {
//             for (let i = 0; i < this._proxies.length; i++) {
//                 let p = this._proxies[i];
//                 let target = p.filter.call(this.builder, name, p.target);
//                 if (target != null) {
//                     this.proxy(target, name, url, request, response);
//                     return;
//                 }
//             }
//         }

//         // 正在请求存在的文件，则执行生成。
//         let path = this.builder.toPath(name);
//         let fs: FS.Stats;
//         try {
//             fs = FS.statSync(path);
//         } catch (e) {
//             if ((e as NodeJS.ErrnoException).code === "ENOENT") {
//                 this.onRequestError(404, path, name, url, request, response);
//             } else if ((e as NodeJS.ErrnoException).code === "EPERM") {
//                 this.onRequestError(403, path, name, url, request, response);
//             } else {
//                 this.onRequestError(500, path, name, url, request, response);
//             }
//             return;
//         }

//         // 目录浏览。
//         if (fs.isDirectory()) {

//             // 修复 /path/to 为 /path/to/
//             if (url.pathname.charCodeAt(url.pathname.length - 1) !== 47 /*/*/) {
//                 let newUrl = request.url + "/";
//                 response.writeHead(302, {
//                     location: newUrl
//                 });
//                 response.end(`Object Moved To <a herf="${newUrl}">${newUrl}</a>`);
//                 return;
//             }

//             this.listDir(path, name, url, request, response);
//             return;
//         }

//         // 生成文件并返回。
//         this.builder.reset();
//         let file = this.builder.buildFile(name);
//         let contentType = this.builder.getMimeTypeByExt(file.extension);
//         if (contentType.startsWith("text/")) {
//             contentType += "; charset=" + this.builder.encoding;
//         }
//         this.writeFile(file, contentType, response);

//     }

//     /**
//      * 主动模式处理指定的请求。
//      * @param request 当前的请求对象。
//      * @param response 当前的响应对象。
//      */
//     protected onRequestActive(request: Http.IncomingMessage, response: Http.ServerResponse) {

//         // 解析地址。
//         let url = Url.parse(request.url);
//         let name = this.builder.toName(url.pathname.substr(this.rootPath.length));

//         // 检查是否使用代理。
//         if (this._proxies) {
//             for (let i = 0; i < this._proxies.length; i++) {
//                 let p = this._proxies[i];
//                 let target = p.filter.call(this.builder, name, p.target);
//                 if (target != null) {
//                     this.proxy(target, name, url, request, response);
//                     return;
//                 }
//             }
//         }

//         // 正在请求存在的文件，则执行生成。
//         let path = this.builder.toPath(name);
//         let fs: FS.Stats;
//         try {
//             fs = FS.statSync(path);
//         } catch (e) {
//             if ((e as NodeJS.ErrnoException).code === "ENOENT") {
//                 this.onRequestError(404, path, name, url, request, response);
//             } else if ((e as NodeJS.ErrnoException).code === "EPERM") {
//                 this.onRequestError(403, path, name, url, request, response);
//             } else {
//                 this.onRequestError(500, path, name, url, request, response);
//             }
//             return;
//         }

//         // 目录浏览。
//         if (fs.isDirectory()) {

//             // 修复 /path/to 为 /path/to/
//             if (url.pathname.charCodeAt(url.pathname.length - 1) !== 47 /*/*/) {
//                 let newUrl = request.url + "/";
//                 response.writeHead(302, {
//                     location: newUrl
//                 });
//                 response.end(`Object Moved To <a herf="${newUrl}">${newUrl}</a>`);
//                 return;
//             }

//             this.listDir(path, name, url, request, response);
//             return;
//         }

//         // 生成文件并返回。
//         this.builder.reset();
//         let file = this.builder.buildFile(name);
//         let contentType = this.builder.getMimeTypeByExt(file.extension);
//         if (contentType.startsWith("text/")) {
//             contentType += "; charset=" + this.builder.encoding;
//         }
//         this.writeFile(file, contentType, response);

//     }

//     /**
//      * 列出文件夹目录。
//      * @param path 请求地址解析物理的地址。
//      * @param name 请求地址的名称。
//      * @param url 请求的原始地址。
//      * @param request 当前的请求对象。
//      * @param response 当前的响应对象。
//      */
//     protected listDir(path: string, name: string, url: Url.Url, request: Http.IncomingMessage, response: Http.ServerResponse) {
//         this.onRequestError(402, path, name, url, request, response);
//     }

//     /**
//      * 通过代理方式请求原始数据。
//      * @param target 代理的目标地址。
//      * @param url 请求的原始地址。
//      * @param request 当前的请求对象。
//      * @param response 当前的响应对象。
//      */
//     protected proxy(target: string, name: string, url: Url.Url, request: Http.IncomingMessage, response: Http.ServerResponse) {

//         // 解析目标地址。
//         let targetUrl = Url.parse(target);
//         targetUrl.protocol = targetUrl.protocol || url.protocol;
//         targetUrl.query = url.query;

//         let https = targetUrl.protocol === "https:";

//         let headers = Object.assign({}, request.headers);
//         headers["host"] = targetUrl.host;
//         delete headers['accept-encoding'];

//         let req = ((https ? require('https') : require('http')).request as typeof Http.request)({
//             protocol: targetUrl.protocol,
//             host: targetUrl.hostname,
//             port: +targetUrl.port || (https ? 443 : 80),
//             path: targetUrl.path,
//             method: request.method,
//             headers: headers,
//             agent: this.builder.serverOptions.agent as Http.Agent
//         }, res => {

//             // 支持 302 跳转。
//             // TODO: 处理重复 302 跳转。
//             if (res.statusCode === 302 && res.headers.location) {
//                 this.proxy(res.headers.location, name, url, request, response);
//                 return;
//             }

//             let output = res;

//             // GZip 解压。
//             switch (res.headers['content-encoding']) {
//                 case 'gzip':
//                     output = output.pipe(require("zlib").createGunzip());
//                     break;
//                 case 'deflate':
//                     output = output.pipe(require("zlib").createInflate());
//                     break;
//             }

//             // 读取响应数据。
//             let buffers: Buffer[] = [];
//             output.on('data', (chunk: Buffer) => { buffers.push(chunk); });
//             output.on('end', () => {

//                 // 远程服务器返回 300 以上表示错误。
//                 if (res.statusCode >= 300 && res.statusCode !== 304) {
//                     response.writeHead(res.statusCode, res.headers);
//                     for (let i = 0; i < buffers.length; i++) {
//                         response.write(buffers[i]);
//                     }
//                     response.end();
//                     return;
//                 }

//                 let file = this.builder.createFile(name, Buffer.concat(buffers));
//                 this.builder.processFile(file);
//                 this.writeFile(file, res.headers['content-type'], response);
//             });
//         });
//         req.on('error', (e: NodeJS.ErrnoException) => { this.onError(e); });
//         req.end();
//     }

//     /**
//      * 存储所有已编译的代理服务器。
//      */
//     private _proxies: { filter: CompiledPattern, target: string }[];

//     /**
//      * 将生成的文件写入输出。
//      * @param file 要写入的文件。
//      * @param contentType 预设的内容类型。
//      * @param response 当前的响应对象。
//      */
//     protected writeFile(file: BuildFile, contentType: string, response: Http.ServerResponse) {
//         response.writeHead(file.errorCount ? 500 : 200, {
//             "content-type": contentType
//         });
//         response.end(file.data, this.builder.encoding);
//         this.builder.onFileSave(file);
//     }

//     /**
//      * 初始化新的服务器。
//      * @param builder 当前服务器所属的生成器。
//      */
//     constructor(builder: Builder) {
//         this.builder = builder;

//         this.builder.currentAction = BuildAction.server;

//         // 被动模式时，需要生成一遍文件。
//         if (this.builder.serverOptions.passive) {
//             this.builder.watch();
//         }

//         this._server = Http.createServer(this.builder.serverOptions.passive ? (request: Http.IncomingMessage, response: Http.ServerResponse) => {
//             this.onRequestPassive(request, response);
//         } : (request: Http.IncomingMessage, response: Http.ServerResponse) => {
//             this.onRequestActive(request, response);
//         });

//         // 编译代理服务器。
//         for (let p in this.builder.serverOptions.proxy) {
//             let target = this.builder.serverOptions.proxy[p];
//             if (target && target.charCodeAt(target.length - 1) === 47 /*/*/) {
//                 target += p.indexOf("*.") >= 0 ? "$1" + Path.extname(p) : p.indexOf('*') >= 0 ? "$1" : "$0";
//             }
//             this._proxies = this._proxies || [];
//             this._proxies.push({ filter: compilePatterns([p]), target: target })
//         }

//         // 绑定事件。
//         this._server.on('listening', () => {
//             let addr = this._server.address();
//             this.url = `http://${addr.address === "0.0.0.0" ? "localhost" : addr.address}${addr.port !== 80 ? ":" + addr.port : ""}${this.rootPath}`;
//             this.onStart();
//         });

//         this._server.on("close", () => { this.onStop(); });

//         // 启动服务器。
//         this.start();

//     }

// batHandler = {
//     processRequest(context: HttpContext) {
//         var Process = require('child_process');
//         var HttpUtility = require('aspserver/lib/httputility');

//         var args = [];
//         for (var key in context.request.queryString) {
//             if (context.request.queryString[key]) {
//                 args.push("-" + key);
//                 args.push(context.request.queryString[key]);
//             } else {
//                 args.push(key);
//             }
//         }

//         var p = Process.execFile(context.request.physicalPath, args, { cwd: Path.dirname(context.request.physicalPath) });

//         context.response.contentType = 'text/html;charset=utf-8';
//         context.response.bufferOutput = false;
//         context.response.write('<!doctype html>\
// 		<html>\
// 		<head>\
// 		<title>正在执行 ');

//         context.response.write(HttpUtility.htmlEncode(context.request.physicalPath));

//         context.response.write('</title>\
// 		</head>\
// 		<body style="font-family: Monaco, Menlo, Consolas, Courier New, monospace; color:#ececec; background: ' + (context.request.queryString["background"] || "black") + ';">');

//         context.response.write('<pre>');

//         var scrollToEnd = context.request.queryString["scroll"] !== false ? "<script>window.scrollTo(0, document.body.offsetHeight);</script>" : "";

//         p.stdout.on('data', function (data) {
//             context.response.write(controlColorToHtml(data));
//             if (data.indexOf('\r') >= 0 || data.indexOf('\n') >= 0) {
//                 context.response.write(scrollToEnd);
//             }
//         });

//         p.stderr.on('data', function (data) {
//             context.response.write('<span style="color:red">');
//             context.response.write(controlColorToHtml(data));
//             context.response.write('</span>');
//             if (data.indexOf('\r') >= 0 || data.indexOf('\n') >= 0) {
//                 context.response.write(scrollToEnd);
//             }
//         });

//         p.on('exit', function (code) {
//             context.response.write('</pre><p><strong>执行完毕!</strong></p>' + scrollToEnd);
//             context.response.write('<script>document.title=document.title.replace("正在执行", "执行完毕：")</script>');
//             context.response.write('</body></html>');

//             context.response.end();
//         });

//         function controlColorToHtml(data) {
//             var Colors = {
//                 '30': ['black', '#1a1a1a', '#333333'],
//                 '31': ['red', '#ff3333', '#ff6666'],
//                 '32': ['green', '#00b300', '#00e600'],
//                 '33': ['yellow', '#ffff33', '#ffff66'],
//                 '34': ['blue', '#3333ff', '#6666ff'],
//                 '35': ['magenta', '#ff33ff', '#ff66ff'],
//                 '36': ['cyan', '#33ffff', '#66ffff'],
//                 '37': ['lightgray', '#ececec', '#ffffff'],
//             }

//             return HttpUtility.htmlEncode(data).replace(/\033\[([\d;]*)m/g, function (all, c) {
//                 if (c === '0') {
//                     return '</span>';
//                 }

//                 c = c.split(';');

//                 var bold = c.indexOf('1') >= 0;
//                 var lighter = c.indexOf('2') >= 0;
//                 var underline = c.indexOf('4') >= 0;
//                 var blackground = c.indexOf('7') >= 0;

//                 var color;
//                 for (var key in Colors) {
//                     if (c.indexOf(key) >= 0) {
//                         color = Colors[key][bold ? 0 : lighter ? 2 : 1];
//                         break;
//                     }
//                 }

//                 var span = '<span style="';

//                 if (blackground) {
//                     span += "background: ";
//                 } else {
//                     span += "color: ";
//                 }
//                 span += color;

//                 if (underline) {
//                     span += "; text-decoration: underline;";
//                 }

//                 span += '">';

//                 return span;
//             });
//         }

//         return true;

//     }
// }

// serverOptions.url = options.url || this._server;

// serverOptions.mimeTypes = options.mimeTypes || this.mimeTypes;
// serverOptions.modules = options.modules || {};
// serverOptions.modules.build = serverOptions.modules.build || {
//     processRequest: function (context) {

//         let name = context.request.path.slice(1);

//         // 生成当前请求相关的文件。
//         let file = builder.createFile(name);
//         if (file.exists) {
//             builder.process(file);
//         } else {
//             // 目标文件可能是生成的文件。
//             for (let key in builder.files) {
//                 if (builder.files[key].dest === name) {
//                     file = builder.files[key];
//                     break;
//                 }
//             }
//         }

//         // 如果当前路径被任一规则处理，则响应处理后的结果。
//         if (file.processed) {
//             context.response.contentType = _server.mimeTypes[file.extension];
//             context.response.write(file.data);
//             context.response.end();
//             return true;
//         }

//         return false;
//     }
// };
// serverOptions.urlRewrites = options.urlRewrites || {};
// if (options.proxy) {
//     serverOptions.urlRewrites["^.*$"] = options.proxy + "/$&";
// }
// serverOptions.handlers = options.handlers || {};
// serverOptions.handlers['.bat'] = serverOptions.handlers['.bat'] || serverConigs.batHandler;
