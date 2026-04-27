import { useState, useMemo } from 'react';
import { useFilter } from '../../context/FilterContext';

// SVG canvas dimensions
const W = 1400;
const H = 720;
const CX = W / 2;
const CY = -15; // dais center just above the viewport top

// Hemicycle rows: innermost → outermost
const ROW_CONFIG = [
  { radius: 195, count: 14 },
  { radius: 278, count: 18 },
  { radius: 361, count: 22 },
  { radius: 444, count: 24 },
  { radius: 527, count: 22 },
]; // 14+18+22+24+22 = 100 seats

const ANGLE_START = Math.PI * 0.055;
const ANGLE_END   = Math.PI * 0.945;

const SEAT_R = 17;
const RING_W = 3;

const PARTY_COLOR = { D: '#1a4aaa', R: '#cc0000', I: '#666666' };
const PARTY_LABEL = { D: 'Democrat', R: 'Republican', I: 'Independent' };
const PARTY_ORDER = { D: 0, I: 1, R: 2 };
const GRADE_COLOR = { A: '#1a7a4a', B: '#2a9a5a', C: '#cc9900', D: '#cc6600', F: '#cc2222' };

function rowSeats(radius, count) {
  return Array.from({ length: count }, (_, i) => {
    const t     = count === 1 ? 0.5 : i / (count - 1);
    const angle = ANGLE_START + t * (ANGLE_END - ANGLE_START);
    return {
      x: CX - radius * Math.cos(angle),
      y: CY + radius * Math.sin(angle),
    };
  });
}

function arcPath(radius, steps = 64) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t     = i / steps;
    const angle = ANGLE_START + t * (ANGLE_END - ANGLE_START);
    const x = CX - radius * Math.cos(angle);
    const y = CY + radius * Math.sin(angle);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');
}

const ALL_SEATS = ROW_CONFIG.flatMap(({ radius, count }) => rowSeats(radius, count));

// Draw a curved bracket arc connecting two points
function bracketPath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Control point pulled toward center of chamber (upward toward CY)
  const pull = 60;
  const cy = my - pull;
  return `M ${x1} ${y1} Q ${mx} ${cy} ${x2} ${y2}`;
}

export default function ChamberView({ members = [], filtered = [] }) {
  const [hovered, setHovered] = useState(null);
  const { highlightedIds, setSelectedMemberId } = useFilter();

  const filteredSet   = useMemo(() => new Set(filtered.map(m => m.id)), [filtered]);
  const isFiltering   = filtered.length < members.length;
  const hasHighlights = highlightedIds.size > 0;

  const seated = useMemo(() => {
    const sorted = [...members].sort(
      (a, b) => (PARTY_ORDER[a.party] ?? 1) - (PARTY_ORDER[b.party] ?? 1)
    );
    return ALL_SEATS.map((seat, i) => ({ ...seat, member: sorted[i] ?? null }));
  }, [members]);

  // Build a state → [{x, y, member}] map for drawing bracket lines
  const stateGroups = useMemo(() => {
    const groups = {};
    for (const seat of seated) {
      if (!seat.member) continue;
      const s = seat.member.state;
      if (!groups[s]) groups[s] = [];
      groups[s].push(seat);
    }
    return groups;
  }, [seated]);

  return (
    <div style={{ position: 'relative', width: '100%', background: '#0c1828' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block' }}
        aria-label="Senate chamber — hover a seat to see senator details"
      >
        <defs>
          <radialGradient id="chamberBg" cx="50%" cy="100%" r="85%">
            <stop offset="0%"   stopColor="#1e3060" />
            <stop offset="100%" stopColor="#0c1828" />
          </radialGradient>
          {seated.map(({ x, y, member }) =>
            member ? (
              <clipPath key={member.id} id={`cp-${member.id}`} clipPathUnits="userSpaceOnUse">
                <circle cx={x} cy={y} r={SEAT_R} />
              </clipPath>
            ) : null
          )}
        </defs>

        <rect width={W} height={H} fill="url(#chamberBg)" />

        {/* Row lane tracks */}
        {ROW_CONFIG.map(({ radius }) => (
          <path
            key={radius}
            d={arcPath(radius)}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={(SEAT_R + RING_W) * 2 + 10}
            strokeLinecap="butt"
          />
        ))}

        {/* Center aisle */}
        <line
          x1={CX} y1={CY + ROW_CONFIG[0].radius - 20}
          x2={CX} y2={CY + ROW_CONFIG[ROW_CONFIG.length - 1].radius + 28}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1.5}
          strokeDasharray="8 6"
        />

        {/* Party labels */}
        <text x={80} y={H - 28} fill="rgba(80,130,255,0.45)" fontSize={11} fontWeight={700} letterSpacing={2.5} fontFamily="var(--font-sans, sans-serif)">DEMOCRATS</text>
        <text x={W - 80} y={H - 28} textAnchor="end" fill="rgba(220,80,80,0.45)" fontSize={11} fontWeight={700} letterSpacing={2.5} fontFamily="var(--font-sans, sans-serif)">REPUBLICANS</text>

        {/* Dais */}
        <ellipse cx={CX} cy={CY + 42} rx={64} ry={18} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" strokeWidth={1} />
        <text x={CX} y={CY + 47} textAnchor="middle" fill="rgba(255,255,255,0.22)" fontSize={9} letterSpacing={3} fontFamily="var(--font-sans, sans-serif)">DAIS</text>

        {/* State bracket arcs — shown when a state is highlighted */}
        {isFiltering && Object.entries(stateGroups).map(([state, seats]) => {
          if (seats.length < 2) return null;
          const allActive = seats.every(s => filteredSet.has(s.member.id));
          if (!allActive) return null;
          const [a, b] = seats;
          const midX = (a.x + b.x) / 2;
          const midY = Math.min(a.y, b.y) - 28;
          return (
            <g key={state}>
              <path
                d={bracketPath(a.x, a.y - SEAT_R - RING_W - 2, b.x, b.y - SEAT_R - RING_W - 2)}
                fill="none"
                stroke="rgba(255,255,255,0.35)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text
                x={midX}
                y={midY}
                textAnchor="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize={10}
                fontWeight={700}
                letterSpacing={1}
                fontFamily="var(--font-sans, sans-serif)"
              >
                {state}
              </text>
            </g>
          );
        })}

        {/* Senator seats */}
        {seated.map(({ x, y, member }, seatIndex) => {
          if (!member) return null;
          const active      = !isFiltering || filteredSet.has(member.id);
          const highlighted = hasHighlights && highlightedIds.has(member.id);
          const isHov       = hovered?.id === member.id;
          const color       = PARTY_COLOR[member.party] ?? '#666';
          const gradeColor  = GRADE_COLOR[member.letter_grade];

          return (
            <g
              key={member.id}
              style={{ cursor: 'pointer', opacity: active ? 1 : 0.12, transition: 'opacity 0.3s ease' }}
              onMouseEnter={() => setHovered(member)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setSelectedMemberId(member.id)}
              role="button"
              aria-label={`${member.first_name} ${member.last_name} (${member.state})`}
            >
              {highlighted && (
                <circle cx={x} cy={y} r={SEAT_R + RING_W + 8} fill="rgba(255,220,60,0.18)" stroke="rgba(255,220,60,0.7)" strokeWidth={2} />
              )}
              <circle cx={x} cy={y} r={SEAT_R + RING_W} fill={color} />
              <circle cx={x} cy={y} r={SEAT_R} fill="#c8d8ec" />
              <image
                href={member.photo_url}
                x={x - SEAT_R}
                y={y - SEAT_R}
                width={SEAT_R * 2}
                height={SEAT_R * 2}
                clipPath={`url(#cp-${member.id})`}
                preserveAspectRatio="xMidYMid slice"
              />
              {gradeColor && (
                <circle cx={x + SEAT_R * 0.62} cy={y + SEAT_R * 0.62} r={5} fill={gradeColor} stroke="rgba(0,0,0,0.4)" strokeWidth={0.75} />
              )}
              {isHov && (
                <circle cx={x} cy={y} r={SEAT_R + RING_W + 5} fill="none" stroke="white" strokeWidth={2} opacity={0.85} />
              )}
            </g>
          );
        })}
      </svg>

      {hovered && <SenatorCard member={hovered} />}

      {/* Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '8px 16px',
        background: 'rgba(0,0,0,0.35)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {[['D','#1a4aaa','Dem'], ['R','#cc0000','Rep'], ['I','#666666','Ind']].map(([key, color, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width={12} height={12}><circle cx={6} cy={6} r={6} fill={color} /></svg>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em' }}>{label}</span>
            </span>
          ))}
        </div>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.12)' }} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em', marginRight: 4 }}>Grade dot:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Object.entries(GRADE_COLOR).map(([grade, color]) => (
            <span key={grade} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width={10} height={10}><circle cx={5} cy={5} r={5} fill={color} /></svg>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>{grade}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SenatorCard({ member }) {
  const color = PARTY_COLOR[member.party] ?? '#666';
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        pointerEvents: 'none',
        zIndex: 20,
        minWidth: 220,
        whiteSpace: 'nowrap',
      }}
    >
      <img
        src={member.photo_url}
        alt=""
        style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: `2.5px solid ${color}`, flexShrink: 0 }}
      />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', lineHeight: 1.3 }}>
          {member.first_name} {member.last_name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--navy)', opacity: 0.55, marginTop: 2 }}>
          {PARTY_LABEL[member.party] ?? member.party} · {member.state}
        </div>
        {member.letter_grade && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 11,
              fontWeight: 800,
              color: '#fff',
              background: GRADE_COLOR[member.letter_grade],
              borderRadius: 4,
              padding: '1px 6px',
              fontFamily: "'Bricolage Grotesque', sans-serif",
            }}>
              {member.letter_grade}
            </span>
            {member.composite_score != null && (
              <span style={{ fontSize: 11, opacity: 0.5, color: 'var(--navy)' }}>
                {parseFloat(member.composite_score).toFixed(1)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
