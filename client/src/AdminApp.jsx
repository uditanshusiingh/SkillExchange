import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, BarChart3, CheckCircle2, ChevronRight, CircleAlert,
  Eye, EyeOff, LayoutDashboard, LogOut, Menu, RefreshCw, Search, Shield,
  Trash2, UserCheck, Users, X
} from 'lucide-react';
import {
  deleteAdminSkill, deleteAdminUser, getAdminExchanges, getAdminReports,
  getAdminSkills, getAdminStats, getAdminUsers, updateAdminExchange,
  updateAdminReport, updateAdminUser
} from './api';
import './admin.css';

const emptyStats = {
  total: 0, verified: 0, discoverable: 0, hidden: 0, blocked: 0,
  skills: 0, exchanges: 0, reports: 0
};

function StatCard({ icon: Icon, label, value }) {
  return <div className="admin-stat-card">
    <div className="admin-stat-icon"><Icon size={19} /></div>
    <div><span>{label}</span><strong>{value ?? 0}</strong></div>
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
      await getAdminStats(key.trim());
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

  const logout = () => {
    localStorage.removeItem('skillswap-admin-key');
    setAdminKey('');
    setAuthenticated(false);
  };

  const loadAll = async (key = adminKey) => {
    setLoading(true);
    setError('');
    try {
      const [nextStats, nextUsers, nextSkills, nextExchanges, nextReports] = await Promise.all([
        getAdminStats(key), getAdminUsers(key), getAdminSkills(key),
        getAdminExchanges(key), getAdminReports(key)
      ]);
      setStats(nextStats);
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
    if (!q) return users;
    return users.filter((u) => [u.name, u.email, u.location, ...(u.teaches || []), ...(u.wants || [])].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [users, query]);

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) => [s.title, s.category, s.level, s.teacher?.name].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [skills, query]);

  const filteredExchanges = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exchanges;
    return exchanges.filter((e) => [e.skillTitle, e.requesterName, e.ownerName, e.requesterEmail, e.ownerEmail, e.status].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [exchanges, query]);

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
    if (!window.confirm(`Delete ${user.name || user.email}? This cannot be undone.`)) return;
    try {
      await deleteAdminUser(adminKey, user._id || user.email);
      setNotice('User deleted.');
      await refresh();
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
    ['users', Users, 'Users'],
    ['skills', BarChart3, 'Skills'],
    ['exchanges', Activity, 'Exchanges'],
    ['reports', CircleAlert, 'Reports']
  ];

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
        <div className="admin-top-actions"><button onClick={refresh} disabled={loading} title="Refresh"><RefreshCw size={18} className={loading ? 'spin' : ''} /></button><button onClick={logout} title="Logout"><LogOut size={18} /></button></div>
      </header>

      {notice && <div className="admin-notice"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')}><X size={15} /></button></div>}
      {error && <div className="admin-error-bar"><CircleAlert size={17} />{error}<button onClick={() => setError('')}><X size={15} /></button></div>}

      {section === 'overview' && <section>
        <div className="admin-stats-grid">
          <StatCard icon={Users} label="Total users" value={stats.total} />
          <StatCard icon={UserCheck} label="Verified users" value={stats.verified} />
          <StatCard icon={Eye} label="Visible profiles" value={stats.discoverable} />
          <StatCard icon={BarChart3} label="Skills" value={stats.skills} />
          <StatCard icon={Activity} label="Exchanges" value={stats.exchanges} />
          <StatCard icon={CircleAlert} label="Open reports" value={stats.reports} />
        </div>
        <div className="admin-overview-grid">
          <div className="admin-card"><div className="admin-card-head"><div><span className="admin-eyebrow">RECENT USERS</span><h2>Latest members</h2></div><button onClick={() => setSection('users')}>View all <ChevronRight size={15} /></button></div>
            <div className="admin-mini-list">{users.slice(0, 6).map((u) => <div key={u._id || u.email}><span className="admin-avatar">{(u.name || 'U').slice(0,2).toUpperCase()}</span><div><strong>{u.name || 'Unnamed'}</strong><small>{u.email}</small></div><span className={u.emailVerified || u.verified ? 'pill success' : 'pill'}>{u.emailVerified || u.verified ? 'Verified' : 'Pending'}</span></div>)}</div>
          </div>
          <div className="admin-card"><div className="admin-card-head"><div><span className="admin-eyebrow">MODERATION</span><h2>Reports</h2></div><button onClick={() => setSection('reports')}>Review <ChevronRight size={15} /></button></div>
            <div className="admin-mini-list">{reports.filter(r => r.status !== 'resolved').slice(0, 5).map((r) => <div key={r._id}><div className="report-dot" /><div><strong>{r.reason}</strong><small>{r.reportedEmail}</small></div><span className="pill warning">{r.status}</span></div>)}{!reports.length && <div className="admin-empty">No reports.</div>}</div>
          </div>
        </div>
      </section>}

      {section !== 'overview' && <section className="admin-card admin-table-card">
        <div className="admin-card-head">
          <div><span className="admin-eyebrow">MANAGEMENT</span><h2>{nav.find(([id]) => id === section)?.[2]}</h2></div>
          <label className="admin-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${section}…`} /></label>
        </div>

        {section === 'users' && <div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Location</th><th>Status</th><th>Skills</th><th>Actions</th></tr></thead><tbody>{filteredUsers.map((u) => <tr key={u._id || u.email}><td><div className="table-user"><span className="admin-avatar">{(u.name || 'U').slice(0,2).toUpperCase()}</span><div><strong>{u.name || 'Unnamed'}</strong><small>{u.email}</small></div></div></td><td>{u.location || '—'}</td><td><span className={u.emailVerified || u.verified ? 'pill success' : 'pill'}>{u.emailVerified || u.verified ? 'Verified' : 'Unverified'}</span><span className={u.profileVisible === false ? 'pill muted' : 'pill success'}>{u.profileVisible === false ? 'Hidden' : 'Visible'}</span></td><td>{u.teaches?.length ? u.teaches.slice(0,3).join(', ') : '—'}</td><td><div className="table-actions"><button title="Verify / unverify" onClick={() => userAction(u, { verified: !(u.emailVerified || u.verified) })}><UserCheck size={15} /></button><button title="Hide / show profile" onClick={() => userAction(u, { profileVisible: u.profileVisible === false })}>{u.profileVisible === false ? <Eye size={15} /> : <EyeOff size={15} />}</button><button className="danger" title="Delete" onClick={() => deleteUser(u)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!filteredUsers.length && <div className="admin-empty">No users found.</div>}</div>}

        {section === 'skills' && <div className="admin-table-wrap"><table><thead><tr><th>Skill</th><th>Category</th><th>Level</th><th>Teacher</th><th>Actions</th></tr></thead><tbody>{filteredSkills.map((s) => <tr key={s._id}><td><strong>{s.title}</strong><small>{s.description}</small></td><td>{s.category}</td><td>{s.level}</td><td>{s.teacher?.name || '—'}</td><td><div className="table-actions"><button className="danger" title="Delete" onClick={() => deleteSkill(s)}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table>{!filteredSkills.length && <div className="admin-empty">No skills found.</div>}</div>}

        {section === 'exchanges' && <div className="admin-table-wrap"><table><thead><tr><th>Skill</th><th>Requester</th><th>Owner</th><th>Status</th><th>Change</th></tr></thead><tbody>{filteredExchanges.map((e) => <tr key={e._id}><td><strong>{e.skillTitle || 'Skill exchange'}</strong><small>{e.offer || 'No offer text'}</small></td><td>{e.requesterName || e.requesterEmail}</td><td>{e.ownerName || e.ownerEmail}</td><td><span className="pill warning">{e.status}</span></td><td><select value={e.status || 'pending'} onChange={(event) => changeExchangeStatus(e, event.target.value)}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select></td></tr>)}</tbody></table>{!filteredExchanges.length && <div className="admin-empty">No exchanges found.</div>}</div>}

        {section === 'reports' && <div className="admin-report-grid">{reports.map((r) => <article className="admin-report" key={r._id}><div className="report-header"><span className={r.status === 'resolved' ? 'pill success' : 'pill warning'}>{r.status}</span><small>{new Date(r.createdAt).toLocaleString()}</small></div><h3>{r.reason}</h3><p><strong>Reported:</strong> {r.reportedEmail}</p><p><strong>Reporter:</strong> {r.reporterEmail}</p>{r.details && <p>{r.details}</p>}<div className="report-actions">{r.status !== 'resolved' && <button onClick={() => resolveReport(r, 'resolved')}>Resolve</button>}<button onClick={() => resolveReport(r, 'dismissed')}>Dismiss</button></div></article>)}{!reports.length && <div className="admin-empty">No reports.</div>}</div>}
      </section>}
    </main>
  </div>;
}
