import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { chatFromMessages, conversationsFromMessages } from './App';

const skills = [{
  _id: 'skill-1',
  title: 'HTML foundations',
  category: 'Technology',
  level: 'Beginner friendly',
  format: 'Video call',
  description: 'Learn semantic HTML.',
  teacher: { name: 'Ishita Sen', role: 'Frontend developer', avatar: 'IS', rating: 4.9 },
  wants: 'I want to learn JavaScript',
  color: '#dbe8de'
}];

describe('SkillSwap app', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, headers: { get: () => 'application/json' }, json: () => Promise.resolve(skills) })));
  });

  function signInDemoUser() {
    localStorage.setItem('skillswap-user', JSON.stringify({ _id: 'user-1', name: 'Demo member', email: 'demo@example.com', teaches: ['HTML'], wants: ['JavaScript'] }));
  }

  it('requires authentication before showing the exchange board', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Log in to SkillSwap/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /the exchange board/i })).not.toBeInTheDocument();
  });

  it('renders the exchange board and loaded skill', async () => {
    signInDemoUser();
    render(<App />);
    expect(screen.getByRole('heading', { name: /Trade what you know/i })).toBeInTheDocument();
    expect((await screen.findAllByText('HTML foundations')).length).toBeGreaterThan(0);
  });

  it('exposes accessible theme and back-to-top controls', async () => {
    signInDemoUser();
    render(<App />);
    await screen.findAllByText('HTML foundations');
    expect(screen.getByRole('button', { name: /Switch to dark mode|Switch to light mode/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to top' })).toBeInTheDocument();
  });

  it('keeps persisted chats grouped and unread across sessions', () => {
    const messages = [
      { _id: 'm-1', senderEmail: 'me@skillswap.test', recipientEmail: 'them@skillswap.test', recipientName: 'Jordan', senderName: 'You', message: 'Hi there', read: true, createdAt: '2024-01-01T09:00:00.000Z' },
      { _id: 'm-2', senderEmail: 'them@skillswap.test', recipientEmail: 'me@skillswap.test', recipientName: 'You', senderName: 'Jordan', message: 'Hello!', read: false, createdAt: '2024-01-01T09:05:00.000Z' }
    ];

    const grouped = chatFromMessages(messages, 'me@skillswap.test');
    const conversations = conversationsFromMessages(messages, 'me@skillswap.test');

    expect(grouped['them@skillswap.test']).toHaveLength(2);
    expect(conversations[0]).toMatchObject({ email: 'them@skillswap.test', name: 'Jordan', unread: true });
  });

  it('shows searchable skill dropdowns in the signup form', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /sign up/i }));

    expect(screen.getByRole('button', { name: /^Sign up$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /what can you teach/i }));
    expect(screen.getByLabelText(/search what can you teach/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /what do you want to learn/i }));
    expect(screen.getByLabelText(/search what do you want to learn/i)).toBeInTheDocument();
  });

  it('opens a dedicated owner sign-in flow before showing the dashboard', async () => {
    signInDemoUser();
    vi.stubGlobal('fetch', vi.fn((url, options = {}) => {
      if (String(url).includes('/admin/users')) {
        return Promise.resolve({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve([
            { _id: 'u-1', name: 'Owner', email: 'owner@example.com', teaches: ['React'], wants: ['Design'], location: 'Delhi', verified: true, emailVerified: true, createdAt: '2024-01-01T00:00:00.000Z' },
            { _id: 'u-2', name: 'Member', email: 'member@example.com', teaches: ['Node'], wants: ['UI'], location: 'Mumbai', verified: false, emailVerified: false, createdAt: '2024-01-02T00:00:00.000Z' }
          ])
        });
      }
      return Promise.resolve({ ok: true, headers: { get: () => 'application/json' }, json: () => Promise.resolve(skills) });
    }));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /DE Demo member/i }));
    fireEvent.click(screen.getByRole('button', { name: /Owner login/i }));
    const keyInput = screen.getByLabelText(/admin key/i);
    fireEvent.change(keyInput, { target: { value: 'owner-secret' } });
    fireEvent.click(screen.getByRole('button', { name: /open owner dashboard/i }));

    expect(await screen.findByText('owner@example.com')).toBeInTheDocument();
    expect(screen.queryByText(/Message this member/i)).not.toBeInTheDocument();
  });
});
