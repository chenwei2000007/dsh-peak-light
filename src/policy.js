/**
 * DeepSeek 峰谷计费规则 —— 本插件唯一的事实来源。
 *
 * 现行规则（2026-09-10 12:00 起执行，2026-10-23 复核官方价格页）：
 *   - 峰时：北京时间 周一至周五 09:00–12:00、14:00–18:00，不含中国法定节假日。
 *   - 谷时：其余全部时间，含周末与中国法定节假日全天；谷时价格为峰时的 50%。
 *
 * 来源：
 *   - 官方价格页（中文）: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
 *
 * 约定：
 *   - 每个峰时窗口都是左闭右开 `[start, end)`；官方只写「9:00 - 12:00」，
 *     边界那一秒的归属未明说，这里按「到点即切换」处理。
 *   - 北京时间固定 UTC+8，无夏令时。
 *
 * 本文件是纯 ESM、无任何依赖，既供 `test/policy.test.mjs` 直接导入，也被
 * `scripts/build-client.mjs` 去掉 `export` 后原样内联进浏览器 bundle。
 */

export const MINUTE_MS = 60_000
export const DAY_MS = 86_400_000
export const BEIJING_OFFSET_MINUTES = 480

/** 峰时窗口，单位为「北京时间当日 0 点起的分钟数」，左闭右开。 */
export const PEAK_WINDOWS = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60],
]

/**
 * 2026 年中国大陆法定节假日中落在周一至周五的日期。
 * 周末本身全天谷时，所以周末日期（含调休上班的周末）不必列出。
 */
export const HOLIDAYS = {
  '2026-01-01': '元旦',
  '2026-01-02': '元旦',
  '2026-02-16': '春节',
  '2026-02-17': '春节',
  '2026-02-18': '春节',
  '2026-02-19': '春节',
  '2026-02-20': '春节',
  '2026-02-23': '春节',
  '2026-04-06': '清明节',
  '2026-05-01': '劳动节',
  '2026-05-04': '劳动节',
  '2026-05-05': '劳动节',
  '2026-06-19': '端午节',
  '2026-09-25': '中秋节',
  '2026-10-01': '国庆节',
  '2026-10-02': '国庆节',
  '2026-10-05': '国庆节',
  '2026-10-06': '国庆节',
  '2026-10-07': '国庆节',
}

/** 内置节假日日历覆盖的年份。 */
export const CALENDAR_YEARS = [2026]

const HOLIDAY_SET = new Set(Object.keys(HOLIDAYS))
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function pad2(value) {
  return value < 10 ? `0${value}` : `${value}`
}

/**
 * 把一个时间点拆成北京时间字段。
 * @param {number} instantMs - epoch 毫秒。
 * @returns {{year:number,month:number,day:number,hour:number,minute:number,weekday:number,minuteOfDay:number,dateKey:string,dayStartMs:number}}
 */
export function beijingParts(instantMs) {
  const shifted = new Date(instantMs + BEIJING_OFFSET_MINUTES * MINUTE_MS)
  const year = shifted.getUTCFullYear()
  const month = shifted.getUTCMonth() + 1
  const day = shifted.getUTCDate()
  const hour = shifted.getUTCHours()
  const minute = shifted.getUTCMinutes()
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: shifted.getUTCDay(),
    minuteOfDay: hour * 60 + minute,
    dateKey: `${year}-${pad2(month)}-${pad2(day)}`,
    dayStartMs: Date.UTC(year, month - 1, day) - BEIJING_OFFSET_MINUTES * MINUTE_MS,
  }
}

/**
 * 某个时间点是否按峰时计价。
 * @param {number} instantMs - epoch 毫秒。
 * @returns {boolean}
 */
export function isPeak(instantMs) {
  const parts = beijingParts(instantMs)
  if (parts.weekday === 0 || parts.weekday === 6) return false
  if (HOLIDAY_SET.has(parts.dateKey)) return false
  return PEAK_WINDOWS.some(
    ([start, end]) => parts.minuteOfDay >= start && parts.minuteOfDay < end,
  )
}

/**
 * 时间点所属时段。
 * @param {number} instantMs - epoch 毫秒。
 * @returns {'peak'|'off-peak'}
 */
export function periodAt(instantMs) {
  return isPeak(instantMs) ? 'peak' : 'off-peak'
}

/**
 * 下一次峰谷切换的时间点。
 * @param {number} instantMs - epoch 毫秒。
 * @returns {number|null} 未来三周内找到的切换点；找不到时返回 null。
 */
export function nextSwitchAt(instantMs) {
  const current = isPeak(instantMs)
  const { dayStartMs } = beijingParts(instantMs)
  const candidates = []
  for (let day = 0; day < 21; day += 1) {
    const base = dayStartMs + day * DAY_MS
    for (const [start, end] of PEAK_WINDOWS) {
      candidates.push(base + start * MINUTE_MS, base + end * MINUTE_MS)
    }
  }
  candidates.sort((left, right) => left - right)
  for (const at of candidates) {
    if (at <= instantMs) continue
    if (isPeak(at) !== current) return at
  }
  return null
}

/**
 * UI 需要的「此刻」状态。
 * @param {number} instantMs - epoch 毫秒。
 */
export function statusAt(instantMs) {
  const parts = beijingParts(instantMs)
  const next = nextSwitchAt(instantMs)
  return {
    period: isPeak(instantMs) ? 'peak' : 'off-peak',
    nextSwitchAt: next,
    msUntilSwitch: next === null ? null : Math.max(0, next - instantMs),
    dateKey: parts.dateKey,
    holiday: HOLIDAYS[parts.dateKey],
    calendarCovered: CALENDAR_YEARS.includes(parts.year),
    year: parts.year,
    clock: `${pad2(parts.hour)}:${pad2(parts.minute)}`,
  }
}

/**
 * 人类可读的剩余时长。
 * @param {number|null} ms - 毫秒。
 * @returns {string}
 */
export function formatRemaining(ms) {
  if (ms === null) return '未知'
  const totalMinutes = Math.max(1, Math.ceil(ms / MINUTE_MS))
  if (totalMinutes < 60) return `${totalMinutes} 分钟`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours} 小时` : `${hours} 小时 ${minutes} 分`
}

function dayNumber(parts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS
}

/**
 * 切换时刻的短标签，例如「今天 18:00」「明天 09:00」「10月8日 周四 09:00」。
 * @param {number|null} targetMs - 切换时间点。
 * @param {number} nowMs - 当前时间点。
 * @returns {string}
 */
export function formatSwitchLabel(targetMs, nowMs) {
  if (targetMs === null) return '未知'
  const target = beijingParts(targetMs)
  const now = beijingParts(nowMs)
  const clock = `${pad2(target.hour)}:${pad2(target.minute)}`
  const diffDays = dayNumber(target) - dayNumber(now)
  if (diffDays === 0) return `今天 ${clock}`
  if (diffDays === 1) return `明天 ${clock}`
  if (diffDays === 2) return `后天 ${clock}`
  const dayLabel =
    target.year === now.year
      ? `${target.month}月${target.day}日`
      : `${target.year}年${target.month}月${target.day}日`
  return `${dayLabel} ${WEEKDAY_NAMES[target.weekday]} ${clock}`
}
