/**
 * 把本插件安装/更新到 DSH 的 desktop 配置档。
 *
 * 安装内容：
 *   1. 把运行时文件复制到 <profile>/plugins/dsh-ds-peak-light
 *   2. 在 profile package.json 里登记 link: 依赖
 *   3. 把 bundle 追加到 dsh.profile.bundles
 *   4. 在 <profile>/node_modules 建 junction 指向装机副本
 *
 * 目标配置档默认取 $DSH_PROFILE_DIR，否则 ~/.dsh/profiles/desktop。
 * 运行前请先 `npm run build`；安装后需要完全重启 DSH 才生效。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const profile =
  process.env.DSH_PROFILE_DIR ?? path.join(os.homedir(), '.dsh', 'profiles', 'desktop')
const destination = path.join(profile, 'plugins', 'dsh-ds-peak-light')
const linkPath = path.join(profile, 'node_modules', 'dsh-ds-peak-light')

const files = [
  'package.json',
  'cordis.patch.yml',
  'icon.svg',
  'README.md',
  'README.en.md',
  'LICENSE',
  'lib/index.js',
  'lib/client.js',
]

for (const relative of files) {
  const from = path.join(source, relative)
  const to = path.join(destination, relative)
  if (!fs.existsSync(from)) throw new Error(`missing source file: ${from}`)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
  console.log(`copied ${relative}`)
}

const packagePath = path.join(profile, 'package.json')
const backupPath = `${packagePath}.bak-peak-light`
const raw = fs.readFileSync(packagePath, 'utf8')
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, raw, 'utf8')
  console.log(`backup -> ${backupPath}`)
}
const pkg = JSON.parse(raw)
pkg.dependencies = pkg.dependencies ?? {}
pkg.dependencies['dsh-ds-peak-light'] = 'link:./plugins/dsh-ds-peak-light'
const bundles = pkg.dsh?.profile?.bundles
if (!Array.isArray(bundles)) throw new Error('profile package.json has no dsh.profile.bundles')
if (!bundles.includes('dsh-ds-peak-light')) bundles.push('dsh-ds-peak-light')
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
console.log('profile package.json updated')

let hasLink = false
try {
  const stat = fs.lstatSync(linkPath)
  if (!stat.isSymbolicLink()) throw new Error(`${linkPath} exists and is not a link`)
  const current = fs.readlinkSync(linkPath)
  if (path.resolve(path.dirname(linkPath), current) !== destination) {
    fs.unlinkSync(linkPath)
  } else {
    hasLink = true
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
if (!hasLink) {
  fs.symlinkSync(destination, linkPath, 'junction')
  console.log('junction created')
} else {
  console.log('junction already points at the installed copy')
}

console.log(
  JSON.stringify(
    {
      destination,
      linkPath,
      bundles: pkg.dsh.profile.bundles,
      dependency: pkg.dependencies['dsh-ds-peak-light'],
    },
    null,
    2,
  ),
)
