// Gamification stats widget for Dashboard
import { Trophy, Zap, Flame } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Gamification } from '../../electron/preload';

export const GamificationWidget = () => {
  const [stats, setStats] = useState<Gamification | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      if (!window.electronAPI) return;
      const data = await window.electronAPI.getGamification();
      setStats(data);
    };
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return null;

  const xpForNextLevel = stats.level * 100;
  const xpProgress = ((stats.xp % 100) / 100) * 100;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-semibold">Level {stats.level}</span>
      </div>
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-blue-400" />
        <span className="text-sm">{stats.xp} XP</span>
        <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Flame className="w-4 h-4 text-orange-400" />
        <span className="text-sm">{stats.streak} day streak</span>
      </div>
    </div>
  );
};
