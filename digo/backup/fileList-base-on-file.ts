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
     * 向当前列表添加一个文件。
     * @param file 要添加的文件。
     */
    add(file: File) {
        asyncQueue.lock("file");
        this.emit("data", file);
        file.asyncQueue.enqueue(() => {
            asyncQueue.unlock("file");
        });
    }

    /**
     * 通知当前列表所有文件已添加。
     */
    end() { return this.emit("end"); }

    /**
     * 设置当前列表完成后的回调函数。
     * @param callback 要执行的回调函数。
     */
    then(callback: Function) {
        const files: File[] = [];
        this.on("data", file => { files.push(file); });
        return this.on("end", () => {
            let pending = files.length;
            if (!pending) {
                callback();
                return;
            }
            for (const file of files) {
                file.asyncQueue.enqueue(() => {
                    if (--pending < 1) {
                        callback();
                    }
                });
            }
            files.length = 0;
        });
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
        if (processor.transform) {
            return processor.transform(this, options);
        }
        const result = new FileList();
        if (processor.init) {
            const t = processor.init(options, this, result);
            if (t !== undefined) options = t;
        }
        let added: File[];
        let pending: number;
        let emitEnd: () => void;
        if (processor.end) {
            added = [];
            pending = 1;
            emitEnd = () => {
                if (--pending < 1) {
                    const taskId = begin("{cyan:processor}: {count} file(s)", {
                        processor: (processor as Processor<T>).name || format("Process"),
                        count: added.length
                    });
                    const onEnd = () => {
                        pending = 1;
                        for (let i = added.length; --i >= 0;) {
                            if (!added[i].srcPath) {
                                added.splice(i, 1);
                            }
                        }
                        end(taskId);
                        result.end();
                    };
                    if ((processor as Processor<T>).end.length <= 3) {
                        (processor as Processor<T>).end(added, options, result);
                        onEnd();
                    } else {
                        (processor as Processor<T>).end(added, options, result, onEnd, this);
                    }
                }
            };
        } else {
            emitEnd = () => {
                result.end();
            };
        }
        this.on("data", file => {
            if ((processor as Processor<T>).load) {
                file.asyncQueue.enqueue(done => {
                    file.load(done);
                });
            }
            if ((processor as Processor<T>).add) {
                file.asyncQueue.enqueue(done => {
                    const taskId = begin("{cyan:processor}: {file}", {
                        processor: (processor as Processor<T>).name || format("Process"),
                        file: file.toString()
                    });
                    if ((processor as Processor<T>).add.length <= 2) {
                        (processor as Processor<T>).add(file, options);
                        end(taskId);
                        done();
                    } else {
                        (processor as Processor<T>).add(file, options, () => {
                            end(taskId);
                            done();
                        }, result, this);
                    }
                });
            }
            if (added) {
                let index = file.srcPath ? added.findIndex(t => t.srcPath === file.srcPath) : added.length;
                if (file.buildMode == BuildMode.clean) {
                    if (index >= 0) {
                        added.splice(index, 1);
                    }
                } else {
                    if (index < 0) index = added.length;
                    added[index >= 0 ? index : added.length] = file;
                    pending++;
                    file.asyncQueue.enqueue(() => {
                        added[index] = file.clone();
                        emitEnd();
                    });
                }
            }
            if (!(processor as Processor<T>).end || (processor as Processor<T>).end.length < 3) {
                result.add(file);
            }
        });
        this.on("end", emitEnd);
        return result;
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
     * 绑定一个数据事件。
     * @param event 要绑定的事件名。
     * @param listener 要绑定的事件监听器。
     */
    on(event: "data", listener: (file: File) => void): this;

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
     * @param destList 要转换的目标列表。
     * @param srcList 要转换的源列表。
     */
    init?(options: T, destList?: FileList, srcList?: FileList): any;

    /**
     * 当列表添加一个文件后执行。
     * @param file 要处理的文件。
     * @param options 传递给处理器的只读选项。
     * @param done 指示异步操作完成的回调函数。
     * @param destList 要转换的目标列表。
     * @param srcList 要转换的源列表。
     */
    add?(file: File, options: T, done?: () => void, destList?: FileList, srcList?: FileList): void;

    /**
     * 当列表所有文件添加完成后执行。
     * @param files 要处理的文件列表。
     * @param options 传递给处理器的只读选项。
     * @param destList 要转换的目标列表。
     * @param done 指示异步操作完成的回调函数。
     * @param srcList 要转换的源列表。
     */
    end?(files?: File[], options?: T, destList?: FileList, done?: () => void, srcList?: FileList): void;

    /**
     * 自定义列表转换方案。
     * @param srcList 要转换的源列表。
     * @param options 传递给处理器的只读选项。
     * @return 返回生成的新列表。
     */
    transform?(srcList: FileList, options: T): FileList;

}

/**
 * 表示一个简单处理器。
 * @param file 要处理的文件。
 * @param options 传递给处理器的只读选项。
 * @param done 指示异步操作完成的回调函数。
 * @param destList 要转换的目标列表。
 * @param srcList 要转换的源列表。
 */
export type SimpleProcessor<T> = (file: File, options: T, done?: () => void, destList?: FileList, srcList?: FileList) => void;
