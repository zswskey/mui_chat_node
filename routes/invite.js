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
                        var sql1 = "UPDATE tab_invite_info i SET i.status= 1 WHERE i.accept_id = ?";
                        update_invite_status(sql1,params);
                    }
                }

            });
        db.end(connection);
    }
}

//改变邀请信息的状态
function update_invite_status(sql, params) {
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
}
