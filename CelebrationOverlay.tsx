import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy } from 'lucide-react';

interface Props {
  show: boolean;
  rank: number;
  name: string;
  onComplete: () => void;
}

export function CelebrationOverlay({ show, rank, name, onComplete }: Props) {
  useEffect(() => {
    if (show) {
      const duration = 5000;
      const end = Date.now() + duration;
      const colors = ['#f59e0b', '#fbbf24', '#fcd34d', '#6366f1', '#10b981', '#f43f5e'];

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 270,
          spread: 60,
          origin: { x: Math.random(), y: -0.1 },
          colors: colors,
          startVelocity: 15,
          gravity: 0.8,
          ticks: 300,
          zIndex: 100,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      const timer = setTimeout(() => {
        onComplete();
      }, duration + 1000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm pointer-events-none p-4"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1, transition: { type: 'spring', damping: 25, stiffness: 200, delay: 0.1 } }}
            className="relative bg-white rounded-[2rem] shadow-2xl overflow-hidden max-w-lg w-full flex flex-col items-center text-center p-12 sm:p-16 border border-slate-100"
          >
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300" />
            
            {/* Background ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200%] h-64 bg-amber-500/5 blur-[80px] rounded-full pointer-events-none" />

            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1, transition: { type: 'spring', delay: 0.3, damping: 15 } }}
              className="w-24 h-24 bg-amber-50 rounded-2xl flex items-center justify-center mb-8 rotate-3 border border-amber-100 shadow-sm relative"
            >
              <Trophy className="w-12 h-12 text-amber-500 -rotate-3" strokeWidth={1.5} />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }}
            >
              <h2 className="text-amber-600/80 font-bold tracking-[0.25em] text-xs sm:text-sm uppercase mb-3">
                Vinh Danh Thành Tích
              </h2>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.5 } }}
            >
              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-6">
                {rank === 1 ? 'Thủ Khoa' : 'Á Khoa'}
              </h1>
            </motion.div>
            
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1, transition: { delay: 0.6, duration: 0.5 } }}
              className="w-16 h-1 bg-amber-200 rounded-full mb-8 origin-center"
            />
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.7 } }}
            >
              <p className="text-2xl sm:text-3xl font-medium text-slate-700">
                {name}
              </p>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
