import React, { useCallback, useMemo, useState } from 'react';

import { useSlidingOverlayPresence } from '../hooks/useSlidingOverlayPresence';

export interface ThinkingHistoryItem {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export const ThinkingHistory: React.FC<{ items: ThinkingHistoryItem[] }> = ({ items }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const wantsOpen = selectedId != null && !isClosing;
  const onDrawerExitComplete = useCallback(() => {
    setSelectedId(null);
    setIsClosing(false);
  }, []);
  const { entered, onPanelTransitionEnd, panelStyle } = useSlidingOverlayPresence(
    wantsOpen,
    onDrawerExitComplete,
  );

  const startClose = useCallback(() => setIsClosing(true), []);

  return (
    <>
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-6 w-1 bg-cyber-blue shadow-neon-blue" />
          <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-white">Thinking History</h2>
        </div>
        <div className="p-4 rounded shadow cyber-card">
          {items.length === 0 ? (
            <p className="text-sm text-white/50">No context history files found.</p>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setIsClosing(false);
                    setSelectedId(item.id);
                  }}
                  className="w-full text-left p-3 rounded border border-white/10 bg-black/20 hover:border-cyber-blue/60 transition-colors"
                >
                  <div className="text-sm text-cyber-blue font-semibold truncate">{item.title}</div>
                  <div className="text-[11px] text-white/40 mt-1 font-mono">
                    {new Date(item.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {selectedItem && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button
            type="button"
            className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ease-out ${
              entered ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={startClose}
            tabIndex={entered ? 0 : -1}
            aria-label="Close thinking history drawer"
          />
          <aside
            style={panelStyle}
            onTransitionEnd={onPanelTransitionEnd}
            className={`pointer-events-auto relative w-full max-w-2xl h-full will-change-transform bg-[#080b14] border-l border-cyber-blue/30 shadow-[0_0_40px_rgba(0,242,255,0.15)] p-6 overflow-y-auto transition-transform duration-300 ease-out ${
              entered ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-white">{selectedItem.title}</h3>
                <p className="text-xs text-white/40 mt-1">
                  {new Date(selectedItem.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={startClose}
                className="text-white/60 hover:text-white text-sm border border-white/20 rounded px-3 py-1"
              >
                Close
              </button>
            </div>
            <pre className="text-sm text-white/80 whitespace-pre-wrap wrap-break-word leading-relaxed font-mono">
              {selectedItem.content}
            </pre>
          </aside>
        </div>
      )}
    </>
  );
};
