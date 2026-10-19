import React from 'react';

/**
 * SkyBackground: ảnh nền cố định toàn trang.
 * - Nguồn: `public/bg.jpg` (ảnh chụp trời đêm + Milky Way, bình minh ven hồ)
 * - `object-cover` + Ken Burns (zoom rất chậm) để không bị méo ở mọi tỉ lệ màn hình
 * - Lớp scrim gradient + vignette để chữ/cạnh trên nền vẫn dễ đọc
 * - Ảnh không đổi khi đổi theme sáng/tối
 */
export function SkyBackground() {
  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none select-none overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <img
        src={`${import.meta.env.BASE_URL}bg.jpg`}
        alt=""
        className="sky-bg-photo absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(9,12,32,0.55) 0%, rgba(9,12,32,0.18) 22%, rgba(9,12,32,0.10) 55%, rgba(9,12,32,0.45) 100%)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 45%, rgba(0,0,0,0) 45%, rgba(4,6,20,0.55) 100%)',
        }}
      />
    </div>
  );
}