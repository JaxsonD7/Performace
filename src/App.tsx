import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { GoalsPage } from '@/pages/GoalsPage';
import { HealthPage } from '@/pages/HealthPage';
import { HomePage } from '@/pages/HomePage';
import { MetricsPage } from '@/pages/MetricsPage';
import { ReadingPage } from '@/pages/ReadingPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { SchoolPage } from '@/pages/SchoolPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TodayPage } from '@/pages/TodayPage';
import { UpdateBanner } from '@/pwa/UpdateBanner';
import { RestTimerHost } from '@/components/lifting/RestTimer';
import { NotificationHost } from '@/components/notifications/NotificationHost';
import { ToastHost } from '@/components/ui/Toast';
import { useStore } from '@/store/store';

export function App() {
  const { state, ready } = useStore();
  const theme = state.settings.theme;

  // The theme preference is stamped on <html> so the CSS token blocks in
  // index.css can resolve it — "system" stamps nothing and lets the media
  // query decide.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-ink-muted">Loading your data…</p>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<TodayPage />} />
          <Route path="home" element={<HomePage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="school" element={<SchoolPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="reading" element={<ReadingPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <UpdateBanner />
      <RestTimerHost />
      <ToastHost />
      <NotificationHost />
    </>
  );
}
