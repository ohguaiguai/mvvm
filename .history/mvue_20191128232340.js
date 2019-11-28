
class MVue {
  constructor(options) {
    this.$options = options;

    this.$data = options.data;

    // 代理
    Object.keys(this.$data).forEach(key => {
      this.proxyData(key);
    });

    // 数据响应化
    this.observe(this.$data);

    new Compile(options.el, this);

    // created执行
    if (options.created) {
        options.created.call(this);
    }
  }

  reactiveArray() {
    let ARRAY_METHODS = [
      'push',
      'pop',
      'shift',
      'unshift',
      'reverse',
      'sort',
      'splice'
    ];
    let array_methods =  Object.create(Array.prototype);
    const that  = this;
    ARRAY_METHODS.forEach((method) => {
      array_methods[method] = function() {
          // 调用原来的方法
          console.log('调用的是拦截的' + method + '方法');
          // 将新加入的数据进行响应式化
          for (let i = 0; i < arguments.length; i++) {
              that.observe(arguments[i]);
          }
          // console.log(this.__dep__);
          const dep = this.__dep__;
          let res = Array.prototype[method].apply(this, arguments);
          dep.notify();
          return res;
      }
    });

    return array_methods;
  }
  

   def (obj, key, val) {
    Object.defineProperty(obj, key, {
      value: val,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }

  defineReactive$1 (obj, key, value) {
    const dep = new Dep();
    this.def(value, '__dep__', dep);
    Object.defineProperty(obj, key, {
      get() {
        Dep.target && dep.addDep(Dep.target);
        // console.log(`读取${key}`);
        return value;
      },
      set(newVal) {
        value = newVal;
        dep.notify();
      } 
    });
  }

  observe(o) {
    if (!o || typeof o !== 'object') {
      return;
    }
     
    let keys = Object.keys(o);
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      let value = o[key];
      // 数组、对象本身做处理
      if (typeof value === 'object') {
        this.defineReactive$1(o, key, value);
      }
      // 如果是数组
      if (Array.isArray(value)) {
        value.__proto__ = this.reactiveArray();
        for (let j = 0; j < value.length; j++) {
          this.observe(value[j]);
        }
      } else { // 基本类型或者对象
        this.defineReactive(o, key, value);
      }
    }
  }

  // 数据响应化
  defineReactive(obj, key, val) {
    if (typeof val === 'object' && value != null ) {
      this.observe(val);
    }

    const dep = new Dep();
    this.def(obj, '__dep__', dep);

    Object.defineProperty(obj, key, {
      get() {
        Dep.target && dep.addDep(Dep.target);
        console.log(`读取${key}`)
        // console.log(Dep.target)
        return val;
      },
      set(newVal) {
        if (newVal === val) {
          return;
        }
        val = newVal;
        console.log(`${key}属性更新了：${val}`);
        dep.notify();
      }
    });
  }

  proxyData(key) {
      Object.defineProperty(this, key, {
          get(){
            return this.$data[key]
          },
          set(newVal){
            this.$data[key] = newVal;
          }
      })
  }

}

// Dep：用来管理Watcher
class Dep {
  constructor() {
    // 这里存放若干依赖（watcher）
    this.deps = [];
  }

  addDep(dep) {
    this.deps.push(dep);
  }

  notify() {
    this.deps.forEach(dep => dep.update());
  }
}

// Watcher
class Watcher {
  constructor(vm, key, cb) {
      this.vm = vm;
      this.key = key;
      this.cb = cb;
    // 将当前watcher实例指定到Dep静态属性target
    Dep.target = this;
    this.vm[this.key]; 
    Dep.target = null;
  }

  update() {
    console.log("属性更新了");
    this.cb.call(this.vm, this.vm[this.key]);
  }
}

class ArrayWatcher {
  constructor(vm, option, cb) {
      console.log(this);
      this.vm = vm;
      this.option = option;
      this.key = option.key;
      this.index = option.index;
      this.paths = option.paths.split('.');
      this.cb = cb;
      // 将当前watcher实例指定到Dep静态属性target
      Dep.target = this;
      // 触发getter，添加依赖
      // 处理list,i,a.b.c.d...这种情况
      let res = this.vm[this.key][this.index];
      let prop;
      while (prop = this.paths.shift()) {
        res = res[prop];
      }
     
      Dep.target = null;
  }

  update() {
    console.log("ArrayWatcher 数组的某一项的某个属性更新了");
    if (this.paths.length) {
       this.cb.call(this.vm, this.getValueVByPath(this.vm[this.key][this.index], this.paths));
    }
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

