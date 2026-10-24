import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ThemeToggle from './components/ThemeToggle';
import DigitalClock from './components/DigitalClock';
import AnalogClock from './components/AnalogClock';
import WorldClock from './components/WorldClock';
import Alarm from './components/Alarm';
import Stopwatch from './components/Stopwatch';
import Timer from './components/Timer';
import { 
  LayoutDashboard, 
  Globe, 
  Bell, 
  Timer as StopwatchIcon,
  Hourglass,
  Settings, 
  Sparkles, 
  Menu, 
  X, 
  Calendar,
  ShieldCheck,
  Palette
} from 'lucide-react';
import './App.css';

function App() {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const [currentTheme, setCurrentTheme] = useState(() => {
    const savedTheme = localStorage.getItem('world_clock_theme');
    if (savedTheme) return savedTheme;
    return 'dark';
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);

  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('world_clock_favorites');
      return saved ? JSON.parse(saved) : ['in-kolkata', 'us-nyc', 'gb-lon'];
    } catch {
      return ['in-kolkata', 'us-nyc', 'gb-lon'];
    }
  });

  const [alarms, setAlarms] = useState(() => {
    try {
      const saved = localStorage.getItem('world_clock_alarms');
      return saved ? JSON.parse(saved) : [
        { id: '1', hour: '08', minute: '30', ampm: 'AM', label: 'Morning Standup', enabled: true },
        { id: '2', hour: '05', minute: '00', ampm: 'PM', label: 'Global Sync', enabled: false }
      ];
    } catch {
      return [];
    }
  });

  const [ringingAlarm, setRingingAlarm] = useState(null);
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('world_clock_theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    localStorage.setItem('world_clock_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('world_clock_alarms', JSON.stringify(alarms));
  }, [alarms]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Unlock Audio Context on first user click or keypress
  useEffect(() => {
    const unlockAudio = () => {
      getAudioContext();
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [getAudioContext]);

  // Audible Alarm Generator
  const playAlarmSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const frequencies = [880, 1174.66, 1760, 2349.32];

      frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.15);

        gain.gain.setValueAtTime(0.75, now + idx * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.15 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.15);
        osc.stop(now + idx * 0.15 + 0.35);
      });
    } catch (e) {
      console.warn("Alarm sound error:", e);
    }
  }, [getAudioContext]);

  // Repeat alarm chime while ringing
  useEffect(() => {
    if (!ringingAlarm) return;

    playAlarmSound();
    const interval = setInterval(() => {
      playAlarmSound();
    }, 1100);

    return () => clearInterval(interval);
  }, [ringingAlarm, playAlarmSound]);

  const checkAlarms = useCallback((now) => {
    let currentH = now.getHours();
    const currentM = String(now.getMinutes()).padStart(2, '0');
    const currentS = now.getSeconds();
    const ampm = currentH >= 12 ? 'PM' : 'AM';

    currentH = currentH % 12;
    currentH = currentH ? currentH : 12;
    const currentHStr = String(currentH).padStart(2, '0');

    if (currentS === 0) {
      alarms.forEach(alarm => {
        if (alarm.enabled && alarm.hour === currentHStr && alarm.minute === currentM && alarm.ampm === ampm) {
          setRingingAlarm(alarm);

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`Alarm: ${alarm.label}`, {
              body: `It's ${alarm.hour}:${alarm.minute} ${alarm.ampm}!`,
              icon: '🌐'
            });
          }
        }
      });
    }
  }, [alarms]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      checkAlarms(now);
    }, 1000);

    return () => clearInterval(timer);
  }, [checkAlarms]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleSelectTheme = useCallback((themeId) => {
    setCurrentTheme(themeId);
  }, []);

  const handleToggleFavorite = useCallback((tzId) => {
    setFavorites(prev => 
      prev.includes(tzId) ? prev.filter(id => id !== tzId) : [...prev, tzId]
    );
  }, []);

  const handleAddAlarm = useCallback((newAlarm) => {
    const created = { ...newAlarm, id: Date.now().toString() };
    setAlarms(prev => [created, ...prev]);
  }, []);

  const handleDeleteAlarm = useCallback((id) => {
    setAlarms(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleToggleAlarm = useCallback((id) => {
    setAlarms(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  }, []);

  const handleDismissRingingAlarm = useCallback(() => {
    setRingingAlarm(null);
  }, []);

  const handleSnoozeRingingAlarm = useCallback(() => {
    if (!ringingAlarm) return;
    const now = new Date(Date.now() + 5 * 60 * 1000);
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;

    const snoozedAlarm = {
      id: Date.now().toString(),
      hour: String(h).padStart(2, '0'),
      minute: m,
      ampm,
      label: `Snoozed: ${ringingAlarm.label}`,
      enabled: true
    };

    setAlarms(prev => [snoozedAlarm, ...prev]);
    setRingingAlarm(null);
  }, [ringingAlarm]);

  const greeting = useMemo(() => {
    const hour = currentTime.getHours();
    if (hour >= 5 && hour < 12) return "Good morning 👋";
    if (hour >= 12 && hour < 17) return "Good afternoon ☀️";
    if (hour >= 17 && hour < 21) return "Good evening 🌆";
    return "Good night 🌙";
  }, [currentTime]);

  const formattedHeaderDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(currentTime);
  }, [currentTime]);

  const activeAlarmsCount = useMemo(() => {
    return alarms.filter(a => a.enabled).length;
  }, [alarms]);

  if (isLoading) {
    return (
      <div className="app-loader">
        <div className="spinner"></div>
        <p>Initializing World Clock Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="sticky-header">
        <div className="header-left">
          <button 
            className="mobile-menu-toggle" 
            onClick={() => setSidebarOpen(prev => !prev)}
            aria-label="Toggle Sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="brand-logo-group">
            <div className="logo-icon-bg">
              <Globe className="logo-icon text-accent" size={22} />
            </div>
            <div>
              <h1 className="brand-title">World Clock Dashboard</h1>
              <span className="brand-badge">PRO SAAS</span>
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="live-status-pill" title="Real-time precision timer synced with System UTC">
            <span className="pulse-indicator"></span>
            <span className="status-text">Live Sync Active</span>
          </div>
          <div className="header-date-badge">
            <Calendar size={14} className="header-date-icon" />
            <span>{formattedHeaderDate}</span>
          </div>
        </div>

        <div className="header-right">
          <ThemeToggle currentTheme={currentTheme} onSelectTheme={handleSelectTheme} />
        </div>
      </header>

      <div className="dashboard-body">
        <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          <div className="sidebar-section">
            <div className="sidebar-label">NAVIGATION</div>
            <nav className="sidebar-nav">
              <a 
                href="#dashboard" 
                className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
                onClick={() => { setActiveSection('dashboard'); setSidebarOpen(false); }}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard Overview</span>
              </a>
              <a 
                href="#world-clock-section" 
                className={`nav-item ${activeSection === 'world-clock' ? 'active' : ''}`}
                onClick={() => { setActiveSection('world-clock'); setSidebarOpen(false); }}
              >
                <Globe size={18} />
                <span>World Clocks</span>
                <span className="nav-badge">{favorites.length} Pinned</span>
              </a>
              <a 
                href="#alarm-section" 
                className={`nav-item ${activeSection === 'alarm' ? 'active' : ''}`}
                onClick={() => { setActiveSection('alarm'); setSidebarOpen(false); }}
              >
                <Bell size={18} />
                <span>Alarm Hub</span>
                {activeAlarmsCount > 0 && (
                  <span className="nav-badge count">{activeAlarmsCount}</span>
                )}
              </a>
              <a 
                href="#stopwatch-section" 
                className={`nav-item ${activeSection === 'stopwatch' ? 'active' : ''}`}
                onClick={() => { setActiveSection('stopwatch'); setSidebarOpen(false); }}
              >
                <StopwatchIcon size={18} />
                <span>Stopwatch</span>
              </a>
              <a 
                href="#timer-section" 
                className={`nav-item ${activeSection === 'timer' ? 'active' : ''}`}
                onClick={() => { setActiveSection('timer'); setSidebarOpen(false); }}
              >
                <Hourglass size={18} />
                <span>Timer</span>
              </a>
              <a 
                href="#theme-settings" 
                className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
                onClick={() => { setActiveSection('settings'); setSidebarOpen(false); }}
              >
                <Settings size={18} />
                <span>Theme Settings</span>
              </a>
            </nav>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <div className="sidebar-label">QUICK STATS</div>
            <div className="sidebar-stats-card">
              <div className="stat-row">
                <span className="stat-label">Active Alarms</span>
                <span className="stat-val">{activeAlarmsCount}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Pinned Cities</span>
                <span className="stat-val">{favorites.length}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Active Theme</span>
                <span className="stat-val" style={{ textTransform: 'capitalize' }}>{currentTheme}</span>
              </div>
            </div>
          </div>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <ShieldCheck size={16} className="text-accent" />
              <span>World Clock SaaS v2.5</span>
            </div>
          </div>
        </aside>

        <main className="main-content" id="dashboard">
          <section className="greeting-banner">
            <div className="greeting-text">
              <h2>{greeting}</h2>
              <p>Welcome to your central global time, alarm, stopwatch & timer suite.</p>
            </div>
            <div className="greeting-accent-badge">
              <Sparkles size={16} />
              <span>High Precision Engine</span>
            </div>
          </section>

          <section className="clocks-grid">
            <DigitalClock currentTime={currentTime} />
            <AnalogClock currentTime={currentTime} />
          </section>

          <WorldClock 
            currentTime={currentTime} 
            favorites={favorites} 
            onToggleFavorite={handleToggleFavorite} 
          />

          <Alarm 
            alarms={alarms} 
            onAddAlarm={handleAddAlarm} 
            onDeleteAlarm={handleDeleteAlarm} 
            onToggleAlarm={handleToggleAlarm}
            triggerAlarmSound={playAlarmSound}
            ringingAlarm={ringingAlarm}
            onDismissRingingAlarm={handleDismissRingingAlarm}
            onSnoozeRingingAlarm={handleSnoozeRingingAlarm}
          />

          <div className="time-tools-grid">
            <Stopwatch />
            <Timer triggerAlarmSound={playAlarmSound} />
          </div>

          <section className="card settings-card" id="theme-settings">
            <div className="card-header">
              <div className="card-title">
                <Palette className="card-icon text-accent" size={20} />
                <div>
                  <h3>Theme & Visual Customization</h3>
                  <p className="card-subtitle">Choose from 5 curated professional SaaS theme palettes</p>
                </div>
              </div>
            </div>

            <div className="settings-grid">
              <div className="setting-item theme-setting-block">
                <div>
                  <h4>Select Dashboard Theme</h4>
                  <p className="setting-desc">Instantly customize background hues, text contrast, and neon accent glows</p>
                </div>
                <ThemeToggle currentTheme={currentTheme} onSelectTheme={handleSelectTheme} />
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
