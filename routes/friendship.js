/**
 * Created by lang.xiao on 2016/9/1.
 */
var db = require("./connection");
var index = require("./index");
// 加载async 支持顺序执行
var async = require("async");
// 加载mysql-queues 支持事务
//var queues = require('mysql-queues');

module.exports = {
    invite : function(sql,param){
        var connection = db.connection();
            connection.query(sql,param,function(err,result){
                console.log(sql);
                console.log(param);
                if(err){
                    console.log('[query] - :'+err);
                }else{
                    console.log("邀请成功");
                }

                //调用邀请通知接口
            });
        db.end(connection);
    },
    agree : function(req,res,sql,params1,params2){
        var connection = db.connection();
        // function数组，需要执行的任务列表，每个function都有一个参数callback函数并且要调用
        var tasks = [function(callback) {
            // 开启事务
            connection.beginTransaction(function(err) {
                callback(err);
            });
        }, function(callback) {
            // 插入posts
            connection.query(sql,params1, function(err, result) {
                callback(err);
            });
        }, function(callback) {
            connection.query(sql,params2, function(err, result) {
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
                res.send({status:false});
            }else{
                console.log("添加好友成功");
                res.send({status:true});
            }
            connection.end();
        });
    },
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
                            return
                        }
                        callback(null, rows);
                    });
                }
            ],
            function(err, results){
                if(results[0].length == 0){
                    res.send({status:true,count:0,remark:"没有记录"});
                }else{
                    console.log("发送通讯录数据");
                    console.log("通讯录数量"+results[0].length);
                    res.send({status:true,count:1,data:results[0]});
                }
                var sql1 = "insert into " +
                    "his_tab_message(receive_id,message_type,create_time,message_mapping_id,his_create_time) " +
                    "select receive_id,message_type,create_time,message_mapping_id,UNIX_TIMESTAMP(NOW()) from tab_message " +
                    "where receive_id = ? and message_type in (1,2,3)";
                var sql2 = "DELETE FROM tab_message WHERE receive_id = ?  and message_type in (1,2,3) ";
                to_history(sql1,sql2,params);

            });
        db.end(connection);
    },
    addFriend : function (req,res,sql,params1,params2){
        var connection = db.connection();
        var flag =false;
        connection.query(sql,params1,function(err,result){
            console.log(sql);
            console.log(params1);
            if(err){
                console.log('[query] - :'+err);
                //res.send({status:false});
                db.end(connection);
                return false;
            }else{
                console.log('受影响的行数:',result.affectedRows);
                //res.send({status:true});
                var sql1 = "INSERT INTO his_tab_invite_info" +
                    "(invite_id,accept_id,group_id,group_name,comments,create_time,invite_status,invite_type,his_create_time) " +
                    "SELECT invite_id,accept_id,group_id,group_name,comments,create_time,1,invite_type,UNIX_TIMESTAMP(NOW()) from tab_invite_info" +
                    " WHERE invite_id =?  AND accept_id =? ";
                var sql2 = "DELETE FROM tab_invite_info WHERE invite_id =?  AND accept_id =?";
                to_history(sql1,sql2,params2);
                db.end(connection);
                return true;
            }
        });

    },
    toHistory :function (req,res,sql1,sql2,params){
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
                    console.log('移除数据个数:', result.affectedRows);
                }
                callback(err);
            });
        }, function(callback) {
            connection.query(sql2,params, function(err, result) {
                if(err){
                    console.log(err);
                }else{
                    console.log('移除数据个数:', result.affectedRows);
                }
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
    }

}

//数据移除到历史表
function to_history(sql1,sql2,params){
    var connection = db.connection();
    // function数组，需要执行的任务列表，每个function都有一个参数callback函数并且要调用
    var tasks = [function(callback) {
        // 开启事务
        connection.beginTransaction(function(err) {
            callback(err);
        });
    }, function(callback) {
        connection.query(sql1,params, function(err, result) {
            console.log('移除数据个数:', result.affectedRows);
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
}

