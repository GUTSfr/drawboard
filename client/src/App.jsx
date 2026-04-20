import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage.jsx';
import BoardsPage from './components/BoardsPage.jsx';
import BoardEditor from './components/BoardEditor.jsx';
import ToastProvider from './components/ToastProvider.jsx';

export default function App() {
  const [nick, setNick] = useState(() => localStorage.getItem('db_nick') || '');
  const [nickColor] = useState(() => {
    let c = localStorage.getItem('db_color');
    if (!c) {
      const colors = ['#6c63ff','#ff6b6b','#43e97b','#f9ca24','#ff9f43','#48dbfb','#ff9ff3','#ffeaa7'];
      c = colors[Math.floor(Math.random() * colors.length)];
      localStorage.setItem('db_color', c);
    }
    return c;
  });
  const [route, setRoute] = useState({ page: nick ? 'boards' : 'landing', boardId: null });

  const enter = (n) => {
    localStorage.setItem('db_nick', n);
    setNick(n);
    setRoute({ page: 'boards', boardId: null });
  };

  if (!nick || route.page === 'landing') return (
    <ToastProvider>
      <LandingPage onEnter={enter} />
    </ToastProvider>
  );

  if (route.page === 'board') return (
    <ToastProvider>
      <BoardEditor
        boardId={route.boardId}
        nick={nick}
        nickColor={nickColor}
        onBack={() => setRoute({ page: 'boards', boardId: null })}
      />
    </ToastProvider>
  );

  return (
    <ToastProvider>
      <BoardsPage
        nick={nick}
        nickColor={nickColor}
        onOpenBoard={(id) => setRoute({ page: 'board', boardId: id })}
        onLogout={() => { localStorage.removeItem('db_nick'); setNick(''); setRoute({ page: 'landing' }); }}
      />
    </ToastProvider>
  );
}
