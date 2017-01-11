var express = require("express");
var app = express();

var bodyParser = require("body-parser");			// POST 파라미터 파싱
app.use(bodyParser.json());							// support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));	// support encoded bodies

app.use(express.static("public"));
app.engine("html", require("ejs").renderFile);

var config = require("./config.json");
app.set("config", config);

require("./routers/main")(app);
require("./routers/weekly")(app);
require("./routers/task")(app);
require("./routers/member")(app);

var schedule = require("node-schedule");
var fs = require("fs");

// db back-up
schedule.scheduleJob("5 5 * * *", function() {
	console.log("# backup-db start");
	var in_file = fs.createReadStream("./" + config.base.dbName, { flags: "r" } );
	var out_file = fs.createWriteStream("./backup/" + (new Date()).getDay() + "_" + config.base.dbName, { flags: "w" });
	in_file.pipe(out_file);
	console.log("# backup-db end");
});

app.listen(config.base.listenPort, function () {
	console.log(config.base.appName + " app listening on port " + config.base.listenPort);
});