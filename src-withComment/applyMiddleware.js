import compose from './compose'

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
export default function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState, enhancer) => {
    const store = createStore(reducer, preloadedState, enhancer)
    let dispatch = store.dispatch
    let chain = []

    const middlewareAPI = { // 提供给中间件的接口。 
      getState: store.getState,
      dispatch: (action) => dispatch(action)
    }
    chain = middlewares.map(middleware => middleware(middlewareAPI)) // 中间件是高阶函数，即返回值是函数，这里是利用闭包，先把api传进去。返回的函数长什么样？答：chain列表里的每个函数都接收一个dispatch（最右边的中间件接收到的是原始dispatch，其余中间件接收到的是经过它右侧的中间件层叠包装后的dispatch）为参数，然后返回一个包装过的dispatch。
                                                                    
    dispatch = compose(...chain)(store.dispatch)  // 加强dispatch，从这里可以看出，所谓中间件，其实是在函数内部包装原始dispatch，然后返回一个函数，看成是新的dispatch，而新的dispatch长什么样就完全取决于中间件了。
                                                  // 最终整个中间件链返回一个包装后的dispatch，在派发action时，最外层dispatch先接收到，然后在内部又调用内层dispatch，传入新的action，上述过程会一直进行到最内层dispatch利用原始dispatch派发出原始action。
    return {
      ...store,
      dispatch
    }
  }
}
