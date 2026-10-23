/**
 * dsh-peak-light — 浏览器半边。
 *
 * 占用 `sidebar.brand.name` 单槽位（priority 低于官方品牌插件，单槽位最低者渲染），
 * 重新渲染官方 `BrandWordmark`（deepseek + HARNESS 徽标），并在它右侧画出
 * 一个小圆灯：峰时红、谷时绿。
 * 槽位被更高优先级占用时官方品牌照常回退，因此本插件卸载后不留痕迹。
 */

const STYLE_ID = 'dsh-peak-light/client.css'

const CSS = `
.dshPeakDot {
  position: relative;
  flex: none;
  align-self: center;
  width: 6px;
  height: 6px;
  margin-left: 2px;
  border-radius: 999px;
  background: #f04438;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 0 6px 1px rgba(240, 68, 56, 0.55);
  cursor: help;
  animation: dshPeakPulse 2.4s ease-in-out infinite;
  transition: background 0.25s ease, box-shadow 0.25s ease;
}
.dshPeakDot::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 999px;
}
.dshPeakDot[data-phase='off-peak'] {
  background: #22c55e;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 0 6px 1px rgba(34, 197, 94, 0.45);
  animation: none;
}
.dshPeakDot:hover {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 0 9px 2px rgba(240, 68, 56, 0.75);
}
.dshPeakDot[data-phase='off-peak']:hover {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 0 9px 2px rgba(34, 197, 94, 0.65);
}
@keyframes dshPeakPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@media (prefers-reduced-motion: reduce) {
  .dshPeakDot { animation: none; }
}
`

function ensureStyle() {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`)) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-peak-light'
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = CSS
  document.head.appendChild(tag)
}

/**
 * 官方品牌文字（deepseek + HARNESS 徽标）+ 右侧峰谷小圆灯。
 */
export function PeakBrandName() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const timer = window.setInterval(tick, 15_000)
    const onVisibility = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const status = statusAt(now)
  const peak = status.period === 'peak'
  const switchLabel = formatSwitchLabel(status.nextSwitchAt, now)
  const remaining = formatRemaining(status.msUntilSwitch)
  const holiday = status.holiday ? `${status.holiday} · ` : ''
  const headline = peak
    ? `峰时 · ${switchLabel} 转谷时，还剩 ${remaining}`
    : `谷时 · ${holiday}${switchLabel} 转峰时，还剩 ${remaining}`
  const rule = peak
    ? 'DeepSeek 峰时：周一至周五 09:00–12:00、14:00–18:00（北京时间）'
    : 'DeepSeek 谷时：其余时间，含周末与法定节假日（北京时间）'
  const uncovered = status.calendarCovered
    ? ''
    : `\n${status.year} 年节假日日历未内置，暂按周一至周五计算`
  const title = `${headline}\n${rule}${uncovered}`
  const ariaLabel = `${peak ? '峰时' : '谷时'}，${switchLabel}切换`

  return h(
    Fragment,
    null,
    h(BrandWordmark, { includeMark: false }),
    h('span', {
      className: 'dshPeakDot',
      'data-phase': status.period,
      role: 'img',
      title,
      'aria-label': ariaLabel,
      onClick: (event) => {
        event.preventDefault()
        event.stopPropagation()
      },
    }),
  )
}

export const inject = ['slots']

/**
 * 注册品牌文字占位。
 * @param {import('@deepseek-ai/cordis').Context} ctx - 客户端根上下文。
 */
export function apply(ctx) {
  // 装饰性插件不能拖垮整个启动：注册失败就静默放弃，官方品牌照常回退。
  try {
    ensureStyle()
    if (typeof BrandWordmark !== 'function') return
    ctx.slots.inject('sidebar.brand.name', () =>
      ctx.slots.register(
        {
          name: 'sidebar.brand.name',
          // 单槽位按 priority 从低到高取第一个渲染；官方品牌插件是 0，
          // 这里用 -1 才能盖过它（相同 priority 会直接抛错）。
          priority: -1,
          registrant: 'dsh-peak-light',
        },
        PeakBrandName,
      ),
    )
  } catch (error) {
    console.warn('[dsh-peak-light] 已跳过：', error)
  }
}
