const fs = require('fs');

const file = 'd:/kết-quả-khảo-sát/Dashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The closing tags are missing
content = content.replace(
  'TRA CỨU KẾT QUẢ\n            </button>\n\n\n\n        </div>',
  'TRA CỨU KẾT QUẢ\n            </button>\n          </div>\n          </form>\n\n\n\n        </div>'
);

fs.writeFileSync(file, content);
