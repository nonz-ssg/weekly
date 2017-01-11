var sqlite3 = require('sqlite3').verbose(); // API : https://github.com/mapbox/node-sqlite3/wiki

module.exports = function(app) {

	var _config = app.get("config");
	
	app.get('/task/list', function(req, res) {

		var pageSize = 50;
		var page = 1;
		if (req.query.page) {
			if (!isNaN(req.query.page)) {
				page = req.query.page;
			} else {
				page = 1;
			}
		}
		
		var db = new sqlite3.Database(_config.base.dbName);
		
		var sql = "";
		sql += " select t.task_id, t.team_cd, t.emp_no, m.name, t.ymd_start, t.ymd_end, t.rm_num_01, t.rm_num_02, t.title, t.contents, t.task_stat_cd, t.task_priority, t.reg_id, t.reg_date, t.mod_id, t.mod_date ";
		sql += " from member m, task t ";
		sql += " indexed by idx_task_02 "; // index-hint
		sql += " where m.team_cd = $teamCd ";
		sql += " and m.team_cd = t.team_cd ";
		sql += " and m.emp_no = t.emp_no ";
		if (req.query.empNo) {
			sql += " and m.emp_no = $empNo ";
		}
		// sql += " order by mod_date desc "; // index 사용으로 제거
		sql += " limit $limit offset $offset ";
		
		var param = {};
		param["$teamCd"] = _config.base.teamCd;
		if (req.query.empNo) {
			param["$empNo"] = req.query.empNo;
		}
		param["$limit"] = pageSize;
		param["$offset"] = (page == 1 ? 0 : pageSize * (page-1));
		
		db.all(sql, param, function(err, row) {
			if (err) { console.log(err); }
			if (row) { console.log("# task-list 결과 : " + row.length); }
			
			var taskList = row;
			
			// ---------- ---------- ---------- ---------- ----------
			
			var sql_mbr = " select * from member where team_cd = $teamCd order by sort_num ";
			var param_mbr = { $teamCd : _config.base.teamCd };
			
			db.all(sql_mbr, param_mbr, function(err, row) {
				if (err) { console.log(err); }
				if (row) { console.log("# member-list 결과 : " + row.length); }
				
				var mbrList = row;
				
				res.render("layout.ejs", {
					headTitle: "Weekly - " + _config.base.teamCd,
					contTitle: "Tasks",
					contentEjs: "task",
					data: {
							taskList: taskList,
							mbrList: mbrList,
							page: page,
							pageSize: pageSize,
							empNo: req.query.empNo
						}
				});
				
			});
			
			db.close();
		});
		
	});
	
}