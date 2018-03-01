import { ActionTypes } from './createStore'
import isPlainObject from 'lodash/isPlainObject'
import warning from './utils/warning'

function getUndefinedStateErrorMessage(key, action) { // 用于抛异常，异常里包含了 返回了undefined的分支reducer 的信息。如果reducer不响应一个action，应该返回传入的state，而不是undefined，如果需要清空state，用null。
  const actionType = action && action.type
  const actionName = (actionType && `"${actionType.toString()}"`) || 'an action'

  return (
    `Given action ${actionName}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state. ` +
    `If you want this reducer to hold no value, you can return null instead of undefined.`
  )
}

function getUnexpectedStateShapeWarningMessage(inputState, reducers, action, unexpectedKeyCache) { // 该函数对state形状存在的异常情况做统一处理，返回警告信息。
  const reducerKeys = Object.keys(reducers)
  const argumentName = action && action.type === ActionTypes.INIT ? // 判断是否在进行state的初始化
    'preloadedState argument passed to createStore' : // 初始化时传入的state是preloadState。参考 createStore.js 第58行、第170行
    'previous state received by the reducer' // 如果action不是 ActionTypes.INIT，说明已经存在了 旧state （ ActionTypes.INIT始终是第一个被派发的动作，参考createStore.js 第245行 ）

  if (reducerKeys.length === 0) { // 没有解析出有效的reducer，说明传入参数reducers不符要求。
    return (
      'Store does not have a valid reducer. Make sure the argument passed ' +
      'to combineReducers is an object whose values are reducers.'
    )
  }

  if (!isPlainObject(inputState)) { // 使用combineReducers时，state一定是object类型，如果不是，则可能是preloadedState类型错误，或reducer计算出的state有误。
    return (
      `The ${argumentName} has unexpected type of "` +
      ({}).toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    )
  }

  const unexpectedKeys = Object.keys(inputState).filter(key => // 过滤出state中不应该存在的多余的key，要保证state的key的正确性，当然多余的key不会引起什么严重问题，
                                                            // 只是这些key没有相应的reducer进行计算。
    !reducers.hasOwnProperty(key) &&
    !unexpectedKeyCache[key]
  )

  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })

  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? 'keys' : 'key'} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    )
  }
}

function assertReducerShape(reducers) { // 试探分支reducer内条件的默认分支，不允许返回undefined
  Object.keys(reducers).forEach(key => {
    const reducer = reducers[key]
    const initialState = reducer(undefined, { type: ActionTypes.INIT }) // 获取到分支的初始state

    if (typeof initialState === 'undefined') { // 如果分支state为undefined则抛出错误，不允许初始state为undefined。reducer如果返回null则会跳过此提示，所以初始化允许null。
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
        `If the state passed to the reducer is undefined, you must ` +
        `explicitly return the initial state. The initial state may ` +
        `not be undefined. If you don't want to set a value for this reducer, ` +
        `you can use null instead of undefined.`
      )
    }

    const type = '@@redux/PROBE_UNKNOWN_ACTION_' + Math.random().toString(36).substring(7).split('').join('.')
    if (typeof reducer(undefined, { type }) === 'undefined') { // 上面如果没有抛出错误，还存在一种例外情况，就是人为地在reducer内加入了ActionTypes.INIT，
                                                              // 且返回值不为undefined。为了防止这种行为，这里使用随机type值进行探测。
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
        `Don't try to handle ${ActionTypes.INIT} or other actions in "redux/*" ` +
        `namespace. They are considered private. Instead, you must return the ` +
        `current state for any unknown actions, unless it is undefined, ` +
        `in which case you must return the initial state, regardless of the ` +
        `action type. The initial state may not be undefined, but can be null.`
      )
    }
  })
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 * 
 * 参数 :
 * {
 *    r1: reducer_1,
 *    r2: reducer_2,
 *      ....
 *    rn: reducer_n
 * }
 * 返回 reducer
 * 该reducer 的 state 像这样计算,即每个子reducer计算一个分支。
 * {
 *    r1:reducer_1(state.r1),
 *    r2:reducer_2(state.r2),
 *        ....
 *    rn:reducer_n(state.rn)
 * }
 * 
 */
export default function combineReducers(reducers) {
  const reducerKeys = Object.keys(reducers) // 读取reducers对象的key，作为state的分支的key
  const finalReducers = {}
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i]

    if (process.env.NODE_ENV !== 'production') { // 生产环境下不提醒
      if (typeof reducers[key] === 'undefined') { // reducers 某分支下没有reducer时给予警告
        warning(`No reducer provided for key "${key}"`)
      }
    }

    if (typeof reducers[key] === 'function') { // reducer存在时保存进finalReducers对象
      finalReducers[key] = reducers[key]
    }
  }
  const finalReducerKeys = Object.keys(finalReducers) // 过滤掉reducers中无效的key

  let unexpectedKeyCache
  if (process.env.NODE_ENV !== 'production') { // 非生产环境下初始化为空对象，用于收集state中无效的key
    unexpectedKeyCache = {}
  }

  let shapeAssertionError
  try {
    assertReducerShape(finalReducers)
  } catch (e) {
    shapeAssertionError = e // 如果有错误，暂时不抛出，而是在输出的reducer被调用时抛出。
  }

  return function combination(state = {}, action) {
    if (shapeAssertionError) {
      throw shapeAssertionError
    }

    if (process.env.NODE_ENV !== 'production') { // 非生产环境下给予警告
      const warningMessage = getUnexpectedStateShapeWarningMessage(state, finalReducers, action, unexpectedKeyCache)
      if (warningMessage) {
        warning(warningMessage)
      }
    }

    let hasChanged = false 
    const nextState = {} // 新 state
    for (let i = 0; i < finalReducerKeys.length; i++) { // 计算新state
      const key = finalReducerKeys[i] // 分支 key
      const reducer = finalReducers[key] // 分支 reducer
      const previousStateForKey = state[key] // 分支 旧state
      const nextStateForKey = reducer(previousStateForKey, action) // 调用分支reducer，传入分支旧state 和 action，得到分支 新state
      if (typeof nextStateForKey === 'undefined') { // 分支 state不允许为 undefined，但允许为null。
        const errorMessage = getUndefinedStateErrorMessage(key, action)
        throw new Error(errorMessage)
      }
      nextState[key] = nextStateForKey // 存入
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey // 有一个分支计算的state发生改变则算作改变。
    }
    return hasChanged ? nextState : state // state改变了就返回新state，否则仍旧返回传入的state，这是reducer的设计原则之一。
  }
}
