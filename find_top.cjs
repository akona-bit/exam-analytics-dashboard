const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./api_data.json', 'utf8'));
const students = data.students || data; // depending on structure

const groups = new Map();
for (const a of students) {
  const score = ((a.thuongPhat && a.thuongPhat.toan) ? a.thuongPhat.toan : 0) + ((a.thuongPhat && a.thuongPhat.tdkh) ? a.thuongPhat.tdkh : 0);
  const key = a.email || a.name;
  const ex = groups.get(key);
  if (!ex || score > ex.totalScore) groups.set(key, { ...a, totalScore: score });
}
const rankData = Array.from(groups.values()).sort((a, b) => b.totalScore - a.totalScore);

console.log("Thủ Khoa:", rankData[0].name, "-", rankData[0].email, "- Điểm:", rankData[0].totalScore);
console.log("Á Khoa:", rankData[1].name, "-", rankData[1].email, "- Điểm:", rankData[1].totalScore);
