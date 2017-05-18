
    //     /**
    //      * ͨ������ʽ����ԭʼ���ݡ�
    //      * @param target �����Ŀ���ַ��
    //      * @param url �����ԭʼ��ַ��
    //      * @param request ��ǰ���������
    //      * @param response ��ǰ����Ӧ����
    //      */
    //     protected proxy(target: string, name: string, url: Url.Url, request: Http.IncomingMessage, response: Http.ServerResponse) {

    //         // ����Ŀ���ַ��
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

    //             // ֧�� 302 ��ת��
    //             // TODO: �����ظ� 302 ��ת��
    //             if (res.statusCode === 302 && res.headers.location) {
    //                 this.proxy(res.headers.location, name, url, request, response);
    //                 return;
    //             }

    //             let output = res;

    //             // GZip ��ѹ��
    //             switch (res.headers['content-encoding']) {
    //                 case 'gzip':
    //                     output = output.pipe(require("zlib").createGunzip());
    //                     break;
    //                 case 'deflate':
    //                     output = output.pipe(require("zlib").createInflate());
    //                     break;
    //             }

    //             // ��ȡ��Ӧ���ݡ�
    //             let buffers: Buffer[] = [];
    //             output.on('data', (chunk: Buffer) => { buffers.push(chunk); });
    //             output.on('end', () => {

    //                 // Զ�̷��������� 300 ���ϱ�ʾ����
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
    //      * �洢�����ѱ���Ĵ����������
    //      */
    //     private _proxies: { filter: CompiledPattern, target: string }[];

    //     /**
    //      * ��ǰ����ĵ�ַ���ִ���ʱִ�С�
    //      * @param statusCode ����Ĵ����롣
    //      * @param path �����ַ��������ĵ�ַ��
    //      * @param name �����ַ�����ơ�
    //      * @param url �����ԭʼ��ַ��
    //      * @param request ��ǰ���������
    //      * @param response ��ǰ����Ӧ����
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
    //      * ����ģʽ����ָ��������
    //      * @param request ��ǰ���������
    //      * @param response ��ǰ����Ӧ����
    //      */
    //     protected onRequestPassive(request: Http.IncomingMessage, response: Http.ServerResponse) {

    //         // ������ַ��
    //         let url = Url.parse(request.url);
    //         let name = this.builder.toName(url.pathname.substr(this.rootPath.length));

    //         // ����Ƿ�ʹ�ô���
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

    //         // ����������ڵ��ļ�����ִ�����ɡ�
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

    //         // Ŀ¼�����
    //         if (fs.isDirectory()) {

    //             // �޸� /path/to Ϊ /path/to/
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

    //         // �����ļ������ء�
    //         this.builder.reset();
    //         let file = this.builder.buildFile(name);
    //         let contentType = this.builder.getMimeTypeByExt(file.extension);
    //         if (contentType.startsWith("text/")) {
    //             contentType += "; charset=" + this.builder.encoding;
    //         }
    //         this.writeFile(file, contentType, response);

    //     }

    //     /**
    //      * ����ģʽ����ָ��������
    //      * @param request ��ǰ���������
    //      * @param response ��ǰ����Ӧ����
    //      */
    //     protected onRequestActive(request: Http.IncomingMessage, response: Http.ServerResponse) {

    //         // ������ַ��
    //         let url = Url.parse(request.url);
    //         let name = this.builder.toName(url.pathname.substr(this.rootPath.length));

    //         // ����Ƿ�ʹ�ô���
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

    //         // ����������ڵ��ļ�����ִ�����ɡ�
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

    //         // Ŀ¼�����
    //         if (fs.isDirectory()) {

    //             // �޸� /path/to Ϊ /path/to/
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

    //         // �����ļ������ء�
    //         this.builder.reset();
    //         let file = this.builder.buildFile(name);
    //         let contentType = this.builder.getMimeTypeByExt(file.extension);
    //         if (contentType.startsWith("text/")) {
    //             contentType += "; charset=" + this.builder.encoding;
    //         }
    //         this.writeFile(file, contentType, response);

    //     }

    //     /**
    //      * �г��ļ���Ŀ¼��
    //      * @param path �����ַ��������ĵ�ַ��
    //      * @param name �����ַ�����ơ�
    //      * @param url �����ԭʼ��ַ��
    //      * @param request ��ǰ���������
    //      * @param response ��ǰ����Ӧ����
    //      */
    //     protected listDir(path: string, name: string, url: Url.Url, request: Http.IncomingMessage, response: Http.ServerResponse) {
    //         this.onRequestError(402, path, name, url, request, response);
    //     }

    //     // /**
    //     //  * ��ʼ���µķ�������
    //     //  */
    //     // constructor() {

    //     //     // ��������������
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
// //      * �洢���������ѡ�
// //      */
// //     private _serverOptions = {

// //     /**
// //      * �������ļ�����ַ�����У�0.0.0.0 ��ʾ�������� IP ��ַ���˿�����Ϊ 0 ��ʾ����˿ڡ�
// //      */
// //     url: "http://0.0.0.0:8080/",

// //     /**
// //      * ָʾ�Ƿ�ʹ�ñ���ģʽ��
// //      */
// //     passive: false,

// //     /**
// //      * ����������
// //      */
// //     proxy: {} as { [path: string]: string },

// //     /**
// //      * ���������ʹ�õĴ����ַ��
// //      */
// //     agent: null as HttpAgent | HttpsAgent

// // };

// /**
//  * ����������������ҳ�����������������������󲢸��ݵ�ǰ���õĹ��������Ӧ��
//  * @param port �������Ķ˿ڡ�
//  * @param url �������ĵ�ַ��
//  * @param options ��������ѡ�
//  * @returns ���ط���������
//  */
// openServer() {
//     var server = this.startServer();
//     (require("child_process").exec as typeof exec)("start " + server.url, (error) => { error && this.fatal(error.toString()); });
//     return server;
// }

// /**
//  * ��ʾһ��������������
//  */
// export class Server {

//     /**
//      * ��ȡ��ǰ��������������������
//      */
//     builder: Builder;

//     /**
//      * ��ȡ��ǰ����������ҳ��ַ��
//      */
//     url: string;

//     /**
//      * ��ȡ��ǰ�������ĸ�·����
//      */
//     rootPath = "";

//     /**
//      * �洢�ײ� HTTP ��������
//      */
//     private _server: Http.Server;

//     /**
//      * ������������ʱ�ص���
//      */
//     protected onStart() {
//         this.builder.onServerStart(this);
//     }

//     /**
//      * ��������ֹͣʱ�ص���
//      */
//     protected onStop() {
//         this.builder.onServerStop(this);
//     }

//     /**
//      * ������������ʱִ�С�
//      */
//     protected onError(e: NodeJS.ErrnoException) {
//         this.builder.onServerError(this, e);
//     }

//     /**
//      * ����ģʽ����ָ��������
//      * @param request ��ǰ���������
//      * @param response ��ǰ����Ӧ����
//      */
//     protected onRequestPassive(request: Http.IncomingMessage, response: Http.ServerResponse) {

//         // ������ַ��
//         let url = Url.parse(request.url);
//         let name = this.builder.toName(url.pathname.substr(this.rootPath.length));

//         // ����Ƿ�ʹ�ô���
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

//         // ����������ڵ��ļ�����ִ�����ɡ�
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

//         // Ŀ¼�����
//         if (fs.isDirectory()) {

//             // �޸� /path/to Ϊ /path/to/
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

//         // �����ļ������ء�
//         this.builder.reset();
//         let file = this.builder.buildFile(name);
//         let contentType = this.builder.getMimeTypeByExt(file.extension);
//         if (contentType.startsWith("text/")) {
//             contentType += "; charset=" + this.builder.encoding;
//         }
//         this.writeFile(file, contentType, response);

//     }

//     /**
//      * ����ģʽ����ָ��������
//      * @param request ��ǰ���������
//      * @param response ��ǰ����Ӧ����
//      */
//     protected onRequestActive(request: Http.IncomingMessage, response: Http.ServerResponse) {

//         // ������ַ��
//         let url = Url.parse(request.url);
//         let name = this.builder.toName(url.pathname.substr(this.rootPath.length));

//         // ����Ƿ�ʹ�ô���
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

//         // ����������ڵ��ļ�����ִ�����ɡ�
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

//         // Ŀ¼�����
//         if (fs.isDirectory()) {

//             // �޸� /path/to Ϊ /path/to/
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

//         // �����ļ������ء�
//         this.builder.reset();
//         let file = this.builder.buildFile(name);
//         let contentType = this.builder.getMimeTypeByExt(file.extension);
//         if (contentType.startsWith("text/")) {
//             contentType += "; charset=" + this.builder.encoding;
//         }
//         this.writeFile(file, contentType, response);

//     }

//     /**
//      * �г��ļ���Ŀ¼��
//      * @param path �����ַ��������ĵ�ַ��
//      * @param name �����ַ�����ơ�
//      * @param url �����ԭʼ��ַ��
//      * @param request ��ǰ���������
//      * @param response ��ǰ����Ӧ����
//      */
//     protected listDir(path: string, name: string, url: Url.Url, request: Http.IncomingMessage, response: Http.ServerResponse) {
//         this.onRequestError(402, path, name, url, request, response);
//     }

//     /**
//      * ͨ������ʽ����ԭʼ���ݡ�
//      * @param target �����Ŀ���ַ��
//      * @param url �����ԭʼ��ַ��
//      * @param request ��ǰ���������
//      * @param response ��ǰ����Ӧ����
//      */
//     protected proxy(target: string, name: string, url: Url.Url, request: Http.IncomingMessage, response: Http.ServerResponse) {

//         // ����Ŀ���ַ��
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

//             // ֧�� 302 ��ת��
//             // TODO: �����ظ� 302 ��ת��
//             if (res.statusCode === 302 && res.headers.location) {
//                 this.proxy(res.headers.location, name, url, request, response);
//                 return;
//             }

//             let output = res;

//             // GZip ��ѹ��
//             switch (res.headers['content-encoding']) {
//                 case 'gzip':
//                     output = output.pipe(require("zlib").createGunzip());
//                     break;
//                 case 'deflate':
//                     output = output.pipe(require("zlib").createInflate());
//                     break;
//             }

//             // ��ȡ��Ӧ���ݡ�
//             let buffers: Buffer[] = [];
//             output.on('data', (chunk: Buffer) => { buffers.push(chunk); });
//             output.on('end', () => {

//                 // Զ�̷��������� 300 ���ϱ�ʾ����
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
//      * �洢�����ѱ���Ĵ����������
//      */
//     private _proxies: { filter: CompiledPattern, target: string }[];

//     /**
//      * �����ɵ��ļ�д�������
//      * @param file Ҫд����ļ���
//      * @param contentType Ԥ����������͡�
//      * @param response ��ǰ����Ӧ����
//      */
//     protected writeFile(file: BuildFile, contentType: string, response: Http.ServerResponse) {
//         response.writeHead(file.errorCount ? 500 : 200, {
//             "content-type": contentType
//         });
//         response.end(file.data, this.builder.encoding);
//         this.builder.onFileSave(file);
//     }

//     /**
//      * ��ʼ���µķ�������
//      * @param builder ��ǰ��������������������
//      */
//     constructor(builder: Builder) {
//         this.builder = builder;

//         this.builder.currentAction = BuildAction.server;

//         // ����ģʽʱ����Ҫ����һ���ļ���
//         if (this.builder.serverOptions.passive) {
//             this.builder.watch();
//         }

//         this._server = Http.createServer(this.builder.serverOptions.passive ? (request: Http.IncomingMessage, response: Http.ServerResponse) => {
//             this.onRequestPassive(request, response);
//         } : (request: Http.IncomingMessage, response: Http.ServerResponse) => {
//             this.onRequestActive(request, response);
//         });

//         // ��������������
//         for (let p in this.builder.serverOptions.proxy) {
//             let target = this.builder.serverOptions.proxy[p];
//             if (target && target.charCodeAt(target.length - 1) === 47 /*/*/) {
//                 target += p.indexOf("*.") >= 0 ? "$1" + Path.extname(p) : p.indexOf('*') >= 0 ? "$1" : "$0";
//             }
//             this._proxies = this._proxies || [];
//             this._proxies.push({ filter: compilePatterns([p]), target: target })
//         }

//         // ���¼���
//         this._server.on('listening', () => {
//             let addr = this._server.address();
//             this.url = `http://${addr.address === "0.0.0.0" ? "localhost" : addr.address}${addr.port !== 80 ? ":" + addr.port : ""}${this.rootPath}`;
//             this.onStart();
//         });

//         this._server.on("close", () => { this.onStop(); });

//         // ������������
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
// 		<title>����ִ�� ');

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
//             context.response.write('</pre><p><strong>ִ�����!</strong></p>' + scrollToEnd);
//             context.response.write('<script>document.title=document.title.replace("����ִ��", "ִ����ϣ�")</script>');
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

//         // ���ɵ�ǰ������ص��ļ���
//         let file = builder.createFile(name);
//         if (file.exists) {
//             builder.process(file);
//         } else {
//             // Ŀ���ļ����������ɵ��ļ���
//             for (let key in builder.files) {
//                 if (builder.files[key].dest === name) {
//                     file = builder.files[key];
//                     break;
//                 }
//             }
//         }

//         // �����ǰ·������һ����������Ӧ�����Ľ����
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
