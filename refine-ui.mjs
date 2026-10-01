import fs from 'fs';

let dashStr = fs.readFileSync('Dashboard.tsx', 'utf8');

// Update Button
dashStr = dashStr.replace(
  'className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full transition-all shadow-lg hover:shadow-xl active:scale-95 text-sm sm:text-base tracking-wide"',
  'className="px-10 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-full transition-all shadow-lg hover:shadow-xl active:scale-95 text-sm sm:text-base tracking-wide"'
);

// Update title typography roughly
dashStr = dashStr.replace(/className="text-5xl sm:text-7xl md:text-8xl font-black leading-tight px-4 text-blue-600 z-10 relative"/, 'className="text-5xl sm:text-7xl md:text-[5.5rem] font-black leading-tight px-6 text-blue-500 z-10 relative"');
dashStr = dashStr.replace(/WebkitTextStroke: "1px white"/, 'WebkitTextStroke: "2px white"');
dashStr = dashStr.replace(/textShadow: "2px 2px 0px white, -2px -2px 0px white, 2px -2px 0px white, -2px 2px 0px white"/, 'textShadow: "0px 4px 15px rgba(0,0,0,0.1), 3px 3px 0px white, -3px -3px 0px white, 3px -3px 0px white, -3px 3px 0px white"');

// Update input shadow
dashStr = dashStr.replaceAll(
  'border border-transparent focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 text-slate-700 font-medium text-base transition-all shadow-md bg-white hover:shadow-lg focus:shadow-lg outline-none',
  'border border-transparent focus:border-blue-400 focus:ring-4 focus:ring-blue-400/20 text-slate-700 font-medium text-base transition-all shadow-lg bg-white/95 backdrop-blur-sm hover:shadow-xl focus:shadow-xl outline-none'
);

fs.writeFileSync('Dashboard.tsx', dashStr);
console.log("Refactored UI successfully");
