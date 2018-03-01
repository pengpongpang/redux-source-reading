/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 * 返回一个函数，在这个函数里，compose传入的函数们将被从右到左地嵌套调用。
 * compose(f, g, h)( a, b, c) 等价于 f(g(h( a, b, c)))
 */

export default function compose(...funcs) {
  if (funcs.length === 0) { 
    return arg => arg // 没有传入参数时，简单地返回此函数。
  }

  if (funcs.length === 1) { // 只传入一个函数时，返回这个函数。
    return funcs[0]
  }

  return funcs.reduce((a, b) => (...args) => a(b(...args))) // 左侧函数套住右侧，依次累积。
}
