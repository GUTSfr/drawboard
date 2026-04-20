import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from './ToastProvider.jsx';
import Canvas from './Canvas.jsx';
import PermissionsModal from './PermissionsModal.jsx';

const API = '';
const WS_URL = window.location.protocol === 'https:'
  ? `wss://${window.location.host}`
  : `ws://${window.location.host}`;

const TOOLS = [
  { id: 'pen', icon: '✏', label: 'Pen' },
  { id: 'line', icon: '╱', label: 'Line' },
  { id: 'rect', icon: '▭', label: 'Rectangle' },
  { id: 'circle', icon: '○', label: 'Circle' },
  { id: 'text', icon: 'T', label: 'Text' },
  { id: 'eraser', icon: '◻', label: 'Eraser' },
  { id: 'select', icon: '⊹', label: 'Select' },
];

const COLORS = [
  '#f0f0f5','#6c63ff','#ff6b6b','#43e97b','#f9ca24',
  '#ff9f43','#48dbfb','#ff9ff3','#a29bfe','#fd79a8',
  '#00cec9','#fdcb6e','#e17055','#74b9ff','#55efc4',
  '#2d3436',
];

const WIDTHS = [2, 4, 8, 16];

export default function BoardEditor({ boardId, nick, nickColor, onBack }) {
  const toast = useToast();
  const [board, setBoard] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentPageId, setCurrentPageId] = useState(null);
  const [elements, setElements] = useState({});   // pageId -> elements[]
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#f0f0f5');
  const [width, setWidth] = useState(4);
  const [users, setUsers] = useState([]);
  const [role, setRole] = useState('editor');
  const [showPerms, setShowPerms] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  // Load board
  useEffect(() => {
    fetch(`${API}/api/boards/${boardId}`)
      .then(r => r.json())
      .then(data => {
        setBoard(data);
        setPages(data.pages || []);
        if (data.pages?.length) setCurrentPageId(data.pages[0].id);
        // Determine role
        if (data.permissions[nick]) setRole(data.permissions[nick]);
        else if (data.isPublic) setRole('editor');
        else setRole(null);
      })
      .catch(() => toast('Failed to load board', 'error'));
  }, [boardId, nick]);

  // Load elements for page
  useEffect(() => {
    if (!currentPageId) return;
    if (elements[currentPageId]) return;
    fetch(`${API}/api/pages/${currentPageId}/elements`)
      .then(r => r.json())
      .then(data => setElements(e => ({ ...e, [currentPageId]: data })))
      .catch(() => {});
  }, [currentPageId]);

  // WebSocket
  const connectWS = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsReady(true);
      ws.send(JSON.stringify({ type: 'join', boardId, nick, color: nickColor }));
      clearInterval(reconnectRef.current);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'presence':
          setUsers(msg.users);
          break;
        case 'draw_element':
          setElements(prev => {
            const arr = prev[msg.element.pageId] || [];
            const idx = arr.findIndex(el => el.id === msg.element.id);
            if (idx >= 0) {
              const newArr = [...arr];
              newArr[idx] = msg.element;
              return { ...prev, [msg.element.pageId]: newArr };
            }
            return { ...prev, [msg.element.pageId]: [...arr, msg.element] };
          });
          break;
        case 'delete_element':
          setElements(prev => ({
            ...prev,
            [msg.pageId]: (prev[msg.pageId] || []).filter(el => el.id !== msg.elementId),
          }));
          break;
        case 'clear_page':
          setElements(prev => ({ ...prev, [msg.pageId]: [] }));
          break;
        case 'page_added':
          setPages(p => [...p, msg.page]);
          setElements(e => ({ ...e, [msg.page.id]: [] }));
          break;
        case 'page_removed':
          setPages(p => p.filter(x => x.id !== msg.pageId));
          setElements(e => { const c = { ...e }; delete c[msg.pageId]; return c; });
          setCurrentPageId(prev => prev === msg.pageId ? null : prev);
          break;
        case 'permissions_updated':
          if (msg.permissions[nick]) setRole(msg.permissions[nick]);
          break;
      }
    };

    ws.onclose = () => {
      setWsReady(false);
      reconnectRef.current = setTimeout(connectWS, 3000);
    };

    ws.onerror = () => ws.close();
  }, [boardId, nick, nickColor]);

  useEffect(() => {
    connectWS();
    return () => {
      clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  // Fix currentPageId when pages load
  useEffect(() => {
    if (!currentPageId && pages.length > 0) setCurrentPageId(pages[0].id);
  }, [pages, currentPageId]);

  const sendWS = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const sendCursor = useCallback((cursor) => {
    sendWS({ type: 'cursor', cursor });
  }, [sendWS]);

  // Add element (from canvas)
  const addElement = useCallback((element) => {
    const el = { ...element, pageId: currentPageId, nick, color: nickColor };
    setElements(prev => {
      const arr = prev[currentPageId] || [];
      const idx = arr.findIndex(e => e.id === el.id);
      if (idx >= 0) {
        const newArr = [...arr];
        newArr[idx] = el;
        return { ...prev, [currentPageId]: newArr };
      }
      return { ...prev, [currentPageId]: [...arr, el] };
    });
    sendWS({ type: 'draw_element', element: el });
  }, [currentPageId, nick, nickColor, sendWS]);

  // Delete element
  const deleteElement = useCallback((elementId) => {
    setElements(prev => ({
      ...prev,
      [currentPageId]: (prev[currentPageId] || []).filter(e => e.id !== elementId),
    }));
    sendWS({ type: 'delete_element', pageId: currentPageId, elementId });
  }, [currentPageId, sendWS]);

  // Add page
  const addPage = async () => {
    try {
      const r = await fetch(`${API}/api/boards/${boardId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick }),
      });
      if (!r.ok) throw new Error();
      const page = await r.json();
      setPages(p => [...p, page]);
      setElements(e => ({ ...e, [page.id]: [] }));
      setCurrentPageId(page.id);
    } catch { toast('Failed to add page', 'error'); }
  };

  // Delete page
  const deletePage = async (pageId) => {
    if (pages.length <= 1) { toast('Cannot delete last page', 'error'); return; }
    if (!confirm('Delete this page?')) return;
    try {
      const r = await fetch(`${API}/api/boards/${boardId}/pages/${pageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick }),
      });
      if (!r.ok) throw new Error();
      const remaining = pages.filter(p => p.id !== pageId);
      setPages(remaining);
      if (currentPageId === pageId) setCurrentPageId(remaining[0]?.id || null);
    } catch { toast('Cannot delete page (insufficient permissions)', 'error'); }
  };

  // Export JPEG
  const exportJPEG = useCallback(async () => {
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${board?.name || 'drawboard'}-page.jpg`;
    a.click();
    toast('Exported!', 'success');
  }, [board]);

  // Save thumbnail
  const saveThumbnail = useCallback(() => {
    const canvas = document.getElementById('main-canvas');
    if (!canvas) return;
    const thumb = canvas.toDataURL('image/jpeg', 0.3);
    fetch(`${API}/api/boards/${boardId}/thumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thumbnail: thumb }),
    }).catch(() => {});
  }, [boardId]);

  // Auto save thumbnail every 30s
  useEffect(() => {
    const t = setInterval(saveThumbnail, 30000);
    return () => clearInterval(t);
  }, [saveThumbnail]);

  const canEdit = role === 'owner' || role === 'editor';
  const canManagePages = role === 'owner';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
        height: 52, borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0, zIndex: 100,
      }}>
        <button className="btn btn-ghost btn-sm btn-icon" onClick={onBack} title="Back to boards">
          ←
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{board?.name || '...'}</span>
          {/* WS status */}
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: wsReady ? 'var(--accent3)' : 'var(--accent2)',
            boxShadow: wsReady ? '0 0 6px var(--accent3)' : 'none',
          }} title={wsReady ? 'Connected' : 'Connecting...'} />
        </div>

        {/* Users online */}
        <div style={{ display: 'flex', alignItems: 'center', gap: -4, marginLeft: 4 }}>
          {users.slice(0, 6).map((u, i) => (
            <div key={u.nick} title={u.nick} style={{
              width: 26, height: 26, borderRadius: 6,
              background: u.color,
              border: '2px solid var(--surface)',
              marginLeft: i > 0 ? -6 : 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
              zIndex: users.length - i,
            }}>
              {u.nick[0].toUpperCase()}
            </div>
          ))}
          {users.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 8 }}>
              {users.length} online
            </span>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {role === 'owner' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowPerms(true)}>
              👥 Permissions
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={exportJPEG}>
            ↓ Export JPEG
          </button>
          {!canEdit && (
            <span className="badge badge-viewer">View only</span>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Toolbar */}
        {canEdit && (
          <div style={{
            width: 64, background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', padding: '12px 0',
            gap: 4, flexShrink: 0, overflowY: 'auto',
          }}>
            {/* Tools */}
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)}
                title={t.label}
                style={{
                  width: 42, height: 42, borderRadius: 8, border: 'none',
                  background: tool === t.id ? 'var(--accent)' : 'transparent',
                  color: tool === t.id ? '#fff' : 'var(--text2)',
                  cursor: 'pointer', fontSize: t.id === 'text' ? 16 : 18,
                  fontWeight: 700, transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => { if (tool !== t.id) e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { if (tool !== t.id) e.currentTarget.style.background = 'transparent'; }}
              >
                {t.icon}
              </button>
            ))}

            <div style={{ width: 32, height: 1, background: 'var(--border)', margin: '8px 0' }} />

            {/* Colors */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '0 8px' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setColor(c)}
                  style={{
                    width: 20, height: 20, borderRadius: 4,
                    background: c, cursor: 'pointer',
                    border: color === c ? '2px solid white' : '2px solid transparent',
                    transition: 'transform 0.1s',
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>

            <div style={{ width: 32, height: 1, background: 'var(--border)', margin: '8px 0' }} />

            {/* Widths */}
            {WIDTHS.map(w => (
              <div key={w} onClick={() => setWidth(w)}
                style={{
                  width: 42, height: 30, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', borderRadius: 6,
                  background: width === w ? 'var(--surface2)' : 'transparent',
                }}
              >
                <div style={{
                  height: w > 8 ? 8 : w, width: 28, borderRadius: 2,
                  background: width === w ? color : 'var(--text2)',
                }} />
              </div>
            ))}

            {/* Current color preview */}
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: color, marginTop: 4,
              border: '2px solid var(--border2)',
            }} />
          </div>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {currentPageId && (
            <Canvas
              key={currentPageId}
              pageId={currentPageId}
              elements={elements[currentPageId] || []}
              tool={canEdit ? tool : 'select'}
              color={color}
              width={width}
              nick={nick}
              users={users}
              onAddElement={addElement}
              onDeleteElement={deleteElement}
              onCursorMove={sendCursor}
            />
          )}
        </div>
      </div>

      {/* Pages Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderTop: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
        overflowX: 'auto', minHeight: 52,
      }}>
        {pages.map((page, idx) => (
          <div key={page.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 6,
              background: currentPageId === page.id ? 'var(--accent)' : 'var(--surface2)',
              border: `1px solid ${currentPageId === page.id ? 'var(--accent)' : 'var(--border)'}`,
              cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
              fontSize: 13, fontWeight: currentPageId === page.id ? 700 : 500,
            }}
            onClick={() => setCurrentPageId(page.id)}
          >
            <span style={{ fontSize: 11, opacity: 0.7 }}>{idx + 1}</span>
            <span>{page.name}</span>
            {canManagePages && pages.length > 1 && (
              <span
                onClick={e => { e.stopPropagation(); deletePage(page.id); }}
                style={{ fontSize: 12, opacity: 0.5, marginLeft: 2, lineHeight: 1 }}
                title="Delete page"
              >✕</span>
            )}
          </div>
        ))}
        {canEdit && (
          <button
            onClick={addPage}
            style={{
              padding: '5px 12px', borderRadius: 6,
              background: 'transparent', border: '1px dashed var(--border2)',
              color: 'var(--text3)', cursor: 'pointer', fontSize: 13,
              flexShrink: 0, transition: 'all 0.15s', fontFamily: 'Syne, sans-serif',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)'; }}
          >
            + Page
          </button>
        )}
      </div>

      {/* Permissions Modal */}
      {showPerms && (
        <PermissionsModal
          boardId={boardId}
          nick={nick}
          onClose={() => setShowPerms(false)}
        />
      )}
    </div>
  );
}
