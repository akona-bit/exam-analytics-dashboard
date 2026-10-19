# 🎓 Kết Quả Thi THPT — Bảng Điều Khiển Tra Cứu & Phân Tích Điểm

Web app cho phép học sinh tra cứu điểm thi và giáo viên phân tích kết quả toàn khóa: xếp loại năng lực, phân tích độ khó từng câu, ma trận kiến thức và xuất PDF phiếu điểm.

- **Deploy:** Cloudflare Pages — <https://ketquathithumitht.pages.dev>
- **Trang quản trị:** mở `#admin` trên URL (góc trên bên phải có nút ẩn dẫn tới).

---

## 📋 Mục lục

- [Tính năng](#-tính-năng)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Kiến trúc tổng thể](#-kiến-trúc-tổng-thể)
- [Luồng dữ liệu](#-luồng-dữ-liệu)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Cài đặt & chạy](#-cài-đặt--chạy)
- [Dữ liệu đầu vào](#-dữ-liệu-đầu-vào)
- [Trang quản trị](#-trang-quản-trị)
- [Supabase](#-supabase)
- [Deploy](#-deploy)
- [Ghi chú bảo mật](#-ghi-chú-bảo-mật)
- [Đã dọn trong lần refactor gần nhất](#-đã-dọn-trong-lần-refactor-gần-nhất)

---

## ✨ Tính năng

### Với học sinh
- **Tra cứu tức thì** theo tên (email bị ẩn hoàn toàn khỏi giao diện), tự gộp lịch sử các lần thi của cùng một thí sinh.
- **4 tab hồ sơ:**
  - **Tổng quan** — Radar so sánh với điểm TB lớp, thang điểm Thô / IRT / Thưởng–Phạt, biểu đồ cột tổng điểm từng môn, Area "Tiến bộ qua các lần thi".
    ⚠️ Ba thang Thô (0–30), IRT (~0–280) và Thưởng Phạt là **không cùng đơn vị**. Radar "So với TB Lớp"
    và biểu đồ cột chỉ vẽ **một thang tại một thời điểm**, chọn bằng thanh "Thang điểm đang hiển thị"
    ở đầu tab — cộng gộp chúng lại sẽ ra số không có ý nghĩa.
  - **Vùng kiến thức** — số câu đúng theo vùng, filter pill (Tất cả / ≥80% / 50–79% / <50%), chuyển đổi giữa dạng thẻ và bảng, bảng chi tiết câu sai & bỏ trống.
  - **Lịch sử thi** — ma trận so sánh nhiều lần thi (chỉ hiện khi có từ 2 lần).
  - **Lớp học** — phân bổ năng lực + phân tích toàn khóa (lazy-load).
- **Xuất PDF** — `html2canvas-pro` (hỗ trợ OKLCH) + `jsPDF`, tự chia nhiều trang, nhúng avatar thành dataURL.
- **Vinh danh** — overlay Thủ Khoa / Á Khoa kèm pháo hoa, **chỉ hiện 1 lần mỗi phiên** (`celebratedRef`).
- **Xem đáp án** từng câu qua modal, lấy nội dung từ `question_texts.json`.

### Với giáo viên (tab Lớp học)
- **KPI tổng quan:** tổng thí sinh, điểm TB Toán / TDKH, trung vị tổng, tỷ lệ đạt ≥ 60%.
- **Histogram** phân bố điểm Toán & TDKH (10 nhóm, bước 2.5), lần thi mới nhất.
- **Donut xếp loại** 5 mức Yếu → Xuất sắc.
- **Scatter Toán – TDKH** kèm đường tham chiếu điểm TB lớp.
- **Tỷ lệ đạt ngưỡng** 40/50/60/70/80% trên thang 60.
- **Bảng thống kê mô tả:** n, min, Q1, trung vị, Q3, P90, max, TB, STĐ.
- **Xu hướng:** điểm TB toàn khóa qua từng lần thi + phân bố số lần thi.
- **Bảng xếp hạng:** Top 10 cao nhất / Top 10 cần cải thiện.
- **Phân tích câu hỏi:** histogram độ khó 60 câu, 5 câu khó nhất / dễ nhất, bảng chi tiết có filter môn.

---

## 🛠 Công nghệ sử dụng

| Lớp | Công nghệ |
|---|---|
| Frontend | React **19**, TypeScript ~5.8, Vite 6 |
| Styling | Tailwind CSS **v4** (cấu hình CSS-first trong `index.css`, không có `tailwind.config.js`) |
| Biểu đồ | Recharts 3 |
| Icon / chuyển động | Lucide React, `motion` (Motion for React) |
| Xuất PDF | `html2canvas-pro`, `jspdf` |
| Export Excel | `xlsx` |
| Backend | Express 4 (tùy chọn), Cloudflare Pages Functions (không dùng) |
| Dữ liệu | Supabase (chính) · CSV tĩnh (fallback) · Express `/api` (dev) |
| Deploy | Cloudflare Pages (`npm run deploy`), CI kiểm tra build bằng GitHub Actions |

> Lưu ý: `package-lock.json` là lockfile duy nhất. CI và mọi lệnh trong tài liệu này dùng **npm**.
>
> `xlsx` được **vendor sẵn** trong repo tại `vendor/xlsx-0.20.3.tgz` và khai báo bằng
> `file:vendor/xlsx-0.20.3.tgz`, nên `npm ci` không cần mạng ra `cdn.sheetjs.com`.
> Bắt buộc phải vendor vì bản trên npm registry bị stale (0.18.5) và có lỗ hổng
> prototype pollution đã vá từ 0.19.3 — CDN của SheetJS là nguồn chính thức.
> Khi nâng version: tải tarball mới từ `https://cdn.sheetjs.com/`, đặt vào `vendor/`,
> rồi đổi `file:` trong `package.json`.

---

## 🏗 Kiến trúc tổng thể

Ứng dụng là **SPA không router**. `App.tsx` chọn view dựa trên `window.location.hash`:

```
location.hash !== "#admin"  →  <SkyBackground/> + <Dashboard/>   (view công khai)
location.hash === "#admin"  →  <AdminPage/>                       (bảng điều khiển quản trị)
```

### `App.tsx` — root component
- Giữ **toàn bộ state dùng chung**: `examName`, `knowledgeCsv`, `questionTexts`, `answerLink`, `nextExamDate`, `examUrl`, `sbdMap`, `visibleParts`, `isDark`.
- Hydrate từ bảng key-value `exam_settings` (Supabase) + seed từ `question_texts.json`.
- Dark mode: class `dark` trên `<html>`, lưu `localStorage.theme`.
- Một hotspot 48×48 `opacity-0` ở góc trên phải mở `#admin`; card QR sinh từ `examUrl` qua `api.qrserver.com`.
- Màn hình splash do `index.html` vẽ sẵn (inline CSS) trước khi bundle JS tải xong → không nháy trắng.
- Có `<noscript>` chứa nội dung tiếng Việt cho crawler.

> **Timeout bắt buộc.** Cả 3 query Supabase được bọc trong `withTimeout` với `SUPABASE_TIMEOUT_MS = 12000`. Bảng `student_responses` có ~41k dòng và được đọc với RLS cho phép anonymous — nếu mạng chậm hoặc treo, `Promise.all` không bao giờ settle và app sẽ kẹt ở "Đang tài dữ liệu..." **vô hạn**, không kịp fallback. Hết giờ thì trả `null` và rơi xuống `/api/*` → file JSON tĩnh. Tăng hẳn giá trị này nếu mạng nội bộ chậm hơn.

### `server.ts` — API tùy chọn (chỉ dùng khi chạy Node server)
Chỉ có **2 endpoint**, dữ liệu nạp 1 lần lúc khởi động từ `process.cwd()`:

| Endpoint | Trả về |
|---|---|
| `GET /api/students` | Danh sách thí sinh, `responses` **chỉ gồm câu sai/bỏ trống** (`status !== 'correct'`) |
| `GET /api/questions` | Thống kê từng câu: số lượt làm, đúng, sai, điểm phạt, bước điểm thưởng, cờ `isError` |

Ở `NODE_ENV !== 'production'` server gắn `vite.middlewares` (middleware mode) để làm dev server. `PORT` mặc định `3000`. Server **không** tự nạp `.env`.

---

## 🔄 Luồng dữ liệu

`App.tsx` thử **3 nguồn theo thứ tự**, fallback khi nguồn trước lỗi:

```
1. Supabase        students · questions · student_responses
      │            (chỉ chạy nếu có VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
      ▼
2. Express API     /api/students · /api/questions
      │            (chỉ nhận nếu res.ok && content-type = application/json)
      ▼
3. File tĩnh       ${BASE_URL}data/students.json · data/questions.json
                   (sinh bởi scripts/export-data.ts → public/data/)
```

Bước 2 có kiểm tra content-type để tránh nuốt phải `index.html` do Cloudflare Pages SPA fallback trả về cho mọi đường dẫn.

### Các lớp module dùng chung

| File | Vai trò |
|---|---|
| `lib/csvParser.ts` | **Nguồn sự thật duy nhất** cho việc đọc CSV. Thuần JS logic, không đụng `fs`/mạng nên chạy được ở cả server, script Node lẫn trình duyệt. Xuất ra đúng tên cột trong `schema.sql` (`tp_*`, `student_stt`, `question_id`, `is_error`) |
| `analytics.ts` | Toàn bộ hàm thống kê thuần JS: `latestAttempts`, `mean`, `quantile`, `stdDev`, `describe`, `rankList`, `bandOf`, `thresholdRows`, `attemptAverages`… + hằng số `MAX_SUBJECT_SCORE = 30` (= số câu/môn, khớp `QUESTIONS_PER_STUDENT`), `MAX_TOTAL_SCORE = 60`, `MAX_ALL_SUBJECT_SCORE = 120`, `GIOI_MIN`, `ABILITY_BANDS`, `THRESHOLDS` |
| `types.ts` | `StudentData`, `QuestionData`, `MetricKey`, `SubjectKey`, `ExamType` |
| `lib/supabase.ts` | Khởi tạo client, export `isSupabaseConfigured` + `supabase` (hoặc `null`) |
| `lib/contentFiles.ts` | Nạp nội dung tĩnh từ file: `knowledgeCsvFile` (CSV vùng kiến thức), `questionTextsFile` — qua `import.meta.glob` nên thiếu file vẫn build được |
| `lib/knowledgeStructure.ts` | Mô hình ma trận kiến thức: `parseKnowledgeCSV`, `DEFAULT_KNOWLEDGE_CSV` (đọc từ `knowledge_structure.csv`), `DOMAIN_PALETTES`, `getPalette` |
| `scripts/export-data.ts` | Build-time exporter: đọc 3 CSV → ghi `public/data/students.json` + `questions.json` |

### Ghi chú về `lib/csvParser.ts`

Cả ba nơi đọc CSV đều import cùng một module:

```
raw_*.csv ──► lib/csvParser.ts ──► server.ts       → map sang shape API
                              ├──► export-data.ts  → ghi JSON tĩnh
                              └──► AdminPage.tsx    → insert thẳng Supabase
```

Hai hàm dùng nhiều nhất:

- `parseStudentsCsv(csv)` — đọc theo tên cột trước, tự lùi về vị trí cố định nếu header chỉ ghi chung ("Thô", "IRT"). Cần gọi `parseResponsesCsv` **truyền vào kết quả của hàm này** để email được back-fill.
- `parseResponsesCsv(csv, students)` — trả về **toàn bộ 120 câu** mỗi thí sinh; dùng `failedOnly()` để chỉ giữ câu sai/bỏ trống. Vì `responses` **chỉ chứa câu sai**, mọi nơi tính "tỉ lệ đúng" phải lấy tổng số câu từ đề thi (`QUESTIONS_PER_STUDENT`), tuyệt đối không dùng `responses.length`.

**Quy ước ma trận kiến thức** (`lib/knowledgeStructure.ts`):
- Ma trận được dựng **từ CSV** (`parseKnowledgeCSV`), môn của mỗi vùng suy ra từ vị trí câu (30 câu/môn). CSV rỗng thì mới lùi về ma trận 120 câu hardcode.
- Các tên vùng trùng nhau giữa các môn ("Ngữ pháp" của Tiếng Việt và của Tiếng Anh) được phân biệt bằng khoá màu `Tên vùng (Tên môn)`.
- Các dòng liên tiếp cùng vùng được gộp, số câu cộng dồn.
- Cột "câu cuối của vùng" trong CSV bị bỏ qua có chủ đích — nó thừa và sai ở vài vùng, để lại sẽ làm lệch số thứ tự câu.
- Nếu đề thi có **≤ 60 câu**, tự động lọc về đúng nhóm Toán/TDKH và **đánh số lại 1..60**.

---

## 📂 Cấu trúc thư mục

```text
.
├── App.tsx                  # Root: chọn view theo hash, fetch dữ liệu, state chung
├── main.tsx                 # createRoot + chặn F12/right-click/view-source
├── Dashboard.tsx            # ⭐ UI chính: tìm kiếm, hồ sơ 4 tab, xuất PDF
├── AdminPage.tsx            # Bảng điều khiển quản trị (#admin, đăng nhập Supabase)
├── ClassAnalytics.tsx       # Xu hướng, xếp hạng, phân tích câu hỏi toàn khóa (lazy)
├── AbilityDistribution.tsx  # KPI, histogram, donut, scatter, thống kê mô tả (lazy)
├── QuestionTable.tsx        # Bảng phân tích từng câu (bước điểm phạt / thưởng)
├── CelebrationOverlay.tsx   # Overlay vinh danh Thủ Khoa / Á Khoa
├── SkyBackground.tsx        # Nền SVG bầu trời buổi sớm (thuần vector, không ảnh)
├── analytics.ts             # Hàm thống kê dùng chung
├── types.ts                 # Interface TypeScript
├── index.css                # Tailwind v4 + dark variant + keyframes + component layers
├── index.html               # Shell tĩnh + SEO/OG/Twitter/JSON-LD + splash loader
├── server.ts                # Express API (tùy chọn)
├── scripts/export-data.ts   # CSV → public/data/*.json
│
├── lib/
│   ├── csvParser.ts         # ⭐ Bộ đọc CSV duy nhất — dùng bởi server, script, admin
│   ├── supabase.ts
│   └── knowledgeStructure.ts
├── public/
│   ├── logo.png · og-banner.jpg
│   ├── _headers             # CSP, HSTS, cache-control cho Cloudflare
│   └── data/                # ⛔ gitignored — output của export-data
│
├── raw_students.csv             # ⛔ gitignored
├── raw_student_responses.csv    # ⛔ gitignored
├── questions.csv                # ⛔ gitignored
├── question_texts.json          # ⛔ gitignored — tuỳ chọn (seed, runtime lấy từ Supabase)
├── knowledge_structure.csv      # ✅ commit — bản đồ Vùng kiến thức / Chuyên đề
│
├── schema.sql                   # Schema Supabase đầy đủ — CHỈ cho DB trống
├── schema_migrate.sql           # Migration idempotent cho DB đang chạy
├── schema_exam_settings.sql     # Migration riêng (đã gộp vào schema.sql)
├── schema_exam_type.sql         # Migration exam_type (đã gộp vào schema.sql)
├── wrangler.jsonc               # Cloudflare Pages config
└── .github/workflows/ci.yml      # lint + build:static mỗi lần push (không deploy)
```

---

## 🚀 Cài đặt & chạy

### Yêu cầu
- **Node.js 22** (theo CI) hoặc Bun
- Backend Express là **tùy chọn** — chạy static-only cũng được

### 1. Cài dependencies
```bash
npm install
```

### 2. Chuẩn bị dữ liệu ⚠️ bắt buộc

Ba file CSV và `question_texts.json` **không** được commit (xem `.gitignore`). Clone mới phải copy vào thư mục gốc:

```bash
raw_students.csv
raw_student_responses.csv
questions.csv
question_texts.json          # tuỳ chọn — xem ghi chú bên dưới
```

> Cả `question_texts.json` và `knowledge_structure.csv` đều được nạp qua `import.meta.glob`
> trong `lib/contentFiles.ts`, **không** import tĩnh. Thiếu file vẫn `npm run lint` và
> `npm run build` chạy bình thường — app chỉ khởi động rỗng rồi lấy nội dung từ Supabase
> (`exam_settings.question_texts` / `exam_settings.knowledge_csv`).

### 3. Cấu hình biến môi trường
```bash
cp .env.example .env
```
Điền `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` nếu muốn dùng Supabase. Bỏ trống thì app chạy bằng `/api` hoặc file JSON tĩnh.

### 4. Chạy development
```bash
npm run dev
```
Chạy `bun run server.ts` — Vite middleware + Express, tải CSV từ `process.cwd()`. Mở <http://localhost:3000>.

> Lệnh `dev` cần **Bun** (`bun install -g bun` hoặc tải từ bun.sh). Các lệnh còn lại (`lint`, `build`, `build:static`, `export-data`, `start`) chỉ cần Node.js.

### 5. Build & chạy production (có backend)
```bash
npm run lint        # tsc --noEmit
npm run build       # vite build → dist/  +  esbuild server.ts → dist/server.cjs
npm run start       # node dist/server.cjs
```

### 6. Build tĩnh (không cần backend)
```bash
npm run build:static   # export-data → public/data/*.json, rồi vite build
npm run preview
```
`vite.config.ts` đặt `base: './'` nên build chạy được cả ở domain gốc lẫn sub-path.

---

## 📝 Dữ liệu đầu vào

### `raw_students.csv` — điểm tổng hợp
**2 dòng header**, dữ liệu bắt đầu từ dòng 3.

```
STT,id,Họ và tên,Email,Thô,,IRT,,Thưởng phạt,
,,,,Toán,TDKH,Toán,TDKH,Toán,TDKH
```

Server ưu tiên đọc theo **tên cột**; nếu thiếu cột `tho_toan` thì chuyển sang **chỉ số cố định** (0, 2, 3, 4–9). Loại kỳ thi lấy từ cột đầu khớp trong `EXAM_TYPE_HEADERS` (`exam_type`, `examtype`, `loai_ky_thi`, `loai_ki_thi`, `ky_thi`), mặc định `survey`.

### `raw_student_responses.csv` — ma trận trả lời
**1 dòng header**, **120 câu** mỗi thí sinh (14 cột thông tin + 120 cột đáp án = 134 cột). Bỏ qua dòng có ít hơn `MIN_RESPONSE_COLUMNS` cột. Vị trí tên/email được dò bằng heuristic (tìm ô bằng `TRUE`, hoặc ô đầu tiên không rỗng trong cột 1–6). Email được back-fill vào danh sách học sinh.

Quy ước trạng thái:

| Giá trị | Trạng thái |
|---|---|
| `1`, `1.0`, `1.00`, `0.1`, `0.25`, `0.5` | `correct` |
| `0`, `0.0`, `0.00` | `wrong` |
| rỗng, `-1`, `\r`, `\r\n` | `missing` |
| số > 0 / = 0 / < 0 (khác) | lần lượt `correct` / `wrong` / `missing` |

⚠️ **Câu 4 bị ép cứng thành `correct`** do lỗi đề thi.

### `questions.csv` — thống kê câu hỏi
**2 dòng header**, dữ liệu từ dòng 3, yêu cầu ≥ 11 cột. Cột 0 forward-fill cho cột `phan_thi` (môn). Cờ `isError = true` khi `parts[2] === 'LỖI ĐỀ THI'` hoặc `parts[1] === 'Câu 4'`.

### `question_texts.json`
```json
{ "Câu 1": "<nội dung câu hỏi đầy đủ>", "Câu 2": "..." }
```
60 khóa, tải dùng cho modal xem đáp án trong `Dashboard.tsx`.

---

## 🔐 Trang quản trị

Truy cập bằng `#admin`. Nếu chưa cấu hình Supabase sẽ hiện hướng dẫn; ngược lại yêu cầu đăng nhập email/password (`supabase.auth.signInWithPassword`), session được khôi phục qua `getSession()`.

### Luồng nạp dữ liệu
```
FileReader (3 file CSV)  →  parseStudents / parseResponses / parseQuestions  (local)
                         →  xoá toàn bộ row của exam_type đang chọn
                         →  insert lại theo lô 500 dòng vào Supabase
```

### Các nhóm chức năng
1. **Thống kê** — số thí sinh / câu hỏi / dòng trả lời; mở rộng: điểm TB Toán–TDKH, số đạt ≥ 30, câu khó nhất.
2. **Export Excel** — `BaoCao_DiemThi.xlsx`, 15 cột tiếng Việt.
3. **Upload CSV** — chọn *Kì Thi Khảo Sát* / *Kì Thi Thử*, hiển thị số row hiện có của từng loại.
4. **Cài đặt kỳ thi** — `exam_name` + 4 cờ hiển thị: `show_tv`, `show_ta`, `show_toan`, `show_tdkh` (thiếu thì mặc định `true`).
5. **Cài đặt hiển thị phụ** — `answer_link`, `next_exam_date`, `exam_url` (sinh QR).
6. **Danh sách SBD** — textarea dạng `Tên<TAB>SBD`, lưu vào `sbd_map`.
7. **Knowledge CSV** — upload / textarea / nút *Đặt lại mẫu 120 câu*, có **preview sống** (số vùng, số câu, badge 120-câu hay 60-câu). Lưu vào cả `knowledge_csv` (Supabase) và `localStorage`. Đây là nguồn duy nhất của ma trận kiến thức.
8. **Nội dung câu hỏi** — textarea JSON cho `question_texts`, seed từ `question_texts.json`.
9. **Vùng nguy hiểm** — xoá một loại kỳ thi hoặc xoá toàn bộ.

Mọi cài đặt đều `upsert` vào `exam_settings` theo khoá `key`, kèm `updated_at`.

---

## 🗄 Supabase

| Bảng | Nội dung |
|---|---|
| `students` | Một dòng / thí sinh / kỳ thi, điểm `tho_*`, `irt_*`, `tp_*` |
| `questions` | Thống kê từng câu |
| `student_responses` | Một dòng / thí sinh / câu (chỉ ghi câu sai & bỏ trống) |
| `exam_settings` | Bảng key-value cho toàn bộ cấu hình hiển thị |

RLS: bật cho cả 4 bảng. Có index cho `exam_type` và các cột truy vấn.

| Phép | Chính sách |
|---|---|
| **Đọc** | Mở cho mọi người, kể cả anonymous — dashboard công khai dùng anon key |
| **Ghi / sửa / xoá** | Chỉ email nằm trong `public.is_admin()` |

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = ANY (ARRAY[
    'minhducle629@gmail.com'
  ]::text[]);
$$;
```

Thêm email mới: sửa mảng trong `is_admin()` rồi chạy lại `schema_migrate.sql`.
Trước đây policy là `TO authenticated USING (true)` — tức **bất kỳ** tài khoản
nào đăng ký trong Supabase Auth cũng xoá sạch được cả 4 bảng.

### Áp schema

| File | Khi nào dùng |
|---|---|
| `schema.sql` | **Database trống, cài mới.** Chạy 1 lần. Dùng `CREATE POLICY` nên chạy lại sẽ lỗi `42710: policy already exists` |
| `schema_migrate.sql` | **Database đang chạy.** Idempotent — chạy lại bao nhiêu lần cũng được, không mất dữ liệu. Bổ sung cột thiếu (`exam_type`, nhóm `tv`/`ta`), tạo index, và `DROP POLICY IF EXISTS` → `CREATE POLICY` |

Có thể kiểm tra database đã đúng chưa:

```sql
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('students','questions','student_responses')
  AND column_name IN ('exam_type','tho_tv','tho_ta','irt_tv','irt_ta','tp_tv','tp_ta')
ORDER BY table_name, column_name;
```

### Nạp dữ liệu từ CSV

```bash
npm run import:supabase -- --type=survey --prune-unknown
```

Xem `scripts/import-supabase.ts` để biết các cờ. `--prune-unknown` đọc schema thật
trên PostgREST và bỏ mọi cột database chưa có — dùng khi migration chưa chạy đủ.
Sau khi `schema_migrate.sql` đã chạy thì bỏ cờ này đi.

---

## 🌐 Deploy

### Cloudflare Pages
```bash
npm run deploy
```
= `build:static` + `wrangler pages deploy dist --project-name ketquathithumitht --branch main`

| Cấu hình | Giá trị |
|---|---|
| Build command | `npm run build:static` |
| Output directory | `dist` |
| Project name | `ketquathithumitht` (`wrangler.jsonc`) |

Kết nối repo GitHub (private) để auto-deploy mỗi lần push lên `main`.

### GitHub Pages — không dùng
GitHub từ chối bật Pages cho repo này:

```
POST /repos/akona-bit/exam-analytics-dashboard/pages
→ 422 "Your current plan does not support GitHub Pages for this repository."
```

Repo **private** + gói Free nên không có Pages. Workflow `deploy.yml` cũ đã bị xoá.
`.github/workflows/ci.yml` thay thế, chỉ chạy `npm ci → lint → build:static` mỗi lần
push lên `main` — giữ vai trò bắt lỗi build mà Cloudflare deploy không phát hiện
(ví dụ import tĩnh một file đang bị gitignore).

### Header bảo mật
`public/_headers` (Cloudflare) + meta tag trong `index.html`: CSP, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`. `index.html` / `logo.png` / `bg.jpg` được đặt `no-cache`, ảnh OG cache 7 ngày.

---

## ⚠️ Ghi chú bảo mật

- **`#admin` không phải route guard.** Chỉ là hash + một hotspot `opacity-0`; bấm ở góc trên phải là vào được. Toàn bộ bảo vệ thực sự nằm ở **Supabase RLS + đăng nhập**.
- **Quyền ghi đã được siết** theo danh sách email trong `public.is_admin()` — xem [mục Supabase](#-supabase). Đây là điểm yếu đã được xử lý.
- **Phần đọc vẫn mở cho anonymous**, kể cả cột `email` của thí sinh trong bảng `students`. Đây là điều kiện để dashboard chạy không cần backend, nên email vẫn nằm trong payload JSON tải về trình duyệt dù giao diện không render nó. Muốn đóng thì phải bỏ `email` khỏi `select('*')` trong `App.tsx`.
- **Key `service_role` bypass hoàn toàn RLS.** Không được commit hay đưa vào client. Nếu từng gửi nó qua kênh không an toàn (shell history, tin nhắn), hãy đổi key ở Supabase → Settings → API.
- **`main.tsx` chặn F12 / Ctrl+U / chuột phải.** Đây chỉ là rào cản tâm lý, không phải bảo mật thực sự.

---

## 🧹 Đã dọn trong lần refactor gần nhất

Những thứ sau đã bị xoá vì là dead code / gây rối:

| Đã xoá | Lý do |
|---|---|
| `KnowledgeMatrix.tsx` | Không nơi nào import — `Dashboard.tsx` đã nội tuyến lại |
| `AdminPage.handleUploadOld` (~55 dòng) | Nhánh upload song song không bao giờ được gọi |
| Editor "Ma trận kiến thức (JSON)" + khoá `exam_settings.topic_map` | Trùng lặp với Knowledge CSV — CSV đã tự sinh `topicMap`, và `Dashboard` có nhận prop `topicMap` nhưng **không dùng ở đâu cả** |
| `lib/knowledgeStructure.defaultTopicMap` | Chỉ tồn tại để seed cho editor JSON đã xoá |
| `topicMap` trong `ParsedKnowledgeStructure` | Không còn nơi nào tiêu thụ sau khi bỏ prop `Dashboard.topicMap` |
| `Dashboard.maskEmail` | Định nghĩa nhưng không dùng (email đã bị ẩn khỏi UI) |
| `AdminPage` props `questions/students/topicMap/questionTexts` | Khai báo nhưng không dùng |
| `ClassAnalytics.onSelectStudent`, `QuestionTable.onRowClick` | Khai báo nhưng không dùng |
| `App.tsx → AdminPage.onDataChange` | Prop không tồn tại trong `AdminPageProps` (lỗi TS bị giấu bởi OOM của `tsc`) |
| `find_top.cjs`, `parse_csv.cjs`, `transform.cjs` | Script một lần; `transform.cjs` còn ghi đè `raw_students.csv` tại chỗ |
| `modify.cjs` / `modify2.cjs` / `modify3.cjs` / `fix-tags.cjs` | Codemod từng chạy một lần, hardcode absolute path |
| `remove-bg.cjs` | Xoá nền `public/avatar.png` — file đã bị xoá từ lâu |
| `scratch.txt`, `temp*.txt` | File nháp |
| `bun.lock` | Liệt kê dependency đã gỡ, gây mâu thuẫn với `package.json`. `package-lock.json` là nguồn duy nhất |
| `@google/genai`, `dotenv`, `html2canvas`, `jimp` | Không còn import ở đâu. `html2canvas` giờ chỉ là dependency gián tiếp của `jspdf` |

Các thứ khác vẫn còn nhưng gitignored: `response.json`, `api_data.json` (thực chất là HTML), `.workbuddy-ai/memory/` (ghi chú AI assistant, còn nhắc tên project cũ).

**Bảo trì:** `vite.config.ts` giờ đặt `build.emptyOutDir: true` nên `dist/` không còn tích tụ artifact cũ. `npm run clean` dùng Node thuần, chạy được trên Windows.