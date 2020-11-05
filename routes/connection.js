/**
 * Created by lang.xiao on 2016/8/30.
 */
var mysql = require("mysql");//调用MySQL模块
/*exports.connection = function(req,res){
    var connection = mysql.createConnection({
        host : '127.0.0.1', //主机
        user : 'root',       //MySQL认证用户名
        password : 'root',  //密码
        port  : '3306' ,     //端口号
        database : 'nodejs'   //数据库名称
    });
    return connection;
}*/
/*var options = {
    host : '127.0.0.1', //主机
    user : 'root',       //MySQL认证用户名
    password : 'root',  //密码
    port  : '3306' ,     //端口号
    database : 'chat' ,  //数据库名称
    connectionLimit : 50,
    supportBigNumber : true,
    bigNumberStrings : true
};

var pool = mysql.createPool(options);*/

/*this.conn=pool.getConnection(function(error, connection) {
    if (error) {
        console.log('DB-获取数据库连接异常！');
        throw error;
    }
    return connection;
});*/
module.exports = {
    connection : function connection(){
        var connection = mysql.createConnection({
            host : '127.0.0.1', //主机
            user : 'root',       //MySQL认证用户名
            password : 'root',  //密码
            port  : '3306' ,     //端口号
            database : 'chat'   //数据库名称
        });
        return connection;
    },
    end : function end(connection) {
        //关闭连接onnection
        connection.end(function(err){
            if(err) {
                return;
            }
            console.log('[connection end] succeed!');
        });
    }
}

/*exports.find = function(req,res){
    var connection = mysql.createConnection({
        host : '127.0.0.1', //主机
        user : 'root',       //MySQL认证用户名
        password : 'root',  //密码
        port  : '3306' ,     //端口号
        database : 'nodejs'   //数据库名称
    });
    connection.query(sql,function(err,rows,fields){
        if(err){
            console.log('[query] - :'+err);
            return
        }
        //console.log(sql);
        //console.log('this user is:', rows);
        return rows;
    });
}*/
/*
module.exports = {
    connection : function connection(){
        //创建一个connection
        var connection = mysql.createConnection({
            host : '127.0.0.1', //主机
            user : 'root',       //MySQL认证用户名
            password : 'root',  //密码
            port  : '3306' ,     //端口号
            database : 'chat'   //数据库名称
        });
        return connection;
    },
    find :function find(connection,sql){
        async.parallel([
                function(callback){
                    connection.query(sql,function(err,rows,fields){
                        if(err){
                            console.log('[query] - :'+err);
                            return
                        }
                        callback(null, rows);
                    });
                }
            ],
            function(err, results){
               return results[0];
            });
    }
};
*/
