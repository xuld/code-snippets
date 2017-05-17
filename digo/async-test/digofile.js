var digo = require("digo");

exports.default = function () {
	digo.config({
    filter: digo.displayRoot
});
    digo.src("./src").dest("./tmp1");
    digo.then(function () {
        digo.src("./tmp1").dest("./tmp2");
    });
    digo.then(function () {
        digo.src("./tmp2").dest("./dist");
    });
};
