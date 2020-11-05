/**
 * Created by lang.xiao on 2016/8/30.
 */
var db = require("./routes/connection"),
    index = require("./routes/index"),
    userss = require("./routes/users"),
    register = require("./routes/register"),
    friendship = require("./routes/friendship"),
    group = require("./routes/group"),
    message = require("./routes/message"),
    chat = require("./routes/chat"),
    invite = require("./routes/invite");
var express = require("express");

var app = express();
var server = require('http').Server(app);
var multipart = require('connect-multiparty');//解析post请求参数（表单）
var bodyParser = require("body-parser");//解析post请求参数
app.use(bodyParser.urlencoded({ extended: false }));
var multipartMiddleware = multipart();

//var cors = require('cors');解决跨域
//app.use(cors());
var path = require('path');

var async = require("async");
app.set('port',process.env.PORT || 3000);
//监听端口
server.listen(app.get('port'),function(req,res){
    console.log('Express server listening on port '+ app.get('port'));
});

var IO = require('socket.io');
var router = express.Router();

//var server = require('http').Server(app);

// 创建socket服务
var socketIO = IO(server);
// 群在线用户名单
var roomInfo = {};
// 群离线用户名单
var offLineroomInfo ={};
// 在线用户
var users = {};
// 用户的socket记录
var usocket = {};
// 用户最新的socketid记录
var socketids = {};
// 保存用户在线的socketid
var usocketids = {};

socketIO.on('connection', function (socket) {
    var user = '';
    var roomID = '';
    //连接加入
    socket.on('join', function (data,callback) {
        //加入的socketids
        var sids = new Array();
        var roomss = new Array();
        callback(true);
        user = data.user;
        if(user){
            users[user] = user;
            console.log(user+":的socketid:"+socket.id);
            usocket[user] = socket;
            socketids[user] = socket.id;
            sids.push(socket.id);
            console.log("同一个账号socket ID的个数："+sids.length);
            if(!usocketids[user]){
                if(sids.length == 1){
                    usocketids[user] = sids;
                }else if(sids.length > 1){
                    usocketids[user] = [];
                    usocketids[user].push(sids[0]);
                    for(var v = 1; v < sids.length; v++){
                        var index = usocketids[user].indexOf(sids[v]);
                        if(index == -1){
                            usocketids[user][usocketids[user].length] = sids[v];
                        }else{
                            socketIO.sockets.connected[sids[v]].disconnect();
                        }
                    }
                }
            }else{
                var index = usocketids[user].indexOf(socket.id);
                if (index == -1) {
                    usocketids[user][usocketids[user].length] = socket.id;
                }else{
                    socketIO.sockets.connected[socket.id].disconnect();
                }
            }

        }
        //注：如何获取该用户在那个群里（根据用户查找所有的群ID,在遍历所有的群ID）
        var connection = db.connection();
        var findGroupIds_sql = "SELECT group_id FROM tab_group_member WHERE user_id = ? and status = 1";
        connection.query(findGroupIds_sql,user,function(err,result){
            console.log(findGroupIds_sql);
            console.log(user);
            if(err){
                console.log('[query] - :'+err);
                connection.end();
            }else{
                for(var x in result){
                    roomss.push(result[x].group_id);
                }
                connection.end();
            }

            //roomID = data.roomID;
            for(var k=0; k<roomss.length; k++){
                roomID = roomss[k];
                if(roomID){
                    socket.join(roomID);    // 加入房间
                    // 将用户加入房间名单中
                    if (!roomInfo[roomID]) {
                        roomInfo[roomID] = [];
                    }
                    var index = roomInfo[roomID].indexOf(user);
                    if(index == -1){
                        roomInfo[roomID].push(user);
                    }
                    if(offLineroomInfo[roomID]){
                        var index = offLineroomInfo[roomID].indexOf(user);
                        if (index != -1) {
                            offLineroomInfo[roomID].splice(index,1);
                        }
                    }
                }
            }
            //打印系统时间和在线、离线人员
            systemdate();

        });

        if(usocketids[user]){
            for(var u=0; u<usocketids[user].length; u++){
                console.log("在线的用户第"+(u+1)+"个socketid:"+usocketids[user][u]);
                if(usocketids[user][u] != socket.id){
                    //console.log("不是最新的socketid:"+usocketids[user][u]);
                    var socketid = usocketids[user][u];
                    //console.log(socketIO.sockets.connected[socketid]);
                    //socket.conn.server.clients[socketid.split("#")[1]].disconnect();
                    //socket.server.sockets.sockets[socketid].disconnect();
                    if(socketIO.sockets.connected[socketid]){
                        socketIO.sockets.connected[socketid].disconnect();
                        u--;
                    }
                }
            }
        }
    });

    //掉线
    socket.on('disconnect', function () {
        var roomss = new Array();
        //当用户最新的Socket.id断开连接的时候
        if(socketids[user] == socket.id){
            var connection = db.connection();
            var findGroupIds_sql = "SELECT group_id FROM tab_group_member WHERE user_id = ? and status = 1";
            connection.query(findGroupIds_sql,user,function(err,result){
                console.log(findGroupIds_sql);
                console.log(user);
                if(err){
                    console.log('[query] - :'+err);
                    connection.end();
                }else{
                    for(var x in result){
                        roomss.push(result[x].group_id);
                    }
                    connection.end();
                }

                for(var k=0; k<roomss.length; k++){
                    roomID = roomss[k];
                    // 从房间名单中移除
                    if(roomID){
                        socket.leave(roomID);    // 退出房间
                        // 将用户加入房间离线名单中
                        if (!offLineroomInfo[roomID]) {
                            offLineroomInfo[roomID] = [];
                        }
                        var index = offLineroomInfo[roomID].indexOf(user);
                        if(index == -1){
                            offLineroomInfo[roomID].push(user);
                        }
                        if(roomInfo[roomID]){
                            var index = roomInfo[roomID].indexOf(user);
                            if (index != -1) {
                                roomInfo[roomID].splice(index, 1);
                            }
                        }
                    }
                }
            });
            if(user) {
                delete users[user];
                delete usocket[user];
                delete socketids[user];
                delete usocketids[user];
            }

            //打印系统时间和在线、离线人员
            systemdate();
        }else{
            if(usocketids[user]){
                console.log("离线的Socket.id:"+socket.id)
                var index = usocketids[user].indexOf(socket.id);
                if (index != -1) {
                    usocketids[user].splice(index,1);
                }
            }
        }
    });

    // 接收用户消息(两人聊天)
    socket.on('privateChat', function (data,callback) {
        var send_date = Date.parse(new Date())/1000;
        console.log("发送者：" + data.user, data);
        //如果接收到消息，则返回给客户端
        user = data.user;
        contenttype = data.contenttype;
        if(contenttype == 1){
            //console.log(data.msg.substr(0,4));
            if(data.msg.length > 7 && data.msg != "" && data.msg.substr(0,4)=='data'){
                callback(true);
                sendChatmessage(send_date,data);
            }else{
                console.log("发送的图片格式不对！");
                callback(false);
            }
        }else if(contenttype == 2){
            var str = trimRight(data.msg);
            if(str != "" && data.msg.length > 0 && data.msg.length <= 1000) {
                callback(true);
                sendChatmessage(send_date,data);
            }else{
                console.log("发送的信息不能为空！");
                callback(false);
            }
        }else if(contenttype == 3){
            //console.log(data.msg.substr(0,4));
            if(data.msg.length > 7 && data.msg != "" && data.msg.substr(0,4)=='data'){
                callback(true);
                sendChatmessage(send_date,data);
            }else{
                console.log("发送的语音格式不对！");
                callback(false);
            }
        }
    });

    // 接收用户消息(群聊天)
    socket.on('groupChat', function (data,callback) {
        var send_date = Date.parse(new Date())/1000;
        console.log('to'+ data.to, data);
        //如果接收到消息，则返回给客户端
        //callback(true);
        //data.id = new Date().getTime();
        user = data.user;
        var type = data.type;

        if(type == 2){
            user = data.user;
            roomid = data.to;
            contenttype = data.contenttype;
            if(contenttype == 1){//图片
                //console.log(data.msg.substr(0,4));
                if(data.msg.length > 7 && data.msg != "" && data.msg.substr(0,4)=='data'){
                    callback(true);
                    // 验证如果用户不在房间内则不给发送
                    if (roomInfo[roomid].indexOf(user) == -1) {
                        return false;
                    }else{
                        //群广播消息
                        sendGroupChat(send_date,data,socket,user);
                    }
                }else{
                    console.log("群中发送的图片格式不对！");
                    callback(false);
                }
            }else if(contenttype == 2){//文字
                var str = trimRight(data.msg);
                if(str != "" && data.msg.length > 0 && data.msg.length <= 1000) {
                    callback(true);
                    // 验证如果用户不在房间内则不给发送
                    if (roomInfo[roomid].indexOf(user) == -1) {
                        return false;
                    }else{
                        sendGroupChat(send_date,data,socket,user);
                    }
                }else{
                    console.log("群中发送的信息不能为空！");
                    callback(false);
                }
            }else if(contenttype == 3){
                //console.log(data.msg.substr(0,4));
                if(data.msg.length > 7 && data.msg != "" && data.msg.substr(0,4)=='data'){
                    callback(true);
                    // 验证如果用户不在房间内则不给发送
                    if (roomInfo[roomid].indexOf(user) == -1) {
                        return false;
                    }else{
                        //群广播消息
                        sendGroupChat(send_date,data,socket,user);
                    }
                }else{
                    console.log("群中发送的语音格式不对！");
                    callback(false);
                }
            }
        }
    });

    //好友请求(添加好友)
    socket.on('addFriend', function (data,callback) {
        //如果接收到消息，则返回给客户端
        console.log("收到添加好友消息："+ data.to, data);
        callback(true);
        var type = data.type;
        if (type == 3) {
            addFriendMessage(data);
        }
    });

    //好友请求接受/不接受
    socket.on('addFriendResult', function (data,callback) {
        console.log("好友已经答应请求！"+data.to,data);
        callback(true);
        var type = data.type;
        var msg="我们已经是好友了，开始聊天吧！";
        if (type == 4) {
            //注：1、好友验证通过，需要将好友关系建立，需要操作数据库（与肖浪对接）
            var invite_id = data.to;//接收人ID
            var invite_name = data.tonick;//接收人昵称
            var accept_id = data.user;//发起人ID
            var accept_name = data.invite_nick;//发起人昵称
            var add_time = Date.parse(new Date())/1000;
            var connection = db.connection();
            var sqlFriend = "SELECT * FROM tab_friendship WHERE user_id = ? AND friend_id = ? AND delete_type = 0 ";
            var pra = [invite_id,accept_id,0];
            var tasks = [function(callback) {
                // 开启事务
                connection.beginTransaction(function(err) {
                    callback(err);
                });
            }, function(callback) {
                connection.query(sqlFriend,pra, function(err,rows,result) {
                    console.log(sqlFriend);
                    console.log(pra);
                    if(!err){
                        console.log("查询完成!");
                        if(rows.length>0){
                            //第二次点击“同意”按钮
                            var sqlChat = "SELECT * FROM tab_chat WHERE send_id = ? AND receive_id = ? AND message = ? AND message_type = ?";
                            var pra1 = [data.user,data.to,msg,2];
                            connection.query(sqlChat,pra1, function(err,rows,result) {
                                console.log(sqlChat);
                                console.log(pra1);
                                if(!err){
                                    console.log("查询完成!");
                                    if(rows.length>0){
                                        var to_chat_sql = "INSERT INTO his_tab_chat"+
                                            "(send_id,receive_id,message,img_id,send_time,message_type,group_id,his_create_time)"+
                                            "SELECT send_id,receive_id,message,img_id,send_time,message_type,group_id,UNIX_TIMESTAMP(NOW()) from tab_chat"+
                                            "WHERE send_id = ?  AND receive_id = ? ";
                                        var delChat_sql = "DELETE FROM tab_invite_info WHERE send_id = ?  AND receive_id = ? ";
                                        var pra2 = [data.user,data.to];
                                        connection.query(to_chat_sql,pra2, function(err, result) {
                                            if(!err){
                                                console.log('添加个数:', result.affectedRows);
                                                connection.query(delChat_sql,pra2, function(err, result) {
                                                    if(!err){
                                                        console.log('移除个数:', result.affectedRows);
                                                        addFriendByTo(data,msg);
                                                    }
                                                    callback(err);
                                                });
                                            }
                                            callback(err);
                                        });
                                    }
                                }
                            });
                        }else{
                            var sql = "INSERT INTO tab_friendship(user_id,friend_id,add_time,friend_remark) VALUES(?,?,?,?),(?,?,?,?)";
                            var params1 = [invite_id,accept_id,add_time,accept_name,accept_id,invite_id,add_time,invite_name];
                            connection.query(sql,params1,function(err,result){
                                console.log(sql);
                                console.log(params1);
                                if(err){
                                    console.log('[query] - :'+err);
                                    db.end(connection);
                                    //添加失败，给被邀请人发送消息
                                    addFriendErr(data);

                                }else{
                                    console.log('受影响的行数:',result.affectedRows);
                                    //添加成功，则将好友请求返回给接收人
                                    addFriendByTo(data,msg);

                                    //添加成功，则将好友请求返回给发起人
                                    //改为串行发送，给接收人发送成功后在给发起人推送
                                    //addFriendByUser(data,msg);

                                    console.log("将对应的邀请信息移除到历史表");
                                    console.log("invite_id:"+data.to+",accept_id:"+data.user)
                                    var to_history_sql = "INSERT INTO his_tab_invite_info" +
                                        "(invite_id,accept_id,group_id,group_name,comments,create_time,invite_status,invite_type,his_create_time) " +
                                        "SELECT invite_id,accept_id,group_id,group_name,comments,create_time,1,invite_type,UNIX_TIMESTAMP(NOW()) from tab_invite_info" +
                                        " WHERE invite_id =?  AND accept_id =? ";
                                    var delete_sql = "DELETE FROM tab_invite_info WHERE invite_id =?  AND accept_id =?";
                                    var params2 = [data.user,data.to];
                                    friendship.toHistory(null,null,to_history_sql,delete_sql,params2);
                                }
                            });
                        }
                    }
                    callback(err);
                });
            }, function(callback) {
                connection.commit(function(err) {
                    callback(err);
                });
            }];
            async.series(tasks, function(err, results) {
                if(err) {
                    console.log(err);
                    connection.rollback(); // 发生错误事务回滚
                }
                connection.end();
            });

        }else if (type == 5) {
            //拒绝好友邀请
            //refFriend(invite_id,accept_id);
        }
    });

    //建群时拉好友
    socket.on('createGroupFriends', function (data,callback) {
        callback(true);
        var type = data.type;
        if(type == 6){//新建群组
            //注：1、需要往数据库添加一条群信息，需要返回群ID（与肖浪对接）创建完成后继续操作
            //2、群创建成功后通过socket.join(groupid),将群id作为房间id放入socket中
            //2.1 群主信息保存在房间中
            //3、to:varchar,//被邀请人ID（数组），遍历被邀请人的数组，推送消息给每个好友
            //新建一个群并把群主自动添加到群成员里面
            var group_name = data.groupname;//群名称
            var manager_id = data.user;//群主ID
            var manager_name = data.usernick;//群主昵称
            var group_comment = data.groupremark;//群简介
            var create_time = Date.parse(new Date())/1000;
            var newGroup_sql = "INSERT INTO tab_group(group_name,manager_id,group_comment,create_time) VALUES(?,?,?,?)";//新建群
            //把管理员加入群
            var addManager_sql = "INSERT INTO tab_group_member(user_id,group_user_name,group_id,join_time) VALUES(?,?,?,?)";
            var connection = db.connection();
            var tasks = [function(callback) {
                connection.beginTransaction(function(err) {
                    callback(err);
                });
            }, function(callback) {
                var newGroup_params = [group_name,manager_id,group_comment,create_time];
                connection.query(newGroup_sql,newGroup_params,function(err, result) {
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
                var addManager_params = [manager_id,manager_name,groupid,create_time];
                connection.query(addManager_sql, addManager_params, function(err, result) {
                    if(err){
                        console.log(err);
                    }else{
                        console.log("添加成员成功");
                        //群创建成功，推送消息
                        data.groupid = groupid;
                        data.manager_id = manager_id;
                        console.log(data);
                        user = data.user;
                        socket.join(data.groupid);
                        // 将用户加入房间名单中
                        if (!roomInfo[data.groupid]) {
                            roomInfo[data.groupid] = [];
                        }
                        var index = roomInfo[data.groupid].indexOf(user);
                        if(index == -1){
                            roomInfo[data.groupid].push(user);
                        }

                        //建群成功，给群主发送消息
                        createGroupSucc(data);
                        //改为串行，给邀请的好友广播加群消息
                        //addGroupFriends(data);

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
                    console.log("发生错误事务回滚");
                    //给群主推送建群失败消息
                    createGroupErr(data);
                    connection.rollback(); // 发生错误事务回滚
                }else{
                }
                connection.end();
            });

        }
    });

    //在群里直接拉好友
    socket.on('addGroupFriends', function (data,callback) {
        callback(true);
        var type = data.type;
        if(type == 7){//群里边直接拉好友
            //给邀请的好友广播加群消息
            addGroupFriends(data);
        }
    });

    //好友请求接受/不接受
    socket.on('addGroupAgree', function (data,callback) {
        callback(true);
        var accept_id =  data.acceptId;//被邀请人ID
        var username =  data.username;//被邀请人昵称
        var img =  data.img;//被邀请人昵称
        var group_id = data.groupId;//群ID
        var join_time = Date.parse(new Date())/1000;
        var message_type = 5;
        var type = data.type;
        if(type == 8){
            //邀请的好友同意，添加到数据库sql
            var addGroup_sql = "INSERT INTO tab_group_member(user_id,group_user_name,group_id,join_time) VALUES(?,?,?,?)";
            //查询所有的群成员sql
            var findGroupMember_sql = "SELECT DISTINCT " +
                "g.group_id,u.account,g.group_user_name,i.img " +
                "FROM " +
                "tab_group_member as g " +
                "LEFT JOIN tab_user_info AS u ON g.user_id = u.account " +
                "LEFT JOIN tab_img AS i ON i.img_id = u.user_img_id " +
                "WHERE g.group_id =? AND g.status = 1";
            var params = [accept_id,username,group_id,join_time];

            var connection = db.connection();
            //查询是否已在群中
            var rememberIsInGroup_sql = "SELECT COUNT(1) as count from tab_group_member WHERE group_id = ? AND user_id = ? AND status = 1";
            var rememberIsInGroup_params =[group_id,accept_id];
            var conn=db.connection();
            conn.query(rememberIsInGroup_sql,rememberIsInGroup_params, function(err, result) {
                if(err){
                    console.log('[query] - :' + err);
                    conn.end();
                }else{
                    if(result[0].count > 0){
                        console.log("用户"+accept_id+"已经加入过该群");
                        conn.query(findGroupMember_sql,group_id, function(err, result) {
                            if(err){
                                console.log("获取群成员信息失败!");
                            }else{
                                //获取群信息
                                var select_group ="SELECT group_id,group_name,group_comment,manager_id FROM tab_group WHERE " +
                                    "group_id = ? ";
                                conn.query(select_group,group_id,function(err,row,fields) {
                                    console.log(select_group);
                                    console.log(group_id);
                                    if (err) {
                                        console.log("获取群信息失败!");
                                        console.log('[query] - :' + err);
                                        //加群失败给应答者推送
                                        addGroupAgreeErr(accept_id,data);
                                    }else{
                                        //将新加群的好友放入在线房间集合
                                        console.log("加入在线房间");
                                        addGroupFriend(accept_id,group_id);
                                        //加群成功给应答者推送
                                        addGroupByAcceptId(accept_id,data,row,result);

                                        //移除对应的邀请信息到历史表（可能没有这条邀请信息）
                                        var toHistorySQL = "INSERT INTO his_tab_invite_info" +
                                            "(invite_id,accept_id,group_id,group_name,comments,create_time,invite_status,invite_type,his_create_time) " +
                                            "SELECT invite_id,accept_id,group_id,group_name,comments,create_time,1,invite_type,UNIX_TIMESTAMP(NOW()) from tab_invite_info" +
                                            " WHERE accept_id =?  AND group_id=?";
                                        var sql2 = "DELETE FROM tab_invite_info WHERE accept_id =? AND group_id=?";
                                        var params2 = [accept_id,group_id];
                                        index.toHistory(toHistorySQL,sql2,params2);
                                    }
                                });
                            }
                        });
                    }else{
                        // function数组，需要执行的任务列表，每个function都有一个参数callback函数并且要调用
                        var tasks = [function(callback) {
                            // 开启事务
                            connection.beginTransaction(function(err) {
                                callback(err);
                            });
                        }, function(callback) {
                            connection.query(addGroup_sql,params, function(err, result) {
                                console.log(addGroup_sql);
                                console.log(params);
                                if(err){
                                    console.log("加入群失败!");
                                }else{
                                    console.log("加入群成功!");
                                }
                                callback(err);
                            });
                        }, function(callback) {
                            connection.query(findGroupMember_sql,group_id, function(err, result) {
                                if(err){
                                    console.log("获取群成员信息失败!");
                                    //加群失败给应答者推送
                                    addGroupAgreeErr(accept_id,data);
                                }else{
                                    //获取群信息
                                    var select_group ="SELECT group_id,group_name,group_comment,manager_id FROM tab_group WHERE " +
                                        "group_id = ? ";
                                    connection.query(select_group,group_id,function(err,row,fields) {
                                        console.log(select_group);
                                        console.log(group_id);
                                        if (err) {
                                            console.log("获取群信息失败!");
                                            console.log('[query] - :' + err);
                                        }else{
                                            //将新加群的好友放入在线房间集合
                                            console.log("加入在线房间");
                                            addGroupFriend(accept_id,group_id);
                                            //加群成功给应答者推送
                                            addGroupByAcceptId(accept_id,data,row,result);

                                            //改为串行，给应答者推送成功后在给其他群成员推送
                                            //newGroupFriends(accept_id,data,result,message_type);
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
                            }else{
                                //移除对应的邀请信息到历史表（可能没有这条邀请信息）
                                var toHistorySQL = "INSERT INTO his_tab_invite_info" +
                                    "(invite_id,accept_id,group_id,group_name,comments,create_time,invite_status,invite_type,his_create_time) " +
                                    "SELECT invite_id,accept_id,group_id,group_name,comments,create_time,1,invite_type,UNIX_TIMESTAMP(NOW()) from tab_invite_info" +
                                    " WHERE accept_id =?  AND group_id=?";
                                var sql2 = "DELETE FROM tab_invite_info WHERE accept_id =? AND group_id=?";
                                var params2 = [accept_id,group_id];
                                index.toHistory(toHistorySQL,sql2,params2);
                            }
                            connection.end();
                        });
                    }
                    conn.end();
                }
            });
        }
    });

    //删除好友
    socket.on('deleteFriend', function (data,callback) {
        console.log("删除好友数据"+data.user,data);
        callback(true);
        var type = data.type;
        if(type == 10){
            //注：1、删除好友，需要操作数据库（与肖浪对接）
            var userId = data.user;
            var friendId = data.to;
            var deleteFeiend_sql = "UPDATE tab_friendship SET delete_type = 1 WHERE user_id in (?,?) AND friend_id in (?,?)";
            var deleteFeiend_params = [userId,friendId,userId,friendId];
            var connection = db.connection();
            connection.query(deleteFeiend_sql, deleteFeiend_params, function (err, result) {
                console.log(deleteFeiend_sql);
                console.log(deleteFeiend_params);
                if (err) {
                    console.log('[query] - :' + err);
                    //return false;
                    //删除失败，给删除的人发送消息
                    deleteFriendErr(data);

                } else {
                    console.log('受影响的行数:', result.affectedRows);
                    //return true;
                    //2、删除成功后，到前台处理删除好友列表中的对应信息
                    deleteFriendByUser(data);
                    //改为串行，给被删除人发送一个已删除的状态
                    //deleteFriendByTo(data);
                }
            });
            db.end(connection);
        }
    });

    //退群操作
    socket.on('quitGroup', function (data,callback) {
        callback(true);
        var userId = data.userId;//退出人ID
        var group_id = data.groupId;//群ID
        var isManager = data.isManager;//是否为群主，0不为群主，1是群主
        console.log("是否是群主："+isManager);
        var quit_time = Date.parse(new Date())/1000;
        var type = data.type;
        var message_type = 4;
        if(type == 11){
            if(isManager == 0){
                //更新退群状态标识
                var memberQuit_sql = "UPDATE tab_group_member SET status = 2 , quit_time = ? WHERE group_id = ? AND user_id = ?";
                var connection = db.connection();
                var params = [quit_time,group_id,userId];
                var tasks = [function(callback) {
                    connection.beginTransaction(function(err) {
                        callback(err);
                    });
                }, function(callback) {
                    connection.query(memberQuit_sql, params, function (err, result) {
                        console.log(memberQuit_sql);
                        console.log(params);
                        if (err) {
                            console.log('[query] - :' + err);
                            //退群失败推送给应答者
                            quitGroupErr(userId,data);

                        } else {
                            console.log('受影响的行数:', result.affectedRows);
                            console.log("退群成功!");
                            //将退群的好友从在线房间集合中删除
                            console.log("退出在线房间");
                            deleteGroupFriend(userId,group_id);
                            //退群成功推送给应答者
                            //quitGroupSoccess(userId,data,message_type);
                        }
                        callback(err);
                    });
                }, function(callback) {
                    var selGroup_sql = 'SELECT DISTINCT user_id as account FROM tab_group_member WHERE group_id =? AND status = 1';
                    connection.query(selGroup_sql, group_id, function (err, result) {
                        if (err) {
                            console.log('[query] - :' + err);
                        }else{
                            console.log('查询完成');
                            //退群成功推送给应答者
                            quitGroupSoccess(userId,data,result,group_id,message_type);

                            //改为串行退群给其他群成员推送退群人员信息
                            //quitGroupFriends(userId,result,group_id,message_type);
                        }
                        callback(err);
                    });

                }, function(callback) {
                    connection.commit(function(err) {
                        callback(err);
                    });
                }];

                async.series(tasks, function(err, results) {
                    if(err) {
                        console.log("发生错误事务回滚");
                        connection.rollback(); // 发生错误事务回滚
                    }else{
                    }
                    connection.end();
                });
            }else if(isManager == 1){
                var managerQuit_sql = "UPDATE tab_group_member SET status = 2 , quit_time = ? WHERE group_id = ? AND user_id = ?";
                var params = [quit_time,group_id,userId];
                var user_id = '';
                var results = '';
                var conn = db.connection();
                var tasks = [function(callback) {
                    conn.beginTransaction(function(err) {
                        callback(err);
                    });
                }, function(callback) {
                    conn.query(managerQuit_sql, params, function (err, result) {
                        console.log(managerQuit_sql);
                        console.log(params);
                        if (err) {
                            console.log('[query] - :' + err);
                            //退群失败推送给应答者
                            quitGroupErr(userId,data);

                        } else {
                            console.log('受影响的行数:', result.affectedRows);
                            console.log("退群成功!");
                            //将退群的好友从在线房间集合中删除
                            console.log("退出在线房间");
                            deleteGroupFriend(userId,group_id);
                            //退群成功推送给应答者
                            //quitGroupSoccess(userId,data,message_type);
                        }
                        callback(err);
                    });
                }, function(callback) {
                    var selGroup_sql = 'SELECT DISTINCT user_id as account FROM tab_group_member WHERE group_id =? AND status = 1';
                    conn.query(selGroup_sql, group_id, function (err, result) {
                        if (err) {
                            console.log('[query] - :' + err);
                        }else {
                            console.log('查询完成');
                            //退群给其他群成员推送退群人员信息
                            results = result;
                            //退群成功推送给应答者
                            quitGroupSoccess(userId,data,result,group_id,message_type);

                            //改为串行发送
                            //quitGroupFriends(userId,result,group_id,message_type);
                        }
                        callback(err);
                    });
                }, function(callback) {
                    //更换群主，同时通知所有群成员
                    //查询群的人数(人数为0，删除该群，人数大于O,更换群主并通知，群成员)
                    var count_group_sql = "SELECT count(1) as count FROM tab_group_member WHERE group_id = ? AND status = 1";
                    var count_group_param = [group_id];
                    conn.query(count_group_sql, count_group_param, function (err, result) {
                        if(err){
                            console.log(err);
                        }else{
                            console.log(result[0].count);
                            if(result[0].count == 0 ){
                                //删除群
                                var delete_group_sql = "DELETE FROM tab_group WHERE group_id = ?";
                                var delete_group_param = [group_id];
                                conn.query(delete_group_sql, delete_group_param, function (err, result) {
                                    if(err){
                                        console.log("删除群失败："+err);
                                    }else{
                                        console.log("删除群成功");
                                    }
                                });
                            }else{
                                //更换群主，并通知其他人
                                //查询群组最早加入群的人
                                var sql = "SELECT m.user_id FROM tab_group_member m WHERE m.join_time = " +
                                    "(SELECT min(join_time) FROM tab_group_member WHERE group_id = ? and status = 1); ";
                                var param = [group_id];
                                conn.query(sql,param, function(err, result) {
                                    if(err){
                                        console.log("查询最早成员失败！"+err);
                                    }else{
                                        console.log("查询最早成员成功！");
                                        user_id = result[0].user_id;
                                        console.log("新群主"+user_id);
                                        var message_type2 = 6;
                                        // 更换群主
                                        var update_manager_sql = "UPDATE tab_group SET manager_id = ? WHERE group_id = ?";
                                        var update_manager_param = [user_id,group_id];
                                        conn.query(update_manager_sql, update_manager_param, function(err, result) {
                                            console.log(update_manager_sql);
                                            console.log(update_manager_param);
                                            if(err){
                                                console.log("更换群主失败");
                                            }else{
                                                console.log("更换群主成功");
                                                //群主退群更新群主
                                                updateGroupMain(user_id,results,group_id,message_type2);
                                            }
                                        });
                                    }
                                });
                            }
                        }
                        callback(err);
                    });
                }, function(callback) {
                    conn.commit(function(err) {
                        callback(err);
                    });
                }];

                async.series(tasks, function(err, results) {
                    if(err) {
                        console.log("发生错误事务回滚");
                        conn.rollback(); // 发生错误事务回滚
                    }
                    conn.end();
                });
            }
        }
    });

});

//两人聊天消息发送
function sendChatmessage(send_date,data){
    var type = data.type;
    var i=1;
    if (type == 1) {
        //socket对象存在
        if (data.to in usocket) {
            var flag = false;
            usocket[data.to].emit('privateChat', data, function (datas) {
                flag = datas;
            });
            //判断15秒后是否发送成功，如果成功则不处理，如果不成功再次尝试发送一遍
            setTimeout(function () {
                //如果再次无法收到回调，将对方清除出socket对象 数组，
                console.log("发送后的结果：" + flag);
                if (flag != true) {
                    if (data.to in usocket) {
                        usocket[data.to].emit('privateChat', data, function (datas) {
                            flag = datas;
                        });
                        setTimeout(function () {
                            //如果再次无法收到回调，将对方清除出socket对象
                            if (flag != true) {
                                //if (usocket[data.to]) {
                                //    usocket[data.to].disconnect();
                                //}
                                console.log("再次无法收到回调,socket对象被清除");
                                //调肖浪业务：将数据保存到数据库；
                                if (data.contenttype == 2) {
                                    friendchat(data.user, data.to, data.msg, 2, null);//1：文本消息；2 ：图片消息
                                } else if (data.contenttype == 1) {
                                    friendchat(data.user, data.to, null, 1, data.msg);//1：文本消息；2 ：图片消息
                                } else if (data.contenttype == 3){
                                    friendchat(data.user, data.to, null, 3, data.msg);//1：文本消息；2 ：图片消息; 3：语音消息
                                }
                            } else {
                                console.log('to' + data.to, data);
                                console.log("第二次发送成功！");
                                if (data.contenttype == 2) {
                                    zxfriendchat(send_date,data.user, data.to, data.msg, 2, null);//1：文本消息；2 ：图片消息
                                } else if (data.contenttype == 1) {
                                    zxfriendchat(send_date,data.user, data.to, null, 1, data.msg);//1：文本消息；2 ：图片消息
                                } else if (data.contenttype == 3){
                                    zxfriendchat(send_date,data.user, data.to, null, 3, data.msg);//1：文本消息；2 ：图片消息; 3：语音消息
                                }
                            }
                        }, 5000);
                    } else {
                        console.log("第二次尝试发送，socket对象不存在！");
                        if (data.contenttype == 2) {
                            friendchat(data.user, data.to, data.msg, 2, null);//1：文本消息；2 ：图片消息
                        } else if (data.contenttype == 1) {
                            friendchat(data.user, data.to, null, 1, data.msg);//1：文本消息；2 ：图片消息
                        } else if (data.contenttype == 3){
                            friendchat(data.user, data.to, null, 3, data.msg);//1：文本消息；2 ：图片消息; 3：语音消息
                        }
                    }
                } else {
                    console.log('to' + data.to, data);
                    console.log("聊天消息发送成功！");
                    if (data.contenttype == 2) {
                        zxfriendchat(send_date,data.user, data.to, data.msg, 2, null);//1：文本消息；2 ：图片消息
                    } else if (data.contenttype == 1) {
                        zxfriendchat(send_date,data.user, data.to, null, 1, data.msg);//1：文本消息；2 ：图片消息
                    } else if (data.contenttype == 3){
                        zxfriendchat(send_date,data.user, data.to, null, 3, data.msg);//1：文本消息；2 ：图片消息; 3：语音消息
                    }
                }
            }, 15000);
        } else {
            console.log("socket对象不存在");
            if (data.contenttype == 2) {
                friendchat(data.user, data.to, data.msg, 2, null);//1：文本消息；2 ：图片消息
            } else if (data.contenttype == 1) {
                friendchat(data.user, data.to, null, 1, data.msg);//1：文本消息；2 ：图片消息
            } else if (data.contenttype == 3){
                friendchat(data.user, data.to, null, 3, data.msg);//1：文本消息；2 ：图片消息; 3：语音消息
            }
        }
    }
}

//群广播消息
function sendGroupChat(send_date,data,socket,user){
    socket.broadcast.to(roomid).emit('groupChat',user, data);
    //好友不在线时消息存储
    if(data.contenttype == 2){
        zxgroupChat(send_date,data.user,roomInfo[roomid],data.msg,2,null,roomid);//1：文本消息；2 ：图片
        groupChat(data.user,roomInfo[roomid],data.msg,2,null,roomid);//1：文本消息；2 ：图片
    }else if(data.contenttype == 1){
        zxgroupChat(send_date,data.user,roomInfo[roomid],null,1,data.msg,roomid);//1：文本消息；2 ：图片消息
        groupChat(data.user,roomInfo[roomid],null,1,data.msg,roomid);//1：文本消息；2 ：图片消息
    }else if(data.contenttype == 3){
        zxgroupChat(send_date,data.user,roomInfo[roomid],null,3,data.msg,roomid);//1：文本消息；2 ：图片消息; 3：语音消息
        groupChat(data.user,roomInfo[roomid],null,3,data.msg,roomid);//1：文本消息；2 ：图片消息; 3：语音消息
    }
};

//添加好友消息发送
function addFriendMessage(data){
    //console.log("加好友应答者头像："+selUserImg(data.user));
    console.log("头像：-------------"+data.img);
    if (data.to in usocket) {
        var selUserImg_sql = "SELECT img FROM tab_img WHERE img_id = (SELECT user_img_id FROM tab_user_info WHERE account = ?)";
        var params = [data.user];
        var connection = db.connection();
        connection.query(selUserImg_sql, params, function (err, result){
            console.log(selUserImg_sql);
            console.log(params);
            if(err){
                console.log("查询头像失败"+err);
            }else{
                data.reqhead = result[0].img;
                console.log("查询头像成功"+data.reqhead);
                var flag = false;
                usocket[data.to].emit('addFriend', data,function(datas){
                    flag = datas;
                });
                setTimeout(function() {
                    console.log("第一次发送好友请求结果"+flag);
                    console.log(flag);
                    //判断客户端有没有收到服务器端推送的消息
                    //无法收到回调；再次推送
                    if (flag != true) {
                        if(data.to in usocket){
                            usocket[data.to].emit('addFriend', data,function(datas) {
                                flag = datas;
                            });
                            setTimeout(function() {
                                //如果再次无法收到回调，将对方清除出socket对象
                                if (flag != true) {
                                    //if(usocket[data.to]){
                                    //    usocket[data.to].disconnect();
                                    //}
                                    console.log("再次无法收到回调,socket对象被清除");
                                    //调肖浪业务：将数据保存到数据库；
                                    addFriend(data.user,data.to,null);
                                }else{
                                    console.log('to' + data.to, data);
                                    console.log("发送成功！");
                                }
                            }, 2000);
                        }
                    }else{
                        console.log('to' + data.to, data);
                        console.log("添加好友信息发送成功！");
                    }
                }, 5000);
            }
            connection.end();
        });
    } else {
        //注：添加好友请求记录到数据库，用户上线后及时推送消息（与肖浪对接）
        addFriend(data.user,data.to,null);
    }
}

//添加好友失败，给被邀请人发送消息
function addFriendErr(data){
    if (data.to in usocket) {
        var flag = false;
        data.result = 'error';
        usocket[data.to].emit('addFriendResult', data, function (datas) {
            flag = datas;
        });
        setTimeout(function() {
            console.log(flag);
            //判断客户端有没有收到服务器端推送的消息
            //无法收到回调；再次推送
            if (flag != true) {
                if (data.to in usocket) {
                    usocket[data.to].emit('addFriendResult', data, function (datas) {
                        flag = datas;
                    });
                    setTimeout(function() {
                        //如果再次无法收到回调，将对方清除出socket对象 数组，
                        if (flag != true) {
                            //if(usocket[data.to]){
                            //    usocket[data.to].disconnect();
                            //}
                            //调肖浪业务：将数据保存到数据库；
                            console.log("再次无法收到回调,socket对象被清除");
                        } else {
                            console.log('to' + data.to, data);
                            console.log("好友添加失败消息第二次发送成功！");
                        }
                    }, 2000);
                }
            } else {
                console.log('to' + data.to, data);
                console.log("好友添加失败消息发送成功");
            }
        }, 5000);
    }
}

//添加成功，则将好友请求返回给接收人
function addFriendByTo(data,msg){
    console.log("头像：-------------"+data.invite_img);
    if (data.to in usocket) {
        var selUserImg_sql = "SELECT img FROM tab_img WHERE img_id = (SELECT user_img_id FROM tab_user_info WHERE account = ?)";
        var params = [data.user];
        var connection = db.connection();
        connection.query(selUserImg_sql, params, function (err, result){
            console.log(selUserImg_sql);
            console.log(params);
            if(err){
                console.log("查询头像失败"+err);
            }else {
                data.invite_img = result[0].img;
                console.log("查询头像成功" + data.invite_img);
                var flags = false;
                data.result = 'success';
                usocket[data.to].emit('addFriendResult', data, function (datas) {
                    flags = datas;
                });
                setTimeout(function() {
                    console.log("第一次给接受人发送结果"+flags);
                    //判断客户端有没有收到服务器端推送的消息
                    //无法收到回调；再次推送
                    if (flags != true) {
                        if (data.to in usocket){
                            usocket[data.to].emit('addFriendResult', data, function (datas) {
                                flags = datas;
                            });
                            setTimeout(function() {
                                console.log("第二次给发起人发送结果"+flags);
                                //如果再次无法收到回调，将对方清除出socket对象 数组，
                                if (flags != true) {
                                    //if(usocket[data.to]){
                                    //    usocket[data.to].disconnect();
                                    //}
                                    //调肖浪业务：将数据保存到数据库；
                                    friendchat(data.user,data.to,msg,2,null);
                                    addMessage(data.to,2,data.user);
                                    console.log("再次无法收到回调,socket对象被清除");
                                } else {
                                    //发送成功，给发起人推送
                                    addFriendByUser(data,msg);
                                    console.log('to' + data.to, data);
                                    console.log("第二次给接收人发送成功！");
                                }
                            }, 5000);
                        }else{
                            console.log("接收人Socket对象不存在");
                            friendchat(data.user,data.to,msg,2,null);
                            addMessage(data.to,2,data.user);
                        }

                    } else {
                        //发送成功，给发起人推送
                        addFriendByUser(data,msg);
                        console.log('to' + data.to, data);
                        console.log("给接收人发送成功！");
                    }
                }, 5000);
            }
            connection.end();
        });
    } else {//接收人不在线时
        //注：好友请求通过的消息记录到数据库，用户上线后及时推送消息（与肖浪对接）
        console.log("接收人已不在线！");
        friendchat(data.user,data.to,msg,2,null);
        addMessage(data.to,2,data.user);
    }
}

//添加成功，则将好友请求返回给发起人
function addFriendByUser(data,msg){
    //data.tohead = selUserImg(data.to);
    console.log("头像：-------------"+data.tohead);
    if (data.user in usocket) {
        var selUserImg_sql = "SELECT img FROM tab_img WHERE img_id = (SELECT user_img_id FROM tab_user_info WHERE account = ?)";
        var params = [data.to];
        var connection = db.connection();
        connection.query(selUserImg_sql, params, function (err, result){
            console.log(selUserImg_sql);
            console.log(params);
            if(err){
                console.log("查询头像失败"+err);
            }else{
                data.tohead = result[0].img;
                console.log("查询头像成功"+data.tohead);
                data.invite_img = '';
                data.result = 'success';
                var flagt = false;
                usocket[data.user].emit('addFriendResult', data, function (datas) {
                    console.log("给发起人答复");
                    flagt = datas;
                });
                setTimeout(function() {
                    console.log("第一次给发起人发送结果"+flagt);
                    //判断客户端有没有收到服务器端推送的消息
                    //无法收到回调；再次推送
                    if (flagt != true) {
                        if (data.user in usocket){
                            usocket[data.user].emit('addFriendResult', data, function (datas) {
                                console.log("给发起人答复2");
                                flagt = datas;
                            });
                            setTimeout(function() {
                                console.log("第二次给发起人发送结果"+flagt);
                                //如果再次无法收到回调，将对方清除出socket对象 数组，
                                if (flagt != true) {
                                    //if(usocket[data.user]){
                                    //    usocket[data.user].disconnect();
                                    //}
                                    //调肖浪业务：将数据保存到数据库；
                                    friendchat(data.to,data.user,msg,2,null);
                                    addMessage(data.user,2,data.to);
                                    console.log("再次无法收到回调,socket对象被清除");
                                } else {
                                    console.log('to' + data.user, data);
                                    console.log("第二次给发起人发送成功！");
                                }
                            }, 5000);
                        }else{
                            console.log("发起人Socket对象不存在");
                            friendchat(data.to,data.user,msg,2,null);
                            addMessage(data.user,2,data.to);
                        }

                    } else {
                        console.log('to' + data.user, data);
                        console.log("给发起人发送成功！");
                    }
                }, 5000);
            }
            connection.end();
        });
    }else{
        //注：好友请求通过的消息记录到数据库，用户上线后及时推送消息（与肖浪对接）
        console.log("发起人已不在线！");
        friendchat(data.to,data.user,msg,2,null);
        addMessage(data.user,2,data.to);
    }

}

//推送建群失败
function createGroupErr(data){
    //推送建群失败
    if (data.user in usocket) {
        var flagt = false;
        data.result = 'error';
        data.manager_id = data.user;
        usocket[data.user].emit('addGroupFriends', data, function (datas) {
            flagt = datas;
        });
        setTimeout(function() {
            console.log(flagt);
            //判断客户端有没有收到服务器端推送的消息
            //无法收到回调；再次推送
            if (flagt != true) {
                if (data.user in usocket){
                    usocket[data.user].emit('addGroupFriends', data, function (datas) {
                        flagt = datas;
                    });
                    setTimeout(function() {
                        //如果再次无法收到回调，将对方清除出socket对象 数组，
                        if (flagt != true) {
                            //if(usocket[data.user]){
                            //    usocket[data.user].disconnect();
                            //}
                            console.log("再次无法收到回调,socket对象被清除");
                        } else {
                            console.log('to' + data.user, data);
                            console.log("第二次发送建群失败，给群主推送成功！");
                        }
                    }, 2000);
                }
            } else {
                console.log('to' + data.user, data);
                console.log("建群失败，给群主推送成功！");
            }
        }, 5000);
    }
}

//推送建群成功
function createGroupSucc(data){
    var offlineusers = new Array();
    //推送建群成功
    if (data.user in usocket) {
        data.result = 'success';
        var flag = false;
        usocket[data.user].emit('addGroupFriends', data, function (datas) {
            flag = datas;
        });
        setTimeout(function() {
            console.log(flag);
            //判断客户端有没有收到服务器端推送的消息
            //无法收到回调；再次推送
            if (flag != true) {
                if (data.user in usocket){
                    usocket[data.user].emit('addGroupFriends', data, function (datas) {
                        flag = datas;
                    });
                    setTimeout(function() {
                        //如果再次无法收到回调，将对方清除出socket对象 数组，
                        if (flag != true) {
                            console.log("再次无法收到回调,socket对象被清除");
                            //if(usocket[data.user]){
                            //    usocket[data.user].disconnect();
                            //}
                            offlineusers.push(data.user);

                        } else {
                            //群创建成功，给邀请的好友广播加群消息
                            addGroupFriends(data);
                            console.log('to' + data.user, data);
                            console.log("第二次发送建群成功，给群主推送成功！");
                        }
                    }, 2000);
                }else{
                    offlineusers.push(data.user);
                    console.log("再次发送，Socket对象不存在");
                }

            } else {
                //群创建成功，给邀请的好友广播加群消息
                addGroupFriends(data);
                console.log('to' + data.user, data);
                console.log("建群成功，给群主推送成功！");
            }
        }, 5000);
    }else{
        offlineusers.push(data.user);
        console.log("群主不在线！");
    }
    //注：如果用户不在线，添加群好友请求记录到数据库，用户上线后及时推送消息（与肖浪对接）
    if(offlineusers.length>0){
        groupInvite(offlineusers,data.user,data.groupid,data.groupname,null);
    }
}

//给邀请的好友广播加群消息
function addGroupFriends(data){
    var offlineusers = new Array();
    //注： 1、to:varchar,//被邀请人ID（数组），遍历被邀请人的数组，推送消息给每个好友
    var invites = data.to;
    //建群成功后，给邀请的成员发送消息
    for(var i=0; i<invites.length; i++){
        console.log("邀请的群成员，第"+i+"个："+invites[i]);
        var touser = invites[i];
        data.to = touser;
        if (touser in usocket){
            var flag = false;
            console.log('to' + touser, data);
            usocket[touser].emit('addGroupFriends', data,function(datas){
                flag = datas;
            });
            setTimeout(function() {
                console.log(flag);
                //判断客户端有没有收到服务器端推送的消息
                //无法收到回调；再次推送
                if (flag != true) {
                    if (touser in usocket){
                        usocket[touser].emit('addGroupFriends', data, function (datas) {
                            flag = datas;
                        });
                        setTimeout(function() {
                            //如果再次无法收到回调，将对方清除出socket对象 数组，
                            if (flag != true) {
                                //if(usocket[touser]){
                                //    usocket[touser].disconnect();
                                //}
                                console.log("再次无法收到回调,socket对象被清除");
                                //将不在线好友放在集合中
                                offlineusers.push(touser);
                                //调肖浪业务：将数据保存到数据库；
                                groupInvite(offlineusers,data.user,data.groupid,data.groupname,null);
                            } else {
                                console.log('to' + touser, data);
                                console.log("发送成功！");
                            }
                        }, 2000);
                    }else{
                        //将不在线好友放在集合中
                        offlineusers.push(touser);
                    }

                } else {
                    console.log('to' + touser, data);
                    console.log("群邀请信息发送成功！");
                }
            }, 5000);
        }else{//不在线时
            //将不在线好友放在集合中
            offlineusers.push(touser);
        }
    }

    //注：如果用户不在线，添加群好友请求记录到数据库，用户上线后及时推送消息（与肖浪对接）
    //groupInvite(offlineusers,invite_id,group_id,group_name,comments);
    if(offlineusers.length>0){
        groupInvite(offlineusers,data.user,data.groupid,data.groupname,null);
    }
}

//加群失败给应答者推送
function addGroupAgreeErr(accept_id,data){
    data.result = "error";
    if (accept_id in usocket) {
        var flag = false;
        usocket[accept_id].emit('addGroupByAcceptId', data, function (datas) {
            flag = datas;
        });
        //判断5秒后是否发送成功，如果成功则不处理，如果不成功再次尝试发送一遍
        setTimeout(function () {
            //如果再次无法收到回调，将对方清除出socket对象 数组，
            console.log("发送后的结果：" + flag);
            if (flag != true) {
                if (accept_id in usocket) {
                    usocket[accept_id].emit('addGroupByAcceptId', data, function (datas) {
                        flag = datas;
                    });
                    setTimeout(function () {//如果再次无法收到回调，将对方清除出socket对象
                        if (flag != true) {
                            console.log("再次无法收到回调,socket对象被清除");
                        } else {
                            console.log('to' + accept_id, data);
                            console.log("第二次发送成功！");
                        }
                    }, 2000);
                } else {
                    console.log("第二次尝试发送，socket对象不存在！");
                }
            } else {
                console.log('to' + accept_id, data);
                console.log("加群失败信息发送成功！");
            }
        }, 5000);
    } else {
        console.log("socket对象不存在");
    }
}

//加群成功给应答者推送
function addGroupByAcceptId(accept_id,data,row,result){
    data.result = "success";
    data.group = row[0];
    data.results = result;
    //socket对象存在
    if (accept_id in usocket) {
        var flag = false;
        usocket[accept_id].emit('addGroupByAcceptId', data, function (datas) {
            flag = datas;
        });
        //判断5秒后是否发送成功，如果成功则不处理，如果不成功再次尝试发送一遍
        setTimeout(function () {
            //如果再次无法收到回调，将对方清除出socket对象 数组，
            console.log("发送后的结果：" + flag);
            if (flag != true) {
                if (accept_id in usocket) {
                    usocket[accept_id].emit('addGroupByAcceptId', data, function (datas) {
                        flag = datas;
                    });
                    setTimeout(function () {//如果再次无法收到回调，将对方清除出socket对象
                        if (flag != true) {
                            console.log("再次无法收到回调,socket对象被清除");
                        } else {
                            console.log('to' + accept_id, data);
                            console.log("第二次发送成功！");
                            //给应答者推送成功后，再给群老成员推送
                            newGroupFriends(accept_id,data,result,5);
                        }
                    }, 2000);
                } else {
                    console.log("第二次尝试发送，socket对象不存在！");

                }
            } else {
                console.log('to' + accept_id, data);
                console.log("加群成功信息发送成功！");
                //给应答者推送成功后，再给群老成员推送
                newGroupFriends(accept_id,data,result,5);
            }
        }, 5000);
    } else {
        console.log("socket对象不存在");
    }
}

//加群成功给群老成员推送新成员信息
function newGroupFriends(accept_id,data,result,message_type){
    //data.img = selUserImg(data.acceptId);
    console.log("头像：-------------"+data.img);
    var selUserImg_sql = "SELECT img FROM tab_img WHERE img_id = (SELECT user_img_id FROM tab_user_info WHERE account = ?)";
    var params = [data.acceptId];
    var connection = db.connection();
    connection.query(selUserImg_sql, params, function (err, results){
        console.log(selUserImg_sql);
        console.log(params);
        if(err){
            console.log("查询头像失败"+err);
        }else{
            data.img = results[0].img;
            console.log("查询头像成功"+data.img);
            for(var x in result){
                if(accept_id != result[x].account){
                    if (result[x].account in usocket) {
                        var flag = false;
                        usocket[result[x].account].emit('newGroupFriends', {acceptId:accept_id,
                            username:data.username,
                            img:data.img,
                            groupId:data.groupId,
                            type:8
                        }, function (datas) {
                            flag = datas;
                        });
                        //判断5秒后是否发送成功，如果成功则不处理，如果不成功再次尝试发送一遍
                        setTimeout(function () {
                            //如果再次无法收到回调，将对方清除出socket对象 数组，
                            console.log("发送后的结果：" + flag);
                            if (flag != true) {
                                if (result[x].account in usocket) {
                                    usocket[result[x].account].emit('newGroupFriends', {acceptId:accept_id,
                                        username:data.username,
                                        img:data.img,
                                        groupId:data.groupId,
                                        type:8
                                    }, function (datas) {
                                        flag = datas;
                                    });
                                    setTimeout(function () {//如果再次无法收到回调，将对方清除出socket对象
                                        if (flag != true) {
                                            console.log("再次无法收到回调,socket对象被清除");
                                            //将加群通知保存在数据库
                                            index.updateMember(result[x].account,data.groupId,accept_id,message_type);
                                        } else {
                                            console.log("第二次发送群新成员信息成功！");
                                        }
                                    }, 2000);
                                } else {
                                    console.log("第二次尝试发送，socket对象不存在！");
                                    //将加群通知保存在数据库
                                    index.updateMember(result[x].account,data.groupId,accept_id,message_type);
                                }
                            } else {
                                console.log("群新成员信息发送成功！");
                            }
                        }, 5000);
                    } else {
                        console.log("socket对象不存在");
                        //将加群通知保存在数据库
                        index.updateMember(result[x].account,data.groupId,accept_id,message_type);
                    }
                }
            }
        }
        connection.end();
    });

}

//删除好友失败，推送消息
function deleteFriendErr(data){
    if (data.user in usocket) {
        var flag = false;
        data.result = 'error';
        console.log('to' + data.user, data);
        usocket[data.user].emit('deleteFriend', data, function (datas) {
            console.log("删除失败已发送");
            flag = datas;
        });
        setTimeout(function() {
            console.log("删除失败发送结果："+flag);
            //判断客户端有没有收到服务器端推送的消息
            //无法收到回调；再次推送
            if (flag != true) {
                if (data.user in usocket){
                    usocket[data.user].emit('deleteFriend', data, function (datas) {
                        console.log("删除失败已发送22");
                        flag = datas;
                    });
                    setTimeout(function() {
                        console.log("删除失败第二次发送结果："+flag);
                        //如果再次无法收到回调，将对方清除出socket对象 数组，
                        if (flag != true) {
                            //if(usocket[data.user]){
                            //    usocket[data.user].disconnect();
                            //}
                            console.log("再次无法收到回调,socket对象被清除");
                        } else {
                            console.log('to' + data.to, data);
                            console.log("好友删除失败信息发送成功");
                        }
                    }, 2000);
                }
            } else {
                console.log('to' + data.user, data);
                console.log("给自己发送成功！");
            }
        }, 5000);
    }
}

//删除成功，给删除人推送消息
function deleteFriendByUser(data){
    if (data.user in usocket) {
        var flags = false;
        data.result = 'success';
        //删除的状态
        data.status = 0;
        console.log('to' + data.user, data);
        usocket[data.user].emit('deleteFriend', data, function (datas) {
            console.log("删除成功，给删除人已发送");
            flags = datas;
        });
        setTimeout(function() {
            console.log("删除成功，给删除人发送结果"+flags);
            //判断客户端有没有收到服务器端推送的消息
            //无法收到回调；再次推送
            if (flags != true) {
                if (data.user in usocket){
                    usocket[data.user].emit('deleteFriend', data, function (datas) {
                        console.log("删除成功，第二次给删除人已发送");
                        flags = datas;
                    });
                    setTimeout(function() {
                        console.log("删除成功，第二次给删除人发送结果"+flags);
                        //如果再次无法收到回调，将对方清除出socket对象 数组，
                        if (flags != true) {
                            //if(usocket[data.user]){
                            //    usocket[data.user].disconnect();
                            //}
                            //调肖浪业务：将数据保存到数据库；
                            addMessage(data.user,3,data.to);
                            console.log("再次无法收到回调,socket对象被清除");
                        } else {
                            //删除人推送成功后给被删除人推送
                            deleteFriendByTo(data);
                            console.log('to' + data.user, data);
                            console.log("好友删除消息发送成功！");
                        }
                    }, 2000);
                }else{
                    addMessage(data.user,3,data.to);
                }

            } else {
                //删除人推送成功后给被删除人推送
                deleteFriendByTo(data);
                console.log('to' + data.user, data);
                console.log("好友删除消息发送成功！");
            }
        }, 5000);
    }else{//发起人不在线时
        //注：删除好友消息记录到数据库，用户上线后及时推送消息（与肖浪对接）
        addMessage(data.user,3,data.to);
        //addMessage(receive_id,3,message_mapping_id);

    }
}

//删除成功，给被删除人推送消息
function deleteFriendByTo(data){
    if (data.to in usocket) {
        data.result = 'success';
        var flagt = false;
        console.log('to' + data.user, data);
        //删除的状态
        data.status = 1;
        usocket[data.to].emit('deleteFriend', data, function (datas) {
            console.log("删除成功，给被删除人已发送");
            flagt = datas;
        });
        setTimeout(function() {
            console.log("删除成功，给删除人发送结果"+flagt);
            //判断客户端有没有收到服务器端推送的消息
            //无法收到回调；再次推送
            if (flagt != true) {
                if (data.to in usocket){
                    usocket[data.to].emit('deleteFriend', data, function (datas) {
                        console.log("删除成功，第二次给被删除人已发送");
                        flagt = datas;
                    });
                    setTimeout(function() {
                        console.log("删除成功，第二次给被删除人发送结果"+flagt);
                        //如果再次无法收到回调，将对方清除出socket对象 数组，
                        if (flagt != true) {
                            //if(usocket[data.to]){
                            //    usocket[data.to].disconnect();
                            //}
                            //调肖浪业务：将数据保存到数据库；
                            addMessage(data.to,3,data.user);
                            console.log("再次无法收到回调,socket对象被清除");
                        } else {
                            console.log('to' + data.to, data);
                            console.log("发送成功！");
                        }
                    }, 2000);
                }else{
                    addMessage(data.to,3,data.user);
                }

            } else {
                console.log('to' + data.to, data);
                console.log("好友被删除消息发送成功！");
            }
        }, 5000);
    }else{//被删除人不在线时
        //注：删除好友消息记录到数据库，用户上线后及时推送消息（与肖浪对接）
        addMessage(data.to,3,data.user);
    }
}

//退群失败推送给删除人
function quitGroupErr(userId,data){
    data.result = "error";
    if (userId in usocket) {
        var flag = false;
        usocket[userId].emit('quitGroupResult', data, function (datas) {
            flag = datas;
        });
        //判断5秒后是否发送成功，如果成功则不处理，如果不成功再次尝试发送一遍
        setTimeout(function () {
            //如果再次无法收到回调，将对方清除出socket对象 数组，
            console.log("发送后的结果：" + flag);
            if (flag != true) {
                if (userId in usocket) {
                    usocket[userId].emit('quitGroupResult', data, function (datas) {
                        flag = datas;
                    });
                    setTimeout(function () {//如果再次无法收到回调，将对方清除出socket对象
                        if (flag != true) {
                            console.log("再次无法收到回调,socket对象被清除");
                        } else {
                            console.log('to' + userId, data);
                            console.log("第二次发送成功！");
                        }
                    }, 2000);
                } else {
                    console.log("第二次尝试发送，socket对象不存在！");
                }
            } else {
                console.log('to' + userId, data);
                console.log("退群失败信息发送成功！");
            }
        }, 5000);
    } else {
        console.log("socket对象不存在");
    }
}

//退群成功推送给删除人
function quitGroupSoccess(userId,data,result,group_id,message_type){
    data.result = "success";
    if (userId in usocket) {
        var flag = false;
        usocket[userId].emit('quitGroupResult', data, function (datas) {
            flag = datas;
        });
        //判断5秒后是否发送成功，如果成功则不处理，如果不成功再次尝试发送一遍
        setTimeout(function () {
            //如果再次无法收到回调，将对方清除出socket对象 数组，
            console.log("发送后的结果：" + flag);
            if (flag != true) {
                if (userId in usocket) {
                    usocket[userId].emit('quitGroupResult', data, function (datas) {
                        flag = datas;
                    });
                    setTimeout(function () {//如果再次无法收到回调，将对方清除出socket对象
                        if (flag != true) {
                            console.log("再次无法收到回调,socket对象被清除");
                            index.updateMember(userId,data.group_id,userId,message_type);
                        } else {
                            //退群给其他群成员推送退群人员信息
                            quitGroupFriends(userId,result,group_id,message_type);
                            console.log('to' + userId, data);
                            console.log("第二次退群成功信息发送成功！");
                        }
                    }, 2000);
                } else {
                    console.log("第二次尝试发送，socket对象不存在！");
                    index.updateMember(userId,data.group_id,userId,message_type);
                }
            } else {
                //退群给其他群成员推送退群人员信息
                quitGroupFriends(userId,result,group_id,message_type);
                console.log('to' + userId, data);
                console.log("退群成功信息发送成功！");

            }
        }, 5000);
    } else {
        console.log("socket对象不存在");
        index.updateMember(userId,data.group_id,userId,message_type);
    }
}

//退群给其他群成员推送退群人员信息
function quitGroupFriends(userId,result,group_id,message_type){
    for(var x in result){
        if(userId != result[x].account){
            if (result[x].account in usocket) {
                var flag = false;
                usocket[result[x].account].emit('updateGroupFriends', {userId:userId,
                    groupId:group_id,
                    type:11
                }, function (datas) {
                    flag = datas;
                });
                //判断5秒后是否发送成功，如果成功则不处理，如果不成功再次尝试发送一遍
                setTimeout(function () {
                    //如果再次无法收到回调，将对方清除出socket对象 数组，
                    console.log("发送后的结果：" + flag);
                    if (flag != true) {
                        if (result[x].account in usocket) {
                            usocket[result[x].account].emit('updateGroupFriends', {userId:userId,
                                groupId:group_id,
                                type:11
                            }, function (datas) {
                                flag = datas;
                            });
                            setTimeout(function () {//如果再次无法收到回调，将对方清除出socket对象
                                if (flag != true) {
                                    console.log("再次无法收到回调,socket对象被清除");
                                    //将退群通知保存在数据库
                                    index.updateMember(result[x].account,group_id,userId,message_type);
                                } else {
                                    console.log("第二次发送退群成员信息成功！");
                                }
                            }, 2000);
                        } else {
                            console.log("第二次尝试发送，socket对象不存在！");
                            //将退群通知保存在数据库
                            index.updateMember(result[x].account,group_id,userId,message_type);
                        }
                    } else {
                        console.log("退群成员信息发送成功！");
                    }
                }, 5000);
            } else {
                console.log("socket对象不存在");
                //将退群通知保存在数据库
                index.updateMember(result[x].account,group_id,userId,message_type);
            }
        }
    }
}

//群主退群更新群主
function updateGroupMain(user_id,result,group_id,message_type2){
    console.log(group_id);
    for(var x in result){
        if (result[x].account in usocket) {
            var flag = false;
            usocket[result[x].account].emit('updateGroupMain', {userId:user_id,
                groupId:group_id,
                type:11
            }, function (datas) {
                flag = datas;
            });
            //判断5秒后是否发送成功，如果成功则不处理，如果不成功再次尝试发送一遍
            setTimeout(function () {
                //如果再次无法收到回调，将对方清除出socket对象 数组，
                console.log("发送后的结果：" + flag);
                if (flag != true) {
                    if (result[x].account in usocket) {
                        usocket[result[x].account].emit('updateGroupMain', {userId:user_id,
                            groupId:group_id,
                            type:11
                        }, function (datas) {
                            flag = datas;
                        });
                        setTimeout(function () {//如果再次无法收到回调，将对方清除出socket对象
                            if (flag != true) {
                                console.log("再次无法收到回调,socket对象被清除");
                                //将群主更换通知保存在数据库
                                index.updateMember(result[x].account,group_id,user_id,message_type2);
                            } else {
                                console.log("第二次发送更换群主信息成功！");
                            }
                        }, 2000);
                    } else {
                        console.log("第二次尝试发送，socket对象不存在！");
                        //将群主更换通知保存在数据库
                        index.updateMember(result[x].account,group_id,user_id,message_type2);
                    }
                } else {
                    console.log("更换群主信息发送成功！");
                }
            }, 5000);
        } else {
            console.log("socket对象不存在");
            //将群主更换通知保存在数据库
            index.updateMember(result[x].account,group_id,user_id,message_type2);
        }
    }
}

//群成员添加成功时，将用户保存到房间中
function addGroupFriend(user,roomID){
    if(roomID){
        // 将用户加入房间名单中
        if (!roomInfo[roomID]) {
            roomInfo[roomID] = [];
        }
        var index = roomInfo[roomID].indexOf(user);
        if(index == -1){
            roomInfo[roomID].push(user);
        }
        if(offLineroomInfo[roomID]){
            var index = offLineroomInfo[roomID].indexOf(user);
            if (index != -1) {
                offLineroomInfo[roomID].splice(index,1);
            }
        }
        usocket[user].join(roomID);    // 加入房间
    }
}

//群成员退群并删除时，将群成员充房间中移除
function deleteGroupFriend(user,roomID){
    // 从房间名单中移除
    if(roomID){
        if(roomInfo[roomID]){
            var index = roomInfo[roomID].indexOf(user);
            if (index != -1) {
                roomInfo[roomID].splice(index, 1);
            }
        }
        usocket[user].leave(roomID);   //移除房间
    }
}

//系统时间以及打印在线离线人员
function systemdate(){
    var myDate = new Date();
    var year = myDate.getFullYear();
    var month = myDate.getMonth()+1>9?myDate.getMonth().toString():'0'+(myDate.getMonth()+1);
    var date = myDate.getDate()>9?myDate.getDate().toString():'0'+myDate.getDate();
    var hours = myDate.getHours()>9?myDate.getHours().toString():'0'+myDate.getHours();
    var minutes = myDate.getMinutes()>9?myDate.getMinutes().toString():'0'+myDate.getMinutes();
    var seconds = myDate.getSeconds()>9?myDate.getSeconds().toString():'0'+myDate.getSeconds();
    var milliseconds = myDate.getMilliseconds()>9?myDate.getMilliseconds().toString():'00'+myDate.getMilliseconds();
    if(myDate.getMilliseconds()<10){
        milliseconds = '00'+myDate.getMilliseconds();
    }else if(myDate.getMilliseconds()>10 && myDate.getMilliseconds()<100){
        milliseconds = '0'+myDate.getMilliseconds();
    }
    console.log(year+"-"+month+"-"+date+" "+hours+":"+minutes+":"+seconds+" "+milliseconds);
    console.log("在线人员：");
    console.log(users);
    console.log("在线房间人员：");
    console.log(roomInfo);
    console.log("离线房间人员：");
    console.log(offLineroomInfo);
}

//去掉右边的空白 　
function trimRight(s){
    if(s == null) return "";
    var whitespace = new String(" \t\n\r");
    var str = new String(s);
    if (whitespace.indexOf(str.charAt(str.length-1)) != -1){
        var i = str.length - 1;
        while (i >= 0 && whitespace.indexOf(str.charAt(i)) != -1){
            i--;
        }
        str = str.substring(0, i+1);
    }
    return str;
}


//用户登录
app.post("/user/login",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    //res.contentType("text/json; charset=utf-8");
    //res.header("Access-Control-Allow-Origin", "");
    //res.header("Access-Control-Allow-Headers", "X-Requested-With");
    //res.header("Cache-Control", "no-cache");
    var account = req.body.account;
    var password = req.body.password;
    userss.login(req,res,account,password);
});
//登录信息的初始化
//获取通讯录信息（当本地通讯录记录为0）(好友)
app.get("/friend/findAll",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    console.log("获取通讯录信息（当本地通讯录记录为0）(好友)");
    var account = req.query.account;
    var sql = "SELECT distinct  u.account,u.user_name,f.friend_remark,i.img " +
        "FROM tab_user_info AS u LEFT JOIN tab_friendship AS f ON f.friend_id = u.account " +
        "LEFT JOIN tab_img AS i ON u.user_img_id = i.img_id " +
        "WHERE f.user_id = ?  AND f.delete_type = 0";
    var params = [account];
    friendship.find(req,res,sql,params);
    //同时将信息表中对应的信息全部移除到历史表（规避老用户换新手机导致离线消息有重复记录）
    /*var sql1 = "insert into " +
     "his_tab_message(receive_id,message_type,create_time,message_mapping_id,his_create_time) " +
     "select receive_id,message_type,create_time,message_mapping_id,UNIX_TIMESTAMP(NOW()) from tab_message " +
     "where receive_id = ? and message_type in (1,2,3)";
     var sql2 = "DELETE FROM tab_message WHERE receive_id = ? and message_type in (1,2,3)";
     index.to_history(req,res,sql1,sql2,params);*/
});
//更新通讯录信息（本地的通讯录数量不为0）（好友）
app.get("/friend/update",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    console.log("更新通讯录信息（本地的通讯录数量不为0）（好友）");
    var account = req.query.account;
    var sql = "SELECT distinct u.account,u.user_name,f.friend_remark,i.img,m.message_type " +
        "FROM tab_user_info AS u " +
        "LEFT JOIN tab_friendship AS f ON f.friend_id = u.account " +
        "LEFT JOIN tab_img AS i ON u.user_img_id = i.img_id " +
        "LEFT JOIN tab_message AS m ON m.message_mapping_id = f.friend_id AND m.receive_id = f.user_id " +
        "WHERE m.receive_id = ? and m.message_type IN (1,2,3)";
    var params = [account];
    friendship.find(req,res,sql,params);
    //同时将信息表中对应的信息全部移除到历史表（规避老用户换新手机导致离线消息有重复记录）
    /*var sql1 = "insert into " +
     "his_tab_message(receive_id,message_type,create_time,message_mapping_id,his_create_time) " +
     "select receive_id,message_type,create_time,message_mapping_id,UNIX_TIMESTAMP(NOW()) from tab_message " +
     "where receive_id = ? and message_type in (1,2,3)";
     var sql2 = "DELETE FROM tab_message WHERE receive_id = ?  and message_type in (1,2,3) ";
     index.to_history(req,res,sql1,sql2,params);*/
});

//获取通讯录信息（当本地通讯录记录为0）(群成员)
app.get("/group/findAll",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    console.log("获取通讯录信息（当本地通讯录记录为0）(群成员)");
    var account = req.query.account;
    //var account = 13235523456;
    var sql = "SELECT u.account,g.group_user_name,g.group_id,i.img FROM tab_group_member g " +
        "LEFT JOIN tab_user_info AS u ON g.user_id = u.account " +
        " LEFT JOIN tab_img AS i ON i.img_id = u.user_img_id " +
        "WHERE g.group_id IN " +
        "(SELECT t.group_id from tab_group_member t WHERE t.user_id = ? AND t.status = 1 GROUP BY t.group_id)" +
        "AND g.status =1";
    var params = [account];
    group.find(req,res,sql,params);
    //同时将信息表中对应的信息全部移除到历史表（规避老用户换新手机导致离线消息有重复记录）
    /*var sql1 = "insert into " +
     "his_tab_message(receive_id,message_type,create_time,message_mapping_id,his_create_time) " +
     "select receive_id,message_type,create_time,message_mapping_id,UNIX_TIMESTAMP(NOW()) from tab_message " +
     "where receive_id = ? and message_type in (4,5)";
     var sql2 = "DELETE FROM tab_message WHERE receive_id = ? and message_type in (4,5)";
     index.to_history(req,res,sql1,sql2,params);*/
});
//更新通讯录信息（本地的通讯录数量不为0）（群成员）
app.get("/group/update",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    console.log("更新通讯录信息（本地的通讯录数量不为0）（群成员）");
    var account = req.query.account;
    //var account = 13235523452;
    var sql = "SELECT distinct u.account,i.img,g.group_user_name,m.message_type,g.group_id " +
        "FROM tab_group_member AS g " +
        "LEFT JOIN tab_user_info AS u ON g.user_id = u.account " +
        "LEFT JOIN tab_message AS m on message_mapping_id = u.account  AND m.group_id = g.group_id  " +
        "LEFT JOIN tab_img AS i ON i.img_id  = u.user_img_id " +
        "WHERE m.receive_id = ? AND m.message_type in (4,5,6)";
    var params = [account];
    group.find(req,res,sql,params);
    //同时将信息表中对应的信息全部移除到历史表（规避老用户换新手机导致离线消息有重复记录）
    /* var sql1 = "insert into " +
     "his_tab_message(receive_id,message_type,create_time,message_mapping_id,his_create_time) " +
     "select receive_id,message_type,create_time,message_mapping_id,UNIX_TIMESTAMP(NOW()) from tab_message " +
     "where receive_id = ? and message_type in (4,5)";
     var sql2 = "DELETE FROM tab_message WHERE receive_id = ?  and message_type in (4,5) ";
     index.to_history(req,res,sql1,sql2,params);*/
});

//通过用户ID查邀请信息,并将状态改为已发送
app.get("/invite/findAll",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    console.log("通过用户ID查邀请信息,并将状态改为已发送");
    var account = req.query.account;
    var sql = "SELECT DISTINCT u.account,u.user_name,t.img,i.accept_id,i.group_id,i.group_name,i.comments,i.invite_type" +
        " FROM " +
        "tab_user_info AS u LEFT JOIN tab_invite_info AS i ON u.account = i.invite_id " +
        "LEFT JOIN tab_img AS t ON t.img_id = u.user_img_id" +
        " WHERE " +
        "i.accept_id = ? and i.status = 0 ";
    var param = [account];
    invite.find(req,res,sql,param);
    //将邀请消息状态置为1
    /* var sql1 = "UPDATE tab_invite_info i SET i.status= 1 WHERE i.accept_id = ?";
     index.updateNoSend(req,res,sql1,param);*/
});

//获取二人聊天信息
app.get("/chat/friend/findAll",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    console.log("获取二人聊天信息");
    var account = req.query.account;
    var isptp = true;//是否为个人聊天，个人聊天需要做数据筛选
    var sql = "SELECT c.send_id,c.message,c.message_type,i.img  " +
        "FROM tab_chat AS c LEFT JOIN tab_img AS i ON c.img_id = i.img_id " +
        "WHERE c.receive_id = ? AND c.group_id is NULL ORDER BY c.send_id,send_time ASC";
    var param = [account];
    var toHistory_sql = "insert into his_tab_chat(send_id,receive_id,message,img_id,send_time,message_type,group_id,his_create_time) " +
        "select send_id,receive_id,message,img_id,send_time,message_type,group_id,UNIX_TIMESTAMP(NOW()) from tab_chat" +
        " where receive_id = ?  AND group_id is NULL";
    var toAllHistory_sql = "insert into all_his_tab_chat(send_id,receive_id,message,img_id,send_time,message_type,group_id,his_create_time) " +
        "select send_id,receive_id,message,img_id,send_time,message_type,group_id,UNIX_TIMESTAMP(NOW()) from tab_chat" +
        " where receive_id = ?  AND group_id is NULL";
    var detele_sql = "DELETE FROM tab_chat WHERE receive_id = ? AND group_id is NULL";
    chat.find(req,res,sql,param,toHistory_sql,toAllHistory_sql,detele_sql,isptp);
    //将对应的记录移除到历史表
    /* var sql1 = "insert into his_tab_chat(send_id,receive_id,message,img_id,send_time,message_type,group_id,his_create_time) " +
     "select send_id,receive_id,message,img_id,send_time,message_type,group_id,UNIX_TIMESTAMP(NOW()) from tab_chat" +
     " where receive_id = ?  AND group_id is NULL";
     var sql2 = "DELETE FROM tab_chat WHERE receive_id = ? AND group_id is NULL";
     index.toHistory(req,res,sql1,sql2,param);*/

});

//用户注册
app.post("/user/reg",function(req,res){
    res.header("Access-Control-Allow-Origin","");
    var account = req.body.account;
    var password = req.body.password;
    var nick_name = req.body.nickName;
    var create_time = Date.parse(new Date())/1000;
    var sql = "INSERT INTO tab_user_info(account,phone_number,password,user_name,create_time) VALUES(?,?,?,?,?)";
    var params = [account,account,password,nick_name,create_time];
    register.register(req,res,sql,params);

});

//注册验证，判断账号已被注册
app.get("/user/isexist",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    var account = req.query.account;
    var sql = "select count(1) from tab_user_info where account = ? ";
    var params = [account];
    register.isexist(req,res,sql,params);
});

//用户更新资料（昵称）
app.post("/user/update",multipartMiddleware,function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    var user_name = req.body.userName;
    var account = req.body.account;
    console.log(account+"修改昵称");
    var update_time = Date.parse(new Date())/1000;
    var update_sql = "UPDATE tab_user_info SET user_name =? , update_ime=?   where account = ? ";
    var update_params = [user_name,update_time,account];
    userss.update(req,res,update_sql,update_params);
    //通知所有好友自己的资料有变更
    var findAllFriend_sql = "SELECT friend_id FROM tab_friendship WHERE user_id = ?";
    var message_typ = 1;
    message.friend_info_update(req,res,findAllFriend_sql,account,message_typ);
});


//用户更新图片
app.post("/user/updateimg",multipartMiddleware,function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    var user_img = req.body.userImg;
    if(user_img.length > 7 && user_img != "" && user_img.substr(0,4)=='data'){
        //验证图片格式、数据正确
        var account = req.body.account;
        console.log(account+"修改图片");
        var update_time = Date.parse(new Date())/1000;
        //保存图片
        var addImg_sql = "INSERT INTO tab_img(type,img) VALUES (1,?);"
        //修改用户图片
        var updateImg_sql = "UPDATE tab_user_info SET user_img_id = ? , update_ime=?  where account = ? ";
        userss.updateImg(req,res,addImg_sql,updateImg_sql,account,user_img,update_time);
        //通知所有好友自己的资料有变更
        var findAllFriend_sql = "SELECT friend_id FROM tab_friendship WHERE user_id = ?";
        var message_typ = 1;
        message.friend_info_update(req,res,findAllFriend_sql,account,message_typ);
    }else{
        res.send({status: false});
    }

});

//通过电话号(ID)查看用户信息（添加好友使用）
app.get("/user/findById",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    var account = req.query.account;
    var sql = "SELECT " +
        "u.account,u.user_name,i.img " +
        "FROM " +
        "tab_user_info AS u LEFT JOIN tab_img AS i " +
        "ON u.user_img_id = i.img_id " +
        "WHERE u.account = ?";
    index.find(req,res,sql,account);
});

/*app.get("/user/findById",function(req,res){
 res.header("Access-Control-Allow-Origin","*");
 var phone_number = req.query.phonenumber;
 var sql = "select friend_id,friend_nikename,friend_remark,friend_img from tab_friendship where user_id = ? ";
 var params = [phone_number];
 index.find(req,res,sql,params);
 });*/

//加好友
function addFriend(invite_id,accept_id,comments){
    var create_time = Date.parse(new Date())/1000;
    var invite_type = 0;
    var sql = "INSERT INTO tab_invite_info(invite_id,accept_id,comments,create_time,invite_type) VALUES(?,?,?,?,?)";
    var params = [invite_id,accept_id,comments,create_time,invite_type];
    friendship.invite(sql,params);
}

//同意好友邀请
app.get("/friend/agree",function(req,res) {
    res.header("Access-Control-Allow-Origin", "*");
    var invite_id = req.body.invite_id;//邀请人ID
    var accept_id = req.body.accept_id;//被邀请人ID
    var add_time = Date.parse(new Date())/1000;
    var sql = "INSERT INTO tab_friendship(user_id,friend_id,add_time) VALUES(?,?,?),(?,?,?)";
    var params1 = [invite_id,accept_id,add_time,accept_id,invite_id,add_time];
    var params2 = [invite_id,accept_id];//移除到历史表所用
    friendship.addFriend(req, res, sql,params1,params2);
    //移除对应的邀请信息到历史表，可能没有
    /*var sql1 = "INSERT INTO his_tab_invite_info" +
     "(invite_id,accept_id,group_id,group_name,comments,create_time,invite_status,invite_type,his_create_time) " +
     "SELECT invite_id,accept_id,group_id,group_name,comments,create_time,1,invite_type,UNIX_TIMESTAMP(NOW()) from tab_invite_info" +
     " WHERE invite_id =?  AND accept_id =? ";
     var sql2 = "DELETE FROM tab_invite_info WHERE invite_id =?  AND accept_id =?";
     var params2 = [invite_id,accept_id];
     index.to_history(req,res,sql1,sql2,params2);*/
});

//不在线时需要存在数据库中
function addMessage(receive_id,message_type,message_mapping_id){
    var create_time = Date.parse(new Date())/1000;
    var sql = "INSERT INTO tab_message(receive_id,message_type,create_time,message_mapping_id) VALUES(?,?,?,?);";
    var params = [receive_id,message_type,create_time,message_mapping_id];
    message.insert(sql,params);
}

//新建群
app.post("/group/new",function(req,res) {
    res.header("Access-Control-Allow-Origin", "*");
    //新建一个群并把群主自动添加到群成员里面
    var group_name = req.body.groupName;//群名称
    var manager_id = req.body.managerId;//群主ID
    var manager_name = "哈哈";//群主昵称
    var group_comment = req.body.groupComment;//群简介
    var create_time = Date.parse(new Date())/1000;
    var sql1 = "INSERT INTO tab_group(group_name,manager_id,group_comment,create_time) VALUES(?,?,?,?)";//新建群
    var sql2 = "INSERT INTO tab_group_member(user_id,group_user_name,group_id,join_time) VALUES(?,?,?,?)";
    group.newGroup(req, res,sql1,sql2, group_name,manager_id,group_comment,create_time,manager_name);
});

//邀请好友进群
function groupInvite(accept_ids,invite_id,group_id,group_name,comments){
    var create_time = Date.parse(new Date())/1000;
    var sql = "INSERT INTO tab_invite_info" +
        "(invite_id,accept_id,group_id,group_name,comments,invite_type,create_time) VALUES";
    var params = new Array();
    for (var x in accept_ids){
        if((Number(x)+Number(1)) == accept_ids.length){
            sql += "(?,?,?,?,?,1,?)";
        }else{
            sql += "(?,?,?,?,?,1,?),";
        }
        params.push(invite_id);
        params.push(accept_ids[x]);
        params.push(group_id);
        params.push(group_name);
        params.push(comments);
        params.push(create_time);
    }
    console.log(sql);
    console.log(params);
    group.invite(sql,params);

};

//同意好友进群邀请
app.post("/friend/group/agree",function(req,res) {
    res.header("Access-Control-Allow-Origin", "*");
    var accept_id =  req.body.acceptId;//被邀请人ID
    var username =  req.body.username;//被邀请人昵称
    var group_id = req.body.groupId;//群ID
    var join_time = Date.parse(new Date())/1000;
    var addGroup_sql = "INSERT INTO tab_group_member(user_id,group_user_name,group_id,join_time) VALUES(?,?,?,?)";
    var findGroupMember_sql = "SELECT DISTINCT " +
        "g.group_id,u.account,g.group_user_name,i.img " +
        "FROM " +
        "tab_group_member as g " +
        "LEFT JOIN tab_user_info AS u ON g.user_id = u.account " +
        "LEFT JOIN tab_img AS i ON i.img_id = u.user_img_id " +
        "WHERE g.group_id =? AND g.status = 1";//查询群所有成员并返回
    var params = [accept_id,username,group_id,join_time];
    group.insert(req, res, addGroup_sql,findGroupMember_sql, params,group_id,accept_id);////添加新的成员，并返回群成员信息
    //将新加群的好友放入在线房间集合
    console.log("加入在线房间");
    addGroupFriend(accept_id,group_id);
    //移除对应的邀请信息到历史表（可能没有这条邀请信息）
    //通知群成员有新的成员加入
});

/*//删除好友
 app.get("/friend/remove",function(req,res){
 var userId = 1;
 var friendId = 2;
 var sql = "UPDATE tab_friendship SET delete_type = 1 WHERE user_id in (?,?) AND friend_id in (?,?)";
 var params = [userId,friendId,userId,friendId];
 index.update(req,res,sql,params);
 });*/

//退出群
app.post("/group/quit",function(req,res){
    res.header("Access-Control-Allow-Origin", "*");
    var userId = req.body.userId;//退出人ID
    var group_id = req.body.groupId;//群ID
    var isManager = req.body.isManager;//是否为群主，0不为群主，1是群主
    var quit_time = Date.parse(new Date())/1000;
    if(isManager == 0){
        var memberQuit_sql = "UPDATE tab_group_member SET status = 2 , quit_time = ? WHERE group_id = ? AND user_id = ?";
        group.quit(req,res,memberQuit_sql,quit_time,group_id,userId);
        //通知其他群成员有成员退群
    }else  if(isManager == 1){
        console.log("weq");
        var managerQuit_sql = "UPDATE tab_group_member SET status = 2 , quit_time = ? WHERE group_id = ? AND user_id = ?";
        group.managerQuit(req,res,managerQuit_sql,quit_time,group_id,userId);
        //通知其他群成员有成员退群
        //通知其他群成员群主有变更
    }
    //将退群的好友从在线房间集合中删除
    console.log("退出在线房间");
    deleteGroupFriend(userId,group_id);

});

//修改好友备注
app.post("/friend/updateRemark",function(req,res){
    var remark = req.body.remark;
    var userId = req.body.userId;
    var friendId = req.body.friendId;
    var updateFriendRemark_sql = "UPDATE tab_friendship SET friend_remark =?  WHERE user_id = ? AND friend_id =?";
    var updateFriendRemark_params = [remark,userId,friendId];
    index.update(req,res,updateFriendRemark_sql,updateFriendRemark_params);

});

//二人聊天离线信息缓存
function friendchat(send_id,receive_id,message,message_type,imgbase64){
    var send_time = Date.parse(new Date())/1000;
    if(message_type ==2 ){
        var addTextChat_sql = "INSERT INTO tab_chat(send_id,receive_id,message,send_time,message_type) VALUES(?,?,?,?,2)";
        var addTextChat_params = [send_id,receive_id,message,send_time];
        chat.textChat(addTextChat_sql,addTextChat_params);
    }else if(message_type == 1){
        var addimg_sql = "INSERT INTO tab_img(type,img) VALUES(2,?);";
        var addimg_param = [imgbase64];
        var addImgChat_sql = "INSERT INTO tab_chat(send_id,receive_id,send_time,img_id,message_type) VALUES(?,?,?,?,1)";
        var addImgChat_params = [send_id,receive_id,send_time];
        chat.imgChatFriend(addimg_sql,addImgChat_sql,addimg_param,addImgChat_params);
    }else if(message_type == 3){
        var addimg_sql = "INSERT INTO tab_img(type,img) VALUES(3,?);";
        var addimg_param = [imgbase64];
        var addImgChat_sql = "INSERT INTO tab_chat(send_id,receive_id,send_time,img_id,message_type) VALUES(?,?,?,?,3)";
        var addImgChat_params = [send_id,receive_id,send_time];
        chat.imgChatFriend(addimg_sql,addImgChat_sql,addimg_param,addImgChat_params);
    }
};
//二人聊天在线信息缓存
function zxfriendchat(send_date,send_id,receive_id,message,message_type,imgbase64){
    var send_time = Date.parse(new Date())/1000;
    if(message_type ==2 ){
        var addTextChat_sql = "INSERT INTO all_his_tab_chat(send_id,receive_id,message,send_time,message_type,his_create_time) VALUES(?,?,?,?,2,?)";
        var addTextChat_params = [send_id,receive_id,message,send_date,send_time];
        chat.textChat(addTextChat_sql,addTextChat_params);
    }else if(message_type == 1){
        var addimg_sql = "INSERT INTO tab_img(type,img) VALUES(2,?);";
        var addimg_param = [imgbase64];
        var addImgChat_sql = "INSERT INTO all_his_tab_chat(send_id,receive_id,send_time,message_type,his_create_time,img_id) VALUES(?,?,?,1,?,?)";
        var addImgChat_params = [send_id,receive_id,send_date,send_time];
        chat.imgChatFriend(addimg_sql,addImgChat_sql,addimg_param,addImgChat_params);
    }else if(message_type == 3){
        var addimg_sql = "INSERT INTO tab_img(type,img) VALUES(3,?);";
        var addimg_param = [imgbase64];
        var addImgChat_sql = "INSERT INTO all_his_tab_chat(send_id,receive_id,send_time,message_type,his_create_time,img_id) VALUES(?,?,?,3,?,?)";
        var addImgChat_params = [send_id,receive_id,send_date,send_time];
        chat.imgChatFriend(addimg_sql,addImgChat_sql,addimg_param,addImgChat_params);
    }
};

//群聊天离线信息缓存
function groupChat(send_id,online_ids,message,message_type,imgbase64,groupid){
    var send_time = Date.parse(new Date())/1000;
    var findGorupOtherMember_params = new  Array();
    var findGorupOtherMember_sql = "SELECT g.user_id FROM tab_group_member g WHERE g.group_id = ? AND g.status = 1 AND g.user_id NOT IN";
    findGorupOtherMember_sql += "(?,";
    findGorupOtherMember_params.push(groupid);
    findGorupOtherMember_params.push(send_id);
    for (var x in online_ids){
        findGorupOtherMember_sql += "?,"
        findGorupOtherMember_params.push(online_ids[x]);
    }
    findGorupOtherMember_sql = findGorupOtherMember_sql.substring(0,findGorupOtherMember_sql.length-1);//去掉最后面的逗号
    findGorupOtherMember_sql +=")";
    if(message_type == 2){
        var addTextChat_sql = "INSERT INTO tab_chat(send_id,receive_id,message,send_time,group_id,message_type) VALUES";
        chat.textChatGroup(findGorupOtherMember_sql,addTextChat_sql,findGorupOtherMember_params,send_id,message,send_time,groupid,message_type);
    }else if(message_type == 1){
        var addimg_sql = "INSERT INTO tab_img(type,img) VALUES(2,?);";
        var addimg_param = [imgbase64];
        var addImgChat_sql = "INSERT INTO tab_chat(send_id,receive_id,send_time,group_id,message_type,img_id) VALUES";
        chat.imgChatGroup(findGorupOtherMember_sql,addimg_sql,addImgChat_sql,findGorupOtherMember_params,addimg_param,send_id,send_time,groupid,message_type);
    }else if(message_type == 3){
        var addimg_sql = "INSERT INTO tab_img(type,img) VALUES(3,?);";
        var addimg_param = [imgbase64];
        var addImgChat_sql = "INSERT INTO tab_chat(send_id,receive_id,send_time,group_id,message_type,img_id) VALUES";
        chat.imgChatGroup(findGorupOtherMember_sql,addimg_sql,addImgChat_sql,findGorupOtherMember_params,addimg_param,send_id,send_time,groupid,message_type);
    }
};
//群聊天在线信息缓存
function zxgroupChat(send_date,send_id,online_ids,message,message_type,imgbase64,groupid){
    var send_time = Date.parse(new Date())/1000;
    if(message_type == 2){
        var addTextChat_sql = "INSERT INTO all_his_tab_chat(send_id,receive_id,message,send_time,group_id,message_type,his_create_time) VALUES";
        chat.zxtextChatGroup(addTextChat_sql,send_date,send_id,online_ids,message,send_time,groupid,message_type);
    }else if(message_type == 1){
        var addimg_sql = "INSERT INTO tab_img(type,img) VALUES(2,?);";
        var addimg_param = [imgbase64];
        var addImgChat_sql = "INSERT INTO all_his_tab_chat(send_id,receive_id,send_time,group_id,message_type,his_create_time,img_id) VALUES";
        chat.zximgChatGroup(addimg_sql,addImgChat_sql,addimg_param,send_date,send_id,online_ids,send_time,groupid,message_type);
    }else if(message_type == 3){
        var addimg_sql = "INSERT INTO tab_img(type,img) VALUES(3,?);";
        var addimg_param = [imgbase64];
        var addImgChat_sql = "INSERT INTO all_his_tab_chat(send_id,receive_id,send_time,group_id,message_type,his_create_time,img_id) VALUES";
        chat.zximgChatGroup(addimg_sql,addImgChat_sql,addimg_param,send_date,send_id,online_ids,send_time,groupid,message_type);
    }
};

//获取群聊天信息(个数)
app.get("/chat/group/count",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    var account = req.query.account;
    var findGroupChatCount_sql = "SELECT count(1) as count,c.group_id  " +
        "FROM tab_chat AS c LEFT JOIN tab_img AS i ON c.img_id = i.img_id " +
        "WHERE c.receive_id = ? AND c.group_id is  not NULL GROUP BY c.group_id ";
    var findGroupChatCount_param = [account];
    index.find(req,res,findGroupChatCount_sql,findGroupChatCount_param);
});

//查询每个群的聊天信息
app.get("/chat/group/findByGroupid",function(req,res){
    res.header("Access-Control-Allow-Origin","*");
    var account = req.query.account;
    var groupId = req.query.groupId;
    var isptp = false;
    var findGroupChat_sql = "SELECT c.send_id,c.message,c.message_type,c.group_id,i.img  " +
        "FROM tab_chat AS c LEFT JOIN tab_img AS i ON c.img_id = i.img_id " +
        "WHERE c.receive_id = ? AND c.group_id = ? ORDER BY c.group_id,send_time ASC ";
    var param = [account,groupId];

    //将对应的记录移除到历史表sql
    var toHistory_sql = "insert into his_tab_chat(send_id,receive_id,message,img_id,send_time,message_type,group_id,his_create_time) " +
        "select send_id,receive_id,message,img_id,send_time,message_type,group_id,UNIX_TIMESTAMP(NOW()) from tab_chat" +
        " where receive_id = ?  AND group_id  = ? ";
    var toAllHistory_sql = "insert into all_his_tab_chat(send_id,receive_id,message,img_id,send_time,message_type,group_id,his_create_time) " +
        "select send_id,receive_id,message,img_id,send_time,message_type,group_id,UNIX_TIMESTAMP(NOW()) from tab_chat" +
        " where receive_id = ?  AND group_id  = ? ";
    var delete_sql = "DELETE FROM tab_chat WHERE receive_id = ? AND group_id  = ? ";
    chat.find(req,res,findGroupChat_sql,param,toHistory_sql,toAllHistory_sql,delete_sql,isptp);



    //index.toHistory(req,res,sql1,sql2,param);*/

});
//获取群聊天信息
/*app.get("/chat/group/findAll",function(req,res){
 res.header("Access-Control-Allow-Origin","*");
 var account = req.query.account;
 var account = 2;
 var sql = "SELECT c.send_id,c.message,c.message_type,c.group_id,i.img  " +
 "FROM tab_chat AS c LEFT JOIN tab_img AS i ON c.img_id = i.img_id " +
 "WHERE c.receive_id = ? AND c.group_id is  not NULL ORDER BY c.group_id,send_time ASC ";
 var param = [account];
 index.find(req,res,sql,param);
 //将对应的记录移除到历史表
 var sql1 = "insert into his_tab_chat(send_id,receive_id,message,img_id,send_time,message_type,group_id,his_create_time) " +
 "select send_id,receive_id,message,img_id,send_time,message_type,group_id,UNIX_TIMESTAMP(NOW()) from tab_chat" +
 " where receive_id = ?  AND group_id is not NULL";
 var sql2 = "DELETE FROM tab_chat WHERE receive_id = ? AND group_id is not NULL";
 index.to_history(req,res,sql1,sql2,param);

 });*/

/*//用户更新资料（昵称）
 app.get("/user/update",multipartMiddleware,function(req,res){
 res.header("Access-Control-Allow-Origin","*");
 var user_name = "改名字喽";
 var account = 13235523456;
 var update_time = Date.parse(new Date())/1000;
 var sql1 = "UPDATE tab_user_info SET user_name =? , update_ime=?   where account = ? ";
 var params = [user_name,update_time,account];
 users.update(req,res,sql1,params);
 //通知所有好友自己的资料有变更
 var sql2 = "SELECT friend_id FROM tab_friendship WHERE user_id = ?";
 var message_typ = 1;
 message.friend_info_update(req,res,sql2,account,message_typ);
 });*/

/*
 app.get("/test",function(req,res){
 var sql ="SELECT DISTINCT " +
 "g.group_id,u.account,g.group_user_name,i.img " +
 "FROM  " +
 " tab_group_member as g   " +
 " LEFT JOIN tab_user_info AS u ON g.user_id = u.account  " +
 "LEFT JOIN tab_img AS i ON i.img_id = u.user_img_id  " +
 " WHERE g.group_id =21 "
 var connection = db.connection();
 connection.query(sql,function(err,rows,fields){
 console.log(sql);
 if(err){
 console.log('[query] - :'+err);
 res.send({status:false,remark:err});
 }else{
 res.send({status:true,data:rows});
 }
 });

 db.end(connection);
 });
 */

/*//拒绝入群邀请
 app.get("/group/refuse",function(req,res){
 res.header("Access-Control-Allow-Origin","*");
 var invite_id = 2;//邀请信息的id
 var accept_id = 1;
 var group_id = 1;
 var sql1 = "INSERT INTO his_tab_invite_info" +
 "(invite_id,accept_id,group_id,group_name,comments,create_time,invite_status,invite_type,his_create_time) " +
 "SELECT invite_id,accept_id,group_id,group_name,comments,create_time,2,invite_type,UNIX_TIMESTAMP(NOW()) from tab_invite_info" +
 " WHERE invite_id =?  AND accept_id =? AND group_id = ?";
 var sql2 = "DELETE FROM tab_invite_info WHERE invite_id =?  AND accept_id =? AND group_id = ?";
 var params = [invite_id,accept_id,group_id];
 index.to_history(req,res,sql1,sql2,params);
 res.send({status:true});
 });*/

/*
 //拒绝添加好友邀请
 function refFriend(invite_id,accept_id){
 var sql1 = "INSERT INTO his_tab_invite_info" +
 "(invite_id,accept_id,group_id,group_name,comments,create_time,invite_status,invite_type,his_create_time) " +
 "SELECT invite_id,accept_id,group_id,group_name,comments,create_time,2,invite_type,UNIX_TIMESTAMP(NOW()) from tab_invite_info" +
 " WHERE invite_id =?  AND accept_id =?";
 var sql2 = "DELETE FROM tab_invite_info WHERE invite_id =?  AND accept_id =?";
 var params = [invite_id,accept_id,group_id];
 index.toHistory(req,res,sql1,sql2,params);
 };*/

/*//message保存对端不在线的删除好友消息
 app.get("/friend/delete",function(req,res){
 var receive_id = 1;
 var create_time = Date.parse(new Date())/1000;
 var message_mapping_id = 2;
 var sql = "INSERT INTO tab_message(receive_id,message_type,create_time,message_mapping_id) VALUES(?,3,?,?)";
 var params = [receive_id,create_time,message_mapping_id];
 index.insert(req,res,sql,params);
 });*/

/*//更新群名片
 app.get("/test",function(req,res){
 var group_user_name = "哈哈";
 var groupId = 1;
 var userId = 1;
 var sql = "UPDATE tab_group_member SET group_user_name = ? WHERE user_id = ? AND group_id = ?;";
 var params = [group_user_name,groupId,userId];
 index.update(req,res,sql,params);
 });*/

/*//查询用户头像
function selUserImg(account){
    var userImg = '';
    var selUserImg_sql = "SELECT img FROM tab_img WHERE img_id = (SELECT user_img_id FROM tab_user_info WHERE account = ?)";
    var params = [account];
    var connection = db.connection();
    var tasks = [function(callback) {
        connection.beginTransaction(function(err) {
            callback(err);
        });
    }, function(callback) {
        connection.query(selUserImg_sql, params, function (err, result){
            console.log(selUserImg_sql);
            console.log(params);
            if(err){
                console.log("查询头像失败"+err);
            }else{
                console.log("查询头像成功");
                userImg = result[0].img;
            }
            callback(err);
        });
    }, function(callback) {
        connection.commit(function(err) {
            callback(err);
        });
    }];

    async.series(tasks, function(err, results) {
        if(err) {
            console.log("发生错误事务回滚");
            connection.rollback(); // 发生错误事务回滚
            //return callback(err);
        }else{
            //return callback(null, results);
        }
        connection.end();
    });
    return userImg;
}*/
