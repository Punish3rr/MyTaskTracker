// Gamification stats widget with animated XP bar
import { Trophy, Zap, Flame } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Gamification } from '../../electron/preload';
import { useDataUpdated } from '../hooks/useDataUpdated';

export const GamificationWidget = () => {
  const [stats, setStats] = useState<Gamification | null>(null);

  const loadStats = useCallback(async () => {
    if (!window.electronAPI) return;
    const data = await window.electronAPI.getGamification();
    setStats(data);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Listen for data-updated events to refresh stats
  useDataUpdated(loadStats);

  if (!stats) return null;

  const xpProgress = ((stats.xp % 100) / 100) * 100;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-800/60 backdrop-blur-xl border border-gray-700/50 rounded-lg shadow-lg">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
        <span className="text-sm font-semibold font-mono">Level {stats.level}</span>
      </div>
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
        <span className="text-sm font-mono">{stats.xp} XP</span>
        <div className="w-20 h-1.5 bg-gray-700/50 rounded-full overflow-hidden relative">
          <motion.div 
            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 relative"
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <motion.div
              className="absolute inset-0 bg-white/30"
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                repeat: Infinity,
                duration: 2,
                ease: 'linear',
              }}
            />
          </motion.div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
        <span className="text-sm font-mono">{stats.streak} day streak</span>
      </div>
    </div>
  );
};
