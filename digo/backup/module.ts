
// /**
//  * 表示一个模块。
//  */
// export class Module {

//     // #region 依赖

//     /**
//      * 存储当前文件直接依赖的模块。存储以避免出现循环依赖。
//      */
//     private required: Module[] = [];

//     /**
//      * 判断当前模块及子模块是否以依赖目标的模块。
//      * @param module 目标模块。
//      * @return 如果已依赖则返回 true，否则返回 false。
//      */
//     private hasRequired(module: Module) {
//         if (this === module) {
//             return true;
//         }
//         for (let i = 0; i < this.required.length; i++) {
//             if (this.required[i].hasRequired(module)) {
//                 return true;
//             }
//         }
//         return false;
//     }

//     /**
//      * 指示当前模块依赖了指定路径。
//      * @param path 依赖的模块绝对路径。
//      * @param resolve 是否需要递归解析目标模块及子模块。
//      * @param callback 模块已加载的回调函数。
//      */
//     require(path: string, resolve: boolean, callback: (module: Module) => void) {
//         this.lock();
//         this.packer.getFile(path, file => {
//             this.packer.getModule(file, module => {
//                 if (module.hasRequired(this)) {
//                     this.unlock();
//                     module.resolve(() => {
//                         callback(module);
//                     });
//                 } else {
//                     if (this.required.indexOf(module) < 0) {
//                         this.required.push(module);
//                     }
//                     if (resolve) {
//                         module.resolve(() => {
//                             callback(module);
//                             this.unlock();
//                         });
//                     } else {
//                         callback(module);
//                         this.unlock();
//                     }
//                 }
//             });
//         });
//     }

//     /**
//      * 记录正在加载的依赖模块数。
//      */
//     private pending = 0;

//     /**
//      * 记录依赖模块已全部加载的回调函数。
//      */
//     private pendingCallbacks: (() => void)[] = [];

//     /**
//      * 标记当前模块即将执行一个异步任务。
//      */
//     lock() {
//         this.pending++;
//     }

//     /**
//      * 标记当前模块已执行一个异步任务。
//      */
//     unlock() {
//         if (--this.pending < 1) {
//             if (this.pendingCallbacks) {
//                 for (const pendingCallback of this.pendingCallbacks) {
//                     pendingCallback();
//                 }
//                 delete this.pendingCallbacks;
//             }
//         }
//     }

//     /**
//      * 存储当前模块是否已解析。
//      */
//     private _parsed = false;

//     /**
//      * 解析当前模块的所有异步任务全部执行完成后执行。
//      * @param callback 模块依赖项已全部加载的回调函数。
//      */
//     resolve(callback: () => void) {
//         if (!this._parsed) {
//             this._parsed = true;
//             this.lock();
//             this.parse();
//             this.unlock();
//         }
//         if (this.pending) {
//             this.pendingCallbacks = this.pendingCallbacks || [];
//             this.pendingCallbacks.push(callback);
//         } else {
//             callback();
//         }
//     }

//     /**
//      * 保存当前模块到指定的文件。
//      * @param file 要保存的目标文件。
//      * @param callback 构建完成的回调。
//      */
//     save(file: digo.File, callback: (relatedFiles?: digo.File[]) => void) {
//         this.resolve(() => {
//             const writer = file.createWriter();
//             this.build(writer, callback);
//             writer.end();
//             if (this.deps) {
//                 file.dep(this.deps);
//             }
//         });
//     }

//     // #endregion

//     // #region 构建

//     /**
//      * 当被子类重写后负责将当前模块写入指定的写入器。
//      * @param writer 要写入的写入器。
//      * @param callback 构建完成的回调。
//      */
//     protected build(writer: digo.Writer, callback: (relatedFiles?: digo.File[]) => void) {
//         // TODO
//         callback();
//     }

//     // #endregion

// }
