import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, BarChart3, CheckCircle2, ChevronRight, CircleAlert,
  Bell, Clock3, Database, Edit3, Eye, EyeOff, FileText, LayoutDashboard, LogOut, MapPin, Menu, MessageSquare, RefreshCw, Search,
  Shield, ShieldCheck, Tag, Trash2, UserCheck, Users, X
} from 'lucide-react';
import {
  adminLogin, deleteAdminSkill, deleteAdminUser, getAdminExchanges, getAdminReports,
  getAdminSkills, getAdminOverview, getAdminAnalytics, getAdminNotifications, getAdminSettings, getAdminUsers, getAdminUserActivity, getAdminLogs, adminLogout, updateAdminExchange,
  updateAdminReport, updateAdminUser, updateAdminSkillModeration, getAdminSkillCategories, addAdminSkillCategory, deleteAdminSkillCategory, getAdminSkillStatistics, updateAdminSettings
} from './api';
import './admin.css';

const emptyStats = {
  total: 0, verified: 0, discoverable: 0, hidden: 0, blocked: 0,
  skills: 0, exchanges: 0, reports: 0
};

function StatCard({ icon: Icon, label, value, tone = '' }) {
  return <div className={`admin-stat-card ${tone}`}>
    <div className="admin-stat-icon"><Icon size={19} /></div>
    <div className="admin-stat-copy"><span>{label}</span><strong>{value ?? 0}</strong></div><span className="admin-stat-arrow"><ChevronRight size={14} /></span>
  </div>;
}

function AdminLogin({ onLogin }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!key.trim()) return setError('Enter your admin key.');
    setLoading(true);
    setError('');
    try {
      await adminLogin(key.trim());
      onLogin(key.trim());
    } catch (err) {
      setError(err.message || 'Invalid admin key.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="admin-login-page">
    <form className="admin-login-card" onSubmit={submit}>
      <div className="admin-brand-mark"><Shield size={24} /></div>
      <span className="admin-eyebrow">SKILLSWAP ADMIN</span>
      <h1>Admin control center</h1>
      <p>Sign in with the private admin key configured on your API server.</p>
      <label>Admin key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Enter admin key" autoFocus /></label>
      {error && <div className="admin-error">{error}</div>}
      <button className="admin-primary-button" disabled={loading}>{loading ? 'Checking…' : 'Enter dashboard'}</button>
      <a className="admin-back-link" href="/">← Back to SkillSwap</a>
    </form>
  </main>;
}

export default function AdminApp() {
  const [adminKey, setAdminKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [section, setSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const [users, setUsers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationRead, setNotificationRead] = useState(() => { try { return JSON.parse(localStorage.getItem('skillswap-admin-notification-read') || '[]'); } catch { return []; } });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [userModal, setUserModal] = useState(null);
  const [userActivity, setUserActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [userFilter, setUserFilter] = useState('all');
  const [savingUser, setSavingUser] = useState(false);
  const [skillFilter, setSkillFilter] = useState('all');
  const [exchangeFilter, setExchangeFilter] = useState('all');
  const [reportFilter, setReportFilter] = useState('all');
  const [reportPriorityFilter, setReportPriorityFilter] = useState('all');
  const [reportCategoryFilter, setReportCategoryFilter] = useState('all');
  const [skillModal, setSkillModal] = useState(null);
  const [exchangeModal, setExchangeModal] = useState(null);
  const [reportModal, setReportModal] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('daily');
  const [adminLogs, setAdminLogs] = useState([]);
  const [skillCategories, setSkillCategories] = useState([]);
  const [skillStats, setSkillStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, featured: 0, categories: 0, flaggedDuplicates: 0, lowQuality: 0 });
  const [categoryName, setCategoryName] = useState('');
  const [adminSettings, setAdminSettings] = useState({ profile: { name: 'SkillSwap Admin', email: '' }, dashboard: { compactMode: false, defaultSection: 'overview', refreshInterval: 0 }, maintenanceMode: false, registrationEnabled: true, announcement: { enabled: false, title: '', message: '' }, keyConfigured: false });
  const [newAdminKey, setNewAdminKey] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const logout = () => {
    adminLogout(adminKey).catch(() => {});
    localStorage.removeItem('skillswap-admin-key');
    setAdminKey('');
    setAuthenticated(false);
  };

  const loadAll = async (key = adminKey) => {
    setLoading(true);
    setError('');
    try {
      const [nextStats, nextUsers, nextSkills, nextAnalytics, nextExchanges, nextReports, nextLogs, nextCategories, nextSkillStats, nextNotifications, nextSettings] = await Promise.all([
        getAdminOverview(key), getAdminUsers(key), getAdminSkills(key), getAdminAnalytics(key),
        getAdminExchanges(key), getAdminReports(key), getAdminLogs(key), getAdminSkillCategories(key), getAdminSkillStatistics(key), getAdminNotifications(key), getAdminSettings(key)
      ]);
      setStats({ total: nextStats.totalUsers, verified: nextStats.verifiedUsers, discoverable: nextStats.visibleUsers, skills: nextStats.skills, exchanges: nextStats.exchanges, reports: nextStats.openReports });
      setAnalytics(nextAnalytics);
      setUsers(nextUsers);
      setSkills(nextSkills);
      setExchanges(nextExchanges);
      setReports(nextReports);
      setAdminLogs(nextLogs);
      setSkillCategories(nextCategories);
      setSkillStats(nextSkillStats);
      setNotifications(nextNotifications);
      setAdminSettings(nextSettings);
      setAuthenticated(true);
    } catch (err) {
      if (/admin access|403|401/i.test(err.message || '')) logout();
      setError(err.message || 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Admin access is intentionally memory-only: every page load/refresh requires the key again.
    localStorage.removeItem('skillswap-admin-key');
  }, []);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQuery = !q || [u.name, u.email, u.location, ...(u.teaches || []), ...(u.wants || [])].filter(Boolean).join(' ').toLowerCase().includes(q);
      const verified = Boolean(u.emailVerified || u.verified);
      const visible = u.profileVisible !== false;
      const matchesFilter = userFilter === 'all' || (userFilter === 'verified' && verified) || (userFilter === 'pending' && !verified) || (userFilter === 'hidden' && !visible);
      return matchesQuery && matchesFilter;
    });
  }, [users, query, userFilter]);

  const openUserEditor = async (user) => {
    const details = { ...user, teachesText: (user.teaches || []).join(', '), wantsText: (user.wants || []).join(', ') };
    setUserModal(details);
    setUserActivity([]);
    setActivityLoading(true);
    try {
      const activity = await getAdminUserActivity(adminKey, user._id || user.email);
      setUserActivity(activity);
    } catch (err) {
      setError(err.message);
    } finally {
      setActivityLoading(false);
    }
  };

  const saveUser = async () => {
    if (!userModal) return;
    setSavingUser(true);
    try {
      const payload = {
        name: userModal.name,
        location: userModal.location,
        bio: userModal.bio,
        teaches: userModal.teachesText.split(',').map((item) => item.trim()).filter(Boolean),
        wants: userModal.wantsText.split(',').map((item) => item.trim()).filter(Boolean),
        profileVisible: userModal.profileVisible !== false,
        allowMessages: userModal.allowMessages !== false,
        verified: Boolean(userModal.emailVerified || userModal.verified)
      };
      const updated = await updateAdminUser(adminKey, userModal._id || userModal.email, payload);
      setUsers((items) => items.map((item) => (item._id || item.email) === (userModal._id || userModal.email) ? updated : item));
      setUserModal(null);
      setNotice('User profile updated successfully.');
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setSavingUser(false); }
  };

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      const matchesQuery = !q || [s.title, s.category, s.level, s.teacher?.name, s.description].filter(Boolean).join(' ').toLowerCase().includes(q);
      const matchesFilter = skillFilter === 'all' || String(s.level || '').toLowerCase() === skillFilter;
      return matchesQuery && matchesFilter;
    });
  }, [skills, query, skillFilter]);

  const filteredExchanges = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exchanges.filter((e) => {
      const matchesQuery = !q || [e.skillTitle, e.requesterName, e.ownerName, e.requesterEmail, e.ownerEmail, e.status, e.offer].filter(Boolean).join(' ').toLowerCase().includes(q);
      return matchesQuery && (exchangeFilter === 'all' || e.status === exchangeFilter);
    });
  }, [exchanges, query, exchangeFilter]);

  const filteredReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      const matchesQuery = !q || [r.reason, r.reportedEmail, r.reporterEmail, r.details, r.status, r.priority, r.category, r.assignedTo].filter(Boolean).join(' ').toLowerCase().includes(q);
      return matchesQuery && (reportFilter === 'all' || r.status === reportFilter) && (reportPriorityFilter === 'all' || (r.priority || 'medium') === reportPriorityFilter) && (reportCategoryFilter === 'all' || (r.category || 'Other') === reportCategoryFilter);
    });
  }, [reports, query, reportFilter]);

  const refresh = () => loadAll();

  const userAction = async (user, updates) => {
    try {
      const id = user._id || user.email;
      const updated = await updateAdminUser(adminKey, id, updates);
      setUsers((items) => items.map((item) => (item._id || item.email) === id ? updated : item));
      setNotice('User updated successfully.');
      await refresh();
    } catch (err) { setError(err.message); }
  };

  const deleteUser = async (user) => {
    const typed = window.prompt(`Type DELETE to permanently delete ${user.name || user.email}.`);
    if (typed !== 'DELETE') return;
    try {
      await deleteAdminUser(adminKey, user._id || user.email);
      setUserModal(null);
      setNotice('User deleted permanently.');
      await refresh();
    } catch (err) { setError(err.message); }
  };

  const toggleUserBlocked = async (user) => {
    const blocked = Boolean(user.accountBlocked);
    if (blocked) return userAction(user, { accountBlocked: false });
    if (!window.confirm(`Block ${user.name || user.email}? They will be unable to log in and their profile will be hidden.`)) return;
    return userAction(user, { accountBlocked: true, profileVisible: false });
  };

  const setUserSuspension = async (user, days) => {
    if (days === 0) return userAction(user, { suspendedUntil: null });
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    return userAction(user, { suspendedUntil: until, profileVisible: false });
  };

  const moderateSkill = async (skill, status, featured = skill.featured) => {
    try {
      const updated = await updateAdminSkillModeration(adminKey, skill._id, { status, featured, moderationNote: skill.moderationNote || '' });
      setSkills((items) => items.map((item) => item._id === skill._id ? { ...item, ...updated } : item));
      setSkillStats(await getAdminSkillStatistics(adminKey));
      setNotice('Skill ' + status + '.');
    } catch (err) { setError(err.message); }
  };

  const toggleFeaturedSkill = async (skill) => {
    await moderateSkill(skill, skill.moderationStatus || 'pending', !skill.featured);
  };

  const addSkillCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;
    try {
      const created = await addAdminSkillCategory(adminKey, name);
      setSkillCategories((items) => [...items, created]);
      setCategoryName('');
      setNotice('Skill category added.');
    } catch (err) { setError(err.message); }
  };

  const removeSkillCategory = async (name) => {
    if (!window.confirm('Delete the "' + name + '" category?')) return;
    try {
      await deleteAdminSkillCategory(adminKey, name);
      setSkillCategories((items) => items.filter((item) => item !== name));
      setNotice('Skill category deleted.');
    } catch (err) { setError(err.message); }
  };

  const deleteSkill = async (skill) => {
    if (!window.confirm(`Delete skill "${skill.title}"?`)) return;
    try {
      await deleteAdminSkill(adminKey, skill._id);
      setNotice('Skill deleted.');
      await refresh();
    } catch (err) { setError(err.message); }
  };

  const changeExchangeStatus = async (exchange, status) => {
    try {
      await updateAdminExchange(adminKey, exchange._id, status);
      setNotice('Exchange status updated.');
      await refresh();
    } catch (err) { setError(err.message); }
  };

  const updateReportCase = async (report, payload) => {
    try {
      const updated = await updateAdminReport(adminKey, report._id, payload);
      setReports((items) => items.map((item) => item._id === report._id ? updated : item));
      setReportModal(updated);
      setNotice('Report updated successfully.');
    } catch (err) { setError(err.message); }
  };

  const resolveReport = async (report, status) => {
    return updateReportCase(report, { status });
  };

  if (!authenticated) return <AdminLogin onLogin={(key) => { setAdminKey(key); setAuthenticated(true); loadAll(key); }} />;

  const nav = [
    ['overview', LayoutDashboard, 'Overview'],
    ['analytics', BarChart3, 'Analytics'],
    ['security', ShieldCheck, 'Security & Logs'],
    ['notifications', Bell, 'Notifications'],
    ['settings', Shield, 'Admin Settings'],
    ['users', Users, 'Users'],
    ['skills', BarChart3, 'Skills'],
    ['exchanges', Activity, 'Exchanges'],
    ['reports', CircleAlert, 'Reports']
  ];

  const analyticsRows = analytics?.[analyticsPeriod] || [];
  const maxUsers = Math.max(1, ...analyticsRows.map((item) => item.users || 0));
  const maxActivity = Math.max(1, ...analyticsRows.map((item) => (item.skills || 0) + (item.exchanges || 0) + (item.reports || 0)));
  const latestGrowth = analyticsRows[analyticsRows.length - 1]?.growth ?? stats.total;
  const previousGrowth = analyticsRows[analyticsRows.length - 2]?.growth ?? latestGrowth;
  const growthDelta = latestGrowth - previousGrowth;

  return <div className="admin-shell">
    <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="admin-sidebar-brand"><div className="admin-brand-mark small"><Shield size={18} /></div><div><strong>SkillSwap</strong><span>Admin Panel</span></div></div>
      <nav>{nav.map(([id, Icon, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => { setSection(id); setQuery(''); setSidebarOpen(false); }}><Icon size={18} /><span>{label}</span>{id === 'notifications' && notifications.filter((item) => !notificationRead.includes(item.id)).length > 0 && <b className="admin-nav-badge">{notifications.filter((item) => !notificationRead.includes(item.id)).length > 99 ? '99+' : notifications.filter((item) => !notificationRead.includes(item.id)).length}</b>}<ChevronRight size={14} /></button>)}</nav>
      <div className="admin-sidebar-bottom">
        <a href="/"><ArrowLeft size={17} /> Back to website</a>
        <button onClick={logout}><LogOut size={17} /> Logout</button>
      </div>
    </aside>

    {sidebarOpen && <button className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}

    <main className="admin-main">
      <header className="admin-topbar">
        <button className="admin-menu-button" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
        <div><span className="admin-eyebrow">CONTROL CENTER</span><h1>{nav.find(([id]) => id === section)?.[2]}</h1></div>
        <div className="admin-top-actions"><div className="admin-system-status"><span className="status-dot" /> System online</div><button onClick={refresh} disabled={loading} title="Refresh"><RefreshCw size={18} className={loading ? 'spin' : ''} /></button><button onClick={logout} title="Logout"><LogOut size={18} /></button></div>
      </header>

      {notice && <div className="admin-notice"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}
      {error && <div className="admin-error-bar"><CircleAlert size={17} />{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

      {section === 'notifications' && <section className="admin-notifications-page">import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, BarChart3, CheckCircle2, ChevronRight, CircleAlert,
  Bell, Clock3, Database, Edit3, Eye, EyeOff, FileText, LayoutDashboard, LogOut, MapPin, Menu, MessageSquare, RefreshCw, Search,
  Shield, ShieldCheck, Tag, Trash2, UserCheck, Users, X
} from 'lucide-react';
import {
  adminLogin, deleteAdminSkill, deleteAdminUser, getAdminExchanges, getAdminReports,
  getAdminSkills, getAdminOverview, getAdminAnalytics, getAdminNotifications, getAdminSettings, getAdminUsers, getAdminUserActivity, getAdminLogs, adminLogout, updateAdminExchange,
  updateAdminReport, updateAdminUser, updateAdminSkillModeration, getAdminSkillCategories, addAdminSkillCategory, deleteAdminSkillCategory, getAdminSkillStatistics, updateAdminSettings
} from './api';
import './admin.css';

const emptyStats = {
  total: 0, verified: 0, discoverable: 0, hidden: 0, blocked: 0,
  skills: 0, exchanges: 0, reports: 0
};

function StatCard({ icon: Icon, label, value, tone = '' }) {
  return <div className={`admin-stat-card ${tone}`}>
    <div className="admin-stat-icon"><Icon size={19} /></div>
    <div className="admin-stat-copy"><span>{label}</span><strong>{value ?? 0}</strong></div><span className="admin-stat-arrow"><ChevronRight size={14} /></span>
  </div>;
}

function AdminLogin({ onLogin }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!key.trim()) return setError('Enter your admin key.');
    setLoading(true);
    setError('');
    try {
      await adminLogin(key.trim());
      onLogin(key.trim());
    } catch (err) {
      setError(err.message || 'Invalid admin key.');
    } finally {
      setLoading(false);
    }
  };

  return <main className="admin-login-page">
    <form className="admin-login-card" onSubmit={submit}>
      <div className="admin-brand-mark"><Shield size={24} /></div>
      <span className="admin-eyebrow">SKILLSWAP ADMIN</span>
      <h1>Admin control center</h1>
      <p>Sign in with the private admin key configured on your API server.</p>
      <label>Admin key<input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Enter admin key" autoFocus /></label>
      {error && <div className="admin-error">{error}</div>}
      <button className="admin-primary-button" disabled={loading}>{loading ? 'Checking…' : 'Enter dashboard'}</button>
      <a className="admin-back-link" href="/">← Back to SkillSwap</a>
    </form>
  </main>;
}

export default function AdminApp() {
  const [adminKey, setAdminKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [section, setSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const [users, setUsers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [reports, setReports] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationRead, setNotificationRead] = useState(() => { try { return JSON.parse(localStorage.getItem('skillswap-admin-notification-read') || '[]'); } catch { return []; } });
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [userModal, setUserModal] = useState(null);
  const [userActivity, setUserActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [userFilter, setUserFilter] = useState('all');
  const [savingUser, setSavingUser] = useState(false);
  const [skillFilter, setSkillFilter] = useState('all');
  const [exchangeFilter, setExchangeFilter] = useState('all');
  const [reportFilter, setReportFilter] = useState('all');
  const [reportPriorityFilter, setReportPriorityFilter] = useState('all');
  const [reportCategoryFilter, setReportCategoryFilter] = useState('all');
  const [skillModal, setSkillModal] = useState(null);
  const [exchangeModal, setExchangeModal] = useState(null);
  const [reportModal, setReportModal] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('daily');
  const [adminLogs, setAdminLogs] = useState([]);
  const [skillCategories, setSkillCategories] = useState([]);
  const [skillStats, setSkillStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, featured: 0, categories: 0, flaggedDuplicates: 0, lowQuality: 0 });
  const [categoryName, setCategoryName] = useState('');
  const [adminSettings, setAdminSettings] = useState({ profile: { name: 'SkillSwap Admin', email: '' }, dashboard: { compactMode: false, defaultSection: 'overview', refreshInterval: 0 }, maintenanceMode: false, registrationEnabled: true, announcement: { enabled: false, title: '', message: '' }, keyConfigured: false });
  const [newAdminKey, setNewAdminKey] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const logout = () => {
    adminLogout(adminKey).catch(() => {});
    localStorage.removeItem('skillswap-admin-key');
    setAdminKey('');
    setAuthenticated(false);
  };

  const loadAll = async (key = adminKey) => {
    setLoading(true);
    setError('');
    try {
      const [nextStats, nextUsers, nextSkills, nextAnalytics, nextExchanges, nextReports, nextLogs, nextCategories, nextSkillStats, nextNotifications, nextSettings] = await Promise.all([
        getAdminOverview(key), getAdminUsers(key), getAdminSkills(key), getAdminAnalytics(key),
        getAdminExchanges(key), getAdminReports(key), getAdminLogs(key), getAdminSkillCategories(key), getAdminSkillStatistics(key), getAdminNotifications(key), getAdminSettings(key)
      ]);
      setStats({ total: nextStats.totalUsers, verified: nextStats.verifiedUsers, discoverable: nextStats.visibleUsers, skills: nextStats.skills, exchanges: nextStats.exchanges, reports: nextStats.openReports });
      setAnalytics(nextAnalytics);
      setUsers(nextUsers);
      setSkills(nextSkills);
      setExchanges(nextExchanges);
      setReports(nextReports);
      setAdminLogs(nextLogs);
      setSkillCategories(nextCategories);
      setSkillStats(nextSkillStats);
      setNotifications(nextNotifications);
      setAdminSettings(nextSettings);
      setAuthenticated(true);
    } catch (err) {
      if (/admin access|403|401/i.test(err.message || '')) logout();
      setError(err.message || 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Admin access is intentionally memory-only: every page load/refresh requires the key again.
    localStorage.removeItem('skillswap-admin-key');
  }, []);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchesQuery = !q || [u.name, u.email, u.location, ...(u.teaches || []), ...(u.wants || [])].filter(Boolean).join(' ').toLowerCase().includes(q);
      const verified = Boolean(u.emailVerified || u.verified);
      const visible = u.profileVisible !== false;
      const matchesFilter = userFilter === 'all' || (userFilter === 'verified' && verified) || (userFilter === 'pending' && !verified) || (userFilter === 'hidden' && !visible);
      return matchesQuery && matchesFilter;
    });
  }, [users, query, userFilter]);

  const openUserEditor = async (user) => {
    const details = { ...user, teachesText: (user.teaches || []).join(', '), wantsText: (user.wants || []).join(', ') };
    setUserModal(details);
    setUserActivity([]);
    setActivityLoading(true);
    try {
      const activity = await getAdminUserActivity(adminKey, user._id || user.email);
      setUserActivity(activity);
    } catch (err) {
      setError(err.message);
    } finally {
      setActivityLoading(false);
    }
  };

  const saveUser = async () => {
    if (!userModal) return;
    setSavingUser(true);
    try {
      const payload = {
        name: userModal.name,
        location: userModal.location,
        bio: userModal.bio,
        teaches: userModal.teachesText.split(',').map((item) => item.trim()).filter(Boolean),
        wants: userModal.wantsText.split(',').map((item) => item.trim()).filter(Boolean),
        profileVisible: userModal.profileVisible !== false,
        allowMessages: userModal.allowMessages !== false,
        verified: Boolean(userModal.emailVerified || userModal.verified)
      };
      const updated = await updateAdminUser(adminKey, userModal._id || userModal.email, payload);
      setUsers((items) => items.map((item) => (item._id || item.email) === (userModal._id || userModal.email) ? updated : item));
      setUserModal(null);
      setNotice('User profile updated successfully.');
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setSavingUser(false); }
  };

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      const matchesQuery = !q || [s.title, s.category, s.level, s.teacher?.name, s.description].filter(Boolean).join(' ').toLowerCase().includes(q);
      const matchesFilter = skillFilter === 'all' || String(s.level || '').toLowerCase() === skillFilter;
      return matchesQuery && matchesFilter;
    });
  }, [skills, query, skillFilter]);

  const filteredExchanges = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exchanges.filter((e) => {
      const matchesQuery = !q || [e.skillTitle, e.requesterName, e.ownerName, e.requesterEmail, e.ownerEmail, e.status, e.offer].filter(Boolean).join(' ').toLowerCase().includes(q);
      return matchesQuery && (exchangeFilter === 'all' || e.status === exchangeFilter);
    });
  }, [exchanges, query, exchangeFilter]);

  const filteredReports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) => {
      const matchesQuery = !q || [r.reason, r.reportedEmail, r.reporterEmail, r.details, r.status, r.priority, r.category, r.assignedTo].filter(Boolean).join(' ').toLowerCase().includes(q);
      return matchesQuery && (reportFilter === 'all' || r.status === reportFilter) && (reportPriorityFilter === 'all' || (r.priority || 'medium') === reportPriorityFilter) && (reportCategoryFilter === 'all' || (r.category || 'Other') === reportCategoryFilter);
    });
  }, [reports, query, reportFilter]);

  const refresh = () => loadAll();

  const userAction = async (user, updates) => {
    try {
      const id = user._id || user.email;
      const updated = await updateAdminUser(adminKey, id, updates);
      setUsers((items) => items.map((item) => (item._id || item.email) === id ? updated : item));
      setNotice('User updated successfully.');
      await refresh();
    } catch (err) { setError(err.message); }
  };

  const deleteUser = async (user) => {
    const typed = window.prompt(`Type DELETE to permanently delete ${user.name || user.email}.`);
    if (typed !== 'DELETE') return;
    try {
      await deleteAdminUser(adminKey, user._id || user.email);
      setUserModal(null);
      setNotice('User deleted permanently.');
      await refresh();
    } catch (err) { setError(err.message); }
  };

  const toggleUserBlocked = async (user) => {
    const blocked = Boolean(user.accountBlocked);
    if (blocked) return userAction(user, { accountBlocked: false });
    if (!window.confirm(`Block ${user.name || user.email}? They will be unable to log in and their profile will be hidden.`)) return;
    return userAction(user, { accountBlocked: true, profileVisible: false });
  };

  const setUserSuspension = async (user, days) => {
    if (days === 0) return userAction(user, { suspendedUntil: null });
    const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    return userAction(user, { suspendedUntil: until, profileVisible: false });
  };

  const moderateSkill = async (skill, status, featured = skill.featured) => {
    try {
      const updated = await updateAdminSkillModeration(adminKey, skill._id, { status, featured, moderationNote: skill.moderationNote || '' });
      setSkills((items) => items.map((item) => item._id === skill._id ? { ...item, ...updated } : item));
      setSkillStats(await getAdminSkillStatistics(adminKey));
      setNotice('Skill ' + status + '.');
    } catch (err) { setError(err.message); }
  };

  const toggleFeaturedSkill = async (skill) => {
    await moderateSkill(skill, skill.moderationStatus || 'pending', !skill.featured);
  };

  const addSkillCategory = async () => {
    const name = categoryName.trim();
    if (!name) return;
    try {
      const created = await addAdminSkillCategory(adminKey, name);
      setSkillCategories((items) => [...items, created]);
      setCategoryName('');
      setNotice('Skill category added.');
    } catch (err) { setError(err.message); }
  };

  const removeSkillCategory = async (name) => {
    if (!window.confirm('Delete the "' + name + '" category?')) return;
    try {
      await deleteAdminSkillCategory(adminKey, name);
      setSkillCategories((items) => items.filter((item) => item !== name));
      setNotice('Skill category deleted.');
    } catch (err) { setError(err.message); }
  };

  const deleteSkill = async (skill) => {
    if (!window.confirm(`Delete skill "${skill.title}"?`)) return;
    try {
      await deleteAdminSkill(adminKey, skill._id);
      setNotice('Skill deleted.');
      await refresh();
    } catch (err) { setError(err.message); }
  };

  const changeExchangeStatus = async (exchange, status) => {
    try {
      await updateAdminExchange(adminKey, exchange._id, status);
      setNotice('Exchange status updated.');
      await refresh();
    } catch (err) { setError(err.message); }
  };

  const updateReportCase = async (report, payload) => {
    try {
      const updated = await updateAdminReport(adminKey, report._id, payload);
      setReports((items) => items.map((item) => item._id === report._id ? updated : item));
      setReportModal(updated);
      setNotice('Report updated successfully.');
    } catch (err) { setError(err.message); }
  };

  const resolveReport = async (report, status) => {
    return updateReportCase(report, { status });
  };

  if (!authenticated) return <AdminLogin onLogin={(key) => { setAdminKey(key); setAuthenticated(true); loadAll(key); }} />;

  const nav = [
    ['overview', LayoutDashboard, 'Overview'],
    ['analytics', BarChart3, 'Analytics'],
    ['security', ShieldCheck, 'Security & Logs'],
    ['notifications', Bell, 'Notifications'],
    ['settings', Shield, 'Admin Settings'],
    ['users', Users, 'Users'],
    ['skills', BarChart3, 'Skills'],
    ['exchanges', Activity, 'Exchanges'],
    ['reports', CircleAlert, 'Reports']
  ];

  const analyticsRows = analytics?.[analyticsPeriod] || [];
  const maxUsers = Math.max(1, ...analyticsRows.map((item) => item.users || 0));
  const maxActivity = Math.max(1, ...analyticsRows.map((item) => (item.skills || 0) + (item.exchanges || 0) + (item.reports || 0)));
  const latestGrowth = analyticsRows[analyticsRows.length - 1]?.growth ?? stats.total;
  const previousGrowth = analyticsRows[analyticsRows.length - 2]?.growth ?? latestGrowth;
  const growthDelta = latestGrowth - previousGrowth;

  return <div className="admin-shell">
    <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="admin-sidebar-brand"><div className="admin-brand-mark small"><Shield size={18} /></div><div><strong>SkillSwap</strong><span>Admin Panel</span></div></div>
      <nav>{nav.map(([id, Icon, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => { setSection(id); setQuery(''); setSidebarOpen(false); }}><Icon size={18} /><span>{label}</span>{id === 'notifications' && notifications.filter((item) => !notificationRead.includes(item.id)).length > 0 && <b className="admin-nav-badge">{notifications.filter((item) => !notificationRead.includes(item.id)).length > 99 ? '99+' : notifications.filter((item) => !notificationRead.includes(item.id)).length}</b>}<ChevronRight size={14} /></button>)}</nav>
      <div className="admin-sidebar-bottom">
        <a href="/"><ArrowLeft size={17} /> Back to website</a>
        <button onClick={logout}><LogOut size={17} /> Logout</button>
      </div>
    </aside>

    {sidebarOpen && <button className="admin-sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-label="Close menu" />}

    <main className="admin-main">
      <header className="admin-topbar">
        <button className="admin-menu-button" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>
        <div><span className="admin-eyebrow">CONTROL CENTER</span><h1>{nav.find(([id]) => id === section)?.[2]}</h1></div>
        <div className="admin-top-actions"><div className="admin-system-status"><span className="status-dot" /> System online</div><button onClick={refresh} disabled={loading} title="Refresh"><RefreshCw size={18} className={loading ? 'spin' : ''} /></button><button onClick={logout} title="Logout"><LogOut size={18} /></button></div>
      </header>

      {notice && <div className="admin-notice"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}
      {error && <div className="admin-error-bar"><CircleAlert size={17} />{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

      {section === 'notifications' && <section className="admin-notifications-page">
        <div className="admin-section-head"><div><span className="admin-eyebrow">ACTIVITY FEED</span><h2>Admin Notifications</h2><p>Recent platform events that may need administrator attention.</p></div><button className="admin-secondary-button" onClick={() => { const ids = notifications.map((item) => item.id); setNotificationRead(ids); localStorage.setItem('skillswap-admin-notification-read', JSON.stringify(ids)); }}>Mark all as read</button></div>
        <div className="admin-notification-summary"><div><strong>{notifications.filter((item) => !notificationRead.includes(item.id)).length}</strong><span>Unread</span></div><div><strong>{notifications.length}</strong><span>Recent events</span></div><div><strong>4</strong><span>Event types</span></div></div>
        <div className="admin-notification-list">{notifications.map((item) => {
          const unread = !notificationRead.includes(item.id);
          const Icon = item.type === 'report' ? CircleAlert : item.type === 'user' ? UserCheck : item.type === 'skill' ? Tag : Activity;
          return <button key={item.id} className={`admin-notification-item ${unread ? 'unread' : ''}`} onClick={() => { const next = Array.from(new Set([...notificationRead, item.id])); setNotificationRead(next); localStorage.setItem('skillswap-admin-notification-read', JSON.stringify(next)); }}>
            <span className={`admin-notification-icon ${item.type}`}><Icon size={17}/></span><span className="admin-notification-body"><strong>{item.title}</strong><span>{item.detail}</span><small>{new Date(item.createdAt).toLocaleString()}</small></span>{unread && <i className="admin-notification-dot"/>}
          </button>;
        })}{!notifications.length && <div className="admin-empty">No recent notifications.</div>}</div>
      </section>}

      {section === 'overview' && <section>
        <div className="admin-stats-grid">
          <StatCard icon={Users} label="Total users" value={stats.total} tone="users" />
          <StatCard icon={UserCheck} label="Verified users" value={stats.verified} tone="verified" />
          <StatCard icon={Eye} label="Visible profiles" value={stats.discoverable} tone="visible" />
          <StatCard icon={BarChart3} label="Skills" value={stats.skills} tone="skills" />
          <StatCard icon={Activity} label="Exchanges" value={stats.exchanges} tone="exchanges" />
          <StatCard icon={CircleAlert} label="Open reports" value={stats.reports} tone="reports" />
        </div>
        <div className="admin-overview-grid">
          <div className="admin-card"><div className="admin-card-head"><div><span className="admin-eyebrow">RECENT USERS</span><h2>Latest members</h2></div><button onClick={() => setSection('users')}>View all <ChevronRight size={15} /></button></div>
            <div className="admin-mini-list">{users.slice(0, 6).map((u) => <div key={u._id || u.email}><span className="admin-avatar">{(u.name || 'U').slice(0,2).toUpperCase()}</span><div><strong>{u.name || 'Unnamed'}</strong><small>{u.email}</small></div><span className={u.emailVerified || u.verified ? 'pill success' : 'pill'}>{u.emailVerified || u.verified ? 'Verified' : 'Pending'}</span></div>)}</div>
          </div>
          <div className="admin-card admin-system-card"><div className="admin-card-head"><div><span className="admin-eyebrow">SYSTEM HEALTH</span><h2>Platform status</h2></div><ShieldCheck size={21} /></div><div className="admin-health"><div className="health-icon"><Database size={20} /></div><div><strong>All services operational</strong><small>API and database are responding normally.</small></div><span className="health-badge"><span className="status-dot" /> Healthy</span></div><div className="admin-health-row"><div><Clock3 size={16} /><span>Last refresh</span></div><strong>Just now</strong></div><div className="admin-health-row"><div><ShieldCheck size={16} /><span>Admin access</span></div><strong>Protected</strong></div><button className="admin-outline-wide" onClick={refresh}><RefreshCw size={15} /> Refresh platform data</button></div><div className="admin-card"><div className="admin-card-head"><div><span className="admin-eyebrow">MODERATION</span><h2>Reports</h2></div><button onClick={() => setSection('reports')}>Review <ChevronRight size={15} /></button></div>
            <div className="admin-mini-list">{reports.filter(r => r.status !== 'resolved').slice(0, 5).map((r) => <div key={r._id}><div className="report-dot" /><div><strong>{r.reason}</strong><small>{r.reportedEmail}</small></div><span className="pill warning">{r.status}</span></div>)}{!filteredReports.length && <div className="admin-empty">No reports match your filters.</div>}</div>
          </div>
        </div>
      </section>}

      {section === 'analytics' && <section>
        <div className="admin-analytics-toolbar">
          <div><span className="admin-eyebrow">PLATFORM INSIGHTS</span><h2>Advanced analytics</h2><p>Track growth, activity and moderation trends from your SkillSwap data.</p></div>
          <div className="admin-period-switcher">
            {['daily', 'weekly', 'monthly'].map((period) => <button key={period} className={analyticsPeriod === period ? 'active' : ''} onClick={() => setAnalyticsPeriod(period)}>{period}</button>)}
          </div>
        </div>
        <div className="admin-analytics-kpis">
          <div className="admin-analytics-kpi"><span>Active users</span><strong>{analytics?.activeUsers ?? 0}</strong><small>Unique users active in the last 30 days</small></div>
          <div className="admin-analytics-kpi"><span>User growth</span><strong>{latestGrowth}</strong><small>{growthDelta >= 0 ? '+' : ''}{growthDelta} from previous period</small></div>
          <div className="admin-analytics-kpi"><span>New skills</span><strong>{analyticsRows.reduce((sum, item) => sum + (item.skills || 0), 0)}</strong><small>In selected period</small></div>
          <div className="admin-analytics-kpi"><span>Exchange activity</span><strong>{analyticsRows.reduce((sum, item) => sum + (item.exchanges || 0), 0)}</strong><small>Created exchanges</small></div>
        </div>
        <div className="admin-analytics-grid">
          <div className="admin-card admin-chart-card">
            <div className="admin-card-head"><div><span className="admin-eyebrow">USER GROWTH</span><h2>New users & cumulative growth</h2></div><span className="data-chip">{analyticsPeriod}</span></div>
            <div className="admin-growth-chart">
              <svg viewBox="0 0 900 280" role="img" aria-label="User growth chart" preserveAspectRatio="none">
                <polyline fill="none" points={analyticsRows.map((item, index) => `${(index / Math.max(1, analyticsRows.length - 1)) * 880 + 10},${265 - ((item.growth / Math.max(1, latestGrowth || 1)) * 235)}`).join(' ')} />
                {analyticsRows.map((item, index) => <circle key={item.key} cx={(index / Math.max(1, analyticsRows.length - 1)) * 880 + 10} cy={265 - ((item.growth / Math.max(1, latestGrowth || 1)) * 235)} r="3.5"><title>{item.label}: {item.growth} users</title></circle>)}
              </svg>
              <div className="admin-chart-axis">{analyticsRows.filter((_, index) => index % Math.max(1, Math.ceil(analyticsRows.length / 6)) === 0).map((item) => <span key={item.key}>{item.label}</span>)}</div>
            </div>
          </div>
          <div className="admin-card admin-chart-card">
            <div className="admin-card-head"><div><span className="admin-eyebrow">ACTIVITY MIX</span><h2>Skills, exchanges & reports</h2></div></div>
            <div className="admin-activity-bars">{analyticsRows.map((item) => <div className="admin-activity-group" key={item.key} title={item.label}><div className="admin-activity-stack"><span style={{height: `${((item.skills || 0) / maxActivity) * 100}%`}}></span><span style={{height: `${((item.exchanges || 0) / maxActivity) * 100}%`}}></span><span style={{height: `${((item.reports || 0) / maxActivity) * 100}%`}}></span></div></div>)}</div>
            <div className="admin-chart-legend"><span><i/>Skills</span><span><i/>Exchanges</span><span><i/>Reports</span></div>
          </div>
        </div>
        <div className="admin-card admin-chart-card">
          <div className="admin-card-head"><div><span className="admin-eyebrow">NEW USERS</span><h2>{analyticsPeriod[0].toUpperCase() + analyticsPeriod.slice(1)} sign-ups</h2></div><span className="data-chip">{analyticsRows.reduce((sum, item) => sum + (item.users || 0), 0)} total</span></div>
          <div className="admin-user-bars">{analyticsRows.map((item) => <div className="admin-user-bar-wrap" key={item.key} title={`${item.label}: ${item.users} new users`}><div className="admin-user-bar" style={{height: `${((item.users || 0) / maxUsers) * 180}px`}}></div><span>{item.label}</span></div>)}</div>
        </div>
      </section>}

      {section !== 'overview' && <section className="admin-card admin-table-card">
        <div className="admin-card-head">
          <div><span className="admin-eyebrow">MANAGEMENT</span><h2>{nav.find(([id]) => id === section)?.[2]}</h2></div>
          <div className="admin-table-tools"><label className="admin-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={"Search " + section + "…"} /></label>
          {section === 'users' && <select className="admin-filter" value={userFilter} onChange={(e) => setUserFilter(e.target.value)}><option value="all">All users</option><option value="verified">Verified</option><option value="pending">Pending</option><option value="hidden">Hidden profiles</option></select>}
          {section === 'skills' && <select className="admin-filter" value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}><option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>}
          {section === 'exchanges' && <select className="admin-filter" value={exchangeFilter} onChange={(e) => setExchangeFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>}
          {section === 'reports' && <>
  <select className="admin-filter" value={reportFilter} onChange={(e) => setReportFilter(e.target.value)}><option value="all">All statuses</option><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select>
  <select className="admin-filter" value={reportPriorityFilter} onChange={(e) => setReportPriorityFilter(e.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
  <select className="admin-filter" value={reportCategoryFilter} onChange={(e) => setReportCategoryFilter(e.target.value)}><option value="all">All categories</option><option value="Safety">Safety</option><option value="Harassment">Harassment</option><option value="Spam">Spam</option><option value="Fraud">Fraud</option><option value="Skill quality">Skill quality</option><option value="Exchange dispute">Exchange dispute</option><option value="Other">Other</option></select>
</>}
        </div>
        </div>

        {section === 'security' && <div className="admin-security-grid"><div className="admin-card admin-security-summary"><div className="admin-card-head"><div><span className="admin-eyebrow">SECURITY</span><h2>Admin activity</h2></div><span className="data-chip">{adminLogs.length} events</span></div><div className="admin-security-stats"><div><strong>{adminLogs.filter((log) => log.action === 'admin_login').length}</strong><span>Successful logins</span></div><div><strong>{adminLogs.filter((log) => log.action === 'admin_login_failed').length}</strong><span>Failed attempts</span></div><div><strong>{adminLogs.filter((log) => /updated|deleted/.test(log.action || '')).length}</strong><span>Admin changes</span></div><div><strong>{adminLogs.filter((log) => log.action === 'admin_logout').length}</strong><span>Logouts</span></div></div></div><div className="admin-card admin-log-card"><div className="admin-card-head"><div><span className="admin-eyebrow">AUDIT LOG</span><h2>Who changed what</h2></div><button className="admin-secondary-button" onClick={refresh}><RefreshCw size={14}/> Refresh</button></div>{adminLogs.length ? <div className="admin-log-list">{adminLogs.map((log, index) => <div className="admin-log-row" key={log._id || (log.createdAt + '-' + index)}><span className={log.success === false ? 'admin-log-icon failed' : 'admin-log-icon'}><ShieldCheck size={15}/></span><div><strong>{String(log.action || '').replaceAll('_', ' ')}</strong><small>{log.details || 'No additional details'}{log.targetId ? ' · ' + log.targetType + ': ' + log.targetId : ''}</small></div><div className="admin-log-meta"><b>{log.admin || 'Admin'}</b><time>{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Date unavailable'}</time></div></div>)}</div> : <div className="admin-empty">No admin events recorded yet.</div>}</div></div>}

{section === 'users' && <div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Location</th><th>Status</th><th>Skills</th><th>Actions</th></tr></thead><tbody>{filteredUsers.map((u) => <tr key={u._id || u.email}><td><div className="table-user"><span className="admin-avatar">{(u.name || 'U').slice(0,2).toUpperCase()}</span><div><strong>{u.name || 'Unnamed'}</strong><small>{u.email}</small></div></div></td><td>{u.location || '—'}</td><td><span className={u.emailVerified || u.verified ? 'pill success' : 'pill'}>{u.emailVerified || u.verified ? 'Verified' : 'Unverified'}</span><span className={u.profileVisible === false ? 'pill muted' : 'pill success'}>{u.profileVisible === false ? 'Hidden' : 'Visible'}</span></td><td>{u.teaches?.length ? u.teaches.slice(0,3).join(', ') : '—'}</td><td><div className="table-actions"><button title="View user details & activity" onClick={() => openUserEditor(u)}><Eye size={15} /></button><button title="Edit profile" onClick={() => openUserEditor(u)}><Edit3 size={15} /></button><button title="Verify / unverify" onClick={() => userAction(u, { verified: !(u.emailVerified || u.verified) })}><UserCheck size={15} /></button><button title={u.profileVisible === false ? 'Show profile' : 'Hide profile'} onClick={() => userAction(u, { profileVisible: u.profileVisible === false })}>{u.profileVisible === false ? <Eye size={15} /> : <EyeOff size={15} />}</button><button className={u.accountBlocked ? '' : 'danger'} title={u.accountBlocked ? 'Unblock user' : 'Block user'} onClick={() => toggleUserBlocked(u)}><Shield size={15} /></button><button className="danger" title="Delete permanently" onClick={() => deleteUser(u)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!filteredUsers.length && <div className="admin-empty">No users found.</div>}</div>}

        {section === 'skills' && <div className="admin-skill-moderation">
  <div className="admin-skill-stats-grid">
    <div className="admin-card"><span>All skills</span><strong>{skillStats.total}</strong></div><div className="admin-card"><span>Pending</span><strong>{skillStats.pending}</strong></div><div className="admin-card"><span>Approved</span><strong>{skillStats.approved}</strong></div><div className="admin-card"><span>Rejected</span><strong>{skillStats.rejected}</strong></div><div className="admin-card"><span>Featured</span><strong>{skillStats.featured}</strong></div><div className="admin-card"><span>Duplicates</span><strong>{skillStats.flaggedDuplicates}</strong></div><div className="admin-card"><span>Low quality</span><strong>{skillStats.lowQuality}</strong></div><div className="admin-card"><span>Categories</span><strong>{skillStats.categories}</strong></div>
  </div>
  <div className="admin-card admin-category-manager"><div className="admin-card-head"><div><span className="admin-eyebrow">CATEGORIES</span><h2>Skill categories</h2></div></div><div className="admin-category-add"><input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="New category name" onKeyDown={(e) => { if (e.key === 'Enter') addSkillCategory(); }}/><button className="admin-primary-button" onClick={addSkillCategory}>Add</button></div><div className="admin-category-list">{skillCategories.map((category) => <span className="data-chip" key={category}>{category}<button onClick={() => removeSkillCategory(category)} aria-label={'Delete ' + category}><X size={12}/></button></span>)}</div></div>
  <div className="admin-table-wrap"><table><thead><tr><th>Skill</th><th>Category</th><th>Quality</th><th>Status</th><th>Featured</th><th>Actions</th></tr></thead><tbody>{filteredSkills.map((s) => <tr key={s._id}><td><div className="table-primary"><span className="table-icon skill"><Tag size={15}/></span><div><strong>{s.title}</strong><small>{s.description || 'No description'}</small></div></div></td><td><span className="data-chip">{s.category || 'General'}</span></td><td>{s.moderationFlags?.duplicate && <span className="pill warning">Duplicate</span>}{s.moderationFlags?.lowQuality && <span className="pill danger">Low quality</span>}{!s.moderationFlags?.duplicate && !s.moderationFlags?.lowQuality && <span className="pill success">Looks good</span>}</td><td><span className={'pill ' + (s.moderationStatus === 'approved' ? 'success' : s.moderationStatus === 'rejected' ? 'muted' : 'warning')}>{s.moderationStatus || 'pending'}</span></td><td>{s.featured ? <span className="pill success">Featured</span> : <span className="pill muted">Standard</span>}</td><td><div className="table-actions"><button title="Approve" onClick={() => moderateSkill(s, 'approved')}><CheckCircle2 size={15}/></button><button title="Reject" onClick={() => moderateSkill(s, 'rejected')}><CircleAlert size={15}/></button><button title={s.featured ? 'Remove featured' : 'Mark featured'} onClick={() => toggleFeaturedSkill(s)}><Tag size={15}/></button><button title="View skill" onClick={() => setSkillModal(s)}><Eye size={15}/></button><button className="danger" title="Delete" onClick={() => deleteSkill(s)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table>{!filteredSkills.length && <div className="admin-empty">No skills found.</div>}</div>
</div>}

        {section === 'exchanges' && <div className="admin-exchange-management">
  <div className="admin-exchange-summary">
    {['pending','accepted','rejected','completed','cancelled'].map((status) => <button key={status} className={exchangeFilter === status ? 'active' : ''} onClick={() => setExchangeFilter(exchangeFilter === status ? 'all' : status)}><span>{status}</span><strong>{exchanges.filter((item) => (item.status || 'pending') === status).length}</strong></button>)}
  </div>
  <div className="admin-table-wrap"><table><thead><tr><th>Exchange</th><th>Participants</th><th>Status</th><th>Last updated</th><th>Actions</th></tr></thead><tbody>{filteredExchanges.map((e) => <tr key={e._id}>
    <td><div className="table-primary"><span className="table-icon exchange"><Activity size={15}/></span><div><strong>{e.skillTitle || 'Skill exchange'}</strong><small>{e.offer || 'No offer text'}</small></div></div></td>
    <td><strong>{e.requester?.name || e.requesterName || e.requesterEmail || 'Requester'}</strong><small>↔ {e.owner?.name || e.ownerName || e.ownerEmail || 'Owner'}</small></td>
    <td><span className={`pill ${e.status === 'accepted' || e.status === 'completed' ? 'success' : e.status === 'rejected' || e.status === 'cancelled' ? 'muted' : 'warning'}`}>{e.status || 'pending'}</span></td>
    <td><small>{e.updatedAt ? new Date(e.updatedAt).toLocaleString() : e.createdAt ? new Date(e.createdAt).toLocaleString() : '—'}</small></td>
    <td><div className="table-actions"><button title="View exchange details & timeline" onClick={() => setExchangeModal(e)}><Eye size={15}/></button><select value={e.status || 'pending'} onChange={(event) => changeExchangeStatus(e, event.target.value)}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div></td>
  </tr>)}</tbody></table>{!filteredExchanges.length && <div className="admin-empty">No exchanges found.</div>}</div>
</div>}

        {section === 'reports' && <div className="admin-report-center">
  <div className="admin-report-priority-strip">
    {['high','medium','low'].map((priority) => <button key={priority} className={reportPriorityFilter === priority ? 'active' : ''} onClick={() => setReportPriorityFilter(reportPriorityFilter === priority ? 'all' : priority)}><span>{priority}</span><strong>{reports.filter((r) => (r.priority || 'medium') === priority && r.status === 'open').length}</strong><small>open cases</small></button>)}
  </div>
  <div className="admin-report-grid">{filteredReports.map((r) => <article className="admin-report" key={r._id} onClick={() => setReportModal(r)}>
    <div className="report-header"><div className="report-badges"><span className={'pill ' + ((r.priority || 'medium') === 'high' ? 'danger' : (r.priority || 'medium') === 'low' ? 'muted' : 'warning')}>{r.priority || 'medium'} priority</span><span className="data-chip">{r.category || 'Other'}</span></div><small>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</small></div>
    <h3>{r.reason}</h3><p><strong>Reported:</strong> {r.reportedEmail}</p><p><strong>Reporter:</strong> {r.reporterEmail}</p>{r.details && <p>{r.details}</p>}
    <div className="report-card-meta"><span>Assigned: <strong>{r.assignedTo || 'Unassigned'}</strong></span><span className={'pill ' + (r.status === 'resolved' ? 'success' : r.status === 'dismissed' ? 'muted' : 'warning')}>{r.status}</span></div>
    <div className="report-actions">{r.status !== 'resolved' && <button onClick={(e) => { e.stopPropagation(); resolveReport(r, 'resolved'); }}>Resolve</button>}{r.status !== 'dismissed' && <button onClick={(e) => { e.stopPropagation(); resolveReport(r, 'dismissed'); }}>Dismiss</button>}</div>
  </article>)}{!filteredReports.length && <div className="admin-empty">No reports match your filters.</div>}</div>
</div>}
      </section>}
      {skillModal && <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSkillModal(null); }}><section className="admin-modal compact-modal"><div className="admin-modal-head"><div><span className="admin-eyebrow">SKILL MODERATION</span><h2>{skillModal.title || 'Skill details'}</h2></div><button className="admin-modal-close" onClick={() => setSkillModal(null)}><X size={18}/></button></div><div className="detail-hero"><span className="detail-icon"><Tag size={22}/></span><div><strong>{skillModal.category || 'General'} · {skillModal.level || 'Unspecified'}</strong><small>{skillModal.teacher?.name || skillModal.teacher?.email || 'Unknown teacher'}</small></div></div><div className="detail-block"><span>Description</span><p>{skillModal.description || 'No description provided.'}</p></div><div className="detail-meta"><div><small>Category</small><strong>{skillModal.category || '—'}</strong></div><div><small>Level</small><strong>{skillModal.level || '—'}</strong></div><div><small>Teacher</small><strong>{skillModal.teacher?.name || '—'}</strong></div></div><div className="admin-modal-actions"><button className="admin-secondary-button" onClick={() => setSkillModal(null)}>Close</button><button className="admin-danger-button" onClick={() => { setSkillModal(null); deleteSkill(skillModal); }}><Trash2 size={14}/> Delete skill</button></div></section></div>}
      {exchangeModal && <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setExchangeModal(null); }}><section className="admin-modal compact-modal exchange-detail-modal">
  <div className="admin-modal-head"><div><span className="admin-eyebrow">EXCHANGE MANAGEMENT</span><h2>Exchange details</h2></div><button className="admin-modal-close" onClick={() => setExchangeModal(null)}><X size={18}/></button></div>
  <div className="detail-hero"><span className="detail-icon"><Activity size={22}/></span><div><strong>{exchangeModal.skillTitle || 'Skill exchange'}</strong><small>{exchangeModal._id} · {exchangeModal.createdAt ? new Date(exchangeModal.createdAt).toLocaleString() : 'Date unavailable'}</small></div><span className={'pill ' + (exchangeModal.status === 'completed' || exchangeModal.status === 'accepted' ? 'success' : exchangeModal.status === 'rejected' || exchangeModal.status === 'cancelled' ? 'muted' : 'warning')}>{exchangeModal.status || 'pending'}</span></div>
  <div className="exchange-participants"><div><span>REQUESTER</span><strong>{exchangeModal.requester?.name || exchangeModal.requesterName || 'Unknown'}</strong><small>{exchangeModal.requester?.email || exchangeModal.requesterEmail || '—'}</small>{exchangeModal.requester?.location && <small>{exchangeModal.requester.location}</small>}</div><div className="exchange-arrow">↔</div><div><span>SKILL OWNER</span><strong>{exchangeModal.owner?.name || exchangeModal.ownerName || 'Unknown'}</strong><small>{exchangeModal.owner?.email || exchangeModal.ownerEmail || '—'}</small>{exchangeModal.owner?.location && <small>{exchangeModal.owner.location}</small>}</div></div>
  <div className="detail-block"><span>Exchange message</span><p>{exchangeModal.offer || 'No message provided.'}</p></div>
  <div className="detail-block"><span>Complete exchange timeline</span><div className="exchange-timeline">{(exchangeModal.statusHistory || [{status: exchangeModal.status || 'pending', at: exchangeModal.createdAt, source: 'legacy'}]).map((event, index) => <div className="exchange-timeline-item" key={(event.at || 'event') + '-' + index}><span className="exchange-timeline-dot"/><div><strong>{event.status}</strong><small>{event.at ? new Date(event.at).toLocaleString() : 'Date unavailable'} · {event.source || 'system'}</small></div></div>)}</div></div>
  <div className="admin-modal-actions"><button className="admin-secondary-button" onClick={() => setExchangeModal(null)}>Close</button><select className="admin-action-select" value={exchangeModal.status || 'pending'} onChange={async (e) => { const status=e.target.value; await changeExchangeStatus(exchangeModal,status); setExchangeModal({...exchangeModal,status,updatedAt:new Date().toISOString(),statusHistory:[...(exchangeModal.statusHistory || []),{status,at:new Date().toISOString(),source:'admin'}]}); }}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
</section></div>}
      {reportModal && <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setReportModal(null); }}><section className="admin-modal compact-modal report-detail-modal">
  <div className="admin-modal-head"><div><span className="admin-eyebrow">REPORTS CENTER</span><h2>Moderation case</h2></div><button className="admin-modal-close" onClick={() => setReportModal(null)}><X size={18}/></button></div>
  <div className="detail-hero report-hero"><span className="detail-icon"><FileText size={22}/></span><div><strong>{reportModal.reason || 'Report'}</strong><small>{reportModal._id} · {reportModal.createdAt ? new Date(reportModal.createdAt).toLocaleString() : 'Date unavailable'}</small></div><span className={'pill ' + (reportModal.status === 'resolved' ? 'success' : reportModal.status === 'dismissed' ? 'muted' : 'warning')}>{reportModal.status || 'open'}</span></div>
  <div className="report-control-grid">
    <label>Priority<select value={reportModal.priority || 'medium'} onChange={(e) => updateReportCase(reportModal,{priority:e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
    <label>Category<select value={reportModal.category || 'Other'} onChange={(e) => updateReportCase(reportModal,{category:e.target.value})}><option>Safety</option><option>Harassment</option><option>Spam</option><option>Fraud</option><option>Skill quality</option><option>Exchange dispute</option><option>Other</option></select></label>
    <label>Assigned admin<input value={reportModal.assignedTo || ''} onChange={(e) => setReportModal({...reportModal,assignedTo:e.target.value})} onBlur={(e) => updateReportCase(reportModal,{assignedTo:e.target.value})} placeholder="Admin name"/></label>
    <label>Status<select value={reportModal.status || 'open'} onChange={(e) => updateReportCase(reportModal,{status:e.target.value})}><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label>
  </div>
  <div className="detail-meta"><div><small>Reported user</small><strong>{reportModal.reportedEmail || '—'}</strong></div><div><small>Reporter</small><strong>{reportModal.reporterEmail || '—'}</strong></div><div><small>Last updated</small><strong>{reportModal.updatedAt ? new Date(reportModal.updatedAt).toLocaleString() : '—'}</strong></div></div>
  <div className="detail-block"><span>Case details</span><p>{reportModal.details || 'No additional details were submitted.'}</p></div>
  <div className="detail-block"><span>Internal admin note</span><textarea className="admin-report-note" id="admin-report-note" placeholder="Add an internal note for other admins…" defaultValue="" /></div>
  <div className="detail-block"><span>Report history</span><div className="report-history">{(reportModal.history || []).map((item,index) => <div className="report-history-item" key={(item.at || 'event')+'-'+index}><span className="report-history-dot"/><div><strong>{String(item.action || 'update').replaceAll('_',' ')}</strong><small>{item.actor || 'system'} · {item.at ? new Date(item.at).toLocaleString() : '—'}{item.status ? ' · '+item.status : ''}</small></div></div>)}{!reportModal.history?.length && <span className="admin-empty">No history available.</span>}</div></div>
  {reportModal.internalNotes?.length ? <div className="detail-block"><span>Internal notes history</span>{reportModal.internalNotes.map((note,index) => <div className="report-note-history" key={(note.at || 'note')+'-'+index}><strong>{note.actor || 'Admin'}</strong><small>{note.at ? new Date(note.at).toLocaleString() : '—'}</small><p>{note.note}</p></div>)}</div> : null}
  <div className="admin-modal-actions"><button className="admin-secondary-button" onClick={() => setReportModal(null)}>Close</button><button className="admin-secondary-button" onClick={async () => { const el=document.getElementById('admin-report-note'); if(!el?.value.trim()) return; await updateReportCase(reportModal,{internalNote:el.value.trim()}); el.value=''; }}>Save internal note</button><button className="admin-primary-button modal-save" onClick={() => updateReportCase(reportModal,{status:'resolved'})}>Resolve</button><button className="admin-secondary-button" onClick={() => updateReportCase(reportModal,{status:'dismissed'})}>Dismiss</button></div>
</section></div>}
      {userModal && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setUserModal(null); }}>
        <section className="admin-modal admin-user-detail-modal" role="dialog" aria-modal="true">
          <div className="admin-modal-head"><div><span className="admin-eyebrow">USER MANAGEMENT</span><h2>User details</h2></div><button className="admin-modal-close" onClick={() => setUserModal(null)}><X size={18} /></button></div>
          <div className="admin-profile-hero"><span className="admin-avatar large">{(userModal.name || 'U').slice(0,2).toUpperCase()}</span><div><strong>{userModal.name || 'Unnamed'}</strong><small>{userModal.email}</small></div><div className="user-status-stack"><span className={userModal.accountBlocked ? 'pill danger' : 'pill success'}>{userModal.accountBlocked ? 'Blocked' : 'Active'}</span><span className={userModal.suspendedUntil && new Date(userModal.suspendedUntil).getTime() > Date.now() ? 'pill warning' : 'pill'}>{userModal.suspendedUntil && new Date(userModal.suspendedUntil).getTime() > Date.now() ? `Suspended until ${new Date(userModal.suspendedUntil).toLocaleDateString()}` : 'Not suspended'}</span></div></div>
          <div className="admin-user-status-actions">
            <button className={userModal.accountBlocked ? 'admin-secondary-button' : 'admin-danger-button'} onClick={async () => { await toggleUserBlocked(userModal); setUserModal({...userModal, accountBlocked: !userModal.accountBlocked, profileVisible: userModal.accountBlocked ? userModal.profileVisible : false}); }}>{userModal.accountBlocked ? 'Unblock account' : 'Block account'}</button>
            <select className="admin-action-select" value="" onChange={async (e) => { const days = Number(e.target.value); if (!Number.isNaN(days)) { await setUserSuspension(userModal, days); setUserModal({...userModal, suspendedUntil: days ? new Date(Date.now() + days * 86400000).toISOString() : null}); } }}><option value="">Suspend account…</option><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option><option value="0">Remove suspension</option></select>
          </div>
          <div className="admin-detail-section"><div className="admin-detail-tabs"><span className="active">Profile & controls</span><span>Activity history</span></div>
          <div className="admin-form-grid">
            <label>Name<input value={userModal.name || ''} onChange={(e) => setUserModal({...userModal,name:e.target.value})} /></label>
            <label>Location<div className="admin-input-icon"><MapPin size={14}/><input value={userModal.location || ''} onChange={(e) => setUserModal({...userModal,location:e.target.value})} /></div></label>
            <label className="full">Bio<textarea rows="3" value={userModal.bio || ''} onChange={(e) => setUserModal({...userModal,bio:e.target.value})} /></label>
            <label>Teaches <small>comma separated</small><input value={userModal.teachesText || ''} onChange={(e) => setUserModal({...userModal,teachesText:e.target.value})} /></label>
            <label>Wants to learn <small>comma separated</small><input value={userModal.wantsText || ''} onChange={(e) => setUserModal({...userModal,wantsText:e.target.value})} /></label>
          </div>
          <div className="admin-toggle-grid">
            <label><span><Eye size={15}/> Profile visible</span><input type="checkbox" checked={userModal.profileVisible !== false} onChange={(e) => setUserModal({...userModal,profileVisible:e.target.checked})}/></label>
            <label><span><MessageSquare size={15}/> Direct messages</span><input type="checkbox" checked={userModal.allowMessages !== false} onChange={(e) => setUserModal({...userModal,allowMessages:e.target.checked})}/></label>
            <label><span><UserCheck size={15}/> Mark verified</span><input type="checkbox" checked={Boolean(userModal.emailVerified || userModal.verified)} onChange={(e) => setUserModal({...userModal,verified:e.target.checked,emailVerified:e.target.checked})}/></label>
          </div>
          <div className="admin-modal-actions"><button className="admin-secondary-button" onClick={() => setUserModal(null)}>Close</button><button className="admin-primary-button modal-save" onClick={saveUser} disabled={savingUser}>{savingUser ? 'Saving…' : 'Save changes'}</button><button className="admin-danger-button" onClick={() => deleteUser(userModal)}><Trash2 size={14}/> Delete</button></div>
          <div className="admin-activity-panel"><div className="admin-card-head"><div><span className="admin-eyebrow">ACTIVITY HISTORY</span><h3>Recent account activity</h3></div><span className="data-chip">{userActivity.length} events</span></div>{activityLoading ? <div className="admin-empty">Loading activity…</div> : userActivity.length ? <div className="admin-activity-list">{userActivity.map((event) => <div className="admin-activity-item" key={`${event.type}-${event.id}`}><span className="activity-dot"><Activity size={14}/></span><div><strong>{event.title}</strong><small>{event.detail}</small></div><time>{event.createdAt ? new Date(event.createdAt).toLocaleString() : 'Date unavailable'}</time></div>)}</div> : <div className="admin-empty">No recent activity recorded.</div>}</div>
          </div>
        </section>
      </div>}
    </main>
  </div>;
}
