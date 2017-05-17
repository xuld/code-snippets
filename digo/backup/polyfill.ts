if (p.isAbsolute) {
        return p.isAbsolute(path);
    }
    const match = /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/.exec(path);
    return !!match[2] || !!match[1] && match[1].charCodeAt(1) !== 58/*:*/;

if ((<any>Buffer).from) {
        return <Buffer>(<any>Buffer).from(value, encoding);
    }
    return new Buffer(value, encoding);
/**
 * 判断指定的字符串是否以目标字符串开头。
 * @param value 要判断的字符串。
 * @param search 要搜索的目标字符串。
 * @returns 如果字符串以目标字符串开头则返回 true，否则返回 false。
 */
export function startsWith(value: string, search: string) {
    if ((<any>value).startsWith) {
        return (<any>value).startsWith(search);
    }
    return value.indexOf(search) === 0;
}

/**
 * 重复指定的字符串指定次数。
 * @param value 要重复的字符串。
 * @param count 重复的次数。
 * @returns 返回重复拼接的字符串。
 */
export function repeat(value: string, count: number) {
    if ((<any>value).repeat) {
        return (<any>value).repeat(count);
    }
    return count ? new Array(count + 1).join(value) : "";
}

        it('startsWith', () => {
            assert.equal(utility.startsWith("", ""), true);
            assert.equal(utility.startsWith("", "a"), false);
            assert.equal(utility.startsWith("abc", ""), true);
            assert.equal(utility.startsWith("abc", "a"), true);
            assert.equal(utility.startsWith("abc", "ab"), true);
            assert.equal(utility.startsWith("abc", "abc"), true);
            assert.equal(utility.startsWith("abc", "abcc"), false);
            assert.equal(utility.startsWith("abc", "bc"), false);
        });
        it('repeat', () => {
            assert.equal(utility.repeat("abc", 0), "");
            assert.equal(utility.repeat("abc", 1), "abc");
            assert.equal(utility.repeat("abc", 2), "abcabc");
            assert.equal(utility.repeat("abc", 3), "abcabcabc");
            assert.equal(utility.repeat("", 1000000), "");
        });
		
		
export function commonPrefix(x: string, y: string) {
    for (let i = 0; i < x.length; i++) {
        if (x.charCodeAt(i) !== y.charCodeAt(i)) {
            return x.substring(0, i);
        }
    }
    return x;
}

/**
 * 删除字符串中的 UTF-8 BOM 字符。
 * @param source 要处理的字符串。
 * @return 返回已处理的字符串。
 */
export function removeUTF8BOM(source: string) {
    return source.charCodeAt(0) === 65279 ? source.substr(1) : source;
}

/**
 * 将数字转为字符串，通过四舍五入保留两位小数。
 * @param value 要转换的数值。
 * @returns 返回转换后的字符串。
 */
function toFixed2(value: number) {
    return value.toFixed(2).replace(/(\.0)?0$/, "");
}
