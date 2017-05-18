/**
 * @file 文件列表
 * @author xuld <xuld@vip.qq.com>
 */
import { EventEmitter } from "events";
import { Matcher, Pattern } from "../utility/matcher";
import { getDisplayName, format, error } from "./logging";
import { asyncQueue } from "./async";
import { begin, end } from "./progress";
import { plugin } from "./plugin";
import { File, BuildMode } from "./file";

/**
 * 表示一个文件列表。
 * @desc
 * FileList 并不存储文件，它只是文件的中转站。
 * FileList 本质上是一个文件对象流。
 */
export class FileList extends EventEmitter {

    /**
     * 初始化新的文件列表。
     */
    constructor() {
        super();
        asyncQueue.lock("FileList");
    }

    /**
     * 向当前列表添加一个文件。
     * @param file 要添加的文件。
     */
    add(file: File) { this.emit("data", file, this); }

    /**
     * 重置当前文件列表。
     */
    reset() {
        asyncQueue.lock("FileList");
        this.emit("reset");
    }

    /**
     * 通知当前列表所有文件已添加。
     */
    end() {
        this.emit("end");
        asyncQueue.unlock("FileList");
    }

    /**
     * 设置当前列表完成后的回调函数。
     * @param callback 要执行的回调函数。
     */
    then(callback: Function) {
        return this.on("end", callback);
    }

    /**
     * 获取上一级列表。
     */
    prev: FileList;

    /**
     * 获取下一级列表。
     */
    next: FileList;

    /**
     * 获取当前列表的根列表。
     */
    get root() {
        let result: FileList = this;
        while (result.prev) {
            result = result.prev;
        }
        return result;
    }

    /**
     * 获取当前列表的最终结果列表。
     */
    get result() {
        let result: FileList = this;
        while (result.next) {
            result = result.next;
        }
        return result;
    }

    /**
     * 判断当前列表是否包含指定的子级列表。
     * @param child 要判断的列表。
     * @return 如果包含则返回 true，否则返回 false。
     */
    private hasNext(child: FileList) {
        if (!this.prev || this === child) {
            return true;
        }
        for (let list: FileList = this; list = list.next;) {
            if (list.prev === this && list.hasNext(child)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 将当前列表所有文件传递给指定的处理器。
     * @param processor 要传递的目标处理器。
     * @param options 供处理器使用的只读配置对象。
     * @return 返回用于接收处理后文件的文件列表。
     * @example
     * list.pipe((file) => file.content += "1");
     * list.pipe((file, options, done) => done());
     * list.pipe((file, options, done, result) => {  });
     */
    pipe<T>(processor: string | SimpleProcessor<T> | Processor<T>, options: T = defaultOptions) {
        // B = A.pipe(b) 的意义为：
        // 当 A 接收到文件时执行 b 后传递给 B。

        // 考虑这个场景：
        //      B1 = A.pipe(b1)
        //      B2 = A.pipe(b2)
        // B1 接收到的是已执行 b1 的文件对象。
        // B2 虽然是从 A 接收文件，但因为文件对象的引用是同一个，
        // 所以 B2 接收到的文件可能已执行 b1，也可能没有执行。

        // 为了确保结果稳定，我们统一延时执行 b2，确保 B2 得到的文件
        // 已先后执行了 b1 和 b2，这个结果也比较符合作者的预期。

        // 我们通过 next 和 prev 属性将所有 FileList 串成一个双向链表。
        // 任何一个文件和事件都会从上往下一级级地传递。
        if (typeof processor === "string") {
            processor = plugin(processor) as SimpleProcessor<T> | Processor<T>;
        }
        if (typeof processor === "function") {
            processor = {
                name: processor.name,
                load: true,
                add: processor
            };
        }
        let cached: File[];
        if (processor.end) {
            cached = [];
        }
        const result = new FileList();
        this.on("data", file => {
            if ((processor as Processor<T>).load) {
                file.asyncQueue.enqueue(done => {
                    file.load(done);
                });
            }
            if ((processor as Processor<T>).add) {
                if ((processor as Processor<T>).add.length <= 2) {
                    file.asyncQueue.enqueue(() => {
                        (processor as Processor<T>).add(file, options);
                    });
                } else {
                    file.asyncQueue.enqueue(done => {
                        (processor as Processor<T>).add(file, options, done);
                    });
                }
            }
            if ((processor as Processor<T>).end) {
                let index = cached.findIndex(t => t.srcPath === file.srcPath);
                if (file.buildMode == BuildMode.clean) {
                    if (index >= 0) {
                        cached.splice(index, 1);
                    }
                } else {
                    if (index < 0) index = cached.length;
                    cached[index >= 0 ? index : cached.length] = file;
                    file.asyncQueue.enqueue(() => {
                        cached[index] = cached[index].clone();
                    });
                }
            } else {
                result.add(file);
            }
        });
        this.on("end", () => {
            if ((processor as Processor<T>).end) {
                let pending = cached.length;
                const emitEnd = () => {
                    if (--pending < 1) {
                        if ((processor as Processor<T>).end.length > 3) {
                            (processor as Processor<T>).end(cached, options, result, () => result.end());
                        } else {
                            (processor as Processor<T>).end(cached, options, result);
                            result.end();
                        }
                    }
                }
                if (!pending) {
                    emitEnd();
                }
                for (const file of cached) {
                    file.asyncQueue.enqueue(emitEnd);
                }
            } else {
                result.end();
            }
        });
        return result;
        // const result = new FileList();
        // result.prev = this;
        // const parent = this.result;
        // parent.next = result;
        // if (processor.init) {
        //     try {
        //         options = processor.init(options, result) || options;
        //     } catch (e) {
        //         error({
        //             plugin: processor.name,
        //             error: e
        //         });
        //     }
        // }
        // let pending = 1;
        // let cached: File[];
        // if (processor.end) {
        //     cached = [];
        // }
        // const onParentEnd = function done() {
        //     if (--pending < 1) {
        //         if ((processor as Processor<T>).end) {
        //             const taskId = begin("{cyan:processor}: {count} file(s)", {
        //                 processor: (processor as Processor<T>).name || format("Process"),
        //                 count: cached.length
        //             });
        //             let hasEnd = false;
        //             const onResultEnd = function done() {
        //                 if (hasEnd) {
        //                     return;
        //                 } else {
        //                     hasEnd = true;
        //                 }
        //                 end(taskId);
        //                 result.end();
        //             };
        //             try {
        //                 if ((processor as Processor<T>).end.length > 3) {
        //                     (processor as Processor<T>).end(cached, options, result, onResultEnd);
        //                 } else {
        //                     (processor as Processor<T>).end(cached, options, result);
        //                     onResultEnd();
        //                 }
        //             } catch (e) {
        //                 error({
        //                     plugin: (processor as Processor<T>).name,
        //                     error: e
        //                 });
        //                 onResultEnd();
        //             }
        //         } else {
        //             result.end();
        //         }
        //     }
        // };
        // parent.on("reset", () => {
        //     pending = 1;
        //     if ((processor as Processor<T>).reset) {
        //         try {
        //             (processor as Processor<T>).reset(options, result);
        //         } catch (e) {
        //             error({
        //                 plugin: (processor as Processor<T>).name,
        //                 error: e
        //             });
        //         }
        //     }
        //     result.reset();
        // });
        // parent.on("data", (file, root, hiddenRoot) => {
        //     if (!root.hasNext(this)) {
        //         return;
        //     }
        //     if (hiddenRoot && hiddenRoot.hasNext(this)) {
        //         result.emit("data", file, root, hiddenRoot);
        //     } else {
        //         let taskAdd: string;
        //         let hasAdd = false;
        //         const onAdd = function done() {
        //             if (hasAdd) {
        //                 return;
        //             } else {
        //                 hasAdd = true;
        //             }
        //             if ((processor as Processor<T>).end) {
        //                 const index = cached.findIndex(t => t.srcPath === file.srcPath);
        //                 if (file.buildMode == BuildMode.clean) {
        //                     if (index >= 0) {
        //                         cached.splice(index, 1);
        //                     }
        //                 } else {
        //                     cached[index >= 0 ? index : cached.length] = file.clone();
        //                 }
        //                 result.emit("data", file, root, result);
        //             } else {
        //                 result.emit("data", file, root, !(processor as Processor<T>).add || (processor as Processor<T>).add.length <= 3 ? undefined : result);
        //             }
        //             if (taskAdd) {
        //                 end(taskAdd);
        //             }
        //             onParentEnd();
        //         };
        //         const onLoad = function done() {
        //             if ((processor as Processor<T>).add) {
        //                 taskAdd = begin("{cyan:processor}: {file}", {
        //                     processor: (processor as Processor<T>).name || format("Process"),
        //                     file: getDisplayName(file.srcPath || format("(Generated)"))
        //                 });
        //                 try {
        //                     if ((processor as Processor<T>).add.length <= 2) {
        //                         (processor as Processor<T>).add(file, options);
        //                         onAdd();
        //                     } else if ((processor as Processor<T>).add.length <= 3) {
        //                         (processor as Processor<T>).add(file, options, onAdd);
        //                     } else {
        //                         (processor as Processor<T>).add(file, options, onAdd, result);
        //                     }
        //                 } catch (e) {
        //                     file.error({
        //                         plugin: (processor as Processor<T>).name,
        //                         error: e
        //                     });
        //                     onAdd();
        //                 }
        //             } else {
        //                 onAdd();
        //             }
        //         };
        //         pending++;
        //         if ((processor as Processor<T>).load) {
        //             file.load(onLoad);
        //         } else {
        //             onLoad();
        //         }
        //     }
        // });
        // parent.on("end", onParentEnd);
        // return result;
    }

    /**
     * 筛选当前文件列表并返回一个新的文件列表。
     * @param patterns 用于筛选文件的通配符、正则表达式、函数或以上模式组合的数组。
     * @return 返回已筛选的文件列表。
     */
    src(...patterns: Pattern[]) {
        const result = new FileList();
        const matcher = new Matcher(patterns);
        this.on("data", file => {
            if (matcher.test(file.path)) {
                result.add(file);
            }
        });
        this.on("end", () => {
            result.end();
        });
        return result;
        // const result = new FileList();
        // result.prev = this;
        // const parent = this.result;
        // parent.next = result;
        // const matcher = new Matcher(patterns);
        // parent.on("reset", () => {
        //     result.reset();
        // });
        // parent.on("data", (file, root, hiddenRoot) => {
        //     if (!root.hasNext(this)) {
        //         return;
        //     }
        //     if (hiddenRoot && hiddenRoot.hasNext(this)) {
        //         result.emit("data", file, root, hiddenRoot);
        //     } else {
        //         if (matcher.test(file.path)) {
        //             result.emit("data", file, root);
        //         } else {
        //             result.emit("data", file, root, result);
        //         }
        //     }
        // });
        // parent.on("end", () => {
        //     result.end();
        // });
        // return result;
    }

    /**
     * 将所有文件移动到指定的文件夹。
     * @param dir 要保存的目标文件文件夹。如果为空则保存到原文件夹。
     */
    dest(dir?: string | ((file: File) => string)) {
        return this.pipe({
            load: false,
            add(file, dir, done) {
                file.save(typeof dir === "function" ? dir(file) : dir, (error, file) => {
                    if (error) {
                        file.error(error);
                    }
                    done();
                });
            }
        }, dir);
    }

    /**
     * 删除所有源文件。
     * @param deleteDir 指示是否删除空的父文件夹。默认为 true。
     */
    delete(deleteDir?: boolean) {
        return this.pipe({
            load: false,
            add(file, deleteDir, done) {
                file.delete(deleteDir, (error, file) => {
                    if (error) {
                        file.error(error);
                    }
                    done();
                });
            }
        }, deleteDir);
    }

}

const defaultOptions: any = Object.freeze({});

export interface FileList {

    /**
     * 绑定一个开始事件。
     * @param event 要绑定的事件名。
     * @param listener 要绑定的事件监听器。
     */
    on(event: "reset", listener: () => void): this;

    /**
     * 绑定一个数据事件。
     * @param event 要绑定的事件名。
     * @param listener 要绑定的事件监听器。
     */
    on(event: "data", listener: (file: File, root: FileList, hiddenRoot?: FileList) => void): this;

    /**
     * 绑定一个结束事件。
     * @param event 要绑定的事件名。
     * @param listener 要绑定的事件监听器。
     */
    on(event: "end", listener: () => void): this;

    /**
     * 绑定一个事件。
     * @param event 要绑定的事件名。
     * @param listener 要绑定的事件监听器。
     */
    on(event: string | symbol, listener: Function): this;

}

/**
 * 表示一个处理器。
 */
export interface Processor<T> {

    /**
     * 获取当前处理器的名字。
     */
    name?: string;

    /**
     * 判断执行当前处理器前是否需要首先载入文件内容。
     */
    load?: boolean;

    /**
     * 初始化选项。
     * @param options 传递给处理器的只读选项。
     * @param result 结果列表。
     */
    init?(options: T, result?: FileList): T | void;

    /**
     * 重置当前处理器。
     * @param options 传递给处理器的只读选项。
     * @param result 结果列表。
     */
    reset?(options: T, result?: FileList): void;

    /**
     * 处理每个文件。
     * @param file 要处理的文件。
     * @param options 传递给处理器的只读选项。
     * @param done 指示异步操作完成的回调函数。
     * @param result 结果列表。
     */
    add?(file: File, options: T, done?: () => void, result?: FileList): void;

    /**
     * 当前列表所有文件处理完成后执行。
     * @param files 要处理的文件列表。
     * @param options 传递给处理器的只读选项。
     * @param result 结果列表。
     * @param done 指示异步操作完成的回调函数。
     */
    end?(files: File[], options: T, result: FileList, done?: () => void): void;

}

/**
 * 表示一个简单处理器。
 * @param file 要处理的文件。
 * @param options 传递给处理器的只读选项。
 * @param done 指示异步操作完成的回调函数。
 * @param result 结果列表。
 */
export type SimpleProcessor<T> = (file: File, options: T, done?: () => void, result?: FileList) => void;
