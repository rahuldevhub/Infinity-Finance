import { useEffect } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

/**
 * Mobile slide-up sheet — the app-native replacement for centered modals.
 * Drag down or tap the backdrop to dismiss.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const dragControls = useDragControls();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="bottom-sheet"
          className="fixed inset-0 z-[90] flex items-end justify-center overflow-hidden pt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={title || 'Dialog'}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative flex max-h-[calc(100dvh-0.75rem)] min-h-0 w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-md"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110) onClose(); }}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <span className="w-10 h-1.5 rounded-full bg-gray-200" />
            </div>
            {title && <h3 className="shrink-0 px-5 pt-1 pb-3 text-base font-bold text-gray-900">{title}</h3>}
            <div
              className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-4 pb-5"
              style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))', WebkitOverflowScrolling: 'touch' }}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
