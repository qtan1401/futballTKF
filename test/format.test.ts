import { describe, expect, it } from "vitest"
import { countdownText, formatKickoffVN, formatLockTimeVN, parseLocalDatetimeVN } from "../src/format"

describe("format (giờ Việt Nam +07)", () => {
  it("parseLocalDatetimeVN đổi giờ VN sang UTC", () => {
    expect(parseLocalDatetimeVN("2026-11-15T17:00")).toBe("2026-11-15T10:00:00.000Z")
    expect(parseLocalDatetimeVN("2026-11-15T05:30")).toBe("2026-11-14T22:30:00.000Z")
  })
  it("parseLocalDatetimeVN từ chối chuỗi sai", () => {
    expect(parseLocalDatetimeVN("")).toBeNull()
    expect(parseLocalDatetimeVN("abc")).toBeNull()
  })
  it("formatKickoffVN hiển thị giờ VN", () => {
    expect(formatKickoffVN("2026-11-15T10:00:00.000Z")).toBe("17:00 · 15/11")
  })
  it("formatLockTimeVN = kickoff − 60 phút", () => {
    expect(formatLockTimeVN("2026-11-15T10:00:00.000Z")).toBe("16:00")
  })
  it("countdownText", () => {
    const k = "2026-11-15T10:00:00.000Z"
    const ms = Date.parse(k)
    expect(countdownText(k, ms - (2 * 3600 + 5 * 60) * 1000)).toBe("còn 2g 05p")
    expect(countdownText(k, ms - 90 * 1000)).toBe("còn 1p")
    expect(countdownText(k, ms - 3 * 86400_000 - 4 * 3600_000)).toBe("còn 3 ngày 4g")
    expect(countdownText(k, ms + 1000)).toBe("đã đến giờ")
  })
})
