import { useEffect, useState } from 'react';
import { checkHealth } from '../api/client';
import type { HealthResponse } from '../api/types';

export function HealthIndicator() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await checkHealth();
        setHealth(data);
        setError(null);
      } catch {
        setError('API unavailable');
        setHealth(null);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-red-500"></span>
        <span className="text-red-600">{error}</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
        <span className="text-yellow-600">Checking...</span>
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`w-2 h-2 rounded-full ${health.status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`}></span>
      <span className={health.status === 'ok' ? 'text-green-600' : 'text-red-600'}>
        {health.status === 'ok' ? 'Online' : 'Error'}
      </span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-500">Uptime: {formatUptime(health.uptime)}</span>
    </div>
  );
}
