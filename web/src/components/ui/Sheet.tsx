import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Bottom sheet on phone, centered dialog on laptop. Native dialog: traps focus, closes on Esc. */
export function Sheet({ open, onClose, title, children, full }: { open: boolean; onClose: () => void; title: string; children: ReactNode; full?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); document.documentElement.style.overflow = 'hidden'; }
    if (!open && d.open) d.close();
    return () => { document.documentElement.style.overflow = ''; };
  }, [open]);
  return (
    <dialog ref={ref} className={full ? 'sheet sheet-full' : 'sheet'} aria-labelledby={id} onClose={() => { document.documentElement.style.overflow = ''; onClose(); }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {open && (
        <div className="sheet-in">
          <div className="sheet-head"><h3 id={id}>{title}</h3><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={20} strokeWidth={1.5} /></button></div>
          {children}
        </div>
      )}
    </dialog>
  );
}
