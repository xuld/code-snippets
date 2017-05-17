
/**
 * 表示匹配器的附加选项。
 */
export interface MatcherOptions {

    /**
     * 设置通配符的根路径。
     */
    cwd?: string;

    /**
     * 设置匹配的忽略项。
     */
    ignore?: Matcher;

    /**
     * 如果为 true 则递归搜索软链接。
     */
    follow?: boolean;

}

/**
 * 创建是否匹配指定通配符、正则表达式、函数或以上组成的数组的测试函数。
 * @param matcher 要测试的通配符、正则表达式、函数或以上组成的数组。
 * @param cwd 地址的基路径。
 * @param ignore 要忽略的通配符、正则表达式、函数或以上组成的数组。
 * @returns 返回测试函数。
 */
export function createTester(matcher: Matcher, cwd: string) {
    const func = [];
    const data = [];
    add(matcher);
    const result = new Function("p", `var D=arguments.callee.data;return ${func.length ? func.join("||") : "false"};`);
    (<any>result).data = data;
    return <Tester>result;

    function add(matcher: Matcher | Matcher[]) {

        // "*.sources*"
        if (typeof matcher === "string") {
            if (matcher.charCodeAt(0) === 33/*!*/) {
                if (func.length) {
                    func[func.length - 1] = `(${func[func.length - 1]}&&!D[${data.length}].test(p))`;
                    data[data.length] = globToRegExp(matcher.substr(1));
                }
                // FIXME: 第一个通配符是 ! 开头的是非法通配符。
                return;
            }

            func.push(`D[${data.length}].test(p)`);
            data[data.length] = globToRegExp(matcher);
            return;
        }

        // /.../
        if (matcher instanceof RegExp) {
            func.push(`D[${data.length}].test(p)`);
            data[data.length] = matcher;
            return;
        }

        // function(){ ... }
        if (typeof matcher === "function") {
            func.push(`D[${data.length}](p)`);
            data[data.length] = matcher;
            return;
        }

        // 数组：串联继续解析。
        if (Array.isArray(matcher)) {
            matcher.forEach(add);
        }
    }
}

/**
 * 规范化匹配器。
 * @param matchers 匹配器列表。
 */
export function normalizeMatchers(matchers: Matcher) {
    const result: MatcherOptions = {

    };
}

/**
 * 表示一个匹配器规范化的结果。
 */
export interface NormalizeMatcherResult {

    /**
     * 通配符的根路径。
     */
    cwd?: string;

    /**
     * 如果为 true 则递归搜索软链接。
     */
    follow?: boolean;

    /**
     * 所有通配符。
     */
    patterns?: (Glob | RegExp | Tester)[];

    ///**
    // * 所有通配符。
    // */
    //globs?: string[];

    ///**
    // * 所有正则表达式。
    // */
    //regexs?: { test: Tester }[];

    /**
     * 所有忽略的匹配器。
     */
    ignores?: Matcher[];

}

/**
 * 规范化单个匹配器。
 * @param matcher 要规范化的匹配器。
 * @param result 存放结果的对象。
 */
export function parseMatcher(matcher: Matcher, result: NormalizeMatcherResult) {

}

/**
 * 获取指定匹配器的基路径。
 * @param matcher 要获取的匹配器。
 * @example getBase("abc/*") // "abc/"
 */
export function getBase(matcher: Matcher | Matcher[]) {

    // 通配符。
    if (typeof matcher === "string") {
        if (matcher.charCodeAt(0) === 33/*!*/) {
            return;
        }
        const match = /^\/?([^*?\[\\]+\/)/.exec(matcher);
        return match ? match[1] : "";
    }

    // 多个匹配器：找出共同的基地址。
    if (Array.isArray(matcher)) {
        let result: string;
        for (let i = 0; i < matcher.length; i++) {
            let cur = getBase(matcher[i]);
            if (cur == undefined) {
                continue;
            }
            if (result == undefined) {
                result = cur;
                continue;
            }

            // 找出 result 和 cur 的公共部分。
            let commonEnd = 0;
            while (result.charCodeAt(commonEnd) === cur.charCodeAt(commonEnd)) {
                commonEnd++;
            }
            while (commonEnd && result.charCodeAt(commonEnd) !== 47/*/*/) {
                commonEnd--;
            }
            if (!commonEnd) {
                return "";
            }
            result = result.substr(0, commonEnd + 1);
        }
        return result;
    }

    return "";
}

export function isGlob(pattern: string) {

}

/**
 * 表示匹配器的属性。
 */
export interface MatcherAttributes {

    /**
     * 获取当前匹配器的基地址。
     */
    base: string;

    /**
     * 判断当前匹配器是否可以匹配子文件的路径。
     */
    recursion: boolean;

    /**
     * 判断当前匹配器是否是完整路径。
     */
    path: boolean;

}

#endregion

    /**
     * 如果为 true 则递归搜索软链接。
     */
    follow: boolean;


    /**
     * 替换指定的字路径。
     * @param value 要替换的绝对路径。
     * @param replacement 替换的目标。
     */
    replace?(path: string, replacement: string | Function): string;

/**
 * 获取指定通配符的文件夹部分。
 * @param pattern 要处理的通配符。
 * @return 返回文件夹部分(含路径分隔符)。如果无文件夹部分则返回空字符串。
 */
export function getGlobDir(pattern: string) {
    if (!pattern) {
        return "";
    }
    const match = /^\/?([^*?\[\\]+\/)/.exec(pattern);
    if (match) {
        return match[1];
    }
    return "";
}

/**
 * 判断指定的字符串是否包含通配符。
 * @param pattern 要判断的通配符。
 * @returns 如果是通配符则返回 true，否则返回 false。
 */
export function isGlob(pattern: string) {
    return /[*?\[\\]/.test(pattern);
}


    export function getGlobBaseTest() {
        assert.equal(matcher.getGlobDir("foo/*.jpg"), "foo/");
        assert.equal(matcher.getGlobDir("foo/goo/*.jpg"), "foo/goo/");
        assert.equal(matcher.getGlobDir("a"), "");
    }
    export function isGlobTest() {
        assert.equal(matcher.isGlob("a"), false);
        assert.equal(matcher.isGlob("a*"), true);
    }