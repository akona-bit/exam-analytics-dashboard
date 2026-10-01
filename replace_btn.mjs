import fs from 'fs';
let content = fs.readFileSync('Dashboard.tsx', 'utf8');

const regex = /<button[\s\S]*?type="submit"[\s\S]*?>\s*TRA CỨU KẾT QUẢ\s*<\/button>/;
const replacement = `<button 
              type="submit"
              className="px-10 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-full transition-all shadow-lg hover:shadow-xl active:scale-95 text-sm sm:text-base tracking-wide flex items-center gap-2 justify-center mx-auto"
            >
              <Search className="w-5 h-5" />
              TRA CỨU KẾT QUẢ
            </button>`;

if (regex.test(content) && !content.includes('<Search className="w-5 h-5" />\n              TRA CỨU KẾT QUẢ')) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('Dashboard.tsx', content);
  console.log('Button replaced successfully!');
} else {
  console.log('Button already has search icon or not found.');
}
