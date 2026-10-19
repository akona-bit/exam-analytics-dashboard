import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Sparkles, X, Check, Award, MailOpen } from 'lucide-react';

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

  const displayName = (studentName || '').trim();
  const greetingName = displayName && !/^\d+$/.test(displayName) ? displayName : 'Bạn';

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md fade-in">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 220 } }}
            exit={{ scale: 0.92, opacity: 0, y: 15, transition: { duration: 0.2 } }}
            className="relative w-full max-w-lg bg-gradient-to-b from-white via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 rounded-3xl shadow-2xl border border-amber-200/80 dark:border-amber-500/20 overflow-hidden flex flex-col"
          >
            {/* Top decorative gradient bar */}
            <div className="h-2.5 w-full bg-gradient-to-r from-indigo-500 via-amber-400 to-rose-500" />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer z-10"
              aria-label="Đóng thư cảm ơn"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-8 flex flex-col items-center text-center">
              {/* Envelope / Seal Icon with floating glow */}
              <div className="relative mb-4">
                <div className="w-18 h-18 rounded-3xl bg-gradient-to-tr from-amber-100 to-amber-50 dark:from-amber-950/80 dark:to-amber-900/40 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center shadow-lg shadow-amber-500/10">
                  <MailOpen className="w-9 h-9 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md">
                  <Heart className="w-4 h-4 fill-white" />
                </span>
              </div>

              {/* Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-xs font-black uppercase tracking-wider mb-2 border border-amber-300/80 dark:border-amber-700/60">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Kỳ Thi Thử Đợt 1 · Team MIT Hàn Thuyên</span>
              </div>

              {/* Title */}
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
                Thư Cảm Ơn Thí Sinh
              </h2>

              {/* Letter Content */}
              <div className="text-left bg-white/80 dark:bg-slate-800/80 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-sm leading-relaxed text-slate-700 dark:text-slate-200 flex flex-col gap-3 shadow-inner">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  Thân gửi <span className="text-indigo-600 dark:text-indigo-400">{greetingName}</span>,
                </p>
                <p className="font-normal text-slate-700 dark:text-slate-200">
                  Toàn thể đội ngũ <strong>Team MIT Hàn Thuyên</strong> xin gửi lời cảm ơn chân thành và nồng nhiệt nhất đến bạn vì đã dành thời gian và tâm huyết tham gia <strong>Kỳ thi thử Đánh giá năng lực (ĐGNL) Đợt 1</strong>.
                </p>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Team Khảo thí &amp; Học thuật</span>
                  <span className="font-black text-amber-700 dark:text-amber-400 text-sm">MIT Hàn Thuyên</span>
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
      )}
    </AnimatePresence>
  );
}
