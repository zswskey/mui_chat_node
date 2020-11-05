/**
 * Created by lang.xiao on 2016/9/11.
 */
var db = require("./connection"),
    index = require("./index.js");
var async = require("async");
module.exports = {

    //新建群
    newGroup : function (req, res, sql1,sql2, group_name,manager_id,group_comment,create_time,user_name){
        var connection = db.connection();
        var tasks = [function(callback) {
            connection.beginTransaction(function(err) {
                callback(err);
            });
        }, function(callback) {
            var params1 = [group_name,manager_id,group_comment,create_time];
            connection.query(sql1,params1, function(err, result) {
                if(err){
                    console.log(err);
                    var groupid = null;
                    callback(err,groupid); // 生成的ID会传给下一个任务
                }else{
                    var groupid = result.insertId;
                    console.log("创建群成功");
                    callback(err,groupid); // 生成的ID会传给下一个任务
                }
            });
        }, function(groupid, callback) {
            // 接收到上一条任务生成的ID
            var params2 = [manager_id,user_name,groupid,create_time];
            connection.query(sql2, params2, function(err, result) {
                if(err){
                    console.log(err);
                }else{
                    console.log("添加成员成功");
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
                //console.log(err);
                console.log("发生错误事务回滚");
                connection.rollback(); // 发生错误事务回滚
                res.send({status:false});
            }else{
                res.send({status:true});
            }
            connection.end();
        });
    },
    //添加新的成员，并返回群成员信息
    insert : function (req,res,sql,sql1,params,group_id,accept_id){
        var connection = db.connection();
        //查询是否已在群中
        var rememberIsInGroup_sql = "SELECT COUNT(1) as count from tab_group_member WHERE group_id = ? AND user_id = ? AND status = 1";
        var rememberIsInGroup_params =[group_id,accept_id];
        var conn=db.connection();
        conn.query(rememberIsInGroup_sql,rememberIsInGroup_params, function(err, result) {
            if(err){
                res.send({status:false,remark:err});
            }else{
                if(result[0].count > 0){
                    console.log("用户"+accept_id+"已经加入过该群");
                    connection.query(sql1,group_id, function(err, result) {
                        if(err){
                            console.log("获取群成员信息失败!");
                            res.send({status:false,remark:err});
                        }else{
                            //获取群信息
                            var select_group ="SELECT group_id,group_name,group_comment,manager_id FROM tab_group WHERE " +
                                "group_id = ? ";
                            var conn2 = db.connection();
                            conn2.query(select_group,group_id,function(err,rows,fields) {
                                console.log(select_group);
                                console.log(group_id);
                                if (err) {
                                    console.log("获取群信息失败!");
                                    console.log('[query] - :' + err);
                                    res.send({status:false,remark:err});
                                }else{
                                    res.send({status:true,group:rows[0],data:result});
                                    //移除对应的邀请信息到历史表（可能没有这条邀请信息）
                                    var toHistorySQL = "INSERT INTO his_tab_invite_info" +
                                        "(invite_id,accept_id,group_id,group_name,comments,create_time,invite_status,invite_type,his_create_time) " +
                                        "SELECT invite_id,accept_id,group_id,group_name,comments,create_time,1,invite_type,UNIX_TIMESTAMP(NOW()) from tab_invite_info" +
                                        " WHERE accept_id =?  AND group_id=?";
                                    var sql2 = "DELETE FROM tab_invite_info WHERE accept_id =? AND group_id=?";
                                    var params2 = [accept_id,group_id];
                                    index.toHistory(req,res,toHistorySQL,sql2,params2);
                                }
                            });
                            console.log("获取群成员信息成功!");
                            conn2.end();
                        }
                    });
                    connection.end();
                }else{
                    // function数组，需要执行的任务列表，每个function都有一个参数callback函数并且要调用
                    var tasks = [function(callback) {
                        // 开启事务
                        connection.beginTransaction(function(err) {
                            callback(err);
                        });
                    }, function(callback) {
                        connection.query(sql,params, function(err, result) {
                            console.log(sql);
                            console.log(params);
                            if(err){
                                console.log("加入群失败!");
                            }else{
                                console.log("加入群成功!");
                            }
                            callback(err);
                        });
                    }, function(callback) {
                        connection.query(sql1,group_id, function(err, result) {
                            if(err){
                                console.log("获取群成员信息失败!");
                            }else{
                                //获取群信息
                                var select_group ="SELECT group_id,group_name,group_comment,manager_id FROM tab_group WHERE " +
                                    "group_id = ? ";
                                connection.query(select_group,group_id,function(err,rows,fields) {
                                    console.log(select_group);
                                    console.log(params);
                                    if (err) {
                                        console.log("获取群信息失败!");
                                        console.log('[query] - :' + err);
                                        // res.send({status:false,remark:err});
                                    }else{
                                        res.send({status:true,group:rows[0],data:result});
                                    }
                                });
                                console.log("获取群成员信息成功!");
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
                            console.log("发生错误事务回滚");
                            connection.rollback(); // 发生错误事务回滚
                            res.send({status:false,remark:err});
                        }else{
                            //移除对应的邀请信息到历史表（可能没有这条邀请信息）
                            var toHistorySQL = "INSERT INTO his_tab_invite_info" +
                                "(invite_id,accept_id,group_id,group_name,comments,create_time,invite_status,invite_type,his_create_time) " +
                                "SELECT invite_id,accept_id,group_id,group_name,comments,create_time,1,invite_type,UNIX_TIMESTAMP(NOW()) from tab_invite_info" +
                                " WHERE accept_id =?  AND group_id=?";
                            var sql2 = "DELETE FROM tab_invite_info WHERE accept_id =? AND group_id=?";
                            var params2 = [accept_id,group_id];
                            index.toHistory(req,res,toHistorySQL,sql2,params2);
                            //通知群其他成员有新成员加入
                            var message_type = 5;
                            updateMember(group_id,accept_id,message_type);
                        }
                        connection.end();
                    });
                }
            }
        });
        conn.end();
    },
    quit : function(req,res,sql,quit_time,group_id,userId) {
        var connection = db.connection();
        var params = [quit_time,group_id,userId];
        connection.query(sql, params, function (err, result) {
            console.log(sql);
            console.log(params);
            if (err) {
                console.log('[query] - :' + err);
                res.send({status: false});
            } else {
                console.log('受影响的行数:', result.affectedRows);
                console.log("退群成功!");
                res.send({status: true});
                //通知群其他成员有人退群
                var message_type = 4;
                updateMember(group_id,userId,message_type);
            }
        });
        db.end(connection);
    },
    managerQuit : function(req,res,sql,quit_time,group_id,userId) {
        var connection = db.connection();
        var params = [quit_time,group_id,userId];
        connection.query(sql, params, function (err, result) {
            console.log(sql);
            console.log(params);
            if (err) {
                console.log('[query] - :' + err);
                res.send({status: false});
            } else {
                console.log('受影响的行数:', result.affectedRows);
                console.log("退群成功!");
                res.send({status: true});
                //通知群其他成员有人退群
                var message_type1 = 4;
                updateMember(group_id,userId,message_type1);
                //更换群主，同时通知所有群成员
                //查询群的人数(人数为0，删除该群，人数大于O,更换群主并通知，群成员)
                var count_group_sql = "SELECT count(1) as count FROM tab_group_member WHERE group_id = ? AND status = 1";
                var count_group_param = [group_id];
                var connection = db.connection();
                connection.query(count_group_sql, count_group_param, function (err, result) {
                    if(err){
                        console.log(err);
                    }else{
                        console.log(result[0].count);
                        if(result[0].count == 0 ){
                            //删除群
                            var delete_group_sql = "DELETE FROM tab_group WHERE group_id = ?";
                            var delete_group_param = [group_id];
                            connection.query(delete_group_sql, delete_group_param, function (err, result) {
                                if(err){
                                    console.log("删除群失败"+err);
                                }
                            });
                        }else{
                            //更换群主，并通知其他人
                            updateManager(group_id);
                        }
                    }
                });
            }
        });
        db.end(connection);
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
                            //res.send({status:false,remark:err});
                        }
                        callback(err, rows);
                    });
                },
                function(callback){
                    var select_group ="SELECT group_id,group_name,group_comment,manager_id FROM tab_group WHERE " +
                        "group_id in (SELECT t.group_id from tab_group_member t WHERE t.user_id = ? AND t.status = 1 GROUP BY t.group_id) ";
                    connection.query(select_group,params,function(err,rows,fields){
                        console.log(select_group);
                        console.log(params);
                        if(err){
                            console.log('[query] - :'+err);
                           // res.send({status:false,remark:err});
                        }
                        callback(err, rows);
                    });
                }
            ],
            function(err, results){
                if(err){
                    console.log("发生错误");
                    res.send({status:false,remark:err});
                }else{

                    if(results[0].length == 0){
                        console.log("没有记录");
                        res.send({status:true,count:0,remark:"没有记录"});
                    }else{
                        //处理数据
                        for(var a in results[1]){
                            var groupId = results[1][a].group_id;
                            var dataArr = new Array();
                            console.log(groupId);
                            for(var b in results[0]){
                                if(groupId == results[0][b].group_id){
                                    dataArr.push(results[0][b]);
                                }
                            }
                            //results[1][a].pop(arr);
                            results[1][a].group_member = dataArr;
                            console.log(results[1][a]);
                        }
                        console.log(results[1]);
                        res.send({status:true,count:1,data:results[1]});
                    }
                }

                var sql1 = "insert into " +
                    "his_tab_message(receive_id,message_type,create_time,message_mapping_id,group_id,his_create_time) " +
                    "select receive_id,message_type,create_time,message_mapping_id,group_id,UNIX_TIMESTAMP(NOW()) from tab_message " +
                    "where receive_id = ? and message_type in (4,5,6)";
                var sql2 = "DELETE FROM tab_message WHERE receive_id = ? and message_type in (4,5,6)";
                to_history(sql1,sql2,params);
            });
        db.end(connection);
    },
    invite : function (sql,params){
        var connection = db.connection();
        connection.query(sql,params,function(err,result){
            console.log(sql);
            console.log(params);
            if(err){
                console.log('[query] - :'+err);
                //res.send({status:false});
            }else{
                console.log('受影响的行数:',result.affectedRows);
                //res.send({status:true});
            }
        });
        db.end(connection);
    },

}

//通知群成员有新的成员加入(退出)（群主变更就要通知本人）
function updateMember(groupId,userId,message_type){
    console.log(groupId+"****"+userId);
    //查询群组所有在群成员（除本人）
    var sql = "SELECT g.user_id FROM tab_group_member g WHERE g.group_id = ? AND g.user_id <> ? AND g.status = 1";
    var params = [groupId,userId];
    if(message_type == 6){
        sql = "SELECT g.user_id FROM tab_group_member g WHERE g.group_id = ? AND g.status = 1";
        params = [groupId];
    }

    var connection = db.connection();
    var tasks = [function(callback) {
        connection.beginTransaction(function(err) {
            callback(err);
        });
    }, function(callback) {
        connection.query(sql,params, function(err, result) {
            var sql2 = "INSERT INTO tab_message(receive_id,message_type,create_time,group_id,message_mapping_id) VALUES ";
            var params2 = new Array();
           if(err){
               console.log("查询群成员失败");
           }else{
                console.log("查询群成员成功");
               for(var o in result){
                   console.log(result[o].user_id+"---");
                   if((Number(o)+Number(1)) == result.length){
                       sql2 += "(?,?,?,?,?)"
                   }else{
                       sql2 += "(?,?,?,?,?),"
                   }
                   params2.push(result[o].user_id);
                   params2.push(message_type);
                   params2.push(Date.parse(new Date())/1000);
                   params2.push(groupId)
                   params2.push(userId);
               }
               console.log(sql2);
               console.log(params2);
           }
            callback(err,sql2,params2); // 拼接业务参数给下一个方法
        });
    }, function(sql2,params2,callback) {
        // 接收到上一条任务给的业务参数
        if(params2.length == 0){
            console.log("该群没有其他成员");
        }else{
            connection.query(sql2, params2, function(err, result) {
                if(err){
                    console.log("插入tab_message表失败");
                }else{
                    console.log("插入tab_message表成功");
                }
                callback(err);
            });
        }

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

//更换群主并通知群成员
function updateManager(groupId){
       //查询群组最早加入群的人
    var sql = "SELECT m.user_id FROM tab_group_member m WHERE m.join_time = " +
        "(SELECT min(join_time) FROM tab_group_member WHERE group_id = ? and status = 1); ";
    var param = [groupId];
    var connection = db.connection();
    var tasks = [function(callback) {
        connection.beginTransaction(function(err) {
            callback(err);
        });
    }, function(callback) {
        connection.query(sql,param, function(err, result) {
            if(err){
                console.log("查询最早成员失败！"+err);
                callback(err,null);
            }else{
                console.log("查询最早成员成功！");
                var user_id = result[0].user_id;
                callback(err,user_id);
            }

        });
    }, function(user_id,callback) {
        // 更换群主
        var update_manager_sql = "UPDATE tab_group SET manager_id = ? WHERE group_id = ?";
        var update_manager_param = [user_id,groupId];
        connection.query(update_manager_sql, update_manager_param, function(err, result) {
            if(err){
                console.log("更换群主失败");
            }else{
                console.log("更换群主成功");
                //通知群成员
                var message_type = 6;
                updateMember(groupId,user_id,message_type);
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
            if(!err){
                console.log('移除数据个数:', result.affectedRows);
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
}
