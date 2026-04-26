export function calculateAttendanceScore(missedVotesPct) {
  return Math.round(Math.max(0, Math.min(100, 100 - missedVotesPct)));
}

export function calculatePartyIndependenceScore(votesWithPartyPct) {
  return Math.round(Math.max(0, Math.min(100, 100 - votesWithPartyPct)));
}

export function calculateCompositeScore(attendanceScore, partyIndependenceScore) {
  return Math.round((attendanceScore + partyIndependenceScore) / 2);
}

export function letterGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
