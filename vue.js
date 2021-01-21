//定义一个vue类
class Vue{
    constructor(options){
        //定义$data属性
        this.$data = options.data;
        //调用数据劫持的方法
        Observe(this.$data);

        //属性代理，通过this直接访问属性
        Object.keys(this.$data).forEach(key => {
            Object.defineProperty(this,key,{
                enumerable: true,
                configurable:true,
                get(){
                    return this.$data[key];
                },
                set(newValue){
                    this.$data[key] = newValue; 
                }
            })
        })

        //调用模板编译的方法
        //传入两个参数，挂载的html结构和vm实例对象
        Compile(options.el,this)
    }
}

//定义一个数据劫持的方法
function Observe(obj){
    //递归给obj中的内层对象上的属性也添加getter和setter
    //递归的退出条件 对象为空或者数据类型不是Object
    if( !obj || typeof obj !== "object"){
        return
    }
    //在这里new一个Dep的实例
    const dep = new Dep();
    //Object.keys(obj)方法获取obj每一项的key,返回一个数组
    Object.keys(obj).forEach(key => {
        let value = obj[key];//每一个key对应的值
        //把value这个子节点进行递归
        Observe(value);
        // console.log(value);
        Object.defineProperty(obj,key,{
            enumerable: true,//能否被遍历
            configurable: true,//能否被配置
            get(){
                // console.log("有人访问我的 " + key);
                //先判断Dep.target存不存在
                Dep.target && dep.addSubs(Dep.target); //在这里完成向subs数组中添加订阅者，因为此时Dep.target还是指向Watcher的实例
                // console.log(dep.subs);
                return value;
            },
            set(newValue){
                // console.log("有人设置我的 " + key);
                value = newValue;
                //为新赋值的属性也添加getter和setter
                Observe(value);
                //应该在set中调用notify方法，通知订阅者
                dep.notify();
            }
        })
    })
}


//定义一个模板编译的方法
function Compile(el,vm){
    vm.$el = document.querySelector(el); //给vm添加一个$el属性
    //创建一个文档碎片，在文档碎片中进行模板编译，避免浏览器多次重绘和重台，可提高浏览器性能
    const fragment = document.createDocumentFragment();
    //将$el中的子节点循环添加到文档碎片中
    while(childNode = vm.$el.firstChild){
        fragment.appendChild(childNode);
    }


    //进行模板编译 调用replace方法
    replace(fragment);


    //将文档碎片中的子节点渲染到浏览器上
    vm.$el.appendChild(fragment);

    //定义替换数据的方法
    function replace(node){
        const regMustache = /\{\{\s*(\S+)\s*\}\}/; //匹配双大括号，并去除括号内两边的空白

        //如果是文本子节点，则node.nodeType == 3,需要进行模板编译
        if(node.nodeType == 3){
            //终止递归的条件
            // console.log(node.textContent);
            let text = node.textContent; //纯文本内容
            let execResult = regMustache.exec(text); //匹配正则
            // console.log(execResult);
            if(execResult){
                let value = execResult[1].split('.').reduce((newObj,k) => newObj[k],vm);
                // console.log(value);
                //拿到最终的值后，对文本内容进行替换
                node.textContent = text.replace(regMustache,value);
                //直到执行到上一行代码，node才有更新自己数据的能力，所以应在此处 new Watcher的实例，并将更新数据的方法存进去
                new Watcher(vm,execResult[1], function(newValue){
                    node.textContent = text.replace(regMustache,newValue);
                })
            }
            return;
        }
        //解析v-model
        //如果是元素节点，判断该元素是不是input元素
        if(node.nodeType == 1 && node.nodeName == "INPUT"){
            //拿到元素中所有的属性节点
            // const attrs = node.attributes;
            // console.log(attrs); 是一个伪数组，将其转化成数组
            // const attrsArr = Array.from(attrs);
            // console.log(attrsArr);
            const attrs = Array.from(node.attributes);
            // console.log(attrs);
            // console.log(attrs[1].value);
            const res = attrs.find(element => element.name == "v-model");
            // console.log(res);
            // console.log(res.value);
            if(res){//res存在说明该元素上有 v-model属性
                const resStr = res.value;
                const keyArr = resStr.split('.');
                // console.log(keyArr); 
                const value = keyArr.reduce((newObj,k) => newObj[k],vm);
                // console.log(value);
                node.value = value;//完成了第一次数据更新
                //第一次更新完value值后就应该创建一个watcher实例
                new Watcher(vm,resStr,function(newValue){
                    node.value = newValue;//至此完成了v-model的单向数据绑定
                })
                //v-model的双向数据绑定实现
                //需要添加一个事件用来监听input事件
                node.addEventListener("input",function(e){
                    // console.log(e.target.value);
                    //此时需要重新给对应的属性赋值，要先拿到需要赋值的属性所在的对象，再给该属性赋值
                    const newArr = keyArr.slice(0,keyArr.length-1);
                    // console.log(newArr);                                  
                    const result =  newArr.reduce((newObj,k) => newObj[k],vm);
                    result[keyArr[keyArr.length - 1]] = e.target.value;
                })
                /* 
                    对上面的解析：
                        比如 keyArr = [vm,obj,info,a]  现在要做的是对里面的a属性重新赋值
                        所以要先拿到 vm.obj.info   然后再对它当中的 a 属性重新赋值，所以先用数组的slice方法得到新数组[vm,obj,info]
                        再用 reduce 方法得到 vm.obj.info ，对于vm.obj.info对象来说，它里面的 a 属性就是原本 keyArr数组中的最后一项
                        所以 vm.obj.info[keyArr[keyArr.length - 1]] 即可重新赋值
                */
            }
        }

        //如果执行到这里，说明节点不是文本子节点，需要递归处理
        node.childNodes.forEach(child => replace(child));
    }
}




//发布订阅模式

//实现一个Dep类，发布者，负责收集订阅，并通知订阅者
class Dep{
    constructor(){
        //需要一个数组，用于收集依赖
        this.subs = [];
    }

    //向数组中添加订阅者的方法
    addSubs(watcher){
        // console.log(222);
        this.subs.push(watcher);
    }

    //通知数组中的每个订阅者
    notify(){
        //调用他们的update方法更新数据
        this.subs.forEach( watcher => watcher.update() )
    }
}


//实现一个Watcher类，订阅者，负责订阅信息
class Watcher{
    //传入一个更新数据的回调函数callback
    //最新的数据存储在vm上。所以也要将vm传进来
    //要知道自己负责更新的是哪一个属性，所以还要传进相应的key
    constructor(vm,key,callback){
        this.vm = vm;
        this.key = key;
        this.callback = callback;

        //在new Watcher的实例过程中，就必定会执行这里面的代码，所以从这里开始操作将Watcher实例添加到subs数组中
        Dep.target = this; //自定义一个Dep类中的属性，让他指向this,即指向Waycher的实例
        //利用reduce方法进行取新值的操作，但我们的目的不是要得到新值，而是在取值时触发之前定义的getter方法
        //因此在执行到取值操作时，代码会跳转到上面的get函数中执行
        key.split('.').reduce((newObj,k) => newObj[k],vm); 
        Dep.target = null;//添加完订阅者后将Dep.target置空
    }

    //调用callback更新数据
    update(){
        //最新的数据    
        const value = this.key.split('.').reduce((newObj, k) => newObj[k], this.vm);
        this.callback(value);
    }
}