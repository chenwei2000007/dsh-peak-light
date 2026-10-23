import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PEAK_WINDOWS,
  HOLIDAYS,
  beijingParts,
  formatRemaining,
  formatSwitchLabel,
  isPeak,
  nextSwitchAt,
  periodAt,
  statusAt,
} from '../src/policy.js'

/** 北京时间 → epoch 毫秒。 */
function bj(year, month, day, hour = 0, minute = 0) {
  return Date.UTC(year, month - 1, day, hour - 8, minute)
}

test('峰时窗口：工作日 09:00–12:00、14:00–18:00，边界左闭右开', () => {
  assert.deepEqual(PEAK_WINDOWS, [
    [540, 720],
    [840, 1080],
  ])
  assert.equal(isPeak(bj(2026, 10, 23, 8, 59)), false)
  assert.equal(isPeak(bj(2026, 10, 23, 9, 0)), true)
  assert.equal(isPeak(bj(2026, 10, 23, 11, 59)), true)
  assert.equal(isPeak(bj(2026, 10, 23, 12, 0)), false)
  assert.equal(isPeak(bj(2026, 10, 23, 13, 59)), false)
  assert.equal(isPeak(bj(2026, 10, 23, 14, 0)), true)
  assert.equal(isPeak(bj(2026, 10, 23, 17, 59)), true)
  assert.equal(isPeak(bj(2026, 10, 23, 18, 0)), false)
  assert.equal(isPeak(bj(2026, 10, 23, 23, 30)), false)
})

test('周末全天谷时', () => {
  assert.equal(isPeak(bj(2026, 10, 24, 10, 0)), false)
  assert.equal(isPeak(bj(2026, 10, 25, 15, 0)), false)
  assert.equal(periodAt(bj(2026, 10, 24, 10, 0)), 'off-peak')
})

test('法定节假日全天谷时，调休上班的周末仍为谷时', () => {
  assert.equal(isPeak(bj(2026, 10, 1, 10, 0)), false)
  assert.equal(isPeak(bj(2026, 9, 25, 10, 0)), false)
  assert.equal(HOLIDAYS['2026-10-01'], '国庆节')
  assert.equal(isPeak(bj(2026, 10, 8, 9, 30)), true)
})

test('下一次切换：午休、下班、跨周末、跨假期', () => {
  assert.equal(nextSwitchAt(bj(2026, 10, 23, 11, 0)), bj(2026, 10, 23, 12, 0))
  assert.equal(nextSwitchAt(bj(2026, 10, 23, 12, 30)), bj(2026, 10, 23, 14, 0))
  assert.equal(nextSwitchAt(bj(2026, 10, 23, 17, 0)), bj(2026, 10, 23, 18, 0))
  assert.equal(nextSwitchAt(bj(2026, 10, 23, 19, 0)), bj(2026, 10, 26, 9, 0))
  // 9/25 中秋、9/26–27 周末 → 下一次峰时是 9/28 周一 09:00
  assert.equal(nextSwitchAt(bj(2026, 9, 24, 19, 0)), bj(2026, 9, 28, 9, 0))
  // 10/1–7 国庆 → 下一次峰时是 10/8 周四 09:00
  assert.equal(nextSwitchAt(bj(2026, 9, 30, 19, 0)), bj(2026, 10, 8, 9, 0))
})

test('statusAt 给出时段、节假日与倒计时', () => {
  const peak = statusAt(bj(2026, 10, 23, 10, 0))
  assert.equal(peak.period, 'peak')
  assert.equal(peak.holiday, undefined)
  assert.equal(peak.msUntilSwitch, 2 * 3_600_000)
  assert.equal(peak.calendarCovered, true)
  assert.equal(peak.clock, '10:00')

  const holiday = statusAt(bj(2026, 10, 6, 10, 0))
  assert.equal(holiday.period, 'off-peak')
  assert.equal(holiday.holiday, '国庆节')
})

test('北京时间字段换算', () => {
  const parts = beijingParts(bj(2026, 10, 23, 0, 5))
  assert.equal(parts.dateKey, '2026-10-23')
  assert.equal(parts.weekday, 5)
  assert.equal(parts.hour, 0)
  assert.equal(parts.minute, 5)
})

test('剩余时长文案', () => {
  assert.equal(formatRemaining(30_000), '1 分钟')
  assert.equal(formatRemaining(90_000), '2 分钟')
  assert.equal(formatRemaining(3_600_000), '1 小时')
  assert.equal(formatRemaining(5_400_000), '1 小时 30 分')
  assert.equal(formatRemaining(null), '未知')
})

test('切换时刻标签', () => {
  const now = bj(2026, 10, 23, 19, 0)
  assert.equal(formatSwitchLabel(bj(2026, 10, 23, 20, 0), now), '今天 20:00')
  assert.equal(formatSwitchLabel(bj(2026, 10, 24, 9, 0), now), '明天 09:00')
  assert.equal(formatSwitchLabel(bj(2026, 10, 25, 9, 0), now), '后天 09:00')
  assert.equal(formatSwitchLabel(bj(2026, 11, 2, 9, 0), now), '11月2日 周一 09:00')
  assert.equal(formatSwitchLabel(bj(2027, 1, 4, 9, 0), bj(2026, 12, 31, 19, 0)), '2027年1月4日 周一 09:00')
})
