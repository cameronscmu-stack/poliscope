import { SeatDot } from '../SeatDot/SeatDot';

export function ChamberGrid({ members = [], loading = false, onSelectMember }) {
  if (loading && members.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="opacity-60">Loading congressional data...</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-bold mb-4 opacity-60">{members.length} members</p>
      <div className="flex flex-wrap gap-2 justify-center">
        {members.map(member => (
          <SeatDot
            key={member.id}
            member={member}
            onClick={onSelectMember}
          />
        ))}
      </div>
    </div>
  );
}
