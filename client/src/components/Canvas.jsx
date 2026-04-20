import React, { useRef, useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function Canvas({
  pageId, elements, tool, color, width: strokeWidth,
  nick, users, onAddElement, onDeleteElement, onCursorMove,
}) {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [currentEl, setCurrentEl] = useState(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [textInput, setTextInput] = useState(null); // { x, y }
  const [textValue, setTextValue] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const vpRef = useRef(viewport);
  vpRef.current = viewport;

  // ── Canvas size
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Coordinate helpers
  const toWorld = (cx, cy) => {
    const vp = vpRef.current;
    return {
      x: (cx - vp.x) / vp.scale,
      y: (cy - vp.y) / vp.scale,
    };
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { cx, cy, ...toWorld(cx, cy) };
  };

  // ── Render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size.w, size.h);

    // Grid
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.scale, viewport.scale);
    drawGrid(ctx, viewport, size);

    // Elements
    elements.forEach(el => drawElement(ctx, el, el.id === selectedId));

    // Current element being drawn
    if (currentEl) drawElement(ctx, currentEl, false);

    ctx.restore();
  }, [elements, currentEl, viewport, size, selectedId]);

  // ── Remote cursors
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, size.w, size.h);
    users.forEach(u => {
      if (u.nick === nick || !u.cursor) return;
      const sx = u.cursor.x * viewport.scale + viewport.x;
      const sy = u.cursor.y * viewport.scale + viewport.y;
      // Cursor dot
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.fillStyle = u.color || '#6c63ff';
      ctx.fill();
      // Nick label
      ctx.font = '600 11px Syne, sans-serif';
      ctx.fillStyle = u.color || '#6c63ff';
      ctx.fillText(u.nick, sx + 8, sy - 6);
    });
  }, [users, viewport, size, nick]);

  // ── Mouse handlers
  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setPanning(true);
      setPanStart({ mx: e.clientX, my: e.clientY, vx: viewport.x, vy: viewport.y });
      return;
    }
    if (e.button !== 0) return;

    const pos = getPos(e);

    if (tool === 'text') {
      setTextInput({ x: pos.x, y: pos.y });
      setTextValue('');
      return;
    }

    if (tool === 'select') {
      // Find clicked element
      const clicked = [...elements].reverse().find(el => hitTest(el, pos.x, pos.y));
      setSelectedId(clicked ? clicked.id : null);
      return;
    }

    if (tool === 'eraser') {
      const clicked = [...elements].reverse().find(el => hitTest(el, pos.x, pos.y));
      if (clicked) onDeleteElement(clicked.id);
      return;
    }

    setDrawing(true);
    const el = {
      id: uuidv4(),
      type: tool,
      color,
      strokeWidth,
      points: tool === 'pen' ? [{ x: pos.x, y: pos.y }] : [],
      x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y,
    };
    setCurrentEl(el);
  }, [tool, color, strokeWidth, viewport, elements, onDeleteElement]);

  const onMouseMove = useCallback((e) => {
    const pos = getPos(e);
    onCursorMove({ x: pos.x, y: pos.y });

    if (panning && panStart) {
      const dx = e.clientX - panStart.mx;
      const dy = e.clientY - panStart.my;
      setViewport(v => ({ ...v, x: panStart.vx + dx, y: panStart.vy + dy }));
      return;
    }
    if (!drawing || !currentEl) return;

    if (currentEl.type === 'pen') {
      setCurrentEl(el => ({ ...el, points: [...el.points, { x: pos.x, y: pos.y }] }));
    } else {
      setCurrentEl(el => ({ ...el, x2: pos.x, y2: pos.y }));
    }
  }, [panning, panStart, drawing, currentEl, onCursorMove]);

  const onMouseUp = useCallback(() => {
    setPanning(false);
    setPanStart(null);
    if (!drawing || !currentEl) return;
    setDrawing(false);
    // Don't save zero-size elements
    const el = currentEl;
    if (el.type === 'pen' && el.points.length < 2) { setCurrentEl(null); return; }
    if (el.type !== 'pen' && Math.abs(el.x2 - el.x1) < 3 && Math.abs(el.y2 - el.y1) < 3) {
      setCurrentEl(null); return;
    }
    onAddElement(el);
    setCurrentEl(null);
  }, [drawing, currentEl, onAddElement]);

  // Wheel zoom
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setViewport(v => {
      const newScale = Math.min(8, Math.max(0.1, v.scale * factor));
      const scaleFactor = newScale / v.scale;
      return {
        scale: newScale,
        x: mx - scaleFactor * (mx - v.x),
        y: my - scaleFactor * (my - v.y),
      };
    });
  }, []);

  // Text confirm
  const confirmText = () => {
    if (!textValue.trim() || !textInput) { setTextInput(null); return; }
    const el = {
      id: uuidv4(),
      type: 'text',
      color,
      strokeWidth,
      x1: textInput.x,
      y1: textInput.y,
      text: textValue,
      fontSize: Math.max(14, strokeWidth * 4),
    };
    onAddElement(el);
    setTextInput(null);
    setTextValue('');
  };

  const getCursorStyle = () => {
    if (tool === 'pen') return 'crosshair';
    if (tool === 'eraser') return 'cell';
    if (tool === 'text') return 'text';
    if (tool === 'select') return 'default';
    return 'crosshair';
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Main canvas */}
      <canvas
        id="main-canvas"
        ref={canvasRef}
        width={size.w}
        height={size.h}
        style={{ position: 'absolute', inset: 0, cursor: getCursorStyle() }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onContextMenu={e => e.preventDefault()}
      />
      {/* Overlay for remote cursors */}
      <canvas
        ref={overlayRef}
        width={size.w}
        height={size.h}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />

      {/* Text input */}
      {textInput && (
        <div style={{
          position: 'absolute',
          left: Math.min(textInput.x * viewport.scale + viewport.x, size.w - 320),
          top: Math.min(textInput.y * viewport.scale + viewport.y, size.h - 120),
          zIndex: 200,
          background: 'var(--surface)',
          border: `2px solid ${color}`,
          borderRadius: 10,
          padding: '10px 12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          minWidth: 280,
        }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6, fontFamily: 'Syne,sans-serif' }}>
            Введи текст → Enter чтобы добавить
          </div>
          <input
            ref={el => el && setTimeout(() => el.focus(), 50)}
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') confirmText();
              if (e.key === 'Escape') { setTextInput(null); setTextValue(''); }
            }}
            style={{
              background: 'var(--surface2)',
              border: `1px solid ${color}`,
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: 15,
              padding: '8px 12px',
              width: '100%',
              outline: 'none',
              fontFamily: 'Syne, sans-serif',
              fontWeight: 500,
              display: 'block',
              marginBottom: 8,
            }}
            placeholder="Напиши текст здесь..."
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onMouseDown={e => { e.preventDefault(); confirmText(); }}
              style={{
                flex: 1, padding: '7px', borderRadius: 6, border: 'none',
                background: color, color: '#fff',
                fontFamily: 'Syne,sans-serif', fontWeight: 700, fontSize: 13,
                cursor: 'pointer',
              }}
            >✓ Добавить</button>
            <button
              onMouseDown={e => { e.preventDefault(); setTextInput(null); setTextValue(''); }}
              style={{
                padding: '7px 12px', borderRadius: 6,
                border: '1px solid var(--border)', background: 'var(--surface2)',
                color: 'var(--text2)', fontFamily: 'Syne,sans-serif', fontSize: 13,
                cursor: 'pointer',
              }}
            >✕</button>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        display: 'flex', gap: 4, alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8, padding: '4px 8px',
        fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
        color: 'var(--text2)',
      }}>
        <button onClick={() => setViewport(v => ({ ...v, scale: Math.min(8, v.scale * 1.2) }))}
          style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>+</button>
        <span style={{ minWidth: 40, textAlign: 'center' }}>{Math.round(viewport.scale * 100)}%</span>
        <button onClick={() => setViewport(v => ({ ...v, scale: Math.max(0.1, v.scale / 1.2) }))}
          style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>−</button>
        <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
        <button onClick={() => setViewport({ x: 0, y: 0, scale: 1 })}
          style={{ background: 'none', border: 'none', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, fontFamily: 'Syne, sans-serif' }}>Reset</button>
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        fontSize: 11, color: 'var(--text3)',
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        Scroll to zoom · Alt+drag to pan
      </div>
    </div>
  );
}

// ── Drawing functions ────────────────────────────────────────────────────────
function drawGrid(ctx, viewport, size) {
  const step = 40;
  const startX = -viewport.x / viewport.scale;
  const startY = -viewport.y / viewport.scale;
  const endX = startX + size.w / viewport.scale;
  const endY = startY + size.h / viewport.scale;

  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;

  const gx = Math.floor(startX / step) * step;
  for (let x = gx; x < endX; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  const gy = Math.floor(startY / step) * step;
  for (let y = gy; y < endY; y += step) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  // Origin cross
  ctx.strokeStyle = 'rgba(108,99,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, startY); ctx.lineTo(0, endY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(endX, 0); ctx.stroke();
}

function drawElement(ctx, el, selected) {
  ctx.save();
  ctx.strokeStyle = el.color || '#f0f0f5';
  ctx.fillStyle = el.color || '#f0f0f5';
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (selected) {
    ctx.shadowColor = '#6c63ff';
    ctx.shadowBlur = 8;
  }

  switch (el.type) {
    case 'pen': {
      if (!el.points || el.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        const prev = el.points[i - 1];
        const curr = el.points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.stroke();
      break;
    }
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(el.x1, el.y1);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      break;
    }
    case 'rect': {
      const x = Math.min(el.x1, el.x2);
      const y = Math.min(el.y1, el.y2);
      const w = Math.abs(el.x2 - el.x1);
      const h = Math.abs(el.y2 - el.y1);
      ctx.strokeRect(x, y, w, h);
      // subtle fill
      ctx.globalAlpha = 0.08;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      break;
    }
    case 'circle': {
      const cx = (el.x1 + el.x2) / 2;
      const cy = (el.y1 + el.y2) / 2;
      const rx = Math.abs(el.x2 - el.x1) / 2;
      const ry = Math.abs(el.y2 - el.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.08;
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'text': {
      const fs = el.fontSize || 18;
      ctx.font = `600 ${fs}px Syne, sans-serif`;
      ctx.fillText(el.text || '', el.x1, el.y1);
      break;
    }
  }

  ctx.restore();
}

function hitTest(el, px, py) {
  const margin = 8;
  switch (el.type) {
    case 'pen': {
      if (!el.points) return false;
      return el.points.some(p => Math.hypot(p.x - px, p.y - py) < margin * 2);
    }
    case 'line': {
      return distToSegment(px, py, el.x1, el.y1, el.x2, el.y2) < margin;
    }
    case 'rect': {
      const x = Math.min(el.x1, el.x2) - margin;
      const y = Math.min(el.y1, el.y2) - margin;
      const w = Math.abs(el.x2 - el.x1) + margin * 2;
      const h = Math.abs(el.y2 - el.y1) + margin * 2;
      return px >= x && px <= x + w && py >= y && py <= y + h;
    }
    case 'circle': {
      const cx = (el.x1 + el.x2) / 2;
      const cy = (el.y1 + el.y2) / 2;
      const rx = Math.abs(el.x2 - el.x1) / 2 + margin;
      const ry = Math.abs(el.y2 - el.y1) / 2 + margin;
      return ((px - cx) ** 2) / rx ** 2 + ((py - cy) ** 2) / ry ** 2 <= 1;
    }
    case 'text': {
      const fs = el.fontSize || 18;
      return px >= el.x1 - margin && py >= el.y1 - fs - margin &&
             px <= el.x1 + 200 && py <= el.y1 + margin;
    }
    default: return false;
  }
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
