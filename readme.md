如何给数组、对象本身添加watcher？ defineProperty

vue
 直接通过使用数组下标来赋值不能达到响应化的目的

模板中使用到数组的任何一个对象元素的key，比如name 都要添加依赖收集