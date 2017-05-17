__tpack__.define("b.js", function (require, exports, module) {
    module.exports = "b";
});

__tpack__.define(function (require, exports, module) {
    console.log("a");
    console.log(require("./b.js"));
});