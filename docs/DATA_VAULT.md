# Bảo vệ dữ liệu thi (Exam Data Vault)

Tài liệu này mô tả cách dự án bảo vệ dữ liệu thi / thông tin học sinh (PII) để:

1. **Không bị đẩy lên GitHub** (kể cả vô tình `git add`).
2. **Không bị xóa nhầm** khi dọn dẹp, `git clean`, format ổ, hoặc thao tác sai.
3. **Luôn có bản lưu ngoài repo**, gồm một bản mã hóa trên Google Drive.

> Không có biện pháp nào là "tuyệt đối" trước người có quyền quản trị máy/ổ đĩa.
> Mục tiêu ở đây là: ngăn tai nạn, ngăn commit, và luôn có nhiều bản để phục hồi.

---

## 1. Vị trí

| Thứ | Đường dẫn |
|---|---|
| Vault chính (ngoài repo) | `D:\ExamDataVault` |
| Snapshot theo thời gian | `D:\ExamDataVault\snapshots\<timestamp>\` |
| Mọi phiên bản dữ liệu từ lịch sử Git | `D:\ExamDataVault\history\git-blobs\` |
| Git bundle trước khi rewrite | `D:\ExamDataVault\repo-history\*.bundle` |
| Bản mã hóa trên Google Drive | `G:\My Drive\ExamVaultBackups\` |
| Khóa giải mã (DPAPI + file recovery) | `%APPDATA%\ExamVault\backup.key` và `%USERPROFILE%\ExamVault-RECOVERY-KEY.txt` |

Repo **không** chứa các file dữ liệu này. `public/data/` chỉ là thư mục sinh ra khi chạy
`npm run export-data`, và đã bị `.gitignore` chặn.

---

## 2. Các lớp bảo vệ

### Lớp 1 — `.gitignore`
Chặn `*.csv`, `*.xlsx`, `*.pdf`, `*.db`, `*.zip`, `raw_*`, `response.json`,
`public/data/`, `dist/data/`, `.env*`, v.v.

Ngoại lệ có chủ đích: `knowledge_structure.csv` (cấu hình app, cần cho build/CI).

### Lớp 2 — pre-commit hook
Cài một lần:

```powershell
git config core.hooksPath .githooks
```

Từ đó mỗi lần `git commit`, hook chạy:

```powershell
node scripts/check-no-exam-data.mjs --staged
```

Nếu có dữ liệu thi trong index, commit bị **chặn ngay** và in danh sách file.

### Lớp 3 — CI guard
`.github/workflows/ci.yml` chạy:

```powershell
node scripts/check-no-exam-data.mjs
```

Nếu ai đó force-add dữ liệu và push, CI fail. (Repo hiện là **private**, 0 fork.)

### Lớp 4 — vault ngoài repo
`D:\ExamDataVault` nằm ngoài `D:\PROJECT\kết-quả-khảo-sát`, nên:

- `git clean -fdx` không chạm tới.
- Xóa repo/checkout lại không làm mất vault.
- Mỗi snapshot là bất biến: file được đặt **read-only**, có `manifest.sha256`.
- ACL **deny Delete** cho user hiện tại trên vault và các thư mục con.

Muốn xóa vault có chủ đích: Properties → Security → Advanced → bỏ rule Deny,
hoặc chạy PowerShell với quyền owner để sửa ACL. Đây là chủ ý để chống xóa nhầm.

### Lớp 5 — lịch sử Git được lưu riêng
Trước khi purge lịch sử, script:

- Trích **tất cả** blob dữ liệu từ mọi commit/ref vào `history\git-blobs\`.
- Tạo `git bundle --all` vào `repo-history\`.
- Sau đó mới rewrite lịch sử và force-push.

Nghĩa là dữ liệu bị xóa khỏi GitHub nhưng **không bị xóa khỏi máy**.

### Lớp 6 — bản mã hóa ngoài site
Mỗi snapshot được zip + mã hóa **AES-256-CBC + HMAC-SHA256**, ghi vào
`G:\My Drive\ExamVaultBackups\*.zip.aes`. Không có key thì không đọc được.

---

## 3. Chạy backup

```powershell
powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1
```

Script sẽ:

1. Tạo Git bundle (nếu chưa có) và trích lịch sử (nếu chưa có).
2. Copy toàn bộ file dữ liệu thi vào `snapshots\<timestamp>\`.
3. Tính SHA-256 và ghi `manifest.sha256`.
4. Đặt read-only + ACL deny Delete.
5. Verify lại hash.
6. Zip + mã hóa và ghi bản Google Drive.

Các tùy chọn:

```powershell
# Chỉ kiểm tra snapshot mới nhất
powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1 -Verify

# Phục hồi snapshot mới nhất ra thư mục riêng trong repo (không ghi đè dữ liệu đang có)
powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1 -RestoreLatest

# Giải mã một file .zip.aes
powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1 `
  -DecryptFile "G:\My Drive\ExamVaultBackups\examvault-2026-10-23_120000.zip.aes" `
  -OutFile "$env:TEMP\restore.zip"

# Bỏ qua Google Drive / lịch sử Git khi cần chạy nhanh
powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1 -SkipCloud
powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1 -SkipHistory -SkipBundle
```

> Google Drive phải đang chạy và đã mount `G:\My Drive` thì bản cloud mới được ghi.

---

## 4. Khóa giải mã

- Khóa gốc 64 byte được tạo ngẫu nhiên, lưu DPAPI tại `%APPDATA%\ExamVault\backup.key`
  (chỉ user hiện tại trên máy này giải mã được).
- Một bản recovery dạng base64 nằm ở `%USERPROFILE%\ExamVault-RECOVERY-KEY.txt`.
- **Hãy copy recovery key vào password manager.** Nếu mất máy và mất file recovery,
  bản Google Drive sẽ không thể giải mã.
- Không đưa recovery key vào repo, chat công khai, hay ảnh chụp màn hình.

---

## 5. Nếu lỡ commit dữ liệu thi

1. Bỏ khỏi index nhưng **giữ file trên đĩa**:

   ```powershell
   git rm --cached -- <file>
   ```

2. Kiểm tra lại:

   ```powershell
   node scripts/check-no-exam-data.mjs
   ```

3. Nếu file đã nằm trong lịch sử đã push, cần rewrite lịch sử (xem mục 6).
   Chỉ `git rm --cached` ở commit mới **không** xóa dữ liệu khỏi commit cũ.

4. Nếu repo private và chưa từng public: rủi ro thấp hơn, nhưng vẫn nên purge.
   Nếu repo đã từng public/fork: coi như dữ liệu đã lộ; cân nhắc thông báo và
   thu hồi/xoay thông tin nếu cần.

---

## 6. Lịch sử đã purge

Ngày purge: `2026-10-23` (ghi bởi phiên thiết lập).

Các path đã xóa khỏi **toàn bộ** lịch sử Git:

- `raw_students.csv`
- `raw_student_responses.csv`
- `questions.csv`
- `toan_responses.csv`
- `response.json`
- `api_data.json`
- `question_texts.json`
- `public/361_A3.pdf`
- `tonghop.xlsx` (nếu có trong ref local)

Bản gốc trước purge:

- Git bundle: `D:\ExamDataVault\repo-history\*.bundle`
- Từng blob: `D:\ExamDataVault\history\git-blobs\`

Sau purge, kiểm tra:

```powershell
git log --all --oneline -- raw_students.csv raw_student_responses.csv response.json public/361_A3.pdf
# Kỳ vọng: không có kết quả

node scripts/check-no-exam-data.mjs
# Kỳ vọng: OK
```

Lưu ý: GitHub có thể còn cache commit cũ trong một thời gian ngắn sau force-push.
Với repo private, 0 fork, rủi ro thấp. Nếu cần tuyệt đối, có thể xóa repo và tạo lại,
hoặc liên hệ GitHub Support để purge cache.

---

## 7. Giới hạn cần biết

- ACL deny Delete chỉ chống **xóa nhầm**; owner/Administrator vẫn có thể đổi ACL.
- File read-only chỉ chống ghi/xóa thông thường, không chống format ổ.
- Google Drive là dịch vụ bên ngoài; dữ liệu đã mã hóa trước khi upload.
- Nếu ổ D: hỏng **và** mất recovery key, bản cloud coi như mất.
- Luôn giữ ít nhất: vault D:, bản cloud mã hóa, và recovery key ở nơi khác.

---

## 8. Việc nên làm định kỳ

- Chạy backup sau mỗi lần có dữ liệu thi mới:

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1
  ```

- Chạy verify mỗi tháng:

  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\vault-backup.ps1 -Verify
  ```

- Kiểm tra recovery key vẫn còn trong password manager.
- Không commit `public/data/`, `raw_*.csv`, `response.json`, `*.xlsx`, `*.pdf`.
