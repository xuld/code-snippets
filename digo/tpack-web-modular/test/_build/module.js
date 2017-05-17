var assert = require("assert");
var tpack = require('tpack');
var BuildModule = require('../lib/module').BuildModule;

describe('BuildModule', function () {

    describe('依赖关系', function () {
        it('include', function () {
            var a = new BuildModule(tpack.createFile("a"));
            var b = new BuildModule(tpack.createFile("b"));
            var c = new BuildModule(tpack.createFile("c"));
            var d = new BuildModule(tpack.createFile("d"));

            a.include("", 0, b);
            a.include("", 0, c);
            c.include("", 0, d);

            assert.equal(a.hasIncluded(b), true);
            assert.equal(a.hasIncluded(c), true);
            assert.equal(a.hasIncluded(d), true);

            assert.equal(a.include("", 0, a), false);
            assert.equal(a.include("", 0, b), true);
            assert.equal(d.include("", 0, a), false);

        });

        it('require', function () {
            var a = new BuildModule(tpack.createFile("a"));
            var b = new BuildModule(tpack.createFile("b"));
            var c = new BuildModule(tpack.createFile("c"));
            var d = new BuildModule(tpack.createFile("d"));

            a.require("", 0, b);
            a.require("", 0, c);
            a.require("", 0, d);

            c.require("", 0, d);

            assert.deepEqual(a.getAllRequires().map(p), [b, d, c, a].map(p));

            function p(x) { return x.path };

        });

        it('external', function () {
            var a = new BuildModule(tpack.createFile("a"));
            var b = new BuildModule(tpack.createFile("b"));
            var c = new BuildModule(tpack.createFile("c"));
            var d = new BuildModule(tpack.createFile("d"));
            var e = new BuildModule(tpack.createFile("e"));
            var f = new BuildModule(tpack.createFile("f"));

            a.require("", 0, b);
            a.require("", 0, c);
            a.require("", 0, d);

            c.require("", 0, d);

            d.require("", 0, e);
            d.external("", 0, f);

            a.external("", 0, d);

            assert.deepEqual(a.getAllExternals().map(p), [d, e, f].map(p));
            assert.deepEqual(a.getAllRequires().map(p), [b, c, a].map(p));

            function p(x) { return x.path };

        });

    });

    describe("解析宏", function () {

        it('resolveMacro', function () {
            var a = new BuildModule(tpack.createFile("a"), {
                define: {
                    A: true,
                    B: 1,
                    C: "C",
                    D: false,
                    "中文": true
                }
            });

            assert.equal(a.resolveMacro("", 0, "A"), true);
            assert.equal(a.resolveMacro("", 0, "B"), 1);
            assert.equal(a.resolveMacro("", 0, "C"), "C");
            assert.equal(a.resolveMacro("", 0, "D"), false);

            assert.equal(a.resolveMacro("", 0, "A && D"), false);
            assert.equal(a.resolveMacro("", 0, "A || D"), true);
            assert.equal(a.resolveMacro("", 0, "B > 0"), true);
            assert.equal(a.resolveMacro("", 0, "B < 0"), false);
            assert.equal(a.resolveMacro("", 0, "A && (B >= 1)"), true);

            assert.equal(a.resolveMacro("", 0, "中文"), true);

        });

    });

});
