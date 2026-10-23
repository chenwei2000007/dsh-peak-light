# dsh-ds-peak-light · DeepSeek 峰谷小圆灯

在 DSH 侧栏「deepseek HARNESS」品牌文字的右侧加一颗小圆灯：

| 时段 | 颜色 | 含义 |
|---|---|---|
| 峰时 | 🔴 红色（缓慢呼吸） | 标准价 |
| 谷时 | 🟢 绿色（常亮） | 高峰价的 50% |

鼠标悬停圆灯可看到：当前时段、距离下次切换还有多久、以及计费规则。
点击圆灯不会冒泡到 logo 按钮，不会误开新会话。

## 计费规则（2026-09-10 12:00 起）

| 时段 | 北京时间 |
|---|---|
| 峰时 | 周一至周五 `09:00–12:00`、`14:00–18:00`（不含中国法定节假日） |
| 谷时 | 其余全部时间，含周末与法定节假日全天 |

来源：[DeepSeek 官方价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)（2026-10-23 复核）。
旧的「00:30–08:30 夜间错峰」规则已取消，不要再用。

## 实现要点

- 占用侧栏槽位 `sidebar.brand.name`（single），用 `priority: -1` 盖过官方品牌插件
  （单槽位「最低 priority 渲染」，相同 priority 会直接报错）；
  组件内部重新渲染官方 `BrandWordmark`（deepseek + HARNESS 徽标），再在右侧放圆灯。
- 官方文字组件缺失时（未来版本改名/移除）插件会主动放弃占位，官方品牌照常回退。
- 纯前端，无 Host 逻辑、无网络请求、不读账号与密钥。
- 浏览器 bundle 是自包含的 CJS 工厂（`lib/client.js`），零运行时依赖。
- **注册入口必须是 `window.__ModuleLoader__`**（双下划线）。内置 bundle 里的
  `_ModuleLoader__` 是引导脚本局部别名，第三方 bundle 用它会在浏览器抛
  `ReferenceError`，DSH 会判定 web boot 失败并回退安全模式。
- 崩溃日志位置：`%APPDATA%\@deepseek-ai\dsh-desktop\logs\crash-*.log`。

## 目录

```
src/policy.js          峰谷规则、节假日、倒计时（纯函数，可单测）
src/ui.js              React 组件与槽位注册
scripts/build-client.mjs  把上面两个文件内联成 lib/client.js
lib/client.js          构建产物（安装时被 DSH 读取）
lib/index.js           Host 半边：空实现，只为让 Loader 能解析到包
cordis.patch.yml       bundle 层：插入一行 Loader entry
```

## 构建与测试

```powershell
cd plugins\dsh-ds-peak-light
npm run build             # 或 node scripts/build-client.mjs
npm test                  # 规则单测 + bundle 冒烟测试
npm run dev:install       # 复制到 %DSH_PROFILE_DIR%\plugins 并登记（需写 ~\.dsh 权限）
```

改颜色改 `src/ui.js` 顶部的 `CSS`；改时间/节假日改 `src/policy.js`。
改完必须重新 `build` + `dev:install`，然后**完全退出并重新打开** DSH
（只刷新页面不够：配置档只在启动时读取）。

## 发布到 npm / 插件市场

包名 `dsh-ds-peak-light`，市场分类 `usage`。完整清单、GitHub 建仓、npm 发布、
awesome-dsh-plugin 的 PR 材料都在 [release/PUBLISH.md](release/PUBLISH.md)，
可直接提交的条目在 [release/awesome-entry.yml](release/awesome-entry.yml)。
发布动作需要本人的 npm / GitHub 登录态，仓库满 1 天后才能被精选列表收录。

## 安装位置（本机）

- 源码：`C:\Users\kk302\Documents\deepseek-harness\default-workspace\plugins\dsh-ds-peak-light`
- 装机副本：`C:\Users\kk302\.dsh\profiles\desktop\plugins\dsh-ds-peak-light`
- 配置档依赖：`"dsh-ds-peak-light": "link:./plugins/dsh-ds-peak-light"`
- `package.json` 的 `dsh.profile.bundles` 末尾追加 `dsh-ds-peak-light`
- `node_modules\dsh-ds-peak-light` 指向装机副本（junction）

## 已知限制

- 节假日日历目前内置 **2026 年**（只列落在工作日的法定节假日）。
  2027 年起若未更新，会按「周一至周五」估算，提示里会标注。
- 槽位名依赖 DSH `0.2.1-rc.2` 的 `sidebar.brand.name`；DSH 改槽位名时需同步调整 `src/ui.js`。
- 圆灯是状态指示，不做通知、不弹窗、不轮询接口。
