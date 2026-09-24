const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

function authHeaders(headers = {}) {
  const token = localStorage.getItem('skillswap-session-token') || '';
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers;
}

function fetchWithAuth(url, options = {}) {
  return fetch(url, { ...options, headers: authHeaders(options.headers || {}) });
}

function storeSessionToken(data) {
  if (data?.sessionToken) localStorage.setItem('skillswap-session-token', data.sessionToken);
  return data;
}


async function readResponse(response, fallbackMessage) {
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(data?.message || `${fallbackMessage} (${response.status})`);
  if (!data) throw new Error(`${fallbackMessage} returned an invalid response.`);
  return data;
}

export async function getPlatformStatus() {
  const response = await fetchWithAuth(`${API_URL}/platform/status`);
  return readResponse(response, 'Could not load platform status');
}

export async function getSkills(filters = {}) {
  const params = new URLSearchParams(filters);
  const response = await fetchWithAuth(`${API_URL}/skills?${params}`);
  const data = await readResponse(response, 'Could not load skills');
  return Array.isArray(data) ? { items: data, page: 1, total: data.length, hasMore: false } : data;
}

export async function getPeople(filters = {}) { const params = new URLSearchParams(filters); const response = await fetchWithAuth(`${API_URL}/profiles?${params}`); return readResponse(response, 'Could not load people'); }

export async function getAdminUsers(adminSession) {
  const response = await fetchWithAuth(`${API_URL}/admin/users`, { headers: { 'x-admin-session': adminSession || '' } });
  return readResponse(response, 'Could not load admin users');
}

export async function updateAdminUser(adminSession, id, profile) {
  const response = await fetchWithAuth(`${API_URL}/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-session': adminSession || '' },
    body: JSON.stringify(profile)
  });
  return readResponse(response, 'Could not update user');
}

export async function sendAdminVerification(adminSession, id) {
  const response = await fetchWithAuth(`${API_URL}/admin/users/${encodeURIComponent(id)}/send-verification`, {
    method: 'POST',
    headers: { 'x-admin-session': adminSession || '' }
  });
  return readResponse(response, 'Could not send verification');
}

export async function getAdminUserActivity(adminSession, id) { const response = await fetchWithAuth(`${API_URL}/admin/users/${encodeURIComponent(id)}/activity`, { headers: { 'x-admin-session': adminSession || '' } }); return readResponse(response, 'Could not load user activity'); }
export async function deleteAdminUser(adminSession, id) {
  const response = await fetchWithAuth(`${API_URL}/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-admin-session': adminSession || '' }
  });
  return readResponse(response, 'Could not delete user');
}

export async function createProfile(profile) {
  try {
    const response = await fetchWithAuth(`${API_URL}/profiles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
    return await readResponse(response, 'Could not create profile');
  } catch (error) {
    if (error instanceof TypeError) throw new Error('Account server is unreachable. Check the deployed API URL and CORS settings.');
    throw error;
  }
}

export async function loginProfile(credentials) {
  const response = await fetchWithAuth(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
  const data = await readResponse(response, 'Could not log in');
  return storeSessionToken(data);
}

export async function verifyEmail(token) {
  const response = await fetchWithAuth(`${API_URL}/auth/verify-email`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
  return readResponse(response, 'Could not verify email');
}

export async function updateProfile(id, profile) {
  const lookups = [...new Set([id, profile.email].filter(Boolean))];
  if (!lookups.length) throw new Error('Your session is missing a profile identity. Please log in again.');
  let lastError = 'Profile service is unavailable. Please try again.';
  for (const lookup of lookups) {
    try {
      const response = await fetchWithAuth(`${API_URL}/profiles/${encodeURIComponent(lookup)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) });
      try { return storeSessionToken(await readResponse(response, 'Profile service unavailable')); } catch (error) { lastError = error.message; }
    } catch (error) {
      lastError = error.message || lastError;
    }
  }
  throw new Error(lastError);
}

export async function sendMessage(message) {
  const response = await fetchWithAuth(`${API_URL}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
  return readResponse(response, 'Could not send message');
}

export async function getMessages(email) { const response = await fetchWithAuth(`${API_URL}/messages/${encodeURIComponent(email)}`); return readResponse(response, 'Could not load messages'); }
export async function markMessageRead(id) { const response = await fetchWithAuth(`${API_URL}/messages/${id}/read`, { method: 'PATCH' }); return readResponse(response, 'Could not mark message read'); }
export async function getNotifications(email) { const response = await fetchWithAuth(`${API_URL}/notifications/${encodeURIComponent(email)}`); return readResponse(response, 'Could not load notifications'); }
export async function markNotificationsRead(email) { const response = await fetchWithAuth(`${API_URL}/notifications/${encodeURIComponent(email)}/read`, { method: 'PATCH' }); return readResponse(response, 'Could not mark notifications read'); }
export async function createExchange(exchange) { const response = await fetchWithAuth(`${API_URL}/exchanges`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(exchange) }); return readResponse(response, 'Could not create exchange'); }
export async function getExchanges(email) { const response = await fetchWithAuth(`${API_URL}/exchanges/${encodeURIComponent(email)}`); return readResponse(response, 'Could not load exchanges'); }
export async function updateExchange(id, status) { const response = await fetchWithAuth(`${API_URL}/exchanges/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }); return readResponse(response, 'Could not update exchange'); }
export async function scheduleExchange(id, scheduledAt, meetingLink) { const response = await fetchWithAuth(`${API_URL}/exchanges/${id}/schedule`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduledAt, meetingLink }) }); return readResponse(response, 'Could not schedule exchange'); }
export async function submitReview(review) { const response = await fetchWithAuth(`${API_URL}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review) }); return readResponse(response, 'Could not submit review'); }
export async function getPublicProfile(email) { const response = await fetchWithAuth(`${API_URL}/profiles/${encodeURIComponent(email)}/public`); return readResponse(response, 'Could not load profile'); }
export async function getRecommendations(email) { const response = await fetchWithAuth(`${API_URL}/recommendations/${encodeURIComponent(email)}`); return readResponse(response, 'Could not load recommendations'); }
export async function getSimilarUsers(email) { const response = await fetchWithAuth(`${API_URL}/profiles/${encodeURIComponent(email)}/similar`); return readResponse(response, 'Could not load similar users'); }
export async function changePassword(payload) { const response = await fetchWithAuth(`${API_URL}/auth/change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); return readResponse(response, 'Could not change password'); }
export async function forgotPassword(email) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetchWithAuth(`${API_URL}/auth/forgot-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }), signal: controller.signal });
    return await readResponse(response, 'Could not start password reset');
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Email service took too long to respond. Please try again later.');
    if (error instanceof TypeError) throw new Error('Account server is unreachable. Check the deployed API URL and CORS settings.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
export async function resetPassword(payload) { const response = await fetchWithAuth(`${API_URL}/auth/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); return readResponse(response, 'Could not reset password'); }
export async function sendVerification(email) { const response = await fetchWithAuth(`${API_URL}/auth/send-verification`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); return readResponse(response, 'Could not send verification'); }
export async function deleteAccount(email) { const response = await fetchWithAuth(`${API_URL}/profiles/${encodeURIComponent(email)}`, { method: 'DELETE' }); return readResponse(response, 'Could not delete account'); }
export async function reportUser(payload) { const response = await fetchWithAuth(`${API_URL}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); return readResponse(response, 'Could not submit report'); }
export async function blockUser(payload) { const response = await fetchWithAuth(`${API_URL}/blocks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); return readResponse(response, 'Could not block user'); }
export async function getSkillMatches(email) { const response = await fetchWithAuth(`${API_URL}/matching/${encodeURIComponent(email)}`); return readResponse(response, 'Could not load skill matches'); }
export async function updatePortfolio(id, payload) { const response = await fetchWithAuth(`${API_URL}/profiles/${encodeURIComponent(id)}/portfolio`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); return readResponse(response, 'Could not save portfolio'); }
export async function getLeaderboard() { const response = await fetchWithAuth(`${API_URL}/leaderboard`); return readResponse(response, 'Could not load leaderboard'); }
export async function getGroups() { const response = await fetchWithAuth(`${API_URL}/groups`); return readResponse(response, 'Could not load groups'); }
export async function joinGroup(id) { const response = await fetchWithAuth(`${API_URL}/groups/${id}/join`, { method: 'POST' }); return readResponse(response, 'Could not join group'); }
export async function createVideoRoom() { const response = await fetchWithAuth(`${API_URL}/video-rooms`, { method: 'POST' }); return readResponse(response, 'Could not create video room'); }

export async function adminLogin(adminKey) {
  const response = await fetchWithAuth(`${API_URL}/admin/auth`, { method: 'POST', headers: { 'x-admin-key': adminKey || '' } });
  return readResponse(response, 'Admin login failed');
}
export async function getAdminLogs(adminSession) { const response = await fetchWithAuth(`${API_URL}/admin/logs`, { headers: { 'x-admin-session': adminSession || '' } }); return readResponse(response, 'Could not load admin logs'); }
export async function adminLogout(adminSession) { const response = await fetchWithAuth(`${API_URL}/admin/logout`, { method: 'POST', headers: { 'x-admin-session': adminSession || '' } }); return readResponse(response, 'Could not record admin logout'); }
export async function getAdminNotifications(adminSession) {
  const response = await fetchWithAuth(`${API_URL}/admin/notifications`, { headers: { 'x-admin-session': adminSession || '' } });
  return readResponse(response, 'Could not load admin notifications');
}

export async function getAdminSettings(adminSession) {
  const response = await fetchWithAuth(`${API_URL}/admin/settings`, { headers: { 'x-admin-session': adminSession || '' } });
  return readResponse(response, 'Could not load admin settings');
}

export async function updateAdminSettings(adminSession, settings) {
  const response = await fetchWithAuth(`${API_URL}/admin/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-session': adminSession || '' },
    body: JSON.stringify(settings)
  });
  return readResponse(response, 'Could not save admin settings');
}

export async function getAdminOverview(adminSession) {
  const response = await fetchWithAuth(`${API_URL}/admin/overview`, { headers: { 'x-admin-session': adminSession || '' } });
  return readResponse(response, 'Could not load admin overview');
}
export async function getAdminAnalytics(adminSession) {
  const response = await fetchWithAuth(`${API_URL}/admin/analytics`, { headers: { 'x-admin-session': adminSession || '' } });
  return readResponse(response, 'Could not load admin analytics');
}
export async function getAdminSkills(adminSession) {
  const response = await fetchWithAuth(`${API_URL}/admin/skills`, { headers: { 'x-admin-session': adminSession || '' } });
  return readResponse(response, 'Could not load admin skills');
}
export async function updateAdminSkillModeration(adminSession, id, payload) { const response = await fetchWithAuth(`${API_URL}/admin/skills/${encodeURIComponent(id)}/moderation`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-session': adminSession || '' }, body: JSON.stringify(payload) }); return readResponse(response, 'Could not update skill moderation'); }
export async function getAdminSkillCategories(adminSession) { const response = await fetchWithAuth(`${API_URL}/admin/skill-categories`, { headers: { 'x-admin-session': adminSession || '' } }); return readResponse(response, 'Could not load skill categories'); }
export async function addAdminSkillCategory(adminSession, name) { const response = await fetchWithAuth(`${API_URL}/admin/skill-categories`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-session': adminSession || '' }, body: JSON.stringify({ name }) }); return readResponse(response, 'Could not add skill category'); }
export async function deleteAdminSkillCategory(adminSession, name) { const response = await fetchWithAuth(`${API_URL}/admin/skill-categories/${encodeURIComponent(name)}`, { method: 'DELETE', headers: { 'x-admin-session': adminSession || '' } }); return readResponse(response, 'Could not delete skill category'); }
export async function getAdminSkillStatistics(adminSession) { const response = await fetchWithAuth(`${API_URL}/admin/skill-statistics`, { headers: { 'x-admin-session': adminSession || '' } }); return readResponse(response, 'Could not load skill statistics'); }
export async function deleteAdminSkill(adminSession, id) {
  const response = await fetchWithAuth(`${API_URL}/admin/skills/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { 'x-admin-session': adminSession || '' } });
  return readResponse(response, 'Could not delete skill');
}
export async function getAdminReports(adminSession) {
  const response = await fetchWithAuth(`${API_URL}/admin/reports`, { headers: { 'x-admin-session': adminSession || '' } });
  return readResponse(response, 'Could not load reports');
}
export async function updateAdminReport(adminSession, id, payload) {
  const body = typeof payload === 'string' ? { status: payload } : payload;
  const response = await fetchWithAuth(`${API_URL}/admin/reports/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-session': adminSession || '' }, body: JSON.stringify(body) });
  return readResponse(response, 'Could not update report');
}
export async function getAdminExchanges(adminSession) {
  const response = await fetchWithAuth(`${API_URL}/admin/exchanges`, { headers: { 'x-admin-session': adminSession || '' } });
  return readResponse(response, 'Could not load exchanges');
}
export async function updateAdminExchange(adminSession, id, status) {
  const response = await fetchWithAuth(`${API_URL}/admin/exchanges/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-session': adminSession || '' }, body: JSON.stringify({ status }) });
  return readResponse(response, 'Could not update exchange');
}
