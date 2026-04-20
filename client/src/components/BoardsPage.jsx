import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastProvider.jsx';

const API = '';

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function BoardsPage({ nick, nickColor, onOpenBoard, onLogout }) {
  const toast = useToast();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const fetchBoards = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/boards`);
      const data = await r.json();
      setBoards(data);
    } catch {
      toast('Failed to load boards', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBoards();
    const interval = setInterval(fetchBoards, 10000);
    return () => clearInterval(interval);
  }, [fetchBoards]);

  const createBoard = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, nick }),
      });
      const board = await r.json();
      setBoards(b => [{ ...board, pageCount: 1, thumbnail: null }, ...b]);
      setShowCreate(false);
      setNewName('');
      toast('Board created!', 'success');
      onOpenBoard(board.id);
    } catch {
      toast('Failed to create board', 'error');
    } finally {
      setCreating(false);
    }
  };

  const deleteBoard = async (e, boardId) => {
    e.stopPropagation();
    if (!confirm('Delete this board permanently?')) return;
    try {
      await fetch(`${API}/api/boards/${boardId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick }),
      });
      setBoards(b => b.filter(x => x.id !== boardId));
      toast('Board deleted', 'info');
    } catch {
      toast('Failed to delete', 'error');
    }
  };

  const filtered = boards.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.owner.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 24px', height: 60,
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6c63ff, #ff6b6b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 36 36" fill="none">
              <path d="M8 28 Q18 8 28 18 Q20 24 8 28Z" fill="white"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px' }}>
            Draw<span style={{ color: 'var(--accent)' }}>Board</span>
          </span>
        </div>

        <div style={{ position: 'relative', width: 220 }}>
          <input
            type="text"
            placeholder="Search boards..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36, fontSize: 13, height: 36, padding: '0 12px 0 36px' }}
          />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 14 }}>⌕</span>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          + New Board
        </button>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: nickColor, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff',
          }}>
            {nick[0].toUpperCase()}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{nick}</span>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onLogout} title="Change nickname"
            style={{ color: 'var(--text3)', fontSize: 16 }}>⏻</button>
        </div>
      </header>

      {/* Body */}
      <main style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text3)' }}>
            Loading boards...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: 300, gap: 16,
          }}>
            <div style={{ fontSize: 48 }}>✦</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {search ? 'No boards found' : 'No boards yet'}
            </div>
            <div style={{ color: 'var(--text2)', fontSize: 14 }}>
              {search ? 'Try a different search' : 'Create the first board to get started'}
            </div>
            {!search && (
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                + Create Board
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text3)',
              letterSpacing: '1px', textTransform: 'uppercase',
              marginBottom: 16,
            }}>
              {filtered.length} Board{filtered.length !== 1 ? 's' : ''}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16,
            }}>
              {filtered.map(board => (
                <BoardCard
                  key={board.id}
                  board={board}
                  nick={nick}
                  onClick={() => onOpenBoard(board.id)}
                  onDelete={(e) => deleteBoard(e, board.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>New Board</h2>
            <p>Give your collaborative canvas a name</p>
            <input
              type="text"
              placeholder="e.g. Product Roadmap, Design Sprint..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBoard()}
              autoFocus
              maxLength={60}
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createBoard} disabled={creating}>
                {creating ? 'Creating...' : 'Create Board'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BoardCard({ board, nick, onClick, onDelete }) {
  const isOwner = board.owner === nick;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        position: 'relative',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border2)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = 'var(--shadow)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {/* Thumbnail */}
      <div style={{
        height: 140, background: 'var(--surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderBottom: '1px solid var(--border)',
        overflow: 'hidden', position: 'relative',
      }}>
        {board.thumbnail ? (
          <img src={board.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 32, marginBottom: 4,
              background: 'linear-gradient(135deg, #6c63ff, #ff6b6b)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>✦</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>No preview</div>
          </div>
        )}
        {/* Page count badge */}
        <div style={{
          position: 'absolute', top: 8, right: 8,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          borderRadius: 6, padding: '3px 8px',
          fontSize: 11, color: 'var(--text2)', fontWeight: 600,
        }}>
          {board.pageCount} page{board.pageCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, letterSpacing: '-0.3px' }}>
          {board.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
            <span style={{
              width: 18, height: 18, borderRadius: 4,
              background: 'var(--accent)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff',
            }}>
              {board.owner[0].toUpperCase()}
            </span>
            {board.owner}
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(board.createdAt)}</span>
        </div>
      </div>

      {isOwner && (
        <button
          onClick={onDelete}
          style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(255,107,107,0.2)',
            border: '1px solid rgba(255,107,107,0.3)',
            color: 'var(--accent2)',
            width: 26, height: 26, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 12, transition: 'all 0.15s',
            opacity: 0,
          }}
          className="delete-btn"
          title="Delete board"
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0'}
        >✕</button>
      )}
    </div>
  );
}
