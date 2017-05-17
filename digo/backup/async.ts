/**
 * 表示一个异步队列。
 */
export class AsyncQueue {

    /**
     * 存储正在执行的异步任务数。
     */
    private _asyncCount = 0;

    /**
     * 存储挂起的异步回调队列。
     */
    private _asyncCallback: AsyncCallback;

    /**
     * 通知当前对象进入异步挂起状态。
     * @param callback 解除挂起前执行的回调。
     * @return 返回一个函数。执行此函数以解除挂起状态。
     * @example setTimeout(awaitable.async(), 10);
     */
    async<T extends Function>(callback?: T): T {
        this._asyncCount++;
        const me = this;
        return <any>function asyncBound() {
            const result = callback && callback.apply(this, arguments);
            me._asyncCount--;
            while (!me._asyncCount && me._asyncCallback) {
                const asyncCallback = me._asyncCallback;
                me._asyncCallback = asyncCallback.next;
                if (asyncCallback.args) {
                    asyncCallback.func.apply(me, asyncCallback.args);
                } else {
                    asyncCallback.func.call(me);
                }
            }
            return result;
        };
    }

    /**
     * 判断当前对象是否已挂起。
     * @param func 要执行的函数。
     * @param args 执行的参数。
     * @return 如果返回 true 说明当前已挂起。否则说明当前未挂起任何函数。
     * @example if(!awaitable.wait(foo, [])) foo();
     */
    protected wait(func: Function, args?: any[] | IArguments) {
        if (!this._asyncCount) {
            return false;
        }
        const asyncCallback: AsyncCallback = {
            func: func,
            args: args && Array.prototype.slice.call(args)
        };
        if (this._asyncCallback) {
            let c = this._asyncCallback;
            while (c.next) c = c.next;
            c.next = asyncCallback;
        } else {
            this._asyncCallback = asyncCallback;
        }
        return true;
    }

    /**
     * 等待所有对象都已完成后执行回调。
     * @param awaitables 要等待的对象。
     * @param callback 执行的回调。
     */
    static all(awaitables: AsyncQueue[], callback: Function) {
        let waiting = 0;
        for (const awaitable of awaitables) {
            if (awaitable.wait(() => {
                if (!--waiting) {
                    callback();
                }
            })) {
                waiting++;
            }
        }
        if (!waiting) {
            callback();
        }
    }

}

/**
 * 表示一个挂起的异步回调函数。
 */
interface AsyncCallback {

    /**
     * 当前等待执行的函数。
     */
    func: Function;

    /**
     * 当前等待执行的函数参数。
     */
    args: any[];

    /**
     * 下一个异步回调函数。
     */
    next?: AsyncCallback;

}
