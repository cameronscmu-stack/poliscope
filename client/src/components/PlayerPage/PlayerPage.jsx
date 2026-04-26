const GRADE_COLOR = {
  A: '#1a7a4a',
  B: '#2a9a5a',
  C: '#cc9900',
  D: '#cc6600',
  F: '#cc2222',
};

function DimensionBar({ label, score }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-bold">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${score}%`,
            backgroundColor: score >= 70 ? '#1a7a4a' : score >= 50 ? '#cc9900' : '#cc2222',
          }}
        />
      </div>
    </div>
  );
}

export function PlayerPage({ member }) {
  if (!member) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="opacity-60">Loading member profile...</p>
      </div>
    );
  }

  const gradeColor = GRADE_COLOR[member.letter_grade] ?? '#666';
  const chamberLabel = member.chamber === 'senate' ? 'Senator' : 'Representative';

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      {/* Identity header */}
      <div className="glass-card p-6 mb-4 flex gap-4 items-start">
        {member.photo_url && (
          <img
            src={member.photo_url}
            alt={`${member.first_name} ${member.last_name}`}
            className="w-20 h-24 object-cover rounded-xl flex-shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <div>
          <h1 className="text-2xl font-bold">
            {member.first_name} {member.last_name}
          </h1>
          <p className="opacity-70 mt-1">
            {chamberLabel} · {member.state} · {member.party === 'D' ? 'Democrat' : member.party === 'R' ? 'Republican' : 'Independent'}
          </p>
          {member.website && (
            <a
              href={member.website}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Official website"
              className="text-sm mt-2 inline-block"
              style={{ color: 'var(--sky-accent)' }}
            >
              Official website ↗
            </a>
          )}
        </div>
      </div>

      {/* Constituent Grade */}
      <div className="glass-card p-6 mb-4">
        <h2 className="text-xs uppercase tracking-widest opacity-50 mb-4">Constituent Grade</h2>

        {!member.data_sufficient ? (
          <p className="text-sm opacity-60">Grade pending — insufficient data (90-day minimum)</p>
        ) : (
          <>
            <div className="flex items-center gap-6 mb-6">
              <div
                className="text-6xl font-bold w-20 h-20 rounded-2xl flex items-center justify-center text-white"
                style={{ backgroundColor: gradeColor }}
              >
                {member.letter_grade}
              </div>
              <div>
                <div className="text-5xl font-bold" style={{ color: 'var(--navy)' }}>
                  {member.composite_score}
                </div>
                <div className="text-xs opacity-50 mt-1">out of 100</div>
              </div>
            </div>

            <div className="text-xs uppercase tracking-widest opacity-50 mb-3">Score Breakdown</div>
            {member.attendance_score != null && (
              <DimensionBar label="Attendance" score={member.attendance_score} />
            )}
            {member.party_independence_score != null && (
              <DimensionBar label="Party Independence" score={member.party_independence_score} />
            )}

            <p className="text-xs opacity-40 mt-4">
              Phase 1 score: 2 of 5 dimensions.
              {member.grade_calculated_at && (
                <> Last calculated {new Date(member.grade_calculated_at).toLocaleDateString()}.</>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
