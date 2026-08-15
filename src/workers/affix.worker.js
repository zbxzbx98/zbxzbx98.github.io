/**
 * 洗词条策略计算 Worker
 *
 * 把耗时的 MDP 求解放到 Web Worker 中执行，避免阻塞页面。
 *
 * 加载方式说明：
 * Vite dev（rolldown）不会把 src 下的 CommonJS 源文件转换成 ESM，
 * 直接 import 会因 module/require 未定义而报错。因此这里用 fetch 获取
 * 算法源码，在函数作用域内以 module/require 垫片求值（两个算法文件只在
 * 末尾使用 module.exports，且只有 affix_solver 的 CLI 测试块用到
 * require.main），dev 与 build 下均可工作，且不改动算法文件本身。
 *
 * 消息协议（主线程 -> Worker）：
 *   { id, type: 'single' | 'character', current, target, options? }
 * 回复：
 *   { id, ok: true, result }          计算完成
 *   { id, ok: true, progress: info }  进度回调（仅角色版）
 *   { id, ok: false, error }          计算失败
 */

let solversPromise = null

const moduleCache = new Map()

/**
 * 获取一段 CommonJS 源码，并在垫片作用域内求值，返回 module.exports。
 */
async function loadCjsModule(url) {
  if (moduleCache.has(url)) return moduleCache.get(url)
  const promise = (async () => {
    const code = await (await fetch(url)).text()
    const module = { exports: {} }
    const requireShim = (id) => loadCjsModule(new URL(id, url).href)
    requireShim.main = undefined
    const factory = new Function('module', 'exports', 'require', code)
    factory(module, module.exports, requireShim)
    return module.exports
  })()
  moduleCache.set(url, promise)
  return promise
}

function ensureSolvers() {
  if (!solversPromise) {
    solversPromise = Promise.all([
      loadCjsModule(new URL('../affix_solver.js', import.meta.url)),
      loadCjsModule(new URL('../affix_4gear_solver.js', import.meta.url)),
    ]).then(([solverMod, charSolverMod]) => ({
      solve: solverMod.solve,
      solveCharacter: charSolverMod.solveCharacter,
    }))
  }
  return solversPromise
}

self.onmessage = (e) => {
  const { id, type, current, target, options } = e.data || {}

  ensureSolvers()
    .then(({ solve, solveCharacter }) => {
      try {
        if (type === 'single') {
          const result = solve(current, target, {
            epsilon: 1e-9,
            maxIterations: 10000,
            digits: 6,
            // 秘钥使用概率阈值 p（0~1，默认 0.1）
            p: typeof options?.p === 'number' ? options.p : 0.1,
          })
          self.postMessage({ id, ok: true, result })
        } else if (type === 'character') {
          const result = solveCharacter(current, target, {
            epsilon: 1e-9,
            maxGlobalStates: options?.maxGlobalStates ?? 500000,
            maxTransitionsPerAction: options?.maxTransitionsPerAction ?? 500000,
            digits: 6,
            p: typeof options?.p === 'number' ? options.p : 0.1,
            solve,
            onProgress(info) {
              self.postMessage({ id, ok: true, progress: info })
            },
          })
          self.postMessage({ id, ok: true, result })
        } else {
          self.postMessage({ id, ok: false, error: '未知计算类型: ' + type })
        }
      } catch (err) {
        self.postMessage({
          id,
          ok: false,
          error: err && err.message ? err.message : String(err),
        })
      }
    })
    .catch((err) => {
      self.postMessage({
        id,
        ok: false,
        error: '算法加载失败：' + (err && err.message ? err.message : String(err)),
      })
    })
}
