/*var express = require('express');
var router = express.Router();

/!* GET users listing. *!/
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

module.exports = router;*/

var db = require("./connection");
var async = require("async");
module.exports = {
  login : function(req,res,account,password){
    var connection = db.connection();
    async.parallel([
          function(callback){
              var sql = "select u.account,u.phone_number,u.password,u.user_name,i.img from tab_user_info AS u " +
                  "left join tab_img AS i ON u.user_img_id = i.img_id  where account = ?";
              var params = [account];
              console.log("用户账号"+account);
              console.log("用户密码"+password);
              console.log("登陆开始---------------");
            connection.query(sql,params,function(err,rows,fields){
              if(err){
                console.log('[query] - :'+err);
                  res.send({status:false,message : ""});
                return
              }
              callback(null, rows);
            });
          }
        ],
        function(err, results){
            db.end(connection);
            if(results[0].length == 0){
                res.send({status:false,message:"账号不存在!"});
                console.log("账号不存在---------------");
            }else{
                if( password == results[0][0]['password']){
                    //调用通知上线的接口
                    console.log("登录成功---------------");
                    console.log(results[0]);
                    res.send({status:true,data:results[0]});
                }else{
                    console.log("密码错误---------------");
                    res.send({status:false,message:"密码错误!"});
                }
            }
            console.log("登录结束---------------");
        });
  },
    update : function(req,res,sql, params) {
        var connection = db.connection();
        async.parallel([
            function (callback) {
                connection.query(sql, params, function (err, result) {
                    console.log(sql);
                    console.log(params);
                    if (err) {
                        console.log('[query] - :' + err);
                        callback(err);
                    } else {
                        console.log('受影响的行数:', result.affectedRows);
                        callback();
                    }
                });
            }
        ],
        function (err, results) {
            if (err) {
                res.send({status: false});
            } else {
                res.send({status: true});
            }

        });
        db.end(connection);
    },
    updateImg : function (req,res,sql1,sql2,account,user_img,update_time){
        var connection = db.connection();
        var tasks = [function(callback) {
            connection.beginTransaction(function(err) {
                callback(err);
            });
        }, function(callback) {
            connection.query(sql1,user_img,function(err, result) {
                var imgId = result.insertId;
                callback(err,imgId); // 生成的ID会传给下一个任务
            });
        }, function(imgId, callback) {
            console.log(imgId);
            // 接收到上一条任务生成的ID
            var params = [imgId,update_time,account];
            console.log(sql2);
            console.log(params);
            connection.query(sql2, params, function(err, result) {
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
                connection.rollback(); // 发生错误事务回滚
                res.send({status:false});
            }else{
                res.send({status:true});
            }
            connection.end();
        });
    }

}