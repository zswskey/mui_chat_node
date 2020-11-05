/**
 * Created by lang.xiao on 2016/9/20.
 */
var db = require("./connection"),
    index = require("./index.js");
var async = require("async");
module.exports = {
    find : function(req,res,sql,params,sql1,sql2,sql3,isptp){
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
                        if(isptp){
                            //查询的聊天记录的个人的，需要通过发送人进行分组筛选
                            //查询所有的二人聊天发送的id号
                            var conn = db.connection();
                            var findAllSendId_sql = "SELECT send_id FROM tab_chat WHERE " +
                                "receive_id = ? AND group_id is NULL GROUP BY send_id"
                            conn.query(findAllSendId_sql,params,function(err,rows,fields){
                                console.log(sql);
                                console.log(params);
                                if(err){
                                    console.log('[query] - :'+err);
                                    res.send({status:false,remark:err});
                                }else{
                                    var datas = new Array();
                                    for(var x in rows){
                                        var arr = new Array();
                                        for(var y in results[0]){
                                            if(rows[x].send_id == results[0][y].send_id){
                                                arr.push(results[0][y]);
                                            }
                                        }
                                        var data = {sendId:rows[x].send_id,chat:arr};
                                        datas.push(data);
                                    }
                                    res.send({status:true,count:1,data:datas});
                                }

                            });
                            db.end(conn);
                        }else{
                            res.send({status:true,count:1,data:results[0]});
                        }
                        console.log(isptp);
                        toHistory(sql1,sql2,sql3,params);
                    }
                }

            });
        db.end(connection);
    },
    //聊天图片保存(二人)
    imgChatFriend: function (sql1, sql2,params1,params2) {
        var connection = db.connection();
        var tasks = [function (callback) {
            connection.beginTransaction(function (err) {
                callback(err);
            });
        }, function (callback) {
            connection.query(sql1, params1, function (err, result) {
                if (err) {
                    console.log(err);
                    var imgid = null;
                    callback(err, imgid); // 生成的ID会传给下一个任务
                } else {
                    var imgid = result.insertId;
                    console.log("图片保存成功");
                    callback(err, imgid); // 生成的ID会传给下一个任务
                }
            });
        }, function (imgid, callback) {
            // 接收到上一条任务生成的ID
           params2.push(imgid);
            console.log(params2);
            connection.query(sql2, params2, function (err, result) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("添加二人聊天（图片）记录成功");
                }
                callback(err);
            });
        }, function (callback) {
            connection.commit(function (err) {
                callback(err);
            });
        }];

        async.waterfall(tasks, function (err, results) {
            if (err) {
                //console.log(err);
                console.log("发生错误事务回滚");
                connection.rollback(); // 发生错误事务回滚
            }
            connection.end();
        });
    },
    //二人聊天文本
    textChat : function (sql,params){
        var connection = db.connection();
        connection.query(sql,params,function(err,result){
            console.log(sql);
            console.log(params);
            if(err){
                console.log('[query] - :'+err);
                //res.send({status:false});
            }else{
                console.log("添加聊天信息成功（文本）");
                console.log('受影响的行数:',result.affectedRows);
                //res.send({status:true});
            }
        });
        db.end(connection);
    },
    //群聊天文本
    textChatGroup : function (sql1,sql2,params,send_id,message,send_time,groupid,message_type){
        var connection = db.connection();
        var tasks = [function (callback) {
            connection.beginTransaction(function (err) {
                callback(err);
            });
        }, function (callback) {
            connection.query(sql1, params, function (err, result) {
                var params2 = new  Array();
                if (err) {
                    console.log(err);
                    var imgid = null;
                    callback(err, sql2,params2); // 生成的ID会传给下一个任务
                } else {
                    console.log("未在线的群成员获取成功");
                    for (var x in result){
                        if((Number(x)+Number(1)) == result.length){
                            sql2 += "(?,?,?,?,?,?)";
                        }else{
                            sql2 += "(?,?,?,?,?,?),";
                        }
                        params2.push(send_id);
                        params2.push(result[x].user_id);
                        params2.push(message);
                        params2.push(send_time);
                        params2.push(groupid);
                        params2.push(message_type);
                    }

                    callback(err, sql2,params2); // 生成的ID会传给下一个任务
                }
            });
        }, function (sql2,params2, callback) {
            // 接收到上一条任务生成的ID
            connection.query(sql2, params2, function (err, result) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("添加群聊天（文本）记录成功");
                }
                callback(err);
            });
        }, function (callback) {
            connection.commit(function (err) {
                callback(err);
            });
        }];

        async.waterfall(tasks, function (err, results) {
            if (err) {
                //console.log(err);
                console.log("发生错误事务回滚");
                connection.rollback(); // 发生错误事务回滚
            }
            connection.end();
        });
    },
    //聊天图片保存(群)
    imgChatGroup: function (sql,sql1,sql2,params,params1,send_id,send_time,groupid,message_type) {
        var connection = db.connection();
        var tasks = [function (callback) {
            connection.beginTransaction(function (err) {
                callback(err);
            });
        }, function (callback) {
            connection.query(sql1, params1, function (err, result) {
                if (err) {
                    console.log(err);
                    callback(err, null ); // 生成的ID会传给下一个任务
                } else {
                    var imgid = result.insertId;
                    console.log("图片保存成功");
                    callback(err, imgid); // 生成的ID会传给下一个任务
                }
            });
        }, function (imgid,callback) {
            connection.query(sql, params, function (err, result) {
                var params2 = new  Array();
                if (err) {
                    console.log(err);
                    //var imgid = null;
                    callback(err, imgid,params2 ); // 生成的ID会传给下一个任务
                } else {
                    console.log("未在线的群成员获取成功");
                    for (var x in result){
                        if((Number(x)+Number(1)) == result.length){
                            sql2 += "(?,?,?,?,?,?)";
                        }else{
                            sql2 += "(?,?,?,?,?,?),";
                        }
                        params2.push(send_id);
                        params2.push(result[x].user_id);
                        params2.push(send_time);
                        params2.push(groupid);
                        params2.push(message_type);
                    }
                    callback(err, imgid,params2); // 生成的ID会传给下一个任务
                }
            });
        }, function (imgid,params2, callback) {
            // 接收到上一条任务生成的ID
            var i = (params2.length)/5;
            //console.log(i);
            for(var x=1;x<=i;x++){
                //console.log(x);
                var index1 = (Number(x)*Number(6))-Number(1);
                //console.log(index);
                params2.splice(index1, 0, imgid);
            }
            console.log(params2);
            console.log(sql2);
            connection.query(sql2, params2, function (err, result) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("添加群聊天（图片）记录成功");
                }
                callback(err);
            });
        }, function (callback) {
            connection.commit(function (err) {
                callback(err);
            });
        }];

        async.waterfall(tasks, function (err, results) {
            if (err) {
                //console.log(err);
                console.log("发生错误事务回滚");
                connection.rollback(); // 发生错误事务回滚
            }
            connection.end();
        });
    },

    //群在线聊天文本
    zxtextChatGroup : function (sql1,send_date,send_id,online_ids,message,send_time,groupid,message_type){
        var onlineIds = clone(online_ids);
        var index = onlineIds.indexOf(send_id);
        if (index != -1) {
            onlineIds.splice(index, 1);
        }
        var conn = db.connection();
        var tasks1 = [function (callback) {
            conn.beginTransaction(function (err) {
                callback(err);
            });
        }, function (callback) {
            var params2 = new  Array();
            for (var x in onlineIds){
                    if((Number(x)+Number(1)) == onlineIds.length){
                        sql1 += "(?,?,?,?,?,?,?)";
                    }else{
                        sql1 += "(?,?,?,?,?,?,?),";
                    }
                    params2.push(send_id);
                    params2.push(onlineIds[x]);
                    params2.push(message);
                    params2.push(send_date);
                    params2.push(groupid);
                    params2.push(message_type);
                    params2.push(send_time);
            }
            callback(null,sql1,params2); // 生成的ID会传给下一个任务
        }, function (sql1,params2,callback) {
            // 接收到上一条任务生成的ID
            console.log("sql:"+sql1);
            console.log("参数："+params2);
            conn.query(sql1,params2,function (err) {
                if (err) {
                    console.log(err);
                    console.log("添加群聊天（文本）到所有数据表记录失败");
                } else {
                    console.log("添加群聊天（文本）到所有数据表记录成功");
                }
                callback(err);
            });
        }, function (callback) {
            conn.commit(function (err) {
                callback(err);
            });
        }];

        async.waterfall(tasks1, function (err, results) {
            if (err) {
                //console.log(err);
                console.log("操作所有数据表发生错误事务回滚");
                conn.rollback(); // 发生错误事务回滚
            }
            conn.end();
        });
    },

    //聊天在线图片保存(群)
    zximgChatGroup: function (sql1,sql2,params1,send_date,send_id,online_ids,send_time,groupid,message_type) {
        var onlineId = clone(online_ids);
        var index = onlineId.indexOf(send_id);
        if (index != -1) {
            onlineId.splice(index, 1);
        }
        var connection = db.connection();
        var tasks = [function (callback) {
            connection.beginTransaction(function (err) {
                callback(err);
            });
        }, function (callback) {
            connection.query(sql1, params1, function (err, result) {
                if (err) {
                    console.log(err);
                    callback(err, null ); // 生成的ID会传给下一个任务
                } else {
                    var imgid = result.insertId;
                    console.log("图片保存成功");
                    callback(err, imgid); // 生成的ID会传给下一个任务
                }
            });
        }, function (imgid,callback) {
            var params2 = new  Array();
            for (var x in onlineId){
                if((Number(x)+Number(1)) == onlineId.length){
                    sql2 += "(?,?,?,?,?,?,?)";
                }else{
                    sql2 += "(?,?,?,?,?,?,?),";
                }
                params2.push(send_id);
                params2.push(onlineId[x]);
                params2.push(send_date);
                params2.push(groupid);
                params2.push(message_type);
                params2.push(send_time);
            }
            callback(null,imgid,params2); // 生成的ID会传给下一个任务

        }, function (imgid,params2, callback) {
            // 接收到上一条任务生成的ID
            var i = (params2.length)/6;
            //console.log(i);
            for(var x=1;x<=i;x++){
                //console.log(x);
                var index1 = (Number(x)*Number(7))-Number(1);
                //console.log(index);
                params2.splice(index1, 0, imgid);
            }
            console.log("参数："+params2);
            console.log("sql："+sql2);
            connection.query(sql2, params2, function (err, result) {
                if (err) {
                    console.log(err);
                } else {
                    console.log("添加群聊天（图片）记录成功");
                }
                callback(err);
            });
        }, function (callback) {
            connection.commit(function (err) {
                callback(err);
            });
        }];

        async.waterfall(tasks, function (err, results) {
            if (err) {
                //console.log(err);
                console.log("发生错误事务回滚");
                connection.rollback(); // 发生错误事务回滚
            }
            connection.end();
        });
    },


}

function toHistory(sql1,sql2,sql3,params){
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
            console.log('移除数据个数:', result.affectedRows);
            callback(err);
        });
    },function(callback) {
        connection.query(sql3,params, function(err, result) {
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
            console.log("聊天消息移除消息到历史表成功！");
            //res.send({status:true});
        }
        connection.end();
    });
}

/**
 * 克隆一个对象
 * @param obj
 * @returns {*}
 */
function clone(obj){
    var o;
    if (typeof obj == "object") {
        if (obj === null) {
            o = null;
        } else {
            if (obj instanceof Array) {
                o = [];
                for (var i = 0, len = obj.length; i < len; i++) {
                    o.push(clone(obj[i]));
                }
            } else {
                o = {};
                for (var j in obj) {
                    o[j] = clone(obj[j]);
                }
            }
        }
    } else {
        o = obj;
    }
    return o;
}
