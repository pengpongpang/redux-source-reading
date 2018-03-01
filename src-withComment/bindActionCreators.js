function bindActionCreator(actionCreator, dispatch) {
  return (...args) => dispatch(actionCreator(...args))
}

/**
 * Turns an object whose values are action creators, into an object with the
 * same keys, but with every function wrapped into a `dispatch` call so they
 * may be invoked directly. This is just a convenience method, as you can call
 * `store.dispatch(MyActionCreators.doSomething())` yourself just fine.
 *
 * For convenience, you can also pass a single function as the first argument,
 * and get a function in return.
 *
 * @param {Function|Object} actionCreators An object whose values are action
 * creator functions. One handy way to obtain it is to use ES6 `import * as`
 * syntax. You may also pass a single function.
 *
 * @param {Function} dispatch The `dispatch` function available on your Redux
 * store.
 *
 * @returns {Function|Object} The object mimicking the original object, but with
 * every action creator wrapped into the `dispatch` call. If you passed a
 * function as `actionCreators`, the return value will also be a single
 * function.
 * 
 * 使用举例:
 * 
 * let actionCreator1 = ()=>({type:'BALA'});
 * let actionCreator2 = ()=>({type:"LABA"});
 * 
 * let actionCreators = bindActionCreators({ actionCreator1, actionCreator2 },store.dispatch); 
 * 
 * actionCreators.actionCreator1(); // 相当于 store.dispatch( {type:'BALA'} )
 * actionCreators.actionCreator2(); // 相当于 store.dispatch( {type:"LABA"} )
 * 
 */
export default function bindActionCreators(actionCreators, dispatch) {
  if (typeof actionCreators === 'function') { // 如果传入了一个actionsCreator，则直接将它包裹起来
    return bindActionCreator(actionCreators, dispatch)
  }

  if (typeof actionCreators !== 'object' || actionCreators === null) { // 注意这里 null 的type是object，所以要排除
    throw new Error(
      `bindActionCreators expected an object or a function, instead received ${actionCreators === null ? 'null' : typeof actionCreators}. ` +
      `Did you write "import ActionCreators from" instead of "import * as ActionCreators from"?`
    )
  }

  const keys = Object.keys(actionCreators)
  const boundActionCreators = {}
  for (let i = 0; i < keys.length; i++) { // 对每个key上的actionCrator进行包装后保存到boundActionCreators相应的key上
    const key = keys[i] // 当前key
    const actionCreator = actionCreators[key] // 当前actionCreator
    if (typeof actionCreator === 'function') { // 必须是function，否则忽略
      boundActionCreators[key] = bindActionCreator(actionCreator, dispatch)
    }
  }
  return boundActionCreators
}
