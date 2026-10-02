const fs = require('fs');

function parse() {
  const content = fs.readFileSync('raw_students.csv', 'utf-8').split('\n').filter(Boolean);
  const rows = content.slice(1).map(r => r.split(','));
  const students = rows.map(r => {
    return {
      name: r[1],
      email: r[2],
      thuongPhat: {
        tv: parseFloat(r[6] || 0),
        ta: parseFloat(r[7] || 0),
        toan: parseFloat(r[8] || 0),
        tdkh: parseFloat(r[9] || 0)
      }
    };
  });
  
  const groups = new Map();
  for (const a of students) {
    if(!a.name) continue;
    const score = (a.thuongPhat.tv || 0) + (a.thuongPhat.ta || 0) + (a.thuongPhat.toan || 0) + (a.thuongPhat.tdkh || 0);
    const key = a.email || a.name;
    const ex = groups.get(key);
    if (!ex || score > ex.totalScore) groups.set(key, { ...a, totalScore: score });
  }
  const rankData = Array.from(groups.values()).sort((a, b) => b.totalScore - a.totalScore);

  console.log("Thủ Khoa:", rankData[0].name, "-", rankData[0].email, "- Điểm:", rankData[0].totalScore);
  console.log("Á Khoa:", rankData[1].name, "-", rankData[1].email, "- Điểm:", rankData[1].totalScore);
}
parse();
