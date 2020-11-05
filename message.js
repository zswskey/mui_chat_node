var express = require('express');
var path = require('path');
var IO = require('socket.io');
var router = express.Router();

var app = express();
var server = require('http').Server(app);
//app.use(express.static(path.join(__dirname, 'public')));
//app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'hbs');

// 创建socket服务
var socketIO = IO(server);
// 群在线用户名单
var roomInfo = {};
// 群离线用户名单
var offLineroomInfo ={};
// 在线用户
var users = {};
// 用户的socketid记录
var usocket = {};
var rooms = {};
// 将用户加入房间名单中
if (!rooms["room1"]) {
    rooms["room1"] = [];
}
if (!rooms["room2"]) {
    rooms["room2"] = [];
}
if (!rooms["room3"]) {
    rooms["room3"] = [];
}
rooms["room1"].push("18515554710");
rooms["room1"].push("13383553391");
rooms["room1"].push("Tom");
rooms["room1"].push("Jack");
rooms["room1"].push("Jack1");
rooms["room1"].push("Rose");
rooms["room2"].push("Jack");
rooms["room2"].push("Rose");
rooms["room2"].push("Ann");
rooms["room3"].push("Tom");
rooms["room3"].push("Ann");
rooms["room3"].push("Andy");

socketIO.on('connection', function (socket) {
  var user = '';
  var roomID = '';
  var roomss = new Array();
  socket.on('join', function (data,callback) {
      callback(true);
      user = data.user;
      for(var j =1; j<=3; j++ ){
          //console.log(rooms["room"+j]);
          var index = rooms["room"+j].indexOf(user);
          if (index !== -1) {
              roomss.push("room"+j);
          }
      }
    //注：如何获取该用户在那个群里（根据用户查找所有的群ID,在遍历所有的群ID）
    if(user){
        users[user] = user;
        console.log(user+":的socketid:"+socket.id);
        usocket[user] = socket;
    }
	//roomID = data.roomID;
    for(var k=0; k<roomss.length; k++){
       roomID = roomss[k];
       if(roomID){
           // 将用户加入房间名单中
           if (!roomInfo[roomID]) {
               roomInfo[roomID] = [];
           }
           var index = roomInfo[roomID].indexOf(user);
           if(index === -1){
               roomInfo[roomID].push(user);
           }
           if(offLineroomInfo[roomID]){
               var index = offLineroomInfo[roomID].indexOf(user);
               if (index !== -1) {
                   offLineroomInfo[roomID].splice(index,1);
               }
           }
           socket.join(roomID);    // 加入房间
       }
     }
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
      console.log(roomInfo);
      console.log("离线人员：");
      console.log(offLineroomInfo);

    // 通知房间内人员
    //socketIO.to(roomid).emit('sys', user + '加入了房间', roomInfo[roomID]);  
    //console.log(user + '加入了' + roomID);
  });

  socket.on('disconnect', function () {
   //注：如何获取该用户在那个群里（根据用户查找所有的群ID,在遍历所有的群ID）
   //当用户断开连接的时候
   if (user) {
       delete users[user];
       delete usocket[user];
    }
    for(var k=0; k<roomss.length; k++){
       roomID = roomss[k];
       // 从房间名单中移除
       if(roomID){
           // 将用户加入房间离线名单中
           if (!offLineroomInfo[roomID]) {
               offLineroomInfo[roomID] = [];
           }
           var index = offLineroomInfo[roomID].indexOf(user);
           if(index === -1){
               offLineroomInfo[roomID].push(user);
           }
           if(roomInfo[roomID]){
               var index = roomInfo[roomID].indexOf(user);
               if (index !== -1) {
                   roomInfo[roomID].splice(index, 1);
               }
           }
           socket.leave(roomID);    // 退出房间
       }
      }
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
      console.log(roomInfo);
      console.log("离线人员：");
      console.log(offLineroomInfo);

    //socketIO.to(roomid).emit('sys', user + '退出了房间', roomInfo[roomID]);
    //console.log(user + '退出了' + roomID);
  });

  // 接收用户消息(聊天)
  socket.on('chat message', function (data,callback) {
      //如果接收到消息，则返回给客户端
      callback(true);
      user = data.user;
      var type = data.type;
      if(type == 1){
          //socket对象存在
          if (data.to in usocket) {
              console.log('to' + data.to, data);
              console.log('to' + data.to+":的socketid:"+usocket[data.to].id);
              console.log('to' + data.user+":的socketid:"+usocket[data.user].id);
              usocket[data.to].emit('to' + data.to, data,function (datas) {
                  console.log(datas);
                  //判断客户端有没有收到服务器端推送的消息
                  //无法收到回调；再次推送
                  if (datas !== true) {
                      usocket[data.to].emit('to' + data.to, data,function (datas) {
                          //如果再次无法收到回调，将对方清除出socket对象 数组，
                          if (datas !== true) {
                              delete users[data.to];
                              delete usocket[data.to];
                              //调肖浪业务：将数据保存到数据库；
                              console.log("再次无法收到回调,socket对象被清除");
                          }
                      })
                  }else{
                      console.log("发送成功！");
                  }
              });
          }else{
              //socket对象不存在，调肖浪业务：将数据保存到数据库；
              console.log("socket对象不存在");
          }
      }else if(type == 2){
          user = data.user;
          roomid = data.to;
          // 验证如果用户不在房间内则不给发送
          if (roomInfo[roomid].indexOf(user) === -1) {
              return false;
          }
          console.log('to'+ data.to, data);
          //群广播消息
          socketIO.to(roomid).emit('chat message',user, data);
          //好友不在线时消息存储
          var msgs = [];
          if (!offLineroomInfo[roomid]) {
              offLineroomInfo[roomid] = [];
          }
          for(var i=0; i<offLineroomInfo[roomid].length; i++){
              if(!offLineroomInfo[roomid][i] in usocket){
                  datas= {msg:data.msg,
                      user:data.user,
                      to:offLineroomInfo[roomid][i],
                      roomID:data.to,
                      type:data.type,
                      contenttype:data.contenttype
                  };
                  msgs[i]=datas;
                  //调用肖浪的接口，将数据保存
              }else{
                  return false;
              }
          }
          //console.log(msgs[0]);

      }

  });

    //好友请求
    socket.on('addFriend', function (data,callback) {
        //如果接收到消息，则返回给客户端
        callback(true);
        var type = data.type;
        if (type == 3) {
            socket.emit('to' + data.to, data);
            if (data.to in usocket) {
                console.log('to' + data.to, data);
                //socket.emit('to' + data.to, data);
                usocket[data.to].emit('to' + data.to, data,function(datas){
                    console.log(datas);
                    //判断客户端有没有收到服务器端推送的消息
                    //无法收到回调；再次推送
                    if (datas !== true) {
                        usocket[data.to].emit('to' + data.to, data,function(datas) {
                            //如果再次无法收到回调，将对方清除出socket对象 数组，
                            if (datas !== true) {
                                delete users[data.to];
                                delete usocket[data.to];
                                //调肖浪业务：将数据保存到数据库；
                                console.log("再次无法收到回调,socket对象被清除");
                           }else{
                                console.log("发送成功！");
                            }
                        })
                    }else{
                        console.log("发送成功！");
                    }

                });
            } else {
                //注：添加好友请求记录到数据库，用户上线后及时推送消息（与肖浪对接）
            }
        }
    });

    //好友请求接受/不接受
    socket.on('friendresults', function (data,callback) {
        callback(true);
        var type = data.type;
        if (type == 4) {
            //注：1、好友验证通过，需要将好友关系建立，需要操作数据库（与肖浪对接）
            //2、如果添加成功，则将好友请求返回给发起人
            if (data.user in usocket) {
                console.log('to' + data.user, data);
                //usocket[data.to].emit('to' + data.to, data);
                usocket[data.user].emit('to' + data.user, data, function (datas) {
                    console.log(datas);
                    //判断客户端有没有收到服务器端推送的消息
                    //无法收到回调；再次推送
                    if (datas !== true) {
                        usocket[data.user].emit('to' + data.user, data, function (datas) {
                            //如果再次无法收到回调，将对方清除出socket对象 数组，
                            if (datas !== true) {
                                delete users[data.user];
                                delete usocket[data.user];
                                //调肖浪业务：将数据保存到数据库；
                                console.log("再次无法收到回调,socket对象被清除");
                            } else {
                                console.log("发送成功！");
                            }
                        })
                    } else {
                        console.log("给自己发送成功！");
                    }
                });
            }else{
                //注：好友请求通过的消息记录到数据库，用户上线后及时推送消息（与肖浪对接）
            }

            if (data.to in usocket) {
                console.log('to' + data.to, data);
                //usocket[data.to].emit('to' + data.to, data);
                usocket[data.to].emit('to' + data.to, data, function (datas) {
                    console.log(datas);
                    //判断客户端有没有收到服务器端推送的消息
                    //无法收到回调；再次推送
                    if (datas !== true) {
                        usocket[data.to].emit('to' + data.to, data, function (datas) {
                            //如果再次无法收到回调，将对方清除出socket对象 数组，
                            if (datas !== true) {
                                delete users[data.to];
                                delete usocket[data.to];
                                //调肖浪业务：将数据保存到数据库；
                                console.log("再次无法收到回调,socket对象被清除");
                            } else {
                                console.log("发送成功！");
                            }
                        })
                    } else {
                        console.log("给对端发送成功！");
                    }
                });
            } else {//发起人不在线时
                    //注：好友请求通过的消息记录到数据库，用户上线后及时推送消息（与肖浪对接）
            }
        }else if (type == 5) {

        }
    });

    socket.on('groupfriends', function (data,callback) {
        callback(true);
        var type = data.type;
        if(type == 6){//新建群组
            //注：1、需要往数据库添加一条群信息，需要返回群ID（与肖浪对接）创建完成后继续操作
            //2、群创建成功后通过socket.join(groupid),将群id作为房间id放入socket中
            //2.1 群主信息保存在房间中
            //3、to:varchar,//被邀请人ID（数组），遍历被邀请人的数组，推送消息给每个好友
            for(var i=0; i<data.to.length; i++){
                var touser = data.to[i];
                if (touser in usocket) {
                    console.log('to' + touser, data);
                    usocket[touser].emit('to' + touser, data,function(datas){
                        console.log(datas);
                        //判断客户端有没有收到服务器端推送的消息
                        //无法收到回调；再次推送
                        if (datas !== true) {
                            usocket[touser].emit('to' + touser, data, function (datas) {
                                //如果再次无法收到回调，将对方清除出socket对象 数组，
                                if (datas !== true) {
                                    delete users[touser];
                                    delete usocket[touser];
                                    //调肖浪业务：将数据保存到数据库；
                                    console.log("再次无法收到回调,socket对象被清除");
                                } else {
                                    console.log("发送成功！");
                                }
                            })
                        } else {
                            console.log("发送成功！");
                        }
                    });
                }else{//不在线时
                    //注：如果用户不在线，添加群好友请求记录到数据库，用户上线后及时推送消息（与肖浪对接）
                }
            }

        }else if(type == 7){//群里边直接拉好友
            //注： 1、to:varchar,//被邀请人ID（数组），遍历被邀请人的数组，推送消息给每个好友
            for(var i=0; i<data.to.length; i++){
                var touser = data.to[i];
                if (touser in usocket) {
                    console.log('to' + touser, data);
                    usocket[touser].emit('to' + touser, data,function(datas){
                        console.log(datas);
                        //判断客户端有没有收到服务器端推送的消息
                        //无法收到回调；再次推送
                        if (datas !== true) {
                            usocket[touser].emit('to' + touser, data, function (datas) {
                                //如果再次无法收到回调，将对方清除出socket对象 数组，
                                if (datas !== true) {
                                    delete users[touser];
                                    delete usocket[touser];
                                    //调肖浪业务：将数据保存到数据库；
                                    console.log("再次无法收到回调,socket对象被清除");
                                } else {
                                    console.log("发送成功！");
                                }
                            })
                        } else {
                            console.log("发送成功！");
                        }
                    });
                }else{//不在线时
                    //注：如果用户不在线，添加群好友请求记录到数据库，用户上线后及时推送消息（与肖浪对接）
                }
            }
        }
    });


    //群好友请求接受/不接受
    socket.on('groupfriendresults', function (data) {
        var type = data.type;
        //type: 8表示接受，9表示不接受（拒绝）
        if(type == 8){
            //注：1、好友验证通过，需要将群成员关系建立，需要操作数据库（与肖浪对接）
            //2将人员信息保存在房间中
            //if (!roomInfo[roomID]) {
                //roomInfo[roomID] = [];
            //}
            //roomInfo[roomID].push(user);
            //3、根据群id查找所有的群成员信息
            //4、如果添加成功，则将群成员信息返回给发起人和被邀请人
            if (data.user in usocket) {
                console.log('to' + data.user, data);
                usocket[data.to].emit('to' + data.to, data);
                usocket[data.user].emit('to' + data.user, data);
            }else{//发起人不在线时
                //注：好友请求通过的消息记录到数据库，用户上线后及时推送消息（与肖浪对接）
            }
        }
        if(type == 9){

        }
    });


    //删除好友
    socket.on('deletefriend', function (data,callback) {
        callback(true);
        var type = data.type;
        if(type == 10){
            //注：1、删除好友，需要操作数据库（与肖浪对接）
            //2、删除成功后，到前台处理删除好友列表中的对应信息
            if (data.user in usocket) {
                console.log('to' + data.user, data);
                usocket[data.user].emit('to' + data.user, data, function (datas) {
                    console.log(datas);
                    //判断客户端有没有收到服务器端推送的消息
                    //无法收到回调；再次推送
                    if (datas !== true) {
                        usocket[data.user].emit('to' + data.user, data, function (datas) {
                            //如果再次无法收到回调，将对方清除出socket对象 数组，
                            if (datas !== true) {
                                delete users[data.user];
                                delete usocket[data.user];
                                //调肖浪业务：将数据保存到数据库；
                                console.log("再次无法收到回调,socket对象被清除");
                            } else {
                                console.log("发送成功！");
                            }
                        })
                    } else {
                        console.log("发送成功！");
                    }
                });
            }else{//发起人不在线时
                //注：删除好友消息记录到数据库，用户上线后及时推送消息（与肖浪对接）
            }
            //给被删除人发送一个已删除的状态
            if (data.to in usocket) {
                console.log('to' + data.user, data);
                //删除的状态
                data.status = 1;
                usocket[data.to].emit('to' + data.to, data, function (datas) {
                    console.log(datas);
                    //判断客户端有没有收到服务器端推送的消息
                    //无法收到回调；再次推送
                    if (datas !== true) {
                        usocket[data.to].emit('to' + data.to, data, function (datas) {
                            //如果再次无法收到回调，将对方清除出socket对象 数组，
                            if (datas !== true) {
                                delete users[data.to];
                                delete usocket[data.to];
                                //调肖浪业务：将数据保存到数据库；
                                console.log("再次无法收到回调,socket对象被清除");
                            } else {
                                console.log("发送成功！");
                            }
                        })
                    } else {
                        console.log("发送成功！");
                    }
                });
            }else{//被删除人不在线时
                //注：删除好友消息记录到数据库，用户上线后及时推送消息（与肖浪对接）
            }
        }
    });

    //删除并退群
    socket.on('deletegroupfriend', function (data) {
        var type = data.type;
        if(type == 11){
            //注：1、删除群成员，需要操作数据库（与肖浪对接）
            //2、删除后，判断该群成员是不是为空，如果没有成员则直接删除群信息（与肖浪对接）
            //socket.leave(roomID);    // 退出房间
            //3、获取自己所在群的信息，并将信息推送给发起人，在列表中删除该群信息（与肖浪对接）
            //4、并且在房间中该用户删除
            var index = roomInfo[roomID].indexOf(user);
            if (index !== -1) {
                roomInfo[roomID].splice(index, 1);
            }
            if (data.user in usocket) {
                console.log('to' + data.user, data);
                usocket[data.user].emit('to' + data.user, data);
            }else{//发起人不在线时
                //注：删除群成员记录到数据库，用户上线后及时推送消息（与肖浪对接）
            }
        }
    });

});

function addgroupfriends(user,roomID){
    if(roomID){
        // 将用户加入房间名单中
        if (!roomInfo[roomID]) {
            roomInfo[roomID] = [];
        }
        var index = roomInfo[roomID].indexOf(user);
        if(index === -1){
            roomInfo[roomID].push(user);
        }
        if(offLineroomInfo[roomID]){
            var index = offLineroomInfo[roomID].indexOf(user);
            if (index !== -1) {
                offLineroomInfo[roomID].splice(index,1);
            }
        }
        socket.join(roomID);    // 加入房间
    }
}

function addgroupfriends(user,roomID){
    if(roomID){
        // 将用户加入房间名单中
        if (!roomInfo[roomID]) {
            roomInfo[roomID] = [];
        }
        var index = roomInfo[roomID].indexOf(user);
        if(index === -1){
            roomInfo[roomID].push(user);
        }
        if(offLineroomInfo[roomID]){
            var index = offLineroomInfo[roomID].indexOf(user);
            if (index !== -1) {
                offLineroomInfo[roomID].splice(index,1);
            }
        }
    }
}

function deletegroupfriends(user,roomID){
    // 从房间名单中移除
    if(roomID){
        if(roomInfo[roomID]){
            var index = roomInfo[roomID].indexOf(user);
            if (index !== -1) {
                roomInfo[roomID].splice(index, 1);
            }
        }
    }
}

