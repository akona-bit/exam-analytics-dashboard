import fs from 'fs';

let dashStr = fs.readFileSync('Dashboard.tsx', 'utf8');

const startMarker = `          {/* Leaderboard */}`;
const endMarker = `            </div>\n          </div>`;

const startIndex = dashStr.indexOf(startMarker);
if (startIndex !== -1) {
  const endIndex = dashStr.indexOf(endMarker, startIndex);
  if (endIndex !== -1) {
    const toRemove = dashStr.substring(startIndex, endIndex + endMarker.length);
    dashStr = dashStr.replace(toRemove, '');
    fs.writeFileSync('Dashboard.tsx', dashStr);
    console.log("Leaderboard removed successfully.");
  } else {
    console.log("Could not find end marker.");
  }
} else {
  console.log("Could not find start marker.");
}
