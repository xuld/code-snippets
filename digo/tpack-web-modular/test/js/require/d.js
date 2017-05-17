var c = require("./c.js");
require("../lib1/b.js", function(b) {
    b();
    c.func();
    alert("d");
});