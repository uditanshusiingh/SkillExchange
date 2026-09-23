import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, BarChart3, CheckCircle2, ChevronRight, CircleAlert,
  Clock3, Database, Edit3, Eye, EyeOff, FileText, LayoutDashboard, LogOut, MapPin, Menu, MessageSquare, RefreshCw, Search,
  Shield, ShieldCheck, Tag, Trash2, UserCheck, Users, X
} from 'lucide-react';
import {
  deleteAdminSkill, deleteAdminUser, getAdminExchanges, getAdminReports,
  getAdminSkills, getAdminOverview, getAdminAnalytics, getAdminUsers, getAdminUserActivity, updateAdminExchange,
  updateAdminReport, updateAdminUser
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
      await getAdminOverview(key.trim());
      localStorage.setItem('skillswap-admin-key', key.trim());
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
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('skillswap-admin-key') || '');
  const [authenticated, setAuthenticated] = useState(false);
  const [section, setSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState(emptyStats);
  const [users, setUsers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [reports, setReports] = useState([]);
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
  const [skillModal, setSkillModal] = useState(null);
  const [exchangeModal, setExchangeModal] = useState(null);
  const [reportModal, setReportModal] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState('daily');

  const logout = () => {
    localStorage.removeItem('skillswap-admin-key');
    setAdminKey('');
    setAuthenticated(false);
  };

  const loadAll = async (key = adminKey) => {
    setLoading(true);
    setError('');
    try {
      const [nextStats, nextUsers, nextSkills, nextAnalytics, nextExchanges, nextReports] = await Promise.all([
        getAdminOverview(key), getAdminUsers(key), getAdminSkills(key), getAdminAnalytics(key),
        getAdminExchanges(key), getAdminReports(key)
      ]);
      setStats({ total: nextStats.totalUsers, verified: nextStats.verifiedUsers, discoverable: nextStats.visibleUsers, skills: nextStats.skills, exchanges: nextStats.exchanges, reports: nextStats.openReports });
      setAnalytics(nextAnalytics);
      setUsers(nextUsers);
      setSkills(nextSkills);
      setExchanges(nextExchanges);
      setReports(nextReports);
      setAuthenticated(true);
    } catch (err) {
      if (/admin access|403|401/i.test(err.message || '')) logout();
      setError(err.message || 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) loadAll(adminKey);
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
      const matchesQuery = !q || [r.reason, r.reportedEmail, r.reporterEmail, r.details, r.status].filter(Boolean).join(' ').toLowerCase().includes(q);
      return matchesQuery && (reportFilter === 'all' || r.status === reportFilter);
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

  const resolveReport = async (report, status) => {
    try {
      await updateAdminReport(adminKey, report._id, status);
      setNotice(`Report marked ${status}.`);
      await refresh();
    } catch (err) { setError(err.message); }
  };

  if (!authenticated) return <AdminLogin onLogin={(key) => { setAdminKey(key); setAuthenticated(true); loadAll(key); }} />;

  const nav = [
    ['overview', LayoutDashboard, 'Overview'],
    ['analytics', BarChart3, 'Analytics'],
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
      <nav>{nav.map(([id, Icon, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => { setSection(id); setQuery(''); setSidebarOpen(false); }}><Icon size={18} /><span>{label}</span><ChevronRight size={14} /></button>)}</nav>
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
          {section === 'exchanges' && <select className="admin-filter" value={exchangeFilter} onChange={(e) => setExchangeFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select>}
          {section === 'reports' && <select className="admin-filter" value={reportFilter} onChange={(e) => setReportFilter(e.target.value)}><option value="all">All reports</option><option value="open">Open</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select>}
        </div>
        </div>

        {section === 'users' && <div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Location</th><th>Status</th><th>Skills</th><th>Actions</th></tr></thead><tbody>{filteredUsers.map((u) => <tr key={u._id || u.email}><td><div className="table-user"><span className="admin-avatar">{(u.name || 'U').slice(0,2).toUpperCase()}</span><div><strong>{u.name || 'Unnamed'}</strong><small>{u.email}</small></div></div></td><td>{u.location || '—'}</td><td><span className={u.emailVerified || u.verified ? 'pill success' : 'pill'}>{u.emailVerified || u.verified ? 'Verified' : 'Unverified'}</span><span className={u.profileVisible === false ? 'pill muted' : 'pill success'}>{u.profileVisible === false ? 'Hidden' : 'Visible'}</span></td><td>{u.teaches?.length ? u.teaches.slice(0,3).join(', ') : '—'}</td><td><div className="table-actions"><button title="View user details & activity" onClick={() => openUserEditor(u)}><Eye size={15} /></button><button title="Edit profile" onClick={() => openUserEditor(u)}><Edit3 size={15} /></button><button title="Verify / unverify" onClick={() => userAction(u, { verified: !(u.emailVerified || u.verified) })}><UserCheck size={15} /></button><button title={u.profileVisible === false ? 'Show profile' : 'Hide profile'} onClick={() => userAction(u, { profileVisible: u.profileVisible === false })}>{u.profileVisible === false ? <Eye size={15} /> : <EyeOff size={15} />}</button><button className={u.accountBlocked ? '' : 'danger'} title={u.accountBlocked ? 'Unblock user' : 'Block user'} onClick={() => toggleUserBlocked(u)}><Shield size={15} /></button><button className="danger" title="Delete permanently" onClick={() => deleteUser(u)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!filteredUsers.length && <div className="admin-empty">No users found.</div>}</div>}

        {section === 'skills' && <div className="admin-table-wrap"><table><thead><tr><th>Skill</th><th>Category</th><th>Level</th><th>Teacher</th><th>Actions</th></tr></thead><tbody>{filteredSkills.map((s) => <tr key={s._id}><td><div className="table-primary"><span className="table-icon skill"><Tag size={15}/></span><div><strong>{s.title}</strong><small>{s.description || 'No description'}</small></div></div></td><td><span className="data-chip">{s.category || 'General'}</span></td><td><span className="pill">{s.level || '—'}</span></td><td>{s.teacher?.name || '—'}</td><td><div className="table-actions"><button title="View skill" onClick={() => setSkillModal(s)}><Eye size={15}/></button><button className="danger" title="Delete" onClick={() => deleteSkill(s)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!filteredSkills.length && <div className="admin-empty">No skills found.</div>}</div>}

        {section === 'exchanges' && <div className="admin-table-wrap"><table><thead><tr><th>Skill</th><th>Requester</th><th>Owner</th><th>Status</th><th>Change</th></tr></thead><tbody>{filteredExchanges.map((e) => <tr key={e._id}><td><div className="table-primary"><span className="table-icon exchange"><Activity size={15}/></span><div><strong>{e.skillTitle || 'Skill exchange'}</strong><small>{e.offer || 'No offer text'}</small></div></div></td><td><strong>{e.requesterName || e.requesterEmail}</strong><small>{e.requesterEmail}</small></td><td><strong>{e.ownerName || e.ownerEmail}</strong><small>{e.ownerEmail}</small></td><td><span className={`pill ${e.status === 'accepted' || e.status === 'completed' ? 'success' : e.status === 'rejected' ? 'muted' : 'warning'}`}>{e.status || 'pending'}</span></td><td><div className="table-actions"><button title="View exchange" onClick={() => setExchangeModal(e)}><Eye size={15}/></button><select value={e.status || 'pending'} onChange={(event) => changeExchangeStatus(e, event.target.value)}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select></div></td></tr>)}</tbody></table>{!filteredExchanges.length && <div className="admin-empty">No exchanges found.</div>}</div>}

        {section === 'reports' && <div className="admin-report-grid">{filteredReports.map((r) => <article className="admin-report" key={r._id} onClick={() => setReportModal(r)}><div className="report-header"><span className={r.status === 'resolved' ? 'pill success' : 'pill warning'}>{r.status}</span><small>{new Date(r.createdAt).toLocaleString()}</small></div><h3>{r.reason}</h3><p><strong>Reported:</strong> {r.reportedEmail}</p><p><strong>Reporter:</strong> {r.reporterEmail}</p>{r.details && <p>{r.details}</p>}<div className="report-actions">{r.status !== 'resolved' && <button onClick={() => resolveReport(r, 'resolved')}>Resolve</button>}<button onClick={() => resolveReport(r, 'dismissed')}>Dismiss</button></div></article>)}{!reports.length && <div className="admin-empty">No reports.</div>}</div>}
      </section>}
      {skillModal && <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSkillModal(null); }}><section className="admin-modal compact-modal"><div className="admin-modal-head"><div><span className="admin-eyebrow">SKILL MODERATION</span><h2>{skillModal.title || 'Skill details'}</h2></div><button className="admin-modal-close" onClick={() => setSkillModal(null)}><X size={18}/></button></div><div className="detail-hero"><span className="detail-icon"><Tag size={22}/></span><div><strong>{skillModal.category || 'General'} · {skillModal.level || 'Unspecified'}</strong><small>{skillModal.teacher?.name || skillModal.teacher?.email || 'Unknown teacher'}</small></div></div><div className="detail-block"><span>Description</span><p>{skillModal.description || 'No description provided.'}</p></div><div className="detail-meta"><div><small>Category</small><strong>{skillModal.category || '—'}</strong></div><div><small>Level</small><strong>{skillModal.level || '—'}</strong></div><div><small>Teacher</small><strong>{skillModal.teacher?.name || '—'}</strong></div></div><div className="admin-modal-actions"><button className="admin-secondary-button" onClick={() => setSkillModal(null)}>Close</button><button className="admin-danger-button" onClick={() => { setSkillModal(null); deleteSkill(skillModal); }}><Trash2 size={14}/> Delete skill</button></div></section></div>}
      {exchangeModal && <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setExchangeModal(null); }}><section className="admin-modal compact-modal"><div className="admin-modal-head"><div><span className="admin-eyebrow">EXCHANGE MODERATION</span><h2>Exchange details</h2></div><button className="admin-modal-close" onClick={() => setExchangeModal(null)}><X size={18}/></button></div><div className="detail-hero"><span className="detail-icon"><Activity size={22}/></span><div><strong>{exchangeModal.skillTitle || 'Skill exchange'}</strong><small>{exchangeModal.status || 'pending'} · {exchangeModal.createdAt ? new Date(exchangeModal.createdAt).toLocaleString() : 'Date unavailable'}</small></div></div><div className="exchange-participants"><div><span>REQUESTER</span><strong>{exchangeModal.requesterName || 'Unknown'}</strong><small>{exchangeModal.requesterEmail || '—'}</small></div><div className="exchange-arrow">→</div><div><span>SKILL OWNER</span><strong>{exchangeModal.ownerName || 'Unknown'}</strong><small>{exchangeModal.ownerEmail || '—'}</small></div></div><div className="detail-block"><span>Offer / message</span><p>{exchangeModal.offer || 'No message provided.'}</p></div><div className="admin-modal-actions"><button className="admin-secondary-button" onClick={() => setExchangeModal(null)}>Close</button><select className="admin-action-select" value={exchangeModal.status || 'pending'} onChange={async (e) => { const status=e.target.value; await changeExchangeStatus(exchangeModal,status); setExchangeModal({...exchangeModal,status}); }}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select></div></section></div>}
      {reportModal && <div className="admin-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setReportModal(null); }}><section className="admin-modal compact-modal"><div className="admin-modal-head"><div><span className="admin-eyebrow">REPORT REVIEW</span><h2>Moderation case</h2></div><button className="admin-modal-close" onClick={() => setReportModal(null)}><X size={18}/></button></div><div className="detail-hero report-hero"><span className="detail-icon"><FileText size={22}/></span><div><strong>{reportModal.reason || 'Report'}</strong><small>{reportModal.createdAt ? new Date(reportModal.createdAt).toLocaleString() : 'Date unavailable'}</small></div><span className={reportModal.status === 'resolved' ? 'pill success' : reportModal.status === 'dismissed' ? 'pill muted' : 'pill warning'}>{reportModal.status}</span></div><div className="detail-meta"><div><small>Reported user</small><strong>{reportModal.reportedEmail || '—'}</strong></div><div><small>Reporter</small><strong>{reportModal.reporterEmail || '—'}</strong></div></div><div className="detail-block"><span>Case details</span><p>{reportModal.details || 'No additional details were submitted.'}</p></div><div className="admin-modal-actions"><button className="admin-secondary-button" onClick={() => setReportModal(null)}>Close</button>{reportModal.status !== 'resolved' && <button className="admin-primary-button modal-save" onClick={async () => { await resolveReport(reportModal,'resolved'); setReportModal(null); }}>Resolve case</button>}<button className="admin-secondary-button" onClick={async () => { await resolveReport(reportModal,'dismissed'); setReportModal(null); }}>Dismiss</button></div></section></div>}
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
