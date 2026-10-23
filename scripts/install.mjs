/**
 * 把本插件安装/更新到 DSH 的 desktop 配置档。
 *
 * 安装内容：
 *   1. 把运行时文件复制到 <profile>/plugins/dsh-peak-light
 *   2. 在 profile package.json 里登记 link: 依赖
 *   3. 把 bundle 追加到 dsh.profile.bundles
 *   4. 在 <profile>/node_modules 建 junction 指向装机副本
 *
 * 同时迁移旧的包名 dsh-ds-peak-light（删除旧依赖、旧 bundle、旧 junction
 * 和旧装机目录），避免同一插件以两个名字同时挂载。
 *
 * 目标配置档默认取 $DSH_PROFILE_DIR，否则 ~/.dsh/profiles/desktop。
 * 运行前请先 `npm run build`；安装后需要完全重启 DSH 才生效。
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentName = 'dsh-peak-light'
const legacyNames = ['dsh-ds-peak-light']
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const profile =
  process.env.DSH_PROFILE_DIR ?? path.join(os.homedir(), '.dsh', 'profiles', 'desktop')
const pluginsDir = path.join(profile, 'plugins')
const destination = path.join(pluginsDir, currentName)
const linkPath = path.join(profile, 'node_modules', currentName)

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

for (const legacy of legacyNames) {
  const legacyLink = path.join(profile, 'node_modules', legacy)
  try {
    const stat = fs.lstatSync(legacyLink)
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(legacyLink)
      console.log(`removed legacy junction ${legacy}`)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  const legacyDir = path.join(pluginsDir, legacy)
  if (fs.existsSync(legacyDir)) {
    if (path.resolve(path.dirname(legacyDir)) !== path.resolve(pluginsDir)) {
      throw new Error(`refusing to remove unexpected path: ${legacyDir}`)
    }
    fs.rmSync(legacyDir, { recursive: true, force: true })
    console.log(`removed legacy install ${legacy}`)
  }
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
for (const legacy of legacyNames) delete pkg.dependencies[legacy]
pkg.dependencies[currentName] = `link:./plugins/${currentName}`
const bundles = pkg.dsh?.profile?.bundles
if (!Array.isArray(bundles)) throw new Error('profile package.json has no dsh.profile.bundles')
for (const legacy of legacyNames) {
  const index = bundles.indexOf(legacy)
  if (index !== -1) bundles.splice(index, 1)
}
if (!bundles.includes(currentName)) bundles.push(currentName)
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
      dependency: pkg.dependencies[currentName],
    },
    null,
    2,
  ),
)
