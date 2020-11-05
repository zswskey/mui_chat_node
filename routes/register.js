/**
 * Created by lang.xiao on 2016/9/5.
 */
var db = require("./connection");
var users = require("./users");
var async = require("async");
module.exports = {
    register : function(req,res,sql,params){
        var connection = db.connection();
        async.parallel([
                function(callback){
                    connection.query(sql,params,function(err,result){
                        console.log("注册开始------");
                        console.log(sql);
                        console.log(params);
                        if(err){
                            console.log('[query] - :'+err);
                            callback(err);
                        }else{
                            console.log('受影响的行数:',result.affectedRows);
                            callback();
                        }
                    });
                }
            ],
            function(err,results){
                if(err){
                    console.log("注册失败------");
                    res.send({reg:false});
                }else{
                    console.log("注册成功------");
                    res.send({reg:true});
                    //users.login(req,res,phone_number,password);
                }

            });
        db.end(connection);
    },
    isexist : function isexist(req,res,sql, params){
        var connection = db.connection();
        connection.query(sql,params,function(err,rows,fields){
            console.log("验证账号是否存在---------");
            console.log(sql);
            console.log(params);
            if(err){
                console.log('[query] - :'+err);
                res.send({status:false,message:"未取得验证数据，请重试！"});
                return
            }else{
                db.end(connection);
                if(rows[0]['count(1)'] == 0){
                    console.log("验证通过--------");
                    res.send({status:true,message:"验证通过"});
                }else{
                    console.log("账号已被注册----------");
                    res.send({status:false,message:"账号已被注册"});
                }
            }
        });
    }
}