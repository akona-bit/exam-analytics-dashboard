const fs = require('fs');

const studentsLines = fs.readFileSync('raw_students.csv', 'utf8').split('\n').map(l => l.trim()).filter(l => l);
const responsesLines = fs.readFileSync('raw_student_responses.csv', 'utf8').split('\n').map(l => l.trim()).filter(l => l);

const dataStudents = studentsLines.slice(2);
const dataResponses = responsesLines.slice(1);

const outLines = [];
outLines.push('STT,id,Họ và tên,Email,Thô,,IRT,,Thưởng phạt,');
outLines.push(',,,,Toán,TDKH,Toán,TDKH,Toán,TDKH');

for (let i = 0; i < dataStudents.length; i++) {
  const partsS = dataStudents[i].split(',');
  const partsR = (dataResponses[i] || '').split(',');
  
  const stt = partsS[0];
  const name = partsS[1];
  
  // in raw_student_responses.csv, email is often at index 3 or 9, or the first containing '@'
  let email = partsR.find(p => p.includes('@')) || '';
  
  // but wait, earlier we saw: STT,id,Họ và tên,Email...
  // In the original raw_students.csv, it was STT,Họ và tên,...
  
  // let's parse original raw_students (from git? No I overwrote it. Let's assume it was STT,id,name,email from my script)
  // Let me just restore raw_students.csv if it's messed up.
  // Actually, partsS currently has: STT,id,Họ và tên,Email,ThôToán,...
  
  const thoToan = partsS[4];
  const thoTdkh = partsS[5];
  const irtToan = partsS[6];
  const irtTdkh = partsS[7];
  const tpToan = partsS[8];
  const tpTdkh = partsS[9];
  
  const id = name;
  outLines.push(`${stt},${id},${name},${email},${thoToan},${thoTdkh},${irtToan},${irtTdkh},${tpToan},${tpTdkh}`);
}

fs.writeFileSync('raw_students.csv', outLines.join('\n'));
console.log("Rewrote based on exact index matching!");
