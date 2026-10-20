import React from 'react';

/**
 * SkyBackground: nền phẳng tối giản giống dashboard tham chiếu.
 * Không ảnh, không animation, không quầng sáng — chỉ một màu xám rất nhạt
 * để card trắng và chữ tối luôn nổi bật, dịu mắt trên mọi màn hình.
 */
export function SkyBackground() {
  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none select-none overflow-hidden bg-[#f6f7f9]"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
