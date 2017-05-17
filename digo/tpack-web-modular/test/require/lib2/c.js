__tpack__.define(function (require, exports, module) {
    console.log("c");
    require(["d.js", "lib3/e.js"], function (d, e) {
        console.log(d);
        e.e();
        console.log(e.f);
    });
});