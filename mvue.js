// 数据响应式实现
function defineReactive(obj, key, val) {

  // 递归
  observe(val);

  // 创建Dep实例
  const dep = new Dep()

  Object.defineProperty(obj, key, {
    get() {
      console.log("get", key);
      // 依赖收集
      Dep.target && dep.addDep(Dep.target)
      return val;
    },
    set(newVal) {
      if (newVal !== val) {
        console.log("set", key);
        // 保证如果newVal是对象，再次做响应式处理
        observe(newVal);
        val = newVal;

        // 触发更新
        dep.notify()
      }
    },
  });
}

// 遍历obj，对其所有属性做响应式
function observe(obj) {
  if (typeof obj !== "object" || obj === null) {
    return;
  }

  new Observer(obj);
}

// 根据传入value的类型做相应的响应式处理
class Observer {
  constructor(value) {
    this.value = value;

    if (Array.isArray(value)) {
      // 数组处理
      this.observeArray(value)
    } else {
      // 对象处理
      this.walk(value);
    }
  }

  // 对象响应式
  walk(obj) {
    Object.keys(obj).forEach((key) => {
      defineReactive(obj, key, obj[key]);
    });
  }

  // 数组响应式
  observeArray (arr) {
    for (let i = 0, l = arr.length; i < l; i++) {
      observe(arr[i])
    }
  }
}

// 为vm.$data做数据代理
function proxy(vm) {
  Object.keys(vm.$data).forEach(key => {
    Object.defineProperty(vm, key, {
      get() {
        return vm.$data[key]
      },
      set(v) {
        vm.$data[key] = v
      }
    })
  })
}

// 构造函数KVue
class KVue {
  constructor(options) {
    this.$options = options; // 构造函数传递的参数
    this.$data = options.data; // 构造函数传递的data数据

    // 1、data响应式处理
    observe(this.$data);

    // 2、为data做代理
    proxy(this)

    // 3、挂载$mount
    if (options.el) {
      this.$mount(options.el);
    }
  }

  $mount(el) {
    // 获取宿主
    this.$el = document.querySelector(el);

    // 创建updateComponent
    const updateComponent = () => {
      // 获取渲染函数
      const { render } = this.$options;

      // 生成vnode
      const vnode = render.call(this, this.$createElement);

      // 执行_update，将vnode变成dom
      this._update(vnode);
    }

    // 创建根组件对应watcher
    new Watcher(this, updateComponent);
  }

  $createElement(tag, props, children) {
    return { tag, props, children }
  }

  // 处理vnode
  _update(vnode) {
    const prevVnode = this._vnode;

    if (!prevVnode) {
      // init
      this.__patch__(this.$el, vnode);
    } else {
      // update
      this.__patch__(prevVnode, vnode);
    }
  }

  // 处理vnode，做diff算法
  __patch__(oldVnode, vnode) {

    // dom
    if (oldVnode.nodeType) { // 创建oldVnode
      const parent = oldVnode.parentElement;
      const refElm = oldVnode.nextSibling;
      const el = this.createElm(vnode);
      parent.insertBefore(el, refElm);
      parent.removeChild(oldVnode);

      // 保存vnode
      this._vnode = vnode;
    } else { // update 处理新旧vnode diff
      // 获取el
      const el = vnode.el = oldVnode.el;

      if (oldVnode.tag === vnode.tag) {
        /******  处理props ******/
        const oldProps = oldVnode.props || {}; // oldProps
        const newProps = vnode.props || {}; // newProps

        // 新旧props比对
        for (const key in newProps) {
          const oldValue = oldProps[key];
          const newValue = newProps[key];

          // 若oldProps中不存在，newProps中存在的属性，则增加新属性
          if (oldValue !== newValue) {
            el.setAttribute(key, newValue);
          }
        }

        // 旧属性删除
        for (const key in oldProps) {
          if (!key in newProps) {
            el.removeAttribute(key);
          }
        }

        /******  处理children ******/
        const oldCh = oldVnode.children; // oldChildren
        const ch = vnode.children; // children

        if (typeof ch === 'string') { // 1、新孩子是文本的情况
          if (typeof oldCh === 'string') {
            // 新旧children都是文本，但文本内容不一致
            if (oldCh !== ch) {
              el.textContent = ch;
            }
          } else {
            // 新文本
            el.textContent = ch;
          }
        } else {
          if (typeof oldCh === 'string') { // 2、新的孩子不是文本，旧孩子是文本
            el.innerHTML = ''; // 清空文本
            ch.forEach(child => {
              this.createElm(child);
            })
          } else { // 新旧孩子都不是文本，则进行diff比对
            this.updateChildren(el, oldCh, ch);
          }
        }
      }
    }
  }

  // 创建vdom树
  createElm(vnode) {
    const el = document.createElement(vnode.tag);
    // props
    if (vnode.props) {
      for (const key in vnode.props) {
        const value = vnode.props[key];
        el.setAttribute(key, value);
      }
    }

    // children
    if (vnode.children) {
      // 文本
      if (typeof vnode.children === 'string') {
        el.textContent = vnode.children;
      } else {
        // 递归
        vnode.children.forEach(n => {
          const child = this.createElm(n);
          el.appendChild(child);
        })
      }
    }

    vnode.el = el;
    return el;
  }

  // 新旧vdom diff
  updateChildren(parentElm, oldCh, ch) {
    const len = Math.min(oldCh.length, ch.length);
    for (let i = 0; i < len; i++) {
      this.__patch__(oldCh[i], ch[i]);
    }
    if (ch.length > oldCh.length) {
      // add
      ch.slice(len).forEach(child => {
        const el = this.createElm(child);
      })
    } else if (ch.length < oldCh.length) {
      // remove
      oldCh.slice(len).forEach(child => {
        const el = this.createElm(child);
        parentElm.removeChild(el);
      })
    }
  }
}

// 监听器： 负责依赖更新
class Watcher {
  constructor(vm, fn) {
    this.vm = vm
    this.getter = fn

    this.get()
  }

  get() {
    // 依赖收集触发
    Dep.target = this;
    this.getter.call(this.vm);
    Dep.target = null;
  }

  update() {
    this.get()
  }
}

// 管家：和key一一对应，管理多个秘书,数据更新时通知他们做更新工作
class Dep {
  constructor() {
    this.deps = new Set();
  }

  addDep(dep) {
    this.deps.add(dep)
  }

  notify() {
    this.deps.forEach(dep => dep.update())
  }
}