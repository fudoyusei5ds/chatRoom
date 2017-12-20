$(document).ready(function(){
    //登录栏与注册栏之间的切换
    $("#denglu-box .sign-box-change-button").click(function(){
        $("#denglu-box").toggle("slow",function(){
            $("#zhuce-box").toggle("slow");
        });
    });
    $("#zhuce-box .sign-box-change-button").click(function(){
        $("#zhuce-box").toggle("slow",function(){
            $("#denglu-box").toggle("slow");
        });
    });
    //登录验证其一:检查用户名是否已被使用
    $("#new-username").bind("input",function(){
        var inputName=$("#new-username").val();
        if(inputName!==''&&$.trim(inputName)){
            $.post("/testUsername",
            {
                newUsername:inputName
            },
            function(data,status){
                if(data){
                    $("#nuInfo").text("用户名已被使用");
                }
                else{
                    $("#nuInfo").text("");
                }
            });
        }
    });
    //登录验证其二:检查密码与确认密码是否一致
    $('#new-password,#confirm').bind("input",function(){
        var password=$("#new-password").val();
        var confirm=$("#confirm").val();
        if(password!==confirm&&password!==""&&confirm!=""){
            $("#npInfo").text("两次密码不一致");
        }
        else{
            if(!/^[0-9a-zA-Z\_]+$/.test(password)){
                $("#npInfo").text("密码只能为数字字母下划线");
            }
            else{
                $("#npInfo").text("");
            }
        }
    });

    //发送登录请求
    $('#denglu').click(function(){
        var name=$('#username').val();
        var password=$('#password').val();
        if(name!==''&&$.trim(name)&&password!==''&&$.trim(password)){
            $("#denglu-box").submit();
        }
    });

    //发送注册请求
    $('#zhuce').click(function(){
        var name=$('#new-username').val();
        var pass=$('#new-password').val();
        if(name!==""&&pass!==""&&
            $.trim(name)&&$.trim(pass)&&
            $("#nuInfo").val()===""&&$("#npInfo").val()===""){
            $("#zhuce-box").submit();
        }
    });
});