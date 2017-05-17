__tpack__.define("f.js", function (require, exports, module) {
    module.exports = "f";
});

__tpack__.define(function (require, exports, module) {
    exports.e = function () {
        console.log("e");
    };
    exports.f = require("./f.js");
});