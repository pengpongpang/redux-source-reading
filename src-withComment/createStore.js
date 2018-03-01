import isPlainObject from 'lodash/isPlainObject' // 用于约束action。
import $$observable from 'symbol-observable'  // 作为键使用。

/**
 * These are private action types reserved by Redux.
 * For any unknown actions, you must return the current state.
 * If the current state is undefined, you must return the initial state.
 * Do not reference these action types directly in your code.
 */
export const ActionTypes = { // 初始化state时使用，应当避免在自己代码里写出一样的type值。
  INIT: '@@redux/INIT'
}

/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param {Function} reducer A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param {any} [preloadedState] The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param {Function} [enhancer] The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
export default function createStore(reducer, preloadedState, enhancer) {
  // 只传入两个参数，且第二个参数是一个函数时。
  // 相当于重载，这里允许只传两个参数，保证第一个是reducer，第二个是enhancer即可。
  // preloadedState在这里会被置为undefined。
  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState
    preloadedState = undefined
  }
  // 如果提供了enhancer，那么它必须是函数。且立即返回使用enhancer加强了的createStore的调用。
  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.')
    }
    // enhancer(createStore) 调用的返回值为函数  
    // (reducer,preloadedState,enhancer):Store => ... 可以看做加强后的createStore
    // 该函数内部调用原始createStore，生成raw Store，接着对raw Store的dispatch函数应用
    // 中间件进行加强。
    // 举例 enhancer 可以是 applyMiddleware(...middlewares)
    // 所以，创建store 的方法 可以是 
    // let store =  createStore(reducer,applyMiddleware(...middlewares))
    // 也可以是 
    // let store = applyMiddleware(...middlewares)(createStore)(reducer),我觉得这行代码更直观些
    // 或者这样：let strongerCreateStore = applyMiddleware(...middlewares)(createStore);
    //          let store = strongerCreateStore(reducer)
    return enhancer(createStore)(reducer, preloadedState)
  }
  // reducer必须提供，且为函数。
  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.')
  }

  let currentReducer = reducer // 保留reducer引用
  let currentState = preloadedState // 保留preloadedState引用
  let currentListeners = [] // 初始化 监听 列表
  let nextListeners = currentListeners // 保留 currentListeners 引用
  let isDispatching = false // 初始化 正在dispatch为false 用于防止在reducer中调用dispatch

  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   */
  function getState() {
    return currentState
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   * 
   * action发出后就会调用 回调函数（listener）。由于state可能已经发生了改变，你可以在
   * 回调函数里使用getState来获取改变后的state。
   * 
   * You may call `dispatch()` from a change listener, with the following
   * caveats:
   * 
   * 在回调函数里，你也可以派发(dispatch) action，但是需要注意这些：
   *  （订阅的加入和取消 与 你派发动作之间的顺序会产生些比较绕的问题，主要是你必须要
   *  知道你的监听器会响应哪些dispatch操作）
   * 
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   * 
   * 在你调用dispatch之前，所有的订阅都被保留了一份快照。如果你在监听器回调中又做出了
   * 添加或移除监听器的操作，这些移除的或添加的监听器并不会响应当前的dispatch操作。
   * （因为当前的dispatch操作使用的是快照版本的监听器列表，所以你移除的那部分监听器
   * 还是会被调用到，你新加入的监听器则不会被调用。）而由于dispatch时会先更新订阅器列表快照，
   *  所以你的添加和移除操作会对下次的dispatch生效，不论该次dispatch是不是嵌套的
   * （简单说就是不管在什么地方调用的dispatch）。
   * 
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   * 
   * 正因为在嵌套的dispatch调用过程中，state可能已经被更新了多次，而这时监听器回调函数还没
   * 有被调用到（因为每次dispatch都会去通知一遍当前的监听器列表，如果在监听器里又一次发起
   * dispatch，导致状态发生改变，发起新的一轮通知，而上一轮中可能还存在一些监听器没有通知到，
   * 等通知到了，此时状态已经是最新的了，而不是最初的dispatch对应的state），所以别在一个监
   * 听器里关注所有的状态变化。尽管如此，能够确保的是，在dispatch之前注册所有的订阅者在被调
   * 用时获取到的都是当前最新的state
   * 
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    // 监听器必须是函数
    if (typeof listener !== 'function') {
      throw new Error('Expected listener to be a function.')
    }

    let isSubscribed = true // 初始化已订阅为true

    // 确保可以更改监听器，这里克隆一份原来的所有监听器的快照到
    //  nextListeners 即新的列表。也就是说，每次添加监听器都会保证产生一份新的监听器列表
    ensureCanMutateNextListeners() 
    nextListeners.push(listener) // 在新列表里加入当前监听器

    return function unsubscribe() { // 返回一个取消订阅的函数
      if (!isSubscribed) { // 重复调用取消订阅是无意义的，所以如果已经取消了，直接退出。
        return
      }

      isSubscribed = false
      // 克隆、删除
      ensureCanMutateNextListeners()
      const index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1)
    }
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   * 
   * 最基础的实现仅支持纯object类型的action，
   * 如果你想disptch如promise,observable,thunk等其他类型action，
   * 则需要用相应的中间件将创建函数包裹起来。
   * 中间件使用该dispatch方法最终的派发的也是纯的object的action。
   * 
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   * 
   * 要保证action是可序列化的纯object。type必须有，最好用字符串类型常量。
   *
   * @returns {Object} For convenience, the same action object you dispatched. 
   * 返回的是同个action
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   * 
   * 注意，如果你用自定义的中间件，包装了dispatch，则可能返回其他类型。
   * 比如异步操作时可以返回Promise，那么可以这样： await store.dispatch(action)
   * 这取决于中间件。
   */
  function dispatch(action) {
    if (!isPlainObject(action)) { // 不是纯对象就抛出错误
      throw new Error(
        'Actions must be plain objects. ' +
        'Use custom middleware for async actions.'
      )
    }

    if (typeof action.type === 'undefined') { // 没提供type就抛出错误
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
        'Have you misspelled a constant?'
      )
    }

    if (isDispatching) { // reducer运行完毕后置为false；在reducer中不允许dispatch。
      throw new Error('Reducers may not dispatch actions.')
    }

    try {
      isDispatching = true
      // 调用reducer。从这里可以看出，如果提供了preloadedState，初始化时，
      //  preloadedState会覆盖reducer里面提供的默认值。
      currentState = currentReducer(currentState, action) 
    } finally {
      isDispatching = false
    }
      // 在通知监听器前，先更新监听器列表，监听器列表可能会在监听器函数里发生改变。
      //  这一步可以保证每次dispatch中都通知当前最新的监听器列表，
      // 也就是说，每次dispatch都有与其相对应的一份监听器列表快照，
      //  而对比任意两次dispatch，它们所使用的监听器列表则可能是不同的，
    const listeners = currentListeners = nextListeners 
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener()
    }

    return action
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.')
    }

    currentReducer = nextReducer
    dispatch({ type: ActionTypes.INIT })
  }

  /**
   * Interoperability point for observable/reactive libraries.
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable
   */
  function observable() {
    const outerSubscribe = subscribe
    return {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe(observer) {
        if (typeof observer !== 'object') {
          throw new TypeError('Expected the observer to be an object.')
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState())
          }
        }

        observeState()
        const unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT })

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable
  }
}
