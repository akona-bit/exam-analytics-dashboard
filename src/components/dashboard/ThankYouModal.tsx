import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X, Check, MailOpen } from 'lucide-react';

interface Props {
  show: boolean;
  studentName?: string;
  onClose: () => void;
}

export function ThankYouModal({ show, studentName, onClose }: Props) {
  useEffect(() => {
    if (show) {
      // Fire confetti celebratory particles
      try {
        const count = 40;
        confetti({
          particleCount: count,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4f46e5', '#38bdf8', '#fbbf24', '#f43f5e', '#a855f7'],
        });
      } catch {
        // Fallback gracefully if canvas-confetti fails
      }
    }
  }, [show]);

  // Khoá cuộn nền + đóng bằng Escape khi thư đang mở.
  useEffect(() => {
    if (!show) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [show, onClose]);

  const displayName = (studentName || '').trim();
  const greetingName = displayName && !/^\d+$/.test(displayName) ? displayName : 'Bạn';

  /**
   * Render qua portal ra thẳng body: dashboard được bọc bởi `.fade-in`
   * (animation giữ lại transform), nếu để modal trong cây đó thì `fixed inset-0`
   * sẽ neo vào dashboard thay vì viewport → thư bị lệch/trôi xuống dưới.
   */
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md fade-in">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 220 } }}
              exit={{ scale: 0.92, opacity: 0, y: 15, transition: { duration: 0.2 } }}
              className="relative w-full max-w-lg bg-gradient-to-b from-white via-white to-amber-50/50 rounded-3xl shadow-2xl border border-amber-200/80 overflow-hidden flex flex-col"
            >
            {/* Top decorative gradient bar */}
            <div className="h-2.5 w-full bg-gradient-to-r from-indigo-500 via-amber-400 to-rose-500" />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer z-10"
              aria-label="Đóng thư cảm ơn"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-8 flex flex-col items-center text-center">
              {/* Envelope / Seal Icon with floating glow */}
              <div className="relative mb-4">
                <div className="w-18 h-18 rounded-3xl bg-gradient-to-tr from-amber-100 to-amber-50 border border-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/10">
                  <MailOpen className="w-9 h-9 text-amber-600" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md">
                  <Heart className="w-4 h-4 fill-white" />
                </span>
              </div>

              {/* Title */}
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-4">
                Thư Cảm Ơn Thí Sinh
              </h2>

              {/* Letter Content */}
              <div className="text-left bg-white/80 p-5 sm:p-6 rounded-2xl border border-slate-200/80 text-sm leading-relaxed text-slate-700 flex flex-col gap-3 shadow-inner">
                <p className="font-bold text-slate-900 text-base">
                  Thân gửi <span className="text-indigo-600">{greetingName}</span>,
                </p>
                <p className="font-normal text-slate-700">
                  Toàn thể đội ngũ <strong>Team MIT Hàn Thuyên</strong> xin gửi lời cảm ơn chân thành và nồng nhiệt nhất đến bạn vì đã dành thời gian và tâm huyết tham gia <strong>Kỳ thi thử Đánh giá năng lực (ĐGNL) Đợt 1</strong>.
                </p>
                <div className="pt-2 border-t border-slate-200 flex items-center justify-end">
                  <span className="font-black text-amber-700 text-sm">MIT Hàn Thuyên</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={onClose}
                className="mt-6 w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-sm sm:text-base shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Xem Kết Quả &amp; Phân Tích Của Tôi</span>
                <Check className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
