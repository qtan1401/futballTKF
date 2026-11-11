export type StatMatch = { result: "win" | "loss"; kickoff_at: string }

export type Stats = {
  total: number
  wins: number
  losses: number
  winRate: number
  currentStreak: { type: "win" | "loss"; count: number } | null
}

export function computeStats(list: StatMatch[]): Stats {
  const total = list.length
  const wins = list.filter((m) => m.result === "win").length
  const losses = total - wins
  const winRate = total === 0 ? 0 : wins / total

  const newestFirst = [...list].sort((a, b) =>
    a.kickoff_at < b.kickoff_at ? 1 : a.kickoff_at > b.kickoff_at ? -1 : 0,
  )
  let currentStreak: Stats["currentStreak"] = null
  for (const m of newestFirst) {
    if (!currentStreak) currentStreak = { type: m.result, count: 1 }
    else if (currentStreak.type === m.result) currentStreak.count++
    else break
  }
  return { total, wins, losses, winRate, currentStreak }
}
