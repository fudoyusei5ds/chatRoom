"use strict";

var http=require("http");
var fs=require("fs");
var url=require('url');
var qs=require('querystring');
//使用sqlite3数据库保存数据
var sqlite3=require("sqlite3");
var ws=require("ws");
var formidable=require('formidable');

var db=new sqlite3.Database("chatroom.db");

var server=http.createServer();
var WebSocketServer=ws.Server;

//新建一个webSocket服务器。
var wss=new WebSocketServer({server:server});

var sessionList={};
var sessionIndex=0;

server.addListener("request",function(req,res){
    // console.log(req.method+' '+req.url);
    console.log(req.method+' '+req.url);
    if(req.method==="GET"){
        //处理GET请求
        var ext=req.url.match(/(\.[^.]+|)$/)[0];
        switch(ext){
            //加载静态资源
            case ".css":
            case ".js":
                fs.readFile("./views/"+req.url,'utf-8',function(err,data){
                    // console.log(ext);
                    if(err){
                        console.log("error");
                    };
                    res.writeHead(200,{"Content-type":{".css":"text/css",".js":"application/javascript"}[ext]});
                    res.write(data);
                    res.end();
                });
                break;
            //加载图片资源
            case ".jpg":
            case ".gif":
            case ".png":
                let typeArray={".jpg":"image/jpeg",".gif":"image/gif",".png":"image/png"};
                res.setHeader("Content-Type",typeArray[ext]);
                var ex=fs.existsSync("./views/"+req.url);
                //fs.exists已经被废弃，使用access判断文件是否存在
                // fs.exists("./views/"+req.url,function(__ex){
                //     fs.ex=__ex;
                // });
                console.log("加载图片资源=>检测是否存在:"+ex);
                if(ex){
                    var stream=fs.createReadStream("./views/"+req.url);
                }
                else{
                    var stream=fs.createReadStream("./views/default.jpg");
                }
                let responseData=[];
                if(stream){
                    stream.on("data",function(chunk){
                        responseData.push(chunk);
                    });
                    stream.on("end",function(){
                        let finalData=Buffer.concat(responseData);
                        res.write(finalData);
                        res.end();
                    });
                }
                break;
            case ".ico":
                break;
            default:
                //默认浏览器请求
                if(req.url==="/"||req.url==="/chatroom"){
                    //请求主页
                    //首先判断对方有没有登录
                    var userID=cookie2obj(req.headers.cookie);
                    //如果登录
                    if(isuserSign(sessionList,userID)){
                        let userName=userID.split("-")[0];
                        console.log("this ok!!!");
                        fs.readFile('./views/chatroom.html','utf-8',function(err,data){
                            if(err){
                                console.log("ERROR:main html file lost!!!");
                                throw err;
                            }
                            else{
                                // var  gettype=Object.prototype.toString;
                                // console.log(gettype.call(data));
                                //替换模板
                                let changeObj={name:userName};
                                data=htmlTemplate(data,changeObj);
                                
                                res.writeHead(200,{"Content-Type":"text/html"});
                                res.write(data);
                                res.end();
                            }
                        });
                    }
                    else{
                        console.log("---test---");
                        let redirect="http://"+req.headers.host+"/chatsign";
                        res.writeHead(301,{location:redirect});
                        res.end();
                    }
                }
                else if(req.url==="/chatsign"){
                    fs.readFile('./views/chatsign.html','utf-8',function(err,data){
                        if(err) throw err;
                        res.writeHead(200,{"Content-Type":"text/html"});
                        res.write(data);
                        res.end();
                    });
                }
                else{
                    let redirect="http://"+req.headers.host+"/chatsign";
                    res.writeHead(301,{location:redirect});
                    res.end();
                }
                break;
        }
    }
    else if(req.method==="POST"){
        //node不会主动解析post请求，需要自己手动实现
        if(req.url==="/sign-in"){
            //登录请求
            let user="";
            req.on('data',function(data){
                user+=data;
            });
            req.on('end',function(){
                user=qs.parse(user);
                console.log(user);
                db.get("select password from user where username=?",user.username,function(err,row){
                    if(!err&&row&&(row.password==user.password)){
                        //登录成功后向服务器发送一个cookie，并在sessionList中保存对应的信息。
                        //sessionList中保存的键值表形式为:用户名:用户名-随机ID-固定ID
                        newSession(user.username,sessionList,sessionIndex);
                        console.log(user.username+" is logging!");
                        let redirect="http://"+req.headers.host+"/chatroom";
                        res.writeHead(301,{
                            location:redirect,
                            "Set-Cookie":'UID='+sessionList[user.username]+';'   
                        });
                        res.end();
                    }
                    else{
                        console.log("no legel user!");
                        let redirect="http://"+req.headers.host+"/chatsign";
                        res.writeHead(301,{location:redirect});
                        res.end();
                    }
                });
            });
        }
        else if(req.url==="/register"){
            //注册请求：详细验证未完成
            let user="";
            req.on('data',function(data){
                user+=data;
            });
            req.on('end',function(){
                user=qs.parse(user);
                console.log(user);
                db.run("insert into user values (?,?)",[user.username,user.password],function(err){
                    if(err){
                        console.log("新建用户=>插入数据库=>出错:"+err);
                    }
                    let redirect="http://"+req.headers.host+"/chatsign";
                    res.writeHead(301,{location:redirect});
                    res.end();
                });
            })
        }
        else if(req.url==="/testUsername"){
            let user="";
            req.on('data',function(data){
                user+=data;
            });
            req.on('end',function(){
                user=qs.parse(user);
                console.log("检测用户名:"+user.newUsername);
                db.get("select * from user where username=?",user.newUsername,function(err,row){
                    if(err){
                        console.log("检测用户名=>数据库查询=>出错:"+err);
                        res.writeHead(200,{"content-type":"text/json"});
                        res.write(`false`);
                        res.end();
                    }
                    else if(row){
                        //如果数据存在,则用户名也存在
                        console.log("检测用户名=>数据库查询=>用户存在");
                        res.writeHead(200,{"content-type":"text/json"});
                        res.write(`true`);
                        res.end();
                    }
                    else{
                        console.log("检测用户名=>数据库查询=>用户不存在");
                        res.writeHead(200,{"content-type":"text/json"});
                        res.write(`false`);
                        res.end();
                    }
                });
            });
        }
        else if(req.url==="/changePt"){
            var form=new formidable.IncomingForm();
            form.uploadDir="./temp//";
            form.keepExtensions=true;
            form.parse(req,function(err,fields,files){
                let path=files["pt-pic"].path;
                let username="./views//"+req.headers.cookie.split('=')[1].split('-')[0]+".jpg";
                fs.rename(path,username,function(err){});
                let redirect="http://"+req.headers.host+"/chatroom";
                res.writeHead(301,{location:redirect});
                res.end();
            });
        }
        else if(req.url==="/changeBg"){
            var form=new formidable.IncomingForm();
            form.uploadDir="./temp//";
            form.keepExtensions=true;
            form.parse(req,function(err,fields,files){
                let path=files["bg-pic"].path;
                let username="./views//"+req.headers.cookie.split('=')[1].split('-')[0]+"-background.jpg";
                fs.rename(path,username,function(err){});
                let redirect="http://"+req.headers.host+"/chatroom";
                res.writeHead(301,{location:redirect});
                res.end();
            });
        }
    }
});

//新建session的函数
function newSession(username,list,index){
    console.log("a new session!!!");
    var uid=0;
    while(uid<1000){
        uid=Math.ceil(Math.random()*10000);
    }
    list[username]=username+'-'+uid+'-'+index;
    index++;
    return;
}
//判断用户是否在登录状态的函数
function isuserSign(list,userid){
    if(!userid){
        return false;
    }
    var username=userid.split('-')[0];
    if(list[username]===userid){
        return true;
    }
    return false;
}

//一个简单的网页模板替换
function htmlTemplate(str,obj){
    for(let key in obj){
        let temp='{{'+String(key)+'}}';
        while(str.indexOf(temp)!==-1){
            str=str.replace(temp,obj[key]);
        }
    }
    return str;
}

//cookie字符串转对象函数
function cookie2obj(cookie){
    //去掉所有的空格;
    if(cookie){
        console.log("cookie处理中："+cookie);
        var obj={};
        while(cookie.indexOf(' ')!==-1){
            cookie=cookie.replace(' ','');
        }
        let arr=cookie.split(';');
        for(let i=0,len=arr.length;i<len;++i){
            let objKey=arr[i].split('=');
            let objValue=objKey[1];
            objKey=objKey[0];
            obj[objKey]=objValue;
        }
        return obj.UID;
    }
}

//以下为webSocket代码
wss.addListener("connection",function(ws){
    //监听连接事件，如果有客户端连接进来:
    //首先需要确认用户身份。  
    var user=ws.upgradeReq.url.split('=')[1].split('-')[0];
    ws.user=user;
    ws.wss=wss;

    //对所有人发送消息：xxx加入聊天室
    console.log(ws.user+"=>加入聊天室!");
    this.broadcast(ws.user+"###=>加入聊天室!!!");
    
    ws.on("message",function(message){
        if(message&&message.trim()){
            console.log(message);
            var send_msg=this.user+"###"+message.trim();
            this.wss.broadcast(send_msg);
        }
    });

    //有人离开聊天室
    ws.on("close",function(){
        let user=this.user;
        let msg=user+"###=>离开聊天室!!!";
        console.log(msg);
        this.wss.broadcast(msg);
    });
});

wss.broadcast=function(data){
    wss.clients.forEach(function(client){
        client.send(data);
    });
};

// var messageIndex=0;
// function createMessage(type,user,data){
//     let obj={
//         "id":messageIndex,
//         "type":type,
//         "user":user,
//         "data":data
//     };
//     messageIndex++;
//     return obj;
// }

server.listen(3000);

console.log("it is running...");