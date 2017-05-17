var tpack = require("tpack");

tpack.srcPath = "src";
tpack.destPath = "lib";

tpack.sourceMap = true;

tpack.src("*.ts").ignore("*.d.ts").pipe(tpack.plugin("tpack-typescript"));
