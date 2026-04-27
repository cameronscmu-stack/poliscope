const GRADE_COLOR = { A: '#1a7a4a', B: '#2a9a5a', C: '#cc9900', D: '#cc6600', F: '#cc2222' };
const PARTY_LABEL = { D: 'Democrat', R: 'Republican', I: 'Independent' };

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
          style={{ width: `${score}%`, backgroundColor: score >= 70 ? '#1a7a4a' : score >= 50 ? '#cc9900' : '#cc2222' }}
        />
      </div>
    </div>
  );
}

function BillRow({ bill }) {
  const typeLabel = bill.type === 'S' ? 'S.' : bill.type === 'HR' ? 'H.R.' : bill.type ?? '';
  return (
    <div
      style={{
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 700,
          background: 'var(--navy)',
          color: '#fff',
          borderRadius: 4,
          padding: '2px 6px',
          marginTop: 2,
          letterSpacing: 0.5,
        }}
      >
        {typeLabel}{bill.number}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--navy)', lineHeight: 1.4, fontWeight: 500 }}>
          {bill.title}
        </div>
        <div style={{ fontSize: 11, opacity: 0.5, marginTop: 3, display: 'flex', gap: 10 }}>
          {bill.policyArea && <span>{bill.policyArea}</span>}
          {bill.introduced && <span>{new Date(bill.introduced).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
        </div>
        {bill.latestAction && (
          <div style={{ fontSize: 11, opacity: 0.4, marginTop: 2, fontStyle: 'italic' }}>
            {bill.latestAction}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlayerPage({ member, activity }) {
  if (!member) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="opacity-60">Loading member profile...</p>
      </div>
    );
  }

  const gradeColor  = GRADE_COLOR[member.letter_grade] ?? '#666';
  const chamberLabel = member.chamber === 'senate' ? 'Senator' : 'Representative';
  const terms       = activity?.terms ?? [];
  const office      = activity?.office ?? {};
  const bills       = activity?.bills ?? [];

  // Sort terms newest first
  const sortedTerms = [...terms].sort((a, b) => (b.startYear ?? 0) - (a.startYear ?? 0));
  const firstTerm   = sortedTerms[sortedTerms.length - 1];

  return (
    <div className="max-w-xl mx-auto px-4 py-8">

      {/* Identity header */}
      <div className="glass-card p-6 mb-4 flex gap-4 items-start">
        {member.photo_url && (
          <img
            src={member.photo_url}
            alt={`${member.first_name} ${member.last_name}`}
            className="w-20 h-24 object-cover rounded-xl flex-shrink-0"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 className="text-2xl font-bold">
            {member.first_name} {member.last_name}
          </h1>
          <p className="opacity-70 mt-1">
            {chamberLabel} · {member.state} · {PARTY_LABEL[member.party] ?? member.party}
          </p>
          {firstTerm && (
            <p style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
              In office since {firstTerm.startYear} · {sortedTerms.length} term{sortedTerms.length !== 1 ? 's' : ''}
            </p>
          )}
          {member.website && (
            <a
              href={member.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm mt-2 inline-block"
              style={{ color: 'var(--sky-accent)' }}
            >
              Official website ↗
            </a>
          )}
        </div>
      </div>

      {/* Contact info */}
      {(office.phone || office.address) && (
        <div className="glass-card p-5 mb-4">
          <h2 className="text-xs uppercase tracking-widest opacity-50 mb-3">Contact</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {office.address && (
              <div style={{ fontSize: 13, color: 'var(--navy)' }}>
                <span style={{ opacity: 0.5, marginRight: 6 }}>📍</span>
                {office.address}{office.city ? `, ${office.city}` : ''}{office.zip ? ` ${office.zip}` : ''}
              </div>
            )}
            {office.phone && (
              <div style={{ fontSize: 13, color: 'var(--navy)' }}>
                <span style={{ opacity: 0.5, marginRight: 6 }}>📞</span>
                <a href={`tel:${office.phone}`} style={{ color: 'var(--sky-accent)' }}>{office.phone}</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Constituent Grade */}
      <div className="glass-card p-6 mb-4">
        <h2 className="text-xs uppercase tracking-widest opacity-50 mb-4">Constituent Grade</h2>
        {!member.data_sufficient ? (
          <div>
            <p className="text-sm opacity-60 mb-3">
              {member.composite_score != null
                ? 'Partial grade — more data still loading'
                : 'Grade pending — vote data is being ingested'}
            </p>
            {member.composite_score != null && (
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="text-5xl font-bold w-16 h-16 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: gradeColor, opacity: 0.8 }}
                >
                  {member.letter_grade}
                </div>
                <div>
                  <div className="text-3xl font-bold" style={{ color: 'var(--navy)' }}>
                    {typeof member.composite_score === 'number' ? member.composite_score.toFixed(1) : member.composite_score}
                  </div>
                  <div className="text-xs opacity-40">partial score</div>
                </div>
              </div>
            )}
            {member.attendance_score != null && <DimensionBar label="Attendance (30%)" score={parseFloat(member.attendance_score).toFixed(1)} />}
            {member.party_independence_score != null && <DimensionBar label="Party Independence (25%)" score={parseFloat(member.party_independence_score).toFixed(1)} />}
            {member.legislative_score != null && <DimensionBar label="Legislative Effectiveness (20%)" score={parseFloat(member.legislative_score).toFixed(1)} />}
          </div>
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
                  {typeof member.composite_score === 'number' ? member.composite_score.toFixed(1) : member.composite_score}
                </div>
                <div className="text-xs opacity-50 mt-1">out of 100</div>
                {member.score_window_start && (
                  <div style={{ fontSize: 10, opacity: 0.4, marginTop: 4 }}>
                    {new Date(member.score_window_start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    {' – '}
                    {member.score_window_end ? new Date(member.score_window_end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'present'}
                  </div>
                )}
              </div>
            </div>
            <div className="text-xs uppercase tracking-widest opacity-50 mb-3">Score Breakdown</div>
            {member.attendance_score != null && <DimensionBar label="Attendance (30%)" score={parseFloat(member.attendance_score).toFixed(1)} />}
            {member.party_independence_score != null && <DimensionBar label="Party Independence (25%)" score={parseFloat(member.party_independence_score).toFixed(1)} />}
            {member.legislative_score != null && <DimensionBar label="Legislative Effectiveness (20%)" score={parseFloat(member.legislative_score).toFixed(1)} />}
            {member.campaign_finance_score != null && <DimensionBar label="Campaign Finance (15%)" score={parseFloat(member.campaign_finance_score).toFixed(1)} />}
            {member.bipartisan_score != null && <DimensionBar label="Bipartisan Engagement (10%)" score={parseFloat(member.bipartisan_score).toFixed(1)} />}
            {member.votes_cast != null && (
              <p style={{ fontSize: 11, opacity: 0.35, marginTop: 12 }}>
                Based on {member.votes_cast} of {member.total_votes_eligible} eligible votes
              </p>
            )}
            <details style={{ marginTop: 16 }}>
              <summary style={{ fontSize: 11, opacity: 0.5, cursor: 'pointer' }}>How this is calculated</summary>
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8, lineHeight: 1.6 }}>
                <p><strong>Attendance</strong> — % of roll call votes cast (vs. eligible)</p>
                <p><strong>Party Independence</strong> — % of votes against their own party's majority position (scaled: 20% crossover = 100 pts)</p>
                <p><strong>Legislative Effectiveness</strong> — bills advanced past committee + bipartisan cosponsor ratio</p>
                <p><strong>Campaign Finance</strong> — small-donor % vs. PAC dependency (FEC data)</p>
                <p><strong>Bipartisan Engagement</strong> — sponsored bills with at least one cross-party cosponsor</p>
              </div>
            </details>
          </>
        )}
      </div>

      {/* Sponsored Legislation */}
      {bills.length > 0 && (
        <div className="glass-card p-6 mb-4">
          <h2 className="text-xs uppercase tracking-widest opacity-50 mb-1">Recent Sponsored Legislation</h2>
          <p style={{ fontSize: 11, opacity: 0.4, marginBottom: 12 }}>Bills introduced by this member</p>
          <div>
            {bills.map((bill, i) => <BillRow key={i} bill={bill} />)}
          </div>
        </div>
      )}

      {/* Term history */}
      {sortedTerms.length > 0 && (
        <div className="glass-card p-6 mb-4">
          <h2 className="text-xs uppercase tracking-widest opacity-50 mb-4">Term History</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sortedTerms.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--navy)' }}>
                <span style={{ opacity: 0.7 }}>{t.chamber?.includes('Senate') ? 'Senate' : 'House'} · {t.congress ? `${t.congress}th Congress` : ''}</span>
                <span style={{ opacity: 0.5 }}>{t.startYear}{t.endYear ? `–${t.endYear}` : '–present'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state for activity */}
      {!activity && (
        <div className="glass-card p-5 mb-4">
          <p style={{ fontSize: 13, opacity: 0.4 }}>Loading legislation and contact info…</p>
        </div>
      )}
    </div>
  );
}
