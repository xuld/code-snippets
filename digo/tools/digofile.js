var digo = require("digo");

exports.default = function() {
    digo.readDir(".").forEach(dir => {
    	console.log(dir);
    	digo.exec("git status", {cwd: dir})
    	//digo.exec("digo --colors", {cwd: dir + "/test"})
    });
};
