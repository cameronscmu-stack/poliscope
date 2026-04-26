const PARTY_COLOR = {
  D: '#1a4aaa',
  R: '#cc2222',
  I: '#8b6914',
};

const GRADE_GLOW = {
  A: '0 0 8px 2px rgba(26, 122, 74, 0.8)',
  B: '0 0 6px 2px rgba(42, 154, 90, 0.6)',
  C: '0 0 4px 2px rgba(204, 170, 34, 0.5)',
  D: '0 0 4px 2px rgba(204, 102, 34, 0.5)',
  F: '0 0 6px 2px rgba(204, 34, 34, 0.6)',
};

export function SeatDot({ member, onClick }) {
  const bgColor = PARTY_COLOR[member.party] ?? '#666';
  const glow = member.letter_grade ? GRADE_GLOW[member.letter_grade] : 'none';

  return (
    <button
      aria-label={`${member.first_name} ${member.last_name}, ${member.party}, ${member.state}`}
      onClick={() => onClick(member.id)}
      style={{ backgroundColor: bgColor, boxShadow: glow }}
      className="w-3 h-3 rounded-full transition-transform hover:scale-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400"
    />
  );
}
