import React, { useState, useEffect } from 'react';
import { useToast } from './ToastProvider.jsx';

const API = '';
const ROLES = ['owner', 'editor', 'viewer'];

export default function PermissionsModal({ boardId, nick, onClose }) {
  const toast = useToast();
  const [perms, setPerms] = useState({});
  const [newNick, setNewNick] = useState('');
  const [newRole, setNewRole] = useState('editor');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/api/boards/${boardId}/permissions`)
      .then(r => r.json())
      .then(data => { setPerms(data); setLoading(false); })
      .catch(() => toast('Failed to load permissions', 'error'));
  }, [boardId]);

  const setRole = async (targetNick, role) => {
    try {
      const r = await fetch(`${API}/api/boards/${boardId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick, targetNick, role }),
      });
      const data = await r.json();
      setPerms(data);
      toast('Permission updated', 'success');
    } catch { toast('Failed', 'error'); }
  };

  const removeUser = async (targetNick) => {
    if (targetNick === nick) { toast('Cannot remove yourself', 'error'); return; }
    try {
      const r = await fetch(`${API}/api/boards/${boardId}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick, targetNick, role: null }),
      });
      const data = await r.json();
      setPerms(data);
      toast('User removed', 'info');
    } catch { toast('Failed', 'error'); }
  };

  const addUser = () => {
    const n = newNick.trim();
    if (!n) return;
    setRole(n, newRole);
    setNewNick('');
  };

  const roleBadgeClass = (r) => {
    if (r === 'owner') return 'badge badge-owner';
    if (r === 'editor') return 'badge badge-editor';
    return 'badge badge-viewer';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(520px, 95vw)' }}>
        <h2>Board Permissions</h2>
        <p>Control who can view and edit this board</p>

        {loading ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 24 }}>Loading...</div>
        ) : (
          <>
            {/* Current users */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {Object.entries(perms).map(([user, role]) => (
                <div key={user} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  background: 'var(--surface2)',
                  borderRadius: 8, border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 7,
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0,
                  }}>
                    {user[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{user}</div>
                  </div>
                  <span className={roleBadgeClass(role)}>{role}</span>
                  {user !== nick && (
                    <>
                      <select
                        value={role}
                        onChange={e => setRole(user, e.target.value)}
                        style={{
                          background: 'var(--surface3)', border: '1px solid var(--border)',
                          color: 'var(--text)', borderRadius: 6, padding: '4px 8px',
                          fontSize: 12, cursor: 'pointer', fontFamily: 'Syne, sans-serif',
                        }}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button
                        onClick={() => removeUser(user)}
                        style={{
                          background: 'rgba(255,107,107,0.15)',
                          border: '1px solid rgba(255,107,107,0.3)',
                          color: 'var(--accent2)', borderRadius: 6,
                          padding: '4px 8px', cursor: 'pointer', fontSize: 12,
                        }}
                      >Remove</button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add user */}
            <div style={{
              background: 'var(--surface2)', borderRadius: 10,
              padding: 16, border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Add User
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Nickname..."
                  value={newNick}
                  onChange={e => setNewNick(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addUser()}
                  style={{ flex: 1 }}
                />
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  style={{
                    background: 'var(--surface3)', border: '1px solid var(--border)',
                    color: 'var(--text)', borderRadius: 6, padding: '0 10px',
                    fontFamily: 'Syne, sans-serif', cursor: 'pointer',
                  }}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={addUser}>Add</button>
              </div>
            </div>

            {/* Info */}
            <div style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)',
              fontSize: 12, color: 'var(--text2)', lineHeight: 1.6,
            }}>
              <strong style={{ color: 'var(--accent)' }}>owner</strong> — full control ·{' '}
              <strong style={{ color: 'var(--accent3)' }}>editor</strong> — can draw ·{' '}
              <strong style={{ color: 'var(--text2)' }}>viewer</strong> — read only
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
