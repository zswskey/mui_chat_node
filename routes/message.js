/**
 * Created by lang.xiao on 2016/9/19.
 */
var db = require("./connection");
var async = require("async");
module.exports = {
    insert : function (sql,params){
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
    //用户资料变更保存到信息表
    friend_info_update : function (req, res, sql,account,message_type){
        var connection = db.connection();
        var tasks = [function(callback) {
            connection.beginTransaction(function(err) {
                callback(err);
            });
        }, function(callback) {
            connection.query(sql,account, function(err, result) {
                var sql2 = "INSERT INTO tab_message(create_time,receive_id,message_type,message_mapping_id) VALUES ";
                var params2 = new Array();
                for(var o in result){
                    console.log(result[o].friend_id+"---");
                    console.log(Number(o)+Number(1)  );
                    if((Number(o)+Number(1)) == result.length){
                        sql2 += "(?,?,?,?)"
                    }else{
                        sql2 += "(?,?,?,?),"
                    }
                    params2.push(Date.parse(new Date())/1000);
                    params2.push(result[o].friend_id);
                    params2.push(message_type);
                    params2.push(account);
                }
                console.log(sql2);
                console.log(params2);
                callback(err,sql2,params2); // 拼接业务参数给下一个方法
            });
        }, function(sql2,params2,callback) {
            // 接收到上一条任务给的业务参数
            if(params2.length == 0){
                console.log("没有好友");
            }else{
                connection.query(sql2, params2, function(err, result) {
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
                connection.rollback(); // 发生错误事务回滚
                //res.send({status:false});
            }else{
                //res.send({status:true});
            }
            connection.end();
        });
    }

}