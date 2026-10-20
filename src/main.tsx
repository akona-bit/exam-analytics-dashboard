import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Disable DevTools
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (e.key === 'F12') {
    e.preventDefault();
  }
  if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) {
    e.preventDefault();
  }
  if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
    e.preventDefault();
  }
});

// Ẩn splash + lớp nền ban đầu (xem index.html) sau khi React đã mount.
// KHÔNG xoá innerHTML của #root ở đây: rAF có thể chạy SAU khi React commit,
// xoá mất DOM vừa render và để lại trang trắng vĩnh viễn. React tự thay thế
// splash khi mount; ở đây chỉ cần bật cờ CSS.
const markAppReady = () => {
  const root = document.getElementById('root');
  if (!root) return;
  root.setAttribute('data-ready', '1');
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

requestAnimationFrame(markAppReady);
