var sqlite3 = require('sqlite3').verbose(); // API : https://github.com/mapbox/node-sqlite3/wiki

module.exports = function(app) {

	var _config = app.get("config");
	
	app.get('/member/list', function(req, res) {

		var db = new sqlite3.Database(_config.base.dbName);
		
		var sql_getMemberList =
			" select * from member "
			+ " where team_cd = $teamCd "
			+ " order by sort_num "
		;
		
		var param_getMemberList = {
			$teamCd : _config.base.teamCd
		};
		
		db.all(sql_getMemberList, param_getMemberList, function(err, row) {
			if (err) { console.log(err); }
			if (row) { console.log("# getMemberList 결과 : " + row.length); }
			
			res.render("layout.ejs", {
				headTitle: "Weekly - " + _config.base.teamCd,
				contTitle: "Members",
				contentEjs: "member",
				data: {
						mbrList: row
					}
			});
			
		});
		
		db.close();
		
	});
	
	app.post('/member/insert', function(req, res) {
		
		var db = new sqlite3.Database(_config.base.dbName);

		var sql_insertMember =
				" insert into member (team_cd, emp_no, name, level, sort_num) "
				+ " values ($teamCd, $empNo, $name, $level, $sortNum) ";
				
		var param_insertMember = {
			$teamCd: _config.base.teamCd,
			$empNo: req.body.empNo,
			$name: req.body.name,
			$level: "1",
			$sortNum: req.body.sortNum
		};
		
		db.run(sql_insertMember, param_insertMember, function(err, row) {
			if (err) { 
				console.log(err);
				res.json({ resCd: "FAILURE" });
				return false;
			}
			if (row) { console.log("# insertTask 결과 : " + row.length); }
			
			res.json({ resCd: "SUCCESS" });
		});
		
		db.close();
	});
	
	app.post('/member/update', function(req, res) {
		
		var db = new sqlite3.Database(_config.base.dbName);

		var sql_updateMember =
				" update member "
				+ " set name = $name, "
				+ "     sort_num = $sortNum "
				+ " where team_cd = $teamCd and emp_no = $empNo "
				;
				
		var param_updateMember = {
			$teamCd: _config.base.teamCd,
			$empNo: req.body.empNo,
			$name: req.body.name,
			$sortNum: req.body.sortNum
		};
		
		db.run(sql_updateMember, param_updateMember, function(err, row) {
			if (err) { 
				console.log(err);
				res.json({ resCd: "FAILURE" });
				return false;
			}
			if (row) { console.log("# updateMember 결과 : " + row.length); }
			
			res.json({ resCd: "SUCCESS" });
		});
		
		db.close();
	});
	
	app.post('/member/delete', function(req, res) {
		
		var db = new sqlite3.Database(_config.base.dbName);
		
		var sql_deleteMember = " delete from member where team_cd = $teamCd and emp_no = $empNo ";
		var param_deleteMember = {
			$teamCd: _config.base.teamCd,
			$empNo: req.body.empNo,
		};
		
		db.run(sql_deleteMember, param_deleteMember, function(err, row) {
			if (err) { console.log(err); }
			if (row) { console.log("# deleteMember 결과 : " + row.length); }
			
			res.json({ resCd: "SUCCESS" });
		});
		
		db.close();
	});
	
}


