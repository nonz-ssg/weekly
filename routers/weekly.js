var sqlite3 = require('sqlite3').verbose(); // API : https://github.com/mapbox/node-sqlite3/wiki

module.exports = function(app) {

	var _config = app.get("config");
	
	app.get('/weekly', function(req, res) {

		var ymd = f조회시작과끝날짜().ymd;
		if (req.query.ymd) {
			ymd = req.query.ymd;
		}
		
		var _지난주기간 = f조회시작과끝날짜(ymd, -7);
		var _이번주기간 = f조회시작과끝날짜(ymd);
		var _다음주기간 = f조회시작과끝날짜(ymd, 7);
		
		var db = new sqlite3.Database(_config.base.dbName);
		
		db.serialize(function() { // CHECK // 왜 썼더라? 트랜잭션?
			
			// 결과 데이터가 map 형태로 정리된 
			var taskMap = {};
			
			var sql_getMemberList = " select * from member where team_cd = $teamCd order by sort_num ";
			var param_getMemberList = {
				$teamCd : _config.base.teamCd
			};
			
			db.all(sql_getMemberList, param_getMemberList, function(err, row) {
				if (err) { console.log(err); }
				if (row) { console.log("# getMemberList 결과 : " + row.length); }
				
				var mbrList = row;
				
				// 노출 데이터 구조 뼈대를 생성
				for (var i=0; i<mbrList.length; i++) {
					var mbr = mbrList[i];
					
					taskMap[mbr.emp_no] = {
						prev_done: new Array(), prev_ing: new Array(), prev_time: new Array(),
						now_done: new Array(), now_ing: new Array(), now_time: new Array(),
						next_done: new Array(), next_ing: new Array(), next_time: new Array()
					};
				}
				
				var sql_getTaskList = ""
					+ " select * from task "
					+ " indexed by idx_task_01 " // index-hint
					+ " where team_cd = $teamCd "
					+ " and ( ymd_start between $ymdStart and $ymdEnd "
					+ "       or ymd_end between $ymdStart and $ymdEnd "
					+ "       or (ymd_start < $ymdStart and ymd_end > $ymdEnd) " // 기간내 포함여부 조건
					+ "       or (ymd_start is null or ymd_start = '' or ymd_end is null or ymd_end = '') ) " // 시작/종료일이 없는 경우
					+ " and task_stat_cd not in ('30') " // 30(감춤) 제외
					+ " order by task_priority desc, ymd_end asc "
					+ " limit 5000 "
				;
				
				var param_getTaskList = {
					$teamCd : _config.base.teamCd,
					$ymdStart : _지난주기간.startYmd.replace(/-/gi, ""),
					$ymdEnd : _다음주기간.endYmd.replace(/-/gi, "")
				};
				
				db.all(sql_getTaskList, param_getTaskList, function(err, row) {
					if (err) { console.log(err); }
					if (row) { console.log("# getTaskList 결과 : " + row.length); }
					
					var taskList = row;

					for (var i=0; i<taskList.length; i++) {
						var task = taskList[i];

						if (!taskMap[task.emp_no]) {
							console.log("# (taskList) not in member data : " + task.emp_no);
							continue;
						}

						// 이번주 대기
						if ((!(task.ymd_start) || !(task.ymd_end))
								&& (Number(formatLocalDate().replace(/-/gi, "")) <= Number(_이번주기간.ymd.replace(/-/gi, "")))
								) {
							taskMap[task.emp_no].now_time.push(task);
						} else {
						
							// 지난주 완료
							if (Number(_지난주기간.startYmd.replace(/-/gi, "")) <= Number(task.ymd_end)
									&& Number(_지난주기간.endYmd.replace(/-/gi, "")) >= Number(task.ymd_end)) {
								taskMap[task.emp_no].prev_done.push(task);
							// 지난주 진행 : 지난주토요일 < 일종료일 && 지난주토요일 >= 일시작
							} else if (Number(_지난주기간.endYmd.replace(/-/gi, "")) < Number(task.ymd_end)
									&& Number(_지난주기간.endYmd.replace(/-/gi, "")) >= Number(task.ymd_start)) {
								taskMap[task.emp_no].prev_ing.push(task);
							}
							
							// 이번주 완료
							if (Number(_이번주기간.startYmd.replace(/-/gi, "")) <= Number(task.ymd_end)
									&& Number(_이번주기간.endYmd.replace(/-/gi, "")) >= Number(task.ymd_end)) {
								taskMap[task.emp_no].now_done.push(task);
							// 이번주 진행
							} else if (Number(_이번주기간.endYmd.replace(/-/gi, "")) < Number(task.ymd_end)
									&& Number(_이번주기간.endYmd.replace(/-/gi, "")) >= Number(task.ymd_start)) {
								taskMap[task.emp_no].now_ing.push(task);
							} 
							
							// 다음주 완료
							if (Number(_다음주기간.startYmd.replace(/-/gi, "")) <= Number(task.ymd_end)
									&& Number(_다음주기간.endYmd.replace(/-/gi, "")) >= Number(task.ymd_end)) {
								taskMap[task.emp_no].next_done.push(task);
							// 다음주 진행
							} else if (Number(_다음주기간.endYmd.replace(/-/gi, "")) < Number(task.ymd_end)) {
								taskMap[task.emp_no].next_ing.push(task);
							}
							
						}
						
					}
					
					res.render("layout.ejs", {
						headTitle: "Weekly - " + _config.base.teamCd,
						contTitle: "Weekly",
						contentEjs: "weekly",
						data: {
								ymd: ymd,
								termPrev: _지난주기간,
								termNow: _이번주기간, 
								termNext: _다음주기간,
								mbrList: mbrList,
								taskList: taskList,
								taskMap: taskMap
							}
					});
					
				});
				
				db.close();
			});
		});
		
	});
	
	
	
	app.post('/task-get', function(req, res) {
		
		var db = new sqlite3.Database(_config.base.dbName);
		
		var sql_getTask = " select * from task where task_id = $taskId ";
		var param_getTask = { $taskId: req.body.taskId };
	
		db.get(sql_getTask, param_getTask, function(err, row) {
			if (err) { 
				console.log(err);
				res.json({ resCd: "FAILURE" });
				return false;
			}
			if (row) { console.log("# getTask 결과 : " + row.length); }
			
			res.json({ resCd: "SUCCESS", resData: row });
		});
		
		db.close();
	});
	
	
	
	app.post('/task-insert', function(req, res) {
		
		var db = new sqlite3.Database(_config.base.dbName);

		var sql_insertTask = ""
				+ " insert into task (task_id, team_cd, emp_no, ymd_start, ymd_end, rm_num_01, rm_num_02, title, contents, task_stat_cd, task_priority, reg_id, reg_date, mod_id, mod_date) "
				+ " values (null, $teamCd, $empNo, $ymdStart, $ymdEnd, $rmNum01, $rmNum02, $title, $contents, $taskStatCd, $taskPriority, $regId, datetime('now', 'localtime'), $modId, datetime('now', 'localtime')) ";
				
		// CHECK // 마지막 seq 가져오는 func 존재
		
		var param_insertTask = {
			$teamCd: _config.base.teamCd,
			$empNo: req.body.empNo,
			$ymdStart: req.body.ymdStart.replace(/-/gi, ""),
			$ymdEnd: req.body.ymdEnd.replace(/-/gi, ""),
			$rmNum01: req.body.rmNum01,
			$rmNum02: req.body.rmNum02,
			$title: req.body.title,
			$contents: req.body.contents,
			$taskStatCd: req.body.taskStatCd,
			$taskPriority: req.body.taskPriority,
			$regId: req.body.regId,
			$modId: req.body.modId
		};
		
		db.run(sql_insertTask, param_insertTask, function(err, row) {
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
	
	
	
	app.post('/task-update', function(req, res) {
		
		var db = new sqlite3.Database(_config.base.dbName);

		// NOTE // nvl() 대신 coalesce() 사용 가능할지도...

		var sql_updateTask = "";
		sql_updateTask += " update task ";
		sql_updateTask += " set ymd_start = $ymdStart ";
		sql_updateTask += "   , ymd_end = $ymdEnd "; 
		sql_updateTask += "   , rm_num_01 = $rmNum01 ";
		sql_updateTask += "   , rm_num_02 = $rmNum02 ";
		sql_updateTask += "   , title = $title ";
		sql_updateTask += "   , contents = $contents ";
		sql_updateTask += "   , task_stat_cd = $taskStatCd ";
		sql_updateTask += "   , task_priority = $taskPriority ";
		sql_updateTask += "   , mod_id = $modId ";
		sql_updateTask += "   , mod_date = datetime('now', 'localtime') ";
		sql_updateTask += " where task_id = $taskId ";
		
		var param_updateTask = {
			$taskId: req.body.taskId, // update pk
			// $teamCd: req.body.teamCd,
			// $empNo: req.body.empNo,
			$ymdStart: req.body.ymdStart.replace(/-/gi, ""),
			$ymdEnd: req.body.ymdEnd.replace(/-/gi, ""),
			$rmNum01: req.body.rmNum01,
			$rmNum02: req.body.rmNum02,
			$title: req.body.title,
			$contents: req.body.contents,
			$taskStatCd: req.body.taskStatCd,
			$taskPriority: req.body.taskPriority,
			// $regId: req.body.regId,
			$modId: req.body.modId
		};

		db.run(sql_updateTask, param_updateTask, function(err, row) {
			if (err) { 
				console.log(err);
				res.json({ resCd: "FAILURE" });
				return false;
			}
			if (row) { console.log("# updateTask 결과 : " + row.length); }
			
			res.json({ resCd: "SUCCESS" });
		});
		
		db.close();
	}); // ~/task-update
	
	
	
	app.post('/task-delete', function(req, res) {
		
		var db = new sqlite3.Database(_config.base.dbName);
		
		var sql_deleteTask = " delete from task where task_id = $taskId ";
		var param_deleteTask = {
			$taskId: req.body.taskId
		};
		
		db.run(sql_deleteTask, param_deleteTask, function(err, row) {
			if (err) { console.log(err); }
			if (row) { console.log("# deleteTask 결과 : " + row.length); }
			
			res.json({ resCd: "SUCCESS" });
		});
		
		db.close();
	}); // ~/task-delete
	
	
	
	app.get('/gantt', function(req, res) {
		
		var ymd = f조회시작과끝날짜().ymd;
		if (req.query.ymd) {
			ymd = req.query.ymd;
		}
		
		var empNo = "";
		if (req.query.empNo) {
			empNo = req.query.empNo;
		}
		
		var dateList = null;
		if (req.query.startDate && req.query.endDate) {
			dateList = f몇일전후날짜리스트(ymd, f두날짜의일수차이(req.query.startDate, ymd), f두날짜의일수차이(req.query.endDate, ymd));
		}
		
		if (!dateList || dateList.length < 1) {
			dateList = f몇일전후날짜리스트(ymd, -20, 60); // 기본값
		}
		
		var startDate = dateList[0].ymd;
        var endDate = dateList[dateList.length-1].ymd;
		
		var db = new sqlite3.Database(_config.base.dbName);
		
		db.serialize(function() { // CHECK // 왜 썼더라? 트랜잭션?
			
			var sql_getMemberList = " select * from member where team_cd = $teamCd order by sort_num ";
			var param_getMemberList = {
				$teamCd : _config.base.teamCd
			};
			
			db.all(sql_getMemberList, param_getMemberList, function(err, row) {
				if (err) { console.log(err); }
				if (row) { console.log("# getMemberList 결과 : " + row.length); }
				
				var mbrList = row;
				var mbrMap = {};				
				for (var i=0; i<mbrList.length; i++) {
					var mbr = mbrList[i];
					mbrMap[mbr.emp_no] = mbr;
				}
				
				var sql_getTaskList = ""
					+ " select * from task "
					+ " indexed by idx_task_01 " // index-hint // CHECK // 인덱스 체크필요
					+ " where team_cd = $teamCd "
					+ " and ($empNo = '' or emp_no = $empNo) "
					+ " and (ymd_start != '' and ymd_end != '') "
					+ " and ( ymd_start between $ymdStart and $ymdEnd "
					+ "       or ymd_end between $ymdStart and $ymdEnd "
					+ "       or (ymd_start < $ymdStart and ymd_end > $ymdEnd) " // 기간내 포함여부 조건
					+ " ) "
					+ " order by ymd_end asc "
					+ " limit 5000 "
				;
				
				var param_getTaskList = {
					$teamCd : _config.base.teamCd,
					$empNo : empNo,
					$ymdStart : startDate.replace(/-/gi, ""),
					$ymdEnd : endDate.replace(/-/gi, "")
				};
				
				db.all(sql_getTaskList, param_getTaskList, function(err, row) {
					if (err) { console.log(err); }
					if (row) { console.log("# getTaskList 결과 : " + row.length); }
					
					var taskList = row;

					res.render("layout.ejs", {
						headTitle: "Weekly - " + _config.base.teamCd,
						contTitle: "Gantt",
						contentEjs: "gantt",
						data: {
								ymd: ymd,
								mbrList: mbrList,
								mbrMap: mbrMap,
								empNo: empNo,
								startDate: startDate,
								endDate: endDate,
								dateList: dateList,
								taskList: taskList
							}
					});
					
				});
				
				db.close();
			});
		});
		
		
	});
	
	
	
	/*
	 * 한주의 일요일과 토요일의 일자를 yyyy-mm-dd 형태로 return
	 */
	function f조회시작과끝날짜(inYmd, addDay) {
		var _기준일자 = new Date();
		if (inYmd) {
			_기준일자 = new Date(inYmd);
		}
		if (addDay) {
			_기준일자.setDate(_기준일자.getDate() + addDay); 
		}
		
		var _요일번호 = _기준일자.getDay();
		var _감소일수 = 0;
		var _증가일수 = 0;
		
		// config.json에 정의된 주의 시작, 끝일로 한주의 기간 세팅
		if (_요일번호 < _config.base.weekPeriod.start) {
			_감소일수 = _요일번호 + _config.base.weekPeriod.end; 
			_증가일수 = _config.base.weekPeriod.end - _요일번호;
		} else {
			_감소일수 = _요일번호 - _config.base.weekPeriod.start ;
			_증가일수 = (6 - _요일번호) + _config.base.weekPeriod.start;
		}
		
		var _시작일자 = new Date(_기준일자);
		_시작일자.setDate(_시작일자.getDate() - _감소일수); 
		
		// 주의 마지막 날
		var _끝일자 = new Date(_기준일자);
		_끝일자.setDate(_끝일자.getDate() + _증가일수);
		
		return {
			ymd: formatLocalDate(_기준일자),
			startYmd: formatLocalDate(_시작일자),
			endYmd: formatLocalDate(_끝일자),
			termStr: formatLocalDate(_시작일자).substring(5, 10).replace(/-/gi, "/") + " ~ " + formatLocalDate(_끝일자).substring(5, 10).replace(/-/gi, "/") // (ex) 10/01 ~ 10/02
		}
	}

	/*
	 * Date 객체를 yyyy-mm-dd 형태의 문자열로 return
	 */
	function formatLocalDate(dateObj) {
	    var now = dateObj;
	    if (!now) { now = new Date(); }
	    
	    var tzo = -now.getTimezoneOffset(),
	        dif = tzo >= 0 ? '+' : '-',
	        pad = function(num) {
	            var norm = Math.abs(Math.floor(num));
	            return (norm < 10 ? '0' : '') + norm;
	        };
	    return now.getFullYear() 
	        + '-' + pad(now.getMonth()+1)
	        + '-' + pad(now.getDate());
	        /*
	        + 'T' + pad(now.getHours())
	        + ':' + pad(now.getMinutes()) 
	        + ':' + pad(now.getSeconds()) 
	        + dif + pad(tzo / 60) 
	        + ':' + pad(tzo % 60);
	        */
	}
	
	/*
	 * 기준일자 기준으로 몇일전부터 몇일후까지의 일자 리스트를 객체로 return
	 */
	function f몇일전후날짜리스트(_기준일자, _몇일전, _몇일후) {
		
		var dateList = [];
		var date;
		for (var i=_몇일전; i<=_몇일후; i++) {
			date = new Date(_기준일자);
			date.setDate(date.getDate() + i);
			dateList.push({ date: date, ymd: formatLocalDate(date), day: date.getDay() });
		}
		date = null;
		
		return dateList;
	}
	
	/*
	 * 두 날짜간(yyyy-mm-dd)의 차이나는 일수 return
	 */
	function f두날짜의일수차이(_날짜1, _날짜2) {
		var getDiffTime = (new Date(_날짜1)).getTime() - (new Date(_날짜2)).getTime();
		return Math.floor(getDiffTime / (1000 * 60 * 60 * 24));
	}
	
}
