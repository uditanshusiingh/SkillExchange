import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, BarChart3, CheckCircle2, ChevronDown, CircleAlert, LogOut,
  RefreshCw, Search, ShieldCheck, Trash2, UserRound, Users, XCircle
} from 'lucide-react';
import {
  adminLogin, getAdminOverview, getAdminUsers, getAdminSkills, updateAdminUser,
  deleteAdminUser, getAdminReports, updateAdminReport, deleteAdminSkill,
  getAdminExchanges, updateAdminExchange
} from './api';
import './admin.css';

const emptyOverview = { totalUsers: 0, verifiedUsers: 0, visibleUsers: 0, skills: 0, exchanges: 0, openReports: 0 };

function Stat({ icon: Icon, label, value }) {
  return <div className="admin-stat"><div className="admin-stat-icon"><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong></div></div>;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AdminPanel({ onBack }) {
  const [key, setKey] = useState(() => localStorage.getItem('skillswap-admin-key') || '');
  const [authenticated, setAuthenticated] = useState(() => Boolean(localStorage.getItem('skillswap-admin-key')));
  const [loginKey, setLoginKey] = useState('');
  const [loginError, setLoginError] = useState('');
  const [section, setSection] = useState('dashboard');
  const [overview, setOverview] = useState(emptyOverview);
  const [users, setUsers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [reports, setReports] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!key) return;
    setLoading(true);
    try {
      const [o, u, s, r, e] = await Promise.all([
        getAdminOverview(key), getAdminUsers(key), getAdminSkills(key), getAdminReports(key), getAdminExchanges(key)
      ]);
      setOverview(o); setUsers(u); setSkills(s); setReports(r); setExchanges(e);
      setAuthenticated(true);
      localStorage.setItem('skillswap-admin-key', key);
    } catch (error) {
      if (error.message?.includes('403')) {
        localStorage.removeItem('skillswap-admin-key');
        setAuthenticated(false);
      }
      setNotice(error.message || 'Could not load admin data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (authenticated) load(); }, [authenticated]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => `${u.name || ''} ${u.email || ''} ${u.location || ''}`.toLowerCase().includes(q));
  }, [users, search]);

  const filteredSkills = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(s => `${s.title || ''} ${s.category || ''} ${s.teacher?.name || ''}`.toLowerCase().includes(q));
  }, [skills, search]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter(r => `${r.reporterEmail || ''} ${r.reportedEmail || ''} ${r.reason || ''} ${r.status || ''}`.toLowerCase().includes(q));
  }, [reports, search]);

  const filteredExchanges = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exchanges;
    return exchanges.filter(e => `${e.requesterName || ''} ${e.ownerName || ''} ${e.skillTitle || ''} ${e.status || ''}`.toLowerCase().includes(q));
  }, [exchanges, search]);

  async function login(event) {
    event.preventDefault(); setLoginError('');
    try {
      await adminLogin(loginKey);
      setKey(loginKey); localStorage.setItem('skillswap-admin-key', loginKey); setAuthenticated(true);
    } catch (error) { setLoginError(error.message || 'Invalid admin key.'); }
  }

  function logout() {
    localStorage.removeItem('skillswap-admin-key');
    setKey(''); setAuthenticated(false); setLoginKey('');
  }

  async function toggleUser(user, field) {
    try {
      const value = field === 'verified' ? !(user.emailVerified || user.verified) : field === 'profileVisible' ? user.profileVisible === false : user.allowMessages === false;
      const updated = await updateAdminUser(key, user._id || user.email, { [field]: value });
      setUsers(prev => prev.map(item => (item._id || item.email) === (user._id || user.email) ? updated : item));
      setNotice('User updated.');
    } catch (error) { setNotice(error.message); }
  }

  async function removeUser(user) {
    if (!window.confirm(`Delete ${user.name || user.email}? This cannot be undone.`)) return;
    try {
      await deleteAdminUser(key, user._id || user.email);
      setUsers(prev => prev.filter(item => (item._id || item.email) !== (user._id || user.email)));
      setNotice('User deleted.');
    } catch (error) { setNotice(error.message); }
  }

  async function removeSkill(skill) {
    if (!window.confirm(`Delete skill "${skill.title}"?`)) return;
    try { await deleteAdminSkill(key, skill._id); setSkills(prev => prev.filter(item => item._id !== skill._id)); setNotice('Skill deleted.'); }
    catch (error) { setNotice(error.message); }
  }

  async function setReportStatus(report, status) {
    try {
      const updated = await updateAdminReport(key, report._id, status);
      setReports(prev => prev.map(item => item._id === report._id ? updated : item));
      setNotice('Report updated.');
    } catch (error) { setNotice(error.message); }
  }

  async function setExchangeStatus(exchange, status) {
    try {
      const updated = await updateAdminExchange(key, exchange._id, status);
      setExchanges(prev => prev.map(item => item._id === exchange._id ? updated : item));
      setNotice('Exchange updated.');
    } catch (error) { setNotice(error.message); }
  }

  if (!authenticated) return <div className="admin-shell admin-login-shell">
    <form className="admin-login-card" onSubmit={login}>
      <div className="admin-brand"><ShieldCheck size={28} /><span>SkillSwap Admin</span></div>
      <p className="admin-kicker">SECURE ADMIN AREA</p>
      <h1>Admin login</h1>
      <p>Use the <code>ADMIN_KEY</code> configured on your SkillSwap server.</p>
      <input autoFocus type="password" value={loginKey} onChange={e => setLoginKey(e.target.value)} placeholder="Enter admin key" />
      {loginError && <div className="admin-error">{loginError}</div>}
      <button className="admin-primary" type="submit">Sign in</button>
      <button className="admin-link-button" type="button" onClick={onBack}><ArrowLeft size={15} /> Back to SkillSwap</button>
    </form>
  </div>;

  const nav = [
    ['dashboard', BarChart3, 'Dashboard'], ['users', Users, 'Users'], ['skills', Activity, 'Skills'],
    ['exchanges', ChevronDown, 'Exchanges'], ['reports', CircleAlert, 'Reports']
  ];

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <div className="admin-brand"><ShieldCheck size={25} /><span>SkillSwap<br /><b>Admin</b></span></div>
      <nav>{nav.map(([id, Icon, label]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => { setSection(id); setSearch(''); }}><Icon size={17} />{label}</button>)}</nav>
      <button className="admin-back" onClick={onBack}><ArrowLeft size={16} /> Main website</button>
      <button className="admin-logout" onClick={logout}><LogOut size={16} /> Logout</button>
    </aside>

    <main className="admin-main">
      <header className="admin-topbar">
        <div><p className="admin-kicker">CONTROL CENTER</p><h1>{nav.find(item => item[0] === section)?.[2] || 'Dashboard'}</h1></div>
        <div className="admin-top-actions"><button title="Refresh" onClick={load} disabled={loading}><RefreshCw size={17} className={loading ? 'spin' : ''} /></button>{section !== 'dashboard' && <label className="admin-search"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." /></label>}</div>
      </header>

      {notice && <div className="admin-notice">{notice}<button onClick={() => setNotice('')}><XCircle size={16} /></button></div>}

      {section === 'dashboard' && <div className="admin-content">
        <div className="admin-stats-grid">
          <Stat icon={Users} label="Total users" value={overview.totalUsers} />
          <Stat icon={CheckCircle2} label="Verified users" value={overview.verifiedUsers} />
          <Stat icon={UserRound} label="Visible profiles" value={overview.visibleUsers} />
          <Stat icon={Activity} label="Skills" value={overview.skills} />
          <Stat icon={ChevronDown} label="Exchanges" value={overview.exchanges} />
          <Stat icon={CircleAlert} label="Open reports" value={overview.openReports} />
        </div>
        <div className="admin-welcome"><div><p className="admin-kicker">SKILLSWAP OVERVIEW</p><h2>Manage your community from one place.</h2><p>Users, skills, exchanges and reports are connected to the existing SkillSwap backend.</p></div><ShieldCheck size={64} /></div>
        <div className="admin-quick-grid">{[['users','Manage users','Verify, hide, restrict or delete accounts.'],['skills','Manage skills','Review community skill listings.'],['exchanges','Manage exchanges','Update exchange status.'],['reports','Moderate reports','Review and resolve submitted reports.']].map(([id,t,d]) => <button key={id} onClick={() => setSection(id)}><strong>{t}</strong><span>{d}</span></button>)}</div>
      </div>}

      {section === 'users' && <div className="admin-content"><div className="admin-table-wrap"><table><thead><tr><th>User</th><th>Location</th><th>Verified</th><th>Profile</th><th>Messages</th><th>Joined</th><th>Actions</th></tr></thead><tbody>{filteredUsers.map(user => <tr key={user._id || user.email}><td><div className="admin-user"><span>{(user.name || 'U').slice(0,2).toUpperCase()}</span><div><b>{user.name || 'Unnamed'}</b><small>{user.email}</small></div></div></td><td>{user.location || '—'}</td><td><em className={user.emailVerified || user.verified ? 'pill ok' : 'pill'}>{user.emailVerified || user.verified ? 'Yes' : 'No'}</em></td><td>{user.profileVisible === false ? 'Hidden' : 'Visible'}</td><td>{user.allowMessages === false ? 'Blocked' : 'Allowed'}</td><td>{formatDate(user.createdAt)}</td><td><div className="admin-row-actions"><button onClick={() => toggleUser(user,'verified')}>{user.emailVerified || user.verified ? 'Unverify' : 'Verify'}</button><button onClick={() => toggleUser(user,'profileVisible')}>{user.profileVisible === false ? 'Show' : 'Hide'}</button><button onClick={() => toggleUser(user,'allowMessages')}>{user.allowMessages === false ? 'Allow' : 'Block'}</button><button className="danger" onClick={() => removeUser(user)}><Trash2 size={14}/></button></div></td></tr>)}{!filteredUsers.length && <tr><td colSpan="7" className="admin-empty">No users found.</td></tr>}</tbody></table></div></div>}

      {section === 'skills' && <div className="admin-content"><div className="admin-table-wrap"><table><thead><tr><th>Skill</th><th>Category</th><th>Level</th><th>Teacher</th><th>Created</th><th></th></tr></thead><tbody>{filteredSkills.map(skill => <tr key={skill._id}><td><b>{skill.title}</b><small>{skill.description || '—'}</small></td><td>{skill.category || '—'}</td><td>{skill.level || '—'}</td><td>{skill.teacher?.name || '—'}</td><td>{formatDate(skill.createdAt)}</td><td><button className="icon-danger" onClick={() => removeSkill(skill)}><Trash2 size={15}/></button></td></tr>)}{!filteredSkills.length && <tr><td colSpan="6" className="admin-empty">No skills found.</td></tr>}</tbody></table></div></div>}

      {section === 'reports' && <div className="admin-content"><div className="admin-table-wrap"><table><thead><tr><th>Reported user</th><th>Reporter</th><th>Reason</th><th>Details</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>{filteredReports.map(report => <tr key={report._id}><td>{report.reportedEmail}</td><td>{report.reporterEmail}</td><td><b>{report.reason}</b></td><td>{report.details || '—'}</td><td><em className={report.status === 'resolved' ? 'pill ok' : 'pill'}>{report.status}</em></td><td>{formatDate(report.createdAt)}</td><td><div className="admin-row-actions">{report.status !== 'resolved' && <button onClick={() => setReportStatus(report,'resolved')}>Resolve</button>}<button onClick={() => setReportStatus(report,'dismissed')}>Dismiss</button></div></td></tr>)}{!filteredReports.length && <tr><td colSpan="7" className="admin-empty">No reports found.</td></tr>}</tbody></table></div></div>}

      {section === 'exchanges' && <div className="admin-content"><div className="admin-table-wrap"><table><thead><tr><th>People</th><th>Skill</th><th>Offer</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>{filteredExchanges.map(exchange => <tr key={exchange._id}><td><b>{exchange.requesterName || exchange.requesterEmail}</b><small>↔ {exchange.ownerName || exchange.ownerEmail}</small></td><td>{exchange.skillTitle || '—'}</td><td>{exchange.offer || '—'}</td><td><select value={exchange.status || 'pending'} onChange={e => setExchangeStatus(exchange,e.target.value)}><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option><option value="completed">Completed</option></select></td><td>{formatDate(exchange.createdAt)}</td><td></td></tr>)}{!filteredExchanges.length && <tr><td colSpan="6" className="admin-empty">No exchanges found.</td></tr>}</tbody></table></div></div>}
    </main>
  </div>;
}
