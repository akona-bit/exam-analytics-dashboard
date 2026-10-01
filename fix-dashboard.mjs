import fs from 'fs';
let content = fs.readFileSync('Dashboard.tsx', 'utf8');

// The file has two `const studentRankInfo = useMemo(() => {`
// Let's find the FIRST one (at line 82) and remove it if it's identical or just rename it.
// Actually, let's just rename the SECOND one (at line 227).
let parts = content.split('const studentRankInfo = useMemo(() => {');
if (parts.length > 2) {
  content = parts[0] + 'const studentRankInfo = useMemo(() => {' + parts[1] + 'const studentRankInfoOld = useMemo(() => {' + parts.slice(2).join('const studentRankInfo = useMemo(() => {');
  fs.writeFileSync('Dashboard.tsx', content);
  console.log('Fixed duplicate studentRankInfo!');
} else {
  console.log('Could not find 2 instances of studentRankInfo.');
}
