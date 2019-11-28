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
  for(node, vm, exp) {
    // let rkuohao = /\{\{(.+?)\}\}/g;
    // list
    let target = exp.match(/\bin\b\s+\b\w+\b/g)[0].replace('/\s+/g', '').replace('in', '').trim();
    // ['', '', '']  [{}, {}, {}]
    // index 或者 item.a.b.c
    let bindRawKey = node.getAttribute('m-bind:key') || node.getAttribute(':key');
    // {{item.a.b.c}} 插值部分 = > a.b.c   {{item.a}}
    let rawContent = node.innerText.replace('{{', '').replace('}}', '').trim();

    let bindKey = '';
    let content = '';

    if (bindRawKey == 'index')  {
      bindKey = 'index';
    } else {
       let arr = bindRawKey.trim().split('.');
       arr.shift();
       bindKey = arr.join('.');
    }
  
    let arr = rawContent.split('.');
    if (arr.length > 1) {
      arr.shift();
      content = arr.join('.');
    } else {
      content = rawContent;
    }
    /* let item_index = exp.match(/(\(\w+\,\s*\w+\)|\w+)/g)[0].replace(/(\s+|\(|\))/g, '').split(',');
    // item
    let item = item_index[0];
    // index
    let index = item_index[1]; */
    let value = vm[target];
    let identifier = '';
    let tagName = node.tagName;

    let fragment = document.createDocumentFragment();

    for (let i = 0; i < value.length; i++) {
      let li = document.createElement(node.tagName);
      li.identifier = identifier = `mass-data-${target}`

      if (this.isPrimitive(value[i])) {
        li.dataset.key = i;
        li.innerText = value[i];
      } 

      if (this.isObject(value[i])) {
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
          vm,
          target,
          tagName,
          identifier,
          bindKey,
          content
        });
    });
  }

  forUpdater(value, options) {
    const {vm, target, tagName, identifier, bindKey, content} = options;
    debugger;
    let lis = document.getElementsByTagName(tagName);
    let nodes = Array.prototype.filter.call(lis, (item) => {
      return item.identifier == identifier;
    });
    let node = nodes[0];
    let nodesLen = nodes.length;
    let valueLen = value.length;
    let diffLen = Math.abs(nodesLen - valueLen);

    let isObj = this.isObject(value[0]);
    
    if (nodesLen == valueLen) {
      for (let i = 0; i < Math.min(nodesLen, valueLen); i++) {
        if (isObj) {
          let val = this.getValueVByPath(value[i], content);
          if (nodes[i].innerText != val) {
            nodes[i].innerText = val;
          }
        } else {
          if (nodes[i].innerText != value[i]) {
            nodes[i].innerText = value[i];
          }
        }
      }
    }
    
    if (nodesLen < valueLen) {
      const fragment = document.createDocumentFragment();

      for (let i = 0; i < diffLen; i++) {
        let li = document.createElement(node.tagName);
        let cursor = nodesLen + i;

        if (bindKey == 'index') {
          li.dataset.key = cursor;
        } else {
          li.dataset.key = this.getValueVByPath(value[cursor], bindKey);
        }

        if (isObj) {
          li.innerText = this.getValueVByPath(value[cursor], content)
        } else {
          li.innerText = value[cursor];
        }
        fragment.appendChild(li);

        new ArrayWatcher(vm, {
          key: target,
          index: cursor,
          paths: content
        }, (value) => {
          li.innerText = value;
        });
      }
      this.insertAfter(fragment, nodes[nodesLen - 1]);
    }

    if (nodesLen > valueLen) {
      for (let i = 0; i < diffLen; i++) {
        node.parentNode.removeChild(nodes[nodes.length - 1]);
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
