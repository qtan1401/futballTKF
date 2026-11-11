import { describe, expect, it } from "vitest"
import { computeStats, type StatMatch } from "../src/stats"

function m(day: number, result: "win" | "loss"): StatMatch {
  return { result, kickoff_at: `2026-10-${String(day).padStart(2, "0")}T10:00:00.000Z` }
}

describe("computeStats", () => {
  it("tổng, thắng, thua, tỷ lệ và chuỗi hiện tại đúng", () => {
    const list = [
      m(1, "loss"), m(2, "win"), m(3, "loss"), m(4, "win"), m(5, "win"),
      m(6, "loss"), m(7, "win"), m(8, "win"), m(9, "win"), m(10, "loss"),
    ]
    // 10 trận: 6 thắng 4 thua, nhưng trận mới nhất là thua → chuỗi thua 1
    const s = computeStats(list)
    expect(s.total).toBe(10)
    expect(s.wins).toBe(6)
    expect(s.losses).toBe(4)
    expect(s.winRate).toBeCloseTo(0.6)
    expect(s.currentStreak).toEqual({ type: "loss", count: 1 })
  })

  it("2 trận mới nhất là thắng → chuỗi thắng 2", () => {
    const s = computeStats([m(1, "loss"), m(2, "win"), m(3, "loss"), m(4, "win"), m(5, "win")])
    expect(s.currentStreak).toEqual({ type: "win", count: 2 })
  })

  it("chuỗi hiện tại dừng khi đổi loại kết quả", () => {
    const s = computeStats([m(1, "win"), m(2, "loss"), m(3, "win")])
    expect(s.currentStreak).toEqual({ type: "win", count: 1 })
  })

  it("danh sách rỗng → total 0, winRate 0, currentStreak null", () => {
    expect(computeStats([])).toEqual({ total: 0, wins: 0, losses: 0, winRate: 0, currentStreak: null })
  })

  it("kết quả không phụ thuộc thứ tự input (dựa vào kickoff_at)", () => {
    const list = [m(1, "loss"), m(2, "win"), m(3, "loss"), m(4, "win"), m(5, "win")]
    const reversed = [...list].reverse()
    const shuffled = [list[3], list[0], list[4], list[2], list[1]]
    expect(computeStats(reversed)).toEqual(computeStats(list))
    expect(computeStats(shuffled)).toEqual(computeStats(list))
  })
})
