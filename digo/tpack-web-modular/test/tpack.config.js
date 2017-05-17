var tpack = require("tpack");
tpack.destPath = "_build";
tpack.sourceMap = true;

tpack.src("*.js").pipe(require("../"));