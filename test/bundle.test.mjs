import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundleSource = fs.readFileSync(path.join(root, 'lib', 'client.js'), 'utf8')

/** 在沙箱里执行 bundle，返回它的 exports 以及记录到的注册调用。 */
function loadBundle() {
  const calls = { inject: [], register: [] }
  const React = {
    Fragment: Symbol('Fragment'),
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children }
    },
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
    },
    useEffect() {},
  }
  const requireStub = (specifier) => {
    if (specifier === 'react') return React
    if (specifier === '@deepseek-ai/dsh-client-ui-primitives') {
      return { BrandWordmark: function BrandWordmark() {} }
    }
    throw new Error(`unexpected require: ${specifier}`)
  }

  let exports
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load({ factory }) {
          exports = factory(requireStub)
        },
      },
    },
    console: { log: console.log, error: console.error, warn() {} },
  }
  vm.runInNewContext(bundleSource, sandbox)

  return {
    exports,
    calls,
    ctx: {
      slots: {
        inject(name, factory) {
          calls.inject.push(name)
          return factory()
        },
        register(options, component) {
          calls.register.push({ options, component })
          return () => {}
        },
      },
    },
    React,
  }
}

test('bundle 导出 apply / inject，且只 require 平台模块', () => {
  const { exports } = loadBundle()
  assert.equal(typeof exports.apply, 'function')
  assert.deepEqual(Array.from(exports.inject), ['slots'])
  assert.equal(typeof exports.PeakBrandName, 'function')
})

test('bundle 用 window.__ModuleLoader__ 注册（动态插件的运行时约定）', () => {
  assert.match(bundleSource, /window\.__ModuleLoader__\.load\(/)
  assert.doesNotMatch(bundleSource, /^_ModuleLoader__\.load\(/m)
})

test('注册占住 sidebar.brand.name，并带更低优先级（最低者渲染）', () => {
  const { exports, calls, ctx } = loadBundle()
  exports.apply(ctx)
  assert.deepEqual(calls.inject, ['sidebar.brand.name'])
  assert.equal(calls.register.length, 1)
  assert.equal(calls.register[0].options.name, 'sidebar.brand.name')
  assert.equal(calls.register[0].options.priority, -1)
  assert.equal(calls.register[0].component, exports.PeakBrandName)
})

test('槽位注册抛错时 apply 不向外抛（不拖垮启动）', () => {
  const { exports } = loadBundle()
  assert.doesNotThrow(() => {
    exports.apply({
      slots: {
        inject() {
          throw new Error('boom')
        },
        register() {},
      },
    })
  })
})

test('渲染官方品牌文字 + 右侧圆灯，圆灯带峰谷提示', () => {
  const { exports, React } = loadBundle()
  const element = exports.PeakBrandName({})
  assert.equal(element.type, React.Fragment)
  assert.equal(element.children.length, 2)

  const wordmark = element.children[0]
  assert.equal(wordmark.props.includeMark, false)

  const dot = element.children[1]
  assert.equal(dot.props.className, 'dshPeakDot')
  assert.ok(['peak', 'off-peak'].includes(dot.props['data-phase']))
  assert.match(dot.props.title, /(峰时|谷时)/)
  assert.match(dot.props.title, /北京时间/)
  assert.match(dot.props['aria-label'], /(峰时|谷时)/)
  assert.equal(typeof dot.props.onClick, 'function')

  // 点击圆灯不应冒泡到品牌按钮（避免误开新会话）
  let stopped = false
  dot.props.onClick({
    preventDefault() {},
    stopPropagation() {
      stopped = true
    },
  })
  assert.equal(stopped, true)
})

test('官方文字组件缺失时不占用槽位，保留回退', () => {
  const source = bundleSource.replace(
    'const BrandWordmark = primitives && primitives.BrandWordmark;',
    'const BrandWordmark = undefined;',
  )
  let exports
  const sandbox = {
    window: {
      __ModuleLoader__: {
        load({ factory }) {
          exports = factory((id) =>
            id === 'react'
              ? { createElement() {}, Fragment: Symbol('Fragment'), useState() {}, useEffect() {} }
              : {},
          )
        },
      },
    },
    console,
  }
  vm.runInNewContext(source, sandbox)
  const calls = []
  exports.apply({
    slots: {
      inject(name) {
        calls.push(name)
      },
      register() {},
    },
  })
  assert.deepEqual(calls, [])
})

test('插件清单与 bundle 约定一致', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const patch = fs.readFileSync(path.join(root, 'cordis.patch.yml'), 'utf8')
  assert.equal(pkg.name, 'dsh-peak-light')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(pkg.exports['./client'].default, './lib/client.js')
  assert.match(patch, /name: dsh-peak-light/)
  assert.match(bundleSource, /id: "dsh-peak-light"/)
  assert.match(bundleSource, /sidebar\.brand\.name/)
})
