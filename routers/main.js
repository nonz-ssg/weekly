module.exports = function(app) {

	var _config = app.get("config");
	
	app.get('/', function(req, res) {

		res.render("layout.ejs", {
			headTitle: "Weekly - " + _config.base.teamCd,
			contTitle: "Main",
			contentEjs: "main",
			data: {}
		});
		
	});
}
