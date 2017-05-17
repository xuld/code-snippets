/**
 * 合并 *from* 和 *to*。
 * @param from 解析的基路径。
 * @param to 要解析的相对路径。
 * @returns 返回解析后的绝对路径。路径中固定以 `/` 作为分隔符。
 */
export function joinUrl(from: string, to: string) {
    const fromObject = u.parse(from, false, true);
    const toObject = u.parse(to, false, true);
    if (!toObject.protocol) {
        toObject.protocol
    }

    if (toObject) {
        from = toObject.path || '/';
    }

    // `join(foo, '//www.example.org')`
    if (fromObject && !fromObject.protocol) {
        if (toObject) {
            fromObject.protocol = toObject.protocol;
        }
        return u.format(fromObject);
    }

    if (fromObject || to.match(dataUrlRegexp)) {
        return to;
    }

    // `join('http://', 'www.example.com')`
    if (toObject && !toObject.host && !toObject.path) {
        toObject.host = to;
        return u.format(toObject);
    }

    var joined = to.charAt(0) === '/'
        ? to
        : normalizeUrl(from.replace(/\/+$/, '') + '/' + to);

    if (toObject) {
        toObject.pathname = joined;
        return u.format(toObject);
    }
    return joined;
}

/**
 * Make a path relative to a URL or another path.
 *
 * @param aRoot The root path or URL.
 * @param aPath The path or URL to be made relative to aRoot.
 */
function relative(aRoot, aPath) {
    if (aRoot === "") {
        aRoot = ".";
    }

    aRoot = aRoot.replace(/\/$/, '');

    // It is possible for the path to be above the root. In this case, simply
    // checking whether the root is a prefix of the path won't work. Instead, we
    // need to remove components from the root one by one, until either we find
    // a prefix that fits, or we run out of components to remove.
    var level = 0;
    while (aPath.indexOf(aRoot + '/') !== 0) {
        var index = aRoot.lastIndexOf("/");
        if (index < 0) {
            return aPath;
        }

        // If the only part of the root that is left is the protocol (i.e. http://,
        // file:///, etc.), one or more slashes (/), or simply nothing at all, we
        // have exhausted all components, so the path is not relative to the root.
        aRoot = aRoot.slice(0, index);
        if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
            return aPath;
        }

        ++level;
    }

    // Make sure we add a "../" for each component we removed from the root.
    return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
}
exports.relative = relative;

/**
 * 合并 *from* 和 *to*。
 * @param from 解析的基路径。
 * @param to 要解析的相对路径。
 * @returns 返回解析后的绝对路径。路径中固定以 `/` 作为分隔符。
 */
export function joinPath(from: string, to?: string) {
    return p.join(from, to || "").replace(/\\/g, "/");
}

var dataUrlRegexp = /^data:.+\,.+$/;

/**
 * 表示一个地址。
 */
export type Url = u.Url;

/**
 * 解析一个地址。
 * @param url 要解析的地址。
 * @return 返回已解析的地址。
 */
export function parseUrl(url: string) {
    return u.parse(url, false, false);
}

function urlGenerate(aParsedUrl) {
    var url = '';
    if (aParsedUrl.protocol) {
        url += aParsedUrl.protocol + ':';
    }
    url += '//';
    if (aParsedUrl.auth) {
        url += aParsedUrl.auth + '@';
    }
    if (aParsedUrl.host) {
        url += aParsedUrl.host;
    }
    if (aParsedUrl.port) {
        url += ":" + aParsedUrl.port
    }
    if (aParsedUrl.path) {
        url += aParsedUrl.path;
    }
    return url;
}
exports.urlGenerate = urlGenerate;

        it('encodeBase64Vlq', function () {
            assert.equal(utility.encodeBase64Vlq(0), "A");
            assert.equal(utility.encodeBase64Vlq(1), "C");
            assert.equal(utility.encodeBase64Vlq(2), "E");
            assert.equal(utility.encodeBase64Vlq(14), "c");
            assert.equal(utility.encodeBase64Vlq(6), "M");
            assert.equal(utility.encodeBase64Vlq(10000), "gxT");
        });
        it('decodeBase64Vlq', function () {
            assert.equal(utility.decodeBase64Vlq("A", { start: 0 }), 0);
            assert.equal(utility.decodeBase64Vlq("gxT", { start: 0 }), 10000);
            assert.equal(utility.decodeBase64Vlq("+/////B", { start: 0 }), 1073741823);
        });
/**
 * 判断指定的地址是否为绝对地址。
 * @param path 要判断的地址。
 * @returns 如果 *path* 是绝对地址则返回 true，否则返回 false。
 */
export function isAbsolute(path: string) {
    const ch0 = path.charCodeAt(0);
    if (ch0 === 47/*/*/ || ch0 === 92/*\*/) {
        return true;
    }
    const ch1 = path.charCodeAt(1);
    if (ch1 === 58/*:*/ && (ch0 >= 65/*A*/ && ch0 <= 90/*Z*/) || (ch0 >= 97/*a*/ && ch0 <= 122/*z*/)) {
        return true;
    }
    return false;
}



export function resolve(from: string, to?: string) {

    // 如果 to 是绝对路径，则忽略 from 的信息。
    const ch0 = to.charCodeAt(0);
    const ch1 = to.charCodeAt(1);
    if (ch0 === 47/*/*/ || ch0 === 92/*\*/) {
        if (ch1 !== 47/*/*/ && ch1 !== 92/*\*/) {
            const fch0 = from.charCodeAt(0);
            const fch1 = from.charCodeAt(1);
            if (fch1 === 58/*:*/ && (fch0 >= 65/*A*/ && fch0 <= 90/*Z*/) || (fch0 >= 97/*a*/ && fch0 <= 122/*z*/)) {
                return normalize(from.charAt(0) + to);
            }
        }
        return normalize(to);
    }
    if (ch1 === 58/*:*/ && ((ch0 >= 65/*A*/ && ch0 <= 90/*Z*/) || (ch0 >= 97/*a*/ && ch0 <= 122/*z*/))) {
        return normalize(to);
    }

    // to 是相对路径，之间连接。
    return normalize(from + '/' + to);
}


/**
 * 判断两个路径是相同。
 * @param x 要比较的第一个路径。
 * @param y 要比较的第二个路径。
 */
export function pathEquals(x: string, y: string) {
    return (x ? x.toLowerCase() : "") === (y ? y.toLowerCase() : "");
}


export function normalize(path: string) {
    let result: string;
    let prefix: string;
    for (let i = 0, left = 0; i <= path.length; i++) {
        switch (i < path.length ? path.charCodeAt(i) : 47/*/*/) {
            case 47/*/*/:
            case 92/*\*/:
                // 判断当前分隔符和上一个分隔符之间的点的个数。
                switch (i - left) {
                    case 0: // (空)
                        if (i === 0) {
                            prefix = "/";
                        } else if (i === 1) {
                            prefix = "//";
                        }
                        left = i + 1;
                        continue;
                    case 1: // .
                        if (path.charCodeAt(left) === 46/*.*/) {
                            left = i + 1;
                            continue;
                        }
                        break;
                    case 2: // ..
                        if (path.charCodeAt(left) === 46/*.*/ && path.charCodeAt(left + 1) === 46/*.*/) {
                            if (result) {
                                let j = result.length;
                                while (--j >= 0 && result.charCodeAt(j) !== 47/*/*/);
                                if (j) {
                                    result = result.substring(0, j);
                                }
                            }
                            left = i + 1;
                            continue;
                        }
                        break;
                }
                if (result) {
                    result += '/' + path.substring(left, i);
                } else {
                    result = path.substring(left, i);
                }
                left = i + 1;
        }
    }
    if (prefix) {
        result = prefix + result;
    }
    return result;
}




        it("A", function () {
            for (var i = 1000000; i--;) {
                utility.normalize("abc/./asd.jpg");
            }
        });
        var p = require("path");
        it("B", function () {
            for (var i = 1000000; i--;) {
                p.normalize("abc/./asd.jpg").replace(/\\/g, "/");
            }
        });
