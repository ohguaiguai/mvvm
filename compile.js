// 用法 new Compile(el, vm)

class Compile {
  constructor(el, vm) {
    // 要遍历的宿主节点
    this.$el = document.querySelector(el);

    this.$vm = vm;

    // 编译
    if (this.$el) {
      // 转换内部内容为片段Fragment
      this.$fragment = this.node2Fragment(this.$el);
      // 执行编译
      this.compile(this.$fragment);
      // 将编译完的html结果追加至$el
      this.$el.appendChild(this.$fragment);
    }
  }

  // 将宿主元素中代码片段拿出来遍历，这样做比较高效
  node2Fragment(el) {
    const frag = document.createDocumentFragment();
    // 将el中所有子元素搬家至frag中
    let child;
    while ((child = el.firstChild)) {
      frag.appendChild(child);
    }
    return frag;
  }
  // 编译过程
  compile(el) {
    const childNodes = el.childNodes;
    Array.from(childNodes).forEach(node => {
      // 类型判断
      if (this.isElement(node)) {
        // 元素
        // console.log('编译元素'+node.nodeName);
        // 查找m-，@，:
        const nodeAttrs = node.attributes;
        Array.from(nodeAttrs).forEach(attr => {
          const attrName = attr.name; //属性名
          const exp = attr.value; // 属性值
          if (this.isDirective(attrName)) {
            // m-text
            const dir = attrName.substring(2);
            // 执行指令
            this[dir] && this[dir](node, this.$vm, exp);
          }
          if (this.isEvent(attrName)) {
            const dir = attrName.substring(1); // @click
            this.eventHandler(node, this.$vm, exp, dir);
          }
        });
      } else if (this.isInterpolation(node)) {
        // 文本
        // console.log('编译文本'+node.textContent);
        this.compileText(node);
      }

      // 递归子节点
      if (node.childNodes && node.childNodes.length > 0) {
        this.compile(node);
      }
    });
  }

  compileText(node) {
    // console.log(RegExp.$1);
    this.update(node, this.$vm, RegExp.$1, "text");
  }

  // 更新函数
  update(node, vm, exp, dir) {
    const updaterFn = this[dir + "Updater"];
    // 初始化
    updaterFn && updaterFn(node, vm[exp]);
    // 依赖收集
    new Watcher(vm, exp, function(value) {
      updaterFn && updaterFn(node, value);
    });
  }
  // m-show
  show (node, vm, exp) {
    this.update(node, vm, exp, "show");
  }
  showUpdater(node, value) {
    node.removeAttribute('m-show');
    if (value) {
      node.style.display = 'block';
    } else {
      node.style.display = 'none';
    }
  }
  // m-if="show"
  if (node, vm, exp) {
    this.update(node, vm, exp, "if");
  }
  ifUpdater(node ,value) {
    if (value) {
       node.removeAttribute('m-if');
       node.parentNode.insertBefore(node, node.nextSibling);
    } else {
      node.parentNode.removeChild(node);
    }
  }
  // m-for="(item, index) in list" :key="index"   {{item.a.b.c}}
  for(node, vm, exp) {
    // let rkuohao = /\{\{(.+?)\}\}/g;
    // list
    let target = exp.match(/\bin\b\s+\b\w+\b/g)[0].replace('/\s+/g', '').replace('in', '').trim();
    // ['', '', '']  [{}, {}, {}]
    // index 或者 item.a.b.c
    let bindContent = node.getAttribute('m-bind:key') || node.getAttribute(':key');
    let bindKey = '';
    if (bindContent == 'index')  {
        bindKey = 'index';
    } else {
      bindKey = bindContent.trim().split('.').shift().join('.');
    }
    // item.a.b.c 插值部分 = > a.b.c
    let content = node.innerText.replace('{{', '').replace('}}', '').trim().split('.').shift().join('.');
    let item_index = exp.match(/(\(\w+\,\s*\w+\)|\w+)/g)[0].replace(/(\s+|\(|\))/g, '').split(',');
    // item
    let item = item_index[0];
    // index
    let index = item_index[1];
    let value = vm[target];
    const fragment = document.createDocumentFragment();
    let className = '';
    let isObj = false;
    let key = null;

    for (let i = 0; i < value.length; i++) {
      let li = document.createElement(node.tagName);
      className = `mass-data-${target}`
      li.classList.add(...node.classList, className);

      if (this.isPrimitive(value[i])) {
        li.dataset.key = i;
        li.innerText = value[i];
      } 

      if (this.isObject(value[i])) {
        isObj = true;
        if (bindKey == 'index') {
          li.dataset.key = i;
        } else {
          li.dataset.key = this.getValueVByPath(value[i], bindKey);
        }
       
        li.innerText = this.getValueVByPath(value[i], content);
        // 给某一个属性添加依赖收集，触发该属性的getter时才可以通知更新页面
        // content 可以是 a.b， 也可以是 a.b.c, 最终绑定依赖的目标应该是属性 c 
        // target 就是 list 
        new ArrayWatcher(vm, {
          key: target,
          index: i,
          paths: content
        }, (value) => {
          li.innerText = value;
        });
      }

      fragment.appendChild(li);
    }

    node.parentNode.replaceChild(fragment, node);
     // 对 list 本身 做依赖收集
    new Watcher(vm, target, (value) => {
        this.forUpdater(value, {
          isObj, 
          bindKey,
          className,
          key
        });
    });
  }

  forUpdater(value, options) {
    const {isObj, bindKey, className, key} = options;
    let lis = document.getElementsByClassName(className);
    let node = lis[0];
    let lisLen = lis.length;
    let listLen = value.length;
    let diffLen = Math.abs(lisLen - listLen);

    for (let i = 0; i < Math.min(lisLen, listLen); i ++) {
      if (isObj) {
        if (lis[i].innerText != value[i][key]) {
          lis[i].innerText = value[i][key];
        }
      } else {
        if (lis[i].innerText != value[i]) {
          lis[i].innerText = value[i];
        }
      }
    }   

    if (lisLen < listLen) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < diffLen; i++) {
        let li = document.createElement(node.tagName);
        li.classList.add(...node.classList);
        let cursor = lisLen + i;
        if (isObj) {
          value[cursor].hasOwnProperty(bindKey) 
          ? li.dataset.key = value[cursor][bindKey]
          : li.dataset.key = cursor
          li.innerText = value[cursor][key];
        } else {
          li.dataset.key = cursor;
          li.innerText = value[cursor];
        }
        fragment.appendChild(li);
      }
      this.insertAfter(fragment, lis[lisLen - 1]);
    }

    if (lisLen > listLen) {
      for (let i = 0; i < diffLen; i++) {
        node.parentNode.removeChild(lis[lis.length - 1]);
      }
    }
  }

  text(node, vm, exp) {
    this.update(node, vm, exp, "text");
  }

  //   双绑
  model(node, vm, exp) {
    // 指定input的value属性
    this.update(node, vm, exp, "model");

    // 视图对模型响应
    node.addEventListener("input", e => {
      vm[exp] = e.target.value;
    });
  }

  modelUpdater(node, value) {
    node.value = value;
  }

  html(node, vm, exp) {
    this.update(node, vm, exp, "html");
  }

  htmlUpdater(node, value) {
    node.innerHTML = value;
  }

  textUpdater(node, value) {
    node.textContent = value;
  }

  //   事件处理器
  eventHandler(node, vm, exp, dir) {
    //   @click="onClick"
    let fn = vm.$options.methods && vm.$options.methods[exp];
    if (dir && fn) {
      node.addEventListener(dir, fn.bind(vm));
    }
  }

  isDirective(attr) {
    return !attr.indexOf("m-") || !attr.indexOf(":");
  }
  isEvent(attr) {
    return !attr.indexOf("@");
  }
  isElement(node) {
    return node.nodeType === 1;
  }
  // 插值文本
  isInterpolation(node) {
    return node.nodeType === 3 && /\{\{(.*)\}\}/.test(node.textContent);
  }
  // 判断是否是原始类型
  isPrimitive (value) {
    return (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'symbol' ||
      typeof value === 'boolean'
    )
  }
  isObject (obj){
    return obj !== null && typeof obj === 'object'
  }  
  insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  }
  getValueVByPath(obj, path) {
    let paths = path.split('.');// [xxx, yyy, zzz]

    let res = obj;
    let prop;
    while(prop = paths.shift()) {
      res = res[prop];
    }
    return res;
  }
}
