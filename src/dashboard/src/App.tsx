import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StatsOverview, StatsData } from './components/StatsOverview';
import { AgentStatus } from './components/AgentStatus';
import { AppLogs } from './components/AppLogs';
import { AgentLoopSteps } from './components/AgentLoopSteps';
import { ThinkingHistory, ThinkingHistoryItem } from './components/ThinkingHistory';
import { WebChatDrawer } from './components/WebChatDrawer';
import { QuickTasks } from './components/QuickTasks';
import { TelegramControls } from './components/TelegramControls';
import { Footer } from './components/Footer';
import { AuthScreen } from './components/AuthScreen';

export const App: React.FC = () => {
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [thinkingHistory, setThinkingHistory] = useState<ThinkingHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [webChatOpen, setWebChatOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setIsAuthenticated(data.authenticated);
      if (data.authenticated) {
        fetchInitialData();
      } else {
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  const fetchInitialData = () => {
    fetchStatusData();
    fetchThinkingHistory();
    const interval = setInterval(() => {
      fetchStatusData();
      fetchThinkingHistory();
    }, 30000);
    return () => clearInterval(interval);
  };

  const fetchStatusData = async () => {
    try {
      const response = await fetch('/api/status');
      if (response.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await response.json();
      setStatsData(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching status data:', error);
      setIsLoading(false);
    }
  };

  const fetchThinkingHistory = async () => {
    try {
      const response = await fetch('/api/thinking-history');
      if (response.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch thinking history');
      const data = (await response.json()) as { items?: ThinkingHistoryItem[] };
      setThinkingHistory(data.items ?? []);
    } catch (error) {
      console.error('Error fetching thinking history:', error);
      setThinkingHistory([]);
    }
  };

  if (isAuthenticated === null || (isLoading && isAuthenticated)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyber-blue text-2xl animate-pulse">LOADING...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={() => {
      setIsAuthenticated(true);
      fetchInitialData();
    }} />;
  }

  const loopMin = statsData?.agentLoopStepsBounds?.min ?? 20;
  const loopMax = statsData?.agentLoopStepsBounds?.max ?? 80;
  const loopSteps = statsData?.maxAgentLoopSteps ?? 40;

  return (
    <div className="overflow-x-hidden min-h-screen bg-black">
      <Header onOpenWebChat={() => setWebChatOpen(true)} />
      <WebChatDrawer open={webChatOpen} onClose={() => setWebChatOpen(false)} />
      <main className="container mx-auto px-6 py-10 relative z-10">
        {statsData && <StatsOverview data={statsData} />}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {statsData && <AgentStatus data={statsData.agent} />}
          <AppLogs />
          <ThinkingHistory items={thinkingHistory} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <TelegramControls />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <AgentLoopSteps
              maxAgentLoopSteps={loopSteps}
              min={loopMin}
              max={loopMax}
              onAfterSave={fetchStatusData}
            />
            <QuickTasks />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};
