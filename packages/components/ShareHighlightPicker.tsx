'use client';

import { SHARE_STAT_IDS, SHARE_STAT_LABELS, type ShareStatId } from '@/lib/share-stats-config';

export function ShareHighlightPicker({
  selected,
  onToggle,
}: {
  selected: readonly ShareStatId[];
  onToggle: (id: ShareStatId) => void;
}) {
  return (
    <div className="share-highlight-grid" role="group" aria-label="Stats to include">
      {SHARE_STAT_IDS.map((id) => (
        <label key={id} className="share-highlight-item">
          <input
            type="checkbox"
            checked={selected.includes(id)}
            onChange={() => onToggle(id)}
          />
          <span>{SHARE_STAT_LABELS[id]}</span>
        </label>
      ))}
    </div>
  );
}
