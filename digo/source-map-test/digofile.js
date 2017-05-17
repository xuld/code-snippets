var digo = require("digo");
digo.sourceMap = true;

exports.default = function() {
    digo.src("c*.js").pipe("digo-concat", "source-map3.js").pipe("digo-typescript").dest(".");
    digo.src("c*.js").pipe("digo-typescript").pipe("digo-concat", "source-map2.js").dest(".");
};
