/*var express = require('express');
 var router = express.Router();

 /!* GET home page. *!/
 router.get('/', function(req, res, next) {
 res.render('index', { title: 'Express' });
 });

 module.exports = router;*/
var db = require("./connection");
var async = require("async");
module.exports = {
    //只有一个sql语句的公用方法(select)
    find : function(req,res,sql,params){
        var connection = db.connection();
        async.parallel([
                function(callback){
                    connection.query(sql,params,function(err,rows,fields){
                        console.log(sql);
                        console.log(params);
                        if(err){
                            console.log('[query] - :'+err);
                            res.send({status:false,remark:err});
                        }
                        callback(err, rows);
                    });
                }
            ],
            function(err, results){
                if(err){

                }else{
                    if(results[0].length == 0){
                        res.send({status:true,count:0,remark:"没有记录"});
                    }else{
                        console.log("记录个数"+results[0].length);
                        res.send({status:true,count:1,data:results[0]});
                    }
                }

            });
        db.end(connection);
    },
    //只有一个insert语句且不做后续操作的公共sql语句
    insert : function (req,res,sql,params){
        var connection = db.connection();
        connection.query(sql,params,function(err,result){
            console.log(sql);
            console.log(params);
            if(err){
                console.log('[query] - :'+err);
                res.send({status:false});
            }else{
                console.log('受影响的行数:',result.affectedRows);
                res.send({status:true});
            }
        });
        db.end(connection);
    },
    //只有一个update语句的sql
    update : function(req,res,sql, params) {
        var connection = db.connection();
        connection.query(sql, params, function (err, result) {
            console.log(sql);
            console.log(params);
            if (err) {
                console.log('[query] - :' + err);
                res.send({status: false});
                return;
            } else {
                console.log('受影响的行数:', result.affectedRows);
                res.send({status: true});
                return;
            }
        });
        db.end(connection);
    },

    //只有一个update语句的sql(无send)
    updateNoSend : function(req,res,sql, params) {
        var connection = db.connection();
        connection.query(sql, params, function (err, result) {
            console.log(sql);
            console.log(params);
            if (err) {
                console.log('[query] - :' + err);
                return;
            } else {
                console.log('受影响的行数:', result.affectedRows);
                return;
            }
        });
        db.end(connection);
    },
    toHistory :function (sql1,sql2,params){
        var connection = db.connection();
        // function数组，需要执行的任务列表，每个function都有一个参数callback函数并且要调用
        var tasks = [function(callback) {
            // 开启事务
            connection.beginTransaction(function(err) {
                callback(err);
            });
        }, function(callback) {
            connection.query(sql1,params, function(err, result) {
                if(err){
                    console.log(err);
                }else{
                    console.log('移除数据个数:'+result.affectedRows);
                }
                callback(err);
            });
        }, function(callback) {
            connection.query(sql2,params, function(err, result) {
                callback(err);
            });
        }, function(callback) {
            // 提交事务
            connection.commit(function(err) {
                callback(err);
            });
        }];

        async.series(tasks, function(err, results) {
            if(err) {
                console.log(err);
                connection.rollback(); // 发生错误事务回滚
                //res.send({status:false});
            }else{
                console.log("移除消息到历史表成功！");
                //res.send({status:true});
            }
            connection.end();
        });
    },

    //通知群成员有新的成员加入(退出)（群主变更就要通知本人）
    updateMember: function (receive_id,groupId,userId,message_type){
        console.log(groupId+"****"+userId);
        var params2 = new Array();
        var sql2 = "INSERT INTO tab_message(receive_id,message_type,create_time,group_id,message_mapping_id) VALUES (?,?,?,?,?)";
        params2.push(receive_id);
        params2.push(message_type);
        params2.push(Date.parse(new Date())/1000);
        params2.push(groupId);
        params2.push(userId);

        var connection = db.connection();
        var tasks = [function(callback) {
            connection.beginTransaction(function(err) {
                callback(err);
            });
        }, function(callback) {
            connection.query(sql2, params2, function(err, result) {
                if(err){
                    console.log("插入tab_message表失败");
                }else{
                    console.log("插入tab_message表成功");
                }
                callback(err);
            });
        }, function(callback) {
            connection.commit(function(err) {
                callback(err);
            });
        }];

        async.waterfall(tasks, function(err, results) {
            if(err) {
                console.log(err);
                console.log("发生错误事务回滚");
                connection.rollback(); // 发生错误事务回滚

            }
            connection.end();
        });
    }


}


