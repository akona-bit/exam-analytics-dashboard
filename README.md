# 🎓 Hệ Thống Tra Cứu & Phân Tích Điểm Thi (Exam Analytics Dashboard)

Hệ thống cung cấp một bảng điều khiển (dashboard) toàn diện giúp học sinh và giáo viên tra cứu điểm thi, phân tích sự tiến bộ qua từng đợt kiểm tra và đánh giá chi tiết lỗ hổng kiến thức.

## ✨ Tính Năng Nổi Bật

### 1. Dành cho Học sinh (Tra cứu cá nhân)
- **Tra cứu thông minh:** Tìm kiếm nhanh chóng qua Tên hoặc Email. Hỗ trợ gộp chung lịch sử của các thí sinh đã thi nhiều lần.
- **Biểu đồ đa dạng:** 
  - Trực quan hóa điểm số (Điểm Thô, Điểm IRT, Điểm Thưởng Phạt) của hai môn Toán và Tư Duy Khoa Học (TDKH).
  - So sánh trực tiếp tiến độ cá nhân với điểm trung bình của toàn lớp qua từng đợt thi.
- **Bảng so sánh lịch sử thi:** Đánh giá chi tiết sự tiến bộ qua các lần thi khác nhau (Lần 1, Lần 2, v.v.).
- **Ma trận kiến thức:** Chỉ rõ những câu hỏi học sinh làm sai hoặc bỏ trống, giúp nhanh chóng xác định các phần kiến thức cần ôn tập lại.

### 2. Dành cho Giáo viên (Thống kê lớp học)
- **Tóm tắt nhanh:** Nắm bắt ngay lập tức tổng số thí sinh tham gia, số lần thi trung bình và điểm trung bình của toàn khóa.
- **Phân tích câu hỏi (Item Analysis):** Bảng phân tích tỷ lệ làm Đúng/Sai/Bỏ trống của từng câu hỏi, kèm theo điểm phạt để xác định mức độ khó của đề thi.
- **Vinh danh xuất sắc:** Tự động phát hiện và hiển thị bảng chúc mừng (kèm hiệu ứng pháo hoa) cho Thủ khoa và Á khoa. Hiệu ứng được thiết kế tối giản, tinh tế mang phong cách bằng khen sang trọng và được tối ưu hóa chỉ xuất hiện 1 lần cho mỗi lượt truy cập để không làm phiền người dùng.

### 3. Tab Thống Kê & Phân Tích (tách khỏi màn hình tra cứu)
Màn hình tra cứu chỉ giữ hero + ô tìm kiếm. Toàn bộ số liệu nằm ở tab **Thống Kê & Phân Tích**:
- **Chuyển đổi chỉ số:** Mọi biểu đồ/bảng cập nhật tức thì theo Điểm Thô / Điểm IRT / Thưởng Phạt.
- **KPI tổng quan:** Tổng thí sinh, điểm trung bình Toán/TDKH, trung vị tổng điểm, tỷ lệ đạt ≥ 60%.
- **Histogram phân bố điểm:** Phân bố Toán và TDKH theo khoảng điểm (bước 2.5), lần thi mới nhất.
- **Xếp loại năng lực (Donut):** 5 mức Yếu → Xuất sắc, % trên vòng trống + số thí sinh ở chú giải.
- **Scatter Toán – TDKH:** Mối quan hệ hai môn từng thí sinh, kèm đường trung bình lớp.
- **Tỷ lệ đạt ngưỡng:** Thanh ngang các ngưỡng 40%–80% trên thang 50 điểm.
- **Bảng thống kê phân tán:** Số TS, Min, Q1, Trung vị, Q3, Q90, Max, Trung bình, STĐ từng môn.
- **Xu hướng & cơ cấu:** Điểm TB toàn khóa qua từng lần thi, phân bố số lần thi.
- **Bảng xếp hạng:** Top 10 điểm cao nhất và Top 10 cần cải thiện (nhấp để mở hồ sơ thí sinh).
- **Phân tích câu hỏi:** Histogram độ khó 60 câu, 5 câu dễ/khó nhất, bảng thống kê từng câu (lọc theo môn).

## 🎨 Thiết Kế Giao Diện & Trải Nghiệm Người Dùng (UI/UX)

Hệ thống được thiết kế với triết lý tối giản (minimalism), tập trung tối đa vào dữ liệu và tối ưu hóa luồng tương tác của người dùng.

### Trải Nghiệm Người Dùng (UX - User Experience)
- **Tìm kiếm tức thì (Real-time Search):** Thanh tìm kiếm phản hồi ngay lập tức khi người dùng gõ phím, tự động nhóm và gợi ý kết quả hợp lý nhất mà không cần tải lại trang.
- **Storytelling qua dữ liệu:** Biến bảng số liệu khô khan thành các biểu đồ xu hướng trực quan và các con số tóm tắt, giúp giáo viên và học sinh nắm bắt bức tranh toàn cảnh chỉ trong vài giây.
- **Luồng thao tác không gián đoạn:** Toàn bộ ứng dụng là một Single Page Application (SPA). Việc chuyển đổi, cuộn trang hay tra cứu giữa các học sinh diễn ra mượt mà, không độ trễ.
- **Chống làm phiền (Anti-annoyance):** Hiệu ứng chúc mừng (Celebration) được giới hạn xuất hiện **chỉ 1 lần duy nhất** cho mỗi thí sinh trong cùng một phiên sử dụng, bảo vệ sự tập trung khi học sinh muốn xem lại điểm nhiều lần.

### Giao Diện Người Dùng (UI - User Interface)
- **Hệ thống màu sắc ngữ nghĩa (Semantic Colors):**
  - 🔵 **Indigo/Blue:** Màu chủ đạo, mang lại cảm giác học thuật, hiện đại và tin cậy.
  - 🔴 **Rose (Đỏ hồng):** Nhấn mạnh các cảnh báo lỗi sai, câu trả lời sai.
  - 🟡 **Amber (Vàng hổ phách):** Biểu thị các điểm phạt, câu bỏ trống, hoặc được dùng tinh tế trong thiết kế bằng khen Thủ khoa.
  - 🟢 **Emerald (Xanh lục):** Thể hiện sự tiến bộ, thành tích tốt và câu trả lời đúng.
- **Bố cục "Bento Box" (Card-based Layout):** Các thành phần chức năng (biểu đồ, bảng, thống kê) được phân chia rõ ràng vào từng ô thẻ (card) bo góc mềm mại, kết hợp đổ bóng nhẹ (soft shadow) giúp giao diện rất thoáng và dễ quét (scannable).
- **Responsive hoàn hảo (Mobile-First):** Giao diện tự động thích ứng với mọi kích thước màn hình từ điện thoại di động (stacked layouts) cho đến Desktop (side-by-side charts).
- **Typography & Khoảng trắng:** Sử dụng bộ phông chữ hiện đại, không chân (sans-serif) với khoảng trắng (negative space) hào phóng, giúp giảm tải sự mệt mỏi cho mắt khi phải đọc một lượng lớn dữ liệu phân tích.

## 🛠 Công Nghệ Sử Dụng

- **Frontend:**
  - **Framework:** React 18 + TypeScript + Vite.
  - **Styling:** Tailwind CSS.
  - **Biểu đồ (Charts):** Recharts.
  - **Icons & Animations:** Lucide React, Framer Motion, Canvas Confetti.
- **Backend & Data:**
  - **Server:** Node.js + Express (Server phục vụ API và static file cho production).
  - **Cơ sở dữ liệu:** Hệ thống parse trực tiếp dữ liệu từ file `.csv` (`raw_students.csv`, `raw_student_responses.csv`) và trả về JSON chuẩn hóa cho giao diện.

## 📂 Cấu Trúc Thư Mục Chính

```text
.
├── src/
│   ├── App.tsx                 # Entry point của UI, fetch dữ liệu từ API
│   ├── Dashboard.tsx           # Layout chính, logic tìm kiếm và biểu đồ thống kê
│   ├── KnowledgeMatrix.tsx     # Ma trận kiến thức (hiển thị câu sai/trống)
│   ├── AbilityDistribution.tsx # Biểu đồ phân bổ năng lực toàn bộ thí sinh
│   ├── ClassAnalytics.tsx      # Xu hướng, xếp hạng & phân tích câu hỏi toàn khóa
│   ├── analytics.ts            # Hàm thống kê dùng chung (percentile, trung bình, nhóm lần thi...)
│   ├── QuestionTable.tsx       # Bảng phân tích độ khó & tỷ lệ đúng sai từng câu
│   ├── CelebrationOverlay.tsx  # Giao diện màn hình vinh danh Thủ khoa/Á khoa
│   ├── types.ts                # Định nghĩa interface TypeScript cho toàn dự án
│   └── question_texts.json     # File chứa văn bản/nội dung chi tiết của câu hỏi
├── server.ts                   # Backend Express server (đọc CSV, xử lý logic & tạo REST API)
├── raw_students.csv            # Dữ liệu điểm số tổng hợp của học viên
├── raw_student_responses.csv   # Dữ liệu chi tiết từng câu trả lời của bài thi
└── package.json                # Cấu hình dự án và scripts
```

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### Cài đặt dependencies
```bash
npm install
```

### Chạy môi trường phát triển (Development)
```bash
npm run dev
```
Hệ thống sẽ chạy frontend (Vite) và backend (Express via `tsx`) tại cổng `3000`.

### Build & Chạy môi trường sản phẩm (Production)
```bash
npm run build
npm run start
```
Quá trình build sẽ:
1. Compile Frontend vào thư mục `dist/`.
2. Đóng gói backend `server.ts` bằng esbuild thành file `dist/server.cjs`.
Lệnh start sẽ chạy ứng dụng dưới dạng một service độc lập.

### Deploy tĩnh (Cloudflare Pages / GitHub Pages)
```bash
npm run build:static   # sinh public/data/*.json rồi build dist/
```
- `export-data` đọc 3 file CSV rồi ghi `public/data/students.json` + `questions.json`, nên bản tĩnh không cần backend Express (App.tsx tự fallback sang file JSON khi `/api/*` không có).
- `vite.config.ts` dùng `base: './'` để chạy được ở cả domain gốc lẫn sub-path.
- **Cloudflare Pages:** Build command `npm run build:static` · Output dir `dist` · kết nối repo GitHub (private) để auto-deploy mỗi push lên `main`.
- **GitHub Pages:** workflow `.github/workflows/deploy.yml` sẵn sàng nhưng chỉ chạy `workflow_dispatch` — Pages không hỗ trợ repo Private trên gói Free.

## 📝 Cấu Trúc Dữ Liệu Đầu Vào

1. **`raw_students.csv`**: File chứa thông tin tổng quan của học sinh (STT, Tên, Email, và các cột điểm Thô, IRT, Thưởng phạt của Toán và TDKH).
2. **`raw_student_responses.csv`**: Chứa ma trận câu trả lời chi tiết (từ Câu 1 đến Câu 60). Hệ thống quy ước:
   - `1` (hoặc các số > 0): Trả lời đúng.
   - `0`: Trả lời sai.
   - Để trống: Bỏ qua câu hỏi.
   Dữ liệu này được liên kết với `raw_students.csv` thông qua Tên hoặc Email.
