import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// SVG canvas dimensions
const W = 1400;
const H = 720;
const CX = W / 2;   // horizontal center
const CY = H + 15;  // dais center just below the viewport bottom

// Hemicycle rows: innermost → outermost
const ROW_CONFIG = [
  { radius: 195, count: 14 },
  { radius: 278, count: 18 },
  { radius: 361, count: 22 },
  { radius: 444, count: 24 },
  { radius: 527, count: 22 },
]; // 14+18+22+24+22 = 100 seats

// Arc sweep: leave a small gap at both ends so edge seats aren't cut off
const ANGLE_START = Math.PI * 0.055;
const ANGLE_END   = Math.PI * 0.945;

const SEAT_R  = 17;   // senator photo circle radius
const RING_W  = 3;    // party ring thickness

const PARTY_COLOR  = { D: '#1a4aaa', R: '#cc0000', I: '#666666' };
const PARTY_LABEL  = { D: 'Democrat',  R: 'Republican', I: 'Independent' };
const PARTY_ORDER  = { D: 0, I: 1, R: 2 };

// Compute (x, y) for each seat in a row, left → right
function rowSeats(radius, count) {
  return Array.from({ length: count }, (_, i) => {
    const t     = count === 1 ? 0.5 : i / (count - 1);
    const angle = ANGLE_START + t * (ANGLE_END - ANGLE_START);
    return {
      x: CX - radius * Math.cos(angle),
      y: CY - radius * Math.sin(angle),
    };
  });
}

// Generate a smooth arc path string for background decoration
function arcPath(radius, steps = 64) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t     = i / steps;
    const angle = ANGLE_START + t * (ANGLE_END - ANGLE_START);
    const x = CX - radius * Math.cos(angle);
    const y = CY - radius * Math.sin(angle);
    return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
  }).join(' ');
}

// All 100 seat positions, left → right across all rows (inner → outer)
const ALL_SEATS = ROW_CONFIG.flatMap(({ radius, count }) => rowSeats(radius, count));

export default function ChamberView({ members = [], filtered = [] }) {
  const [hovered, setHovered] = useState(null);
  const navigate = useNavigate();

  const filteredSet  = useMemo(() => new Set(filtered.map(m => m.id)), [filtered]);
  const isFiltering  = filtered.length < members.length;

  // Sort senators: Democrats fill left seats, Republicans fill right, Independents in middle
  const seated = useMemo(() => {
    const sorted = [...members].sort(
      (a, b) => (PARTY_ORDER[a.party] ?? 1) - (PARTY_ORDER[b.party] ?? 1)
    );
    return ALL_SEATS.map((seat, i) => ({ ...seat, member: sorted[i] ?? null }));
  }, [members]);

  return (
    <div style={{ position: 'relative', width: '100%', background: '#0c1828' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block' }}
        aria-label="Senate chamber — hover a seat to see senator details"
      >
        <defs>
          {/* Radial background gradient */}
          <radialGradient id="chamberBg" cx="50%" cy="100%" r="85%">
            <stop offset="0%"   stopColor="#1e3060" />
            <stop offset="100%" stopColor="#0c1828" />
          </radialGradient>

          {/* Per-senator circular clip paths */}
          {seated.map(({ member }) =>
            member ? (
              <clipPath key={member.id} id={`cp-${member.id}`}>
                <circle cx={0} cy={0} r={SEAT_R} />
              </clipPath>
            ) : null
          )}
        </defs>

        {/* Chamber floor */}
        <rect width={W} height={H} fill="url(#chamberBg)" />

        {/* Row lane tracks — thick stroked arcs form the desk rows */}
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

        {/* Center aisle divider */}
        <line
          x1={CX}
          y1={CY - ROW_CONFIG[0].radius + 20}
          x2={CX}
          y2={CY - ROW_CONFIG[ROW_CONFIG.length - 1].radius - 28}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1.5}
          strokeDasharray="8 6"
        />

        {/* Party side labels */}
        <text
          x={80} y={H - 28}
          fill="rgba(80,130,255,0.45)"
          fontSize={11} fontWeight={700} letterSpacing={2.5}
          fontFamily="var(--font-sans, sans-serif)"
        >
          DEMOCRATS
        </text>
        <text
          x={W - 80} y={H - 28}
          textAnchor="end"
          fill="rgba(220,80,80,0.45)"
          fontSize={11} fontWeight={700} letterSpacing={2.5}
          fontFamily="var(--font-sans, sans-serif)"
        >
          REPUBLICANS
        </text>

        {/* Dais indicator */}
        <ellipse
          cx={CX} cy={CY - 42}
          rx={64} ry={18}
          fill="rgba(255,255,255,0.04)"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
        />
        <text
          x={CX} y={CY - 37}
          textAnchor="middle"
          fill="rgba(255,255,255,0.22)"
          fontSize={9} letterSpacing={3}
          fontFamily="var(--font-sans, sans-serif)"
        >
          DAIS
        </text>

        {/* Senator seats */}
        {seated.map(({ x, y, member }) => {
          if (!member) return null;
          const active  = !isFiltering || filteredSet.has(member.id);
          const isHov   = hovered?.id === member.id;
          const color   = PARTY_COLOR[member.party] ?? '#666';

          return (
            <g
              key={member.id}
              transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)})`}
              style={{
                cursor: 'pointer',
                opacity: active ? 1 : 0.12,
                transition: 'opacity 0.25s ease',
              }}
              onMouseEnter={() => setHovered(member)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => navigate(`/rep/${member.id}`)}
              role="button"
              aria-label={`${member.first_name} ${member.last_name} (${member.state})`}
            >
              {/* Party ring */}
              <circle r={SEAT_R + RING_W} fill={color} />

              {/* Photo background fallback */}
              <circle r={SEAT_R} fill="#c8d8ec" />

              {/* Senator photo */}
              <image
                href={member.photo_url}
                x={-SEAT_R}
                y={-SEAT_R}
                width={SEAT_R * 2}
                height={SEAT_R * 2}
                clipPath={`url(#cp-${member.id})`}
                preserveAspectRatio="xMidYMid slice"
              />

              {/* Hover highlight ring */}
              {isHov && (
                <circle
                  r={SEAT_R + RING_W + 5}
                  fill="none"
                  stroke="white"
                  strokeWidth={2}
                  opacity={0.85}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Hover info card */}
      {hovered && (
        <SenatorCard member={hovered} />
      )}
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
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          objectFit: 'cover',
          border: `2.5px solid ${color}`,
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', lineHeight: 1.3 }}>
          {member.first_name} {member.last_name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--navy)', opacity: 0.55, marginTop: 2 }}>
          {PARTY_LABEL[member.party] ?? member.party} &middot; {member.state}
        </div>
      </div>
    </div>
  );
}
