import { describe, expect, it } from "vitest"
import {
  canAddSignup,
  canEditMatchInfo,
  canEditResult,
  canEnterResult,
  canHideMatch,
  canRemoveSignup,
  phase,
} from "../src/rules"

const kickoff = "2026-11-15T10:00:00.000Z"
const kickoffMs = Date.parse(kickoff)
const lockMs = kickoffMs - 60 * 60 * 1000
const open = { kickoff_at: kickoff, result: null }
const won = { kickoff_at: kickoff, result: "win" as const }
const farFuture = Date.parse("2027-01-01T00:00:00.000Z")

describe("rules: khoá T-60′ và quyền", () => {
  it("đúng biên T-60′: 1ms trước khoá bỏ tên được; đúng giờ khoá thì không", () => {
    expect(canRemoveSignup(open, lockMs - 1)).toBe(true)
    expect(canRemoveSignup(open, lockMs)).toBe(false)
  })

  it("phase: OPEN trước khoá, LATE từ khoá tới khi có kết quả, LOCKED khi đã có kết quả", () => {
    expect(phase(open, lockMs - 1)).toBe("OPEN")
    expect(phase(open, lockMs)).toBe("LATE")
    expect(phase(open, kickoffMs + 1)).toBe("LATE")
    expect(phase(won, farFuture)).toBe("LOCKED")
  })

  it("trước khoá: thêm được và không muộn", () => {
    expect(canAddSignup(open, lockMs - 1)).toEqual({ allowed: true, late: false })
  })

  it("từ khoá tới kickoff: thêm được nhưng muộn", () => {
    expect(canAddSignup(open, lockMs)).toEqual({ allowed: true, late: true })
    expect(canAddSignup(open, kickoffMs - 1)).toEqual({ allowed: true, late: true })
  })

  it("sau kickoff nhưng chưa có kết quả: vẫn thêm muộn", () => {
    expect(canAddSignup(open, kickoffMs + 3_600_000)).toEqual({ allowed: true, late: true })
  })

  it("đã có kết quả: khoá hẳn, không thêm không bỏ", () => {
    expect(canAddSignup(won, farFuture)).toEqual({ allowed: false, late: false })
    expect(canRemoveSignup(won, farFuture)).toBe(false)
  })

  it("đã có kết quả: kết quả vẫn sửa được, trận không ẩn được", () => {
    expect(canEditResult(won, farFuture)).toBe(true)
    expect(canHideMatch(won, farFuture)).toBe(false)
  })

  it("nhập kết quả chỉ từ giờ bóng lăn; trận đã qua chưa ai nhập vẫn back-fill được", () => {
    expect(canEnterResult(open, kickoffMs - 1)).toBe(false)
    expect(canEnterResult(open, kickoffMs)).toBe(true)
    expect(canEnterResult(open, farFuture)).toBe(true)
  })

  it("sửa thông tin trận chỉ trước giờ khoá", () => {
    expect(canEditMatchInfo(open, lockMs - 1)).toBe(true)
    expect(canEditMatchInfo(open, lockMs)).toBe(false)
  })

  it("chỉ ẩn được trận chưa có kết quả", () => {
    expect(canHideMatch(open, lockMs - 1)).toBe(true)
  })

  it("kết quả chỉ phụ thuộc nowMs truyền vào, không đọc đồng hồ hệ thống", () => {
    expect(canRemoveSignup(open, 0)).toBe(true)
    expect(canRemoveSignup(open, farFuture)).toBe(false)
  })
})
