import React from 'react';

interface Props {
  onQuestionClick?: (qNum: number) => void;
  wrongQuestions?: number[];
  missingQuestions?: number[];
  topicMap?: Record<string, number[]>;
}

export const defaultTopicMap: Record<string, number[]> = {
  'Hệ bất phương trình bậc nhất 2 ẩn': [7, 16, 17],
  'Hàm số bậc 2': [6, 14],
  'Lượng giác': [3, 13],
  'Dãy số': [1, 18, 19],
  'Giới hạn & Hàm số liên tục': [2, 4, 8],
  'Số mũ & Logarit': [9, 11],
  'Đạo hàm': [12],
  'Xác suất & Tổ hợp': [5, 28, 29, 30],
  'Hệ thức lượng trong tam giác & Vecto': [10, 15],
  'Toạ độ Oxy': [24, 25, 26, 27],
  'Hình học không gian': [20, 21, 22, 23],
  'Logic sắp xếp': [31, 32, 33, 34],
  'Logic phân nhóm': [35, 36, 37, 38],
  'Dữ liệu bảng': [39, 40, 41, 42],
  'Dữ liệu biểu đồ cột': [43, 44, 45, 46],
  'Dữ liệu biểu đồ tròn': [47, 48, 49, 50],
  'Đọc hiểu KHTN': [51, 52, 53, 54, 55, 56],
  'Đọc hiểu KHXH': [57, 58, 59, 60],
};

export function KnowledgeMatrix({ wrongQuestions = [], missingQuestions = [], onQuestionClick, topicMap: propTopicMap }: Props) {
  // Mapping of question numbers to topics (example mapping)
  const topicMap = propTopicMap || defaultTopicMap;

  const checkTopic = (topic: string) => {
    const qList = topicMap[topic] || [];
    const missed = qList.filter(q => missingQuestions.includes(q));
    const wrong = qList.filter(q => wrongQuestions.includes(q));
    
    if (missed.length > 0 || wrong.length > 0) {
      let parts = [];
      if (wrong.length > 0) parts.push(`Sai câu ${wrong.join(', ')}`);
      if (missed.length > 0) parts.push(`Bỏ trống câu ${missed.join(', ')}`);
      
      const isMissingOnly = wrong.length === 0 && missed.length > 0;
      
      return { 
        hasError: true, 
        isMissingOnly,
        text: `(Cần ôn lại - ${parts.join('; ')})` 
      };
    }
    return { hasError: false, isMissingOnly: false, text: '' };
  };

  const getRowClass = (topic: string) => {
    const status = checkTopic(topic);
    if (!status.hasError) return 'hover:bg-slate-50 transition-colors';
    if (status.isMissingOnly) return 'bg-amber-50/70 hover:bg-amber-100 transition-colors';
    return 'bg-rose-50/70 hover:bg-rose-100 transition-colors';
  };

  const getCellClass = (topic: string) => {
    const status = checkTopic(topic);
    if (!status.hasError) return '';
    if (status.isMissingOnly) return 'text-amber-600 font-bold';
    return 'text-rose-600 font-bold';
  };

  const getSubtitleClass = (topic: string) => {
    const status = checkTopic(topic);
    if (status.isMissingOnly) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse border border-slate-200">
        <thead className="bg-slate-100 text-slate-700 font-semibold">
          <tr>
            <th className="border border-slate-200 px-3 py-2 text-center" colSpan={3}>Kiến thức</th>
          </tr>
        </thead>
        <tbody className="text-slate-600 align-top">
          {/* Đại số */}
          <tr className={getRowClass('Hệ bất phương trình bậc nhất 2 ẩn')}>
            <td className="border border-slate-200 px-3 py-2 font-bold text-slate-800 bg-white" rowSpan={8}>Đại số</td>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Hệ bất phương trình bậc nhất 2 ẩn')}`}>
              Hệ bất phương trình bậc nhất 2 ẩn <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Hệ bất phương trình bậc nhất 2 ẩn')}`}>{checkTopic('Hệ bất phương trình bậc nhất 2 ẩn').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2">
              <ul className="list-disc pl-4 space-y-1">
                <li>Quy hoạch tuyến tính/Bài toán tối ưu</li>
                <li>Biểu đồ venn</li>
                <li>Hệ bất phương trình tham số m</li>
              </ul>
            </td>
          </tr>
          <tr className={getRowClass('Hàm số bậc 2')}>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Hàm số bậc 2')}`}>
              Hàm số bậc 2 <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Hàm số bậc 2')}`}>{checkTopic('Hàm số bậc 2').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2">
              <ul className="list-disc pl-4 space-y-1">
                <li>Tam thức bậc 2</li>
                <li>(Bất) phương trình chứa căn thức bậc 2</li>
              </ul>
            </td>
          </tr>
          <tr className={getRowClass('Lượng giác')}>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Lượng giác')}`}>
              Lượng giác <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Lượng giác')}`}>{checkTopic('Lượng giác').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2">
              <ul className="list-disc pl-4 space-y-1">
                <li>Hàm số lượng giác</li>
                <li>Phương trình lượng giác</li>
              </ul>
            </td>
          </tr>
          <tr className={getRowClass('Dãy số')}>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Dãy số')}`}>
              Dãy số <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Dãy số')}`}>{checkTopic('Dãy số').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2">
              <ul className="list-disc pl-4 space-y-1">
                <li>Cấp số cộng/nhân. Tổng n cấp số</li>
                <li>Dãy số tăng/giảm, truy hồi</li>
              </ul>
            </td>
          </tr>
          <tr className={getRowClass('Giới hạn & Hàm số liên tục')}>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Giới hạn & Hàm số liên tục')}`}>
              Giới hạn & Hàm số liên tục <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Giới hạn & Hàm số liên tục')}`}>{checkTopic('Giới hạn & Hàm số liên tục').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2"></td>
          </tr>
          <tr className={getRowClass('Số mũ & Logarit')}>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Số mũ & Logarit')}`}>
              Số mũ & Logarit <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Số mũ & Logarit')}`}>{checkTopic('Số mũ & Logarit').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2">
              <ul className="list-disc pl-4 space-y-1">
                <li>Các phép biến đổi</li>
                <li>Giải (bất) phương trình</li>
              </ul>
            </td>
          </tr>
          <tr className={getRowClass('Đạo hàm')}>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Đạo hàm')}`}>
              Đạo hàm <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Đạo hàm')}`}>{checkTopic('Đạo hàm').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2"></td>
          </tr>
          <tr className={getRowClass('Xác suất & Tổ hợp')}>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Xác suất & Tổ hợp')}`}>
              Xác suất & Tổ hợp <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Xác suất & Tổ hợp')}`}>{checkTopic('Xác suất & Tổ hợp').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2">
              <ul className="list-disc pl-4 space-y-1">
                <li>Quy tắc cộng/nhân</li>
                <li>Hoán vị/Tổ hợp/Chỉnh hợp</li>
                <li>Xác suất</li>
              </ul>
            </td>
          </tr>

          {/* Hình học */}
          <tr className={getRowClass('Hệ thức lượng trong tam giác & Vecto')}>
            <td className="border border-slate-200 px-3 py-2 font-bold text-slate-800 bg-white" rowSpan={3}>Hình học</td>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Hệ thức lượng trong tam giác & Vecto')}`}>
              Hệ thức lượng trong tam giác & Vecto <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Hệ thức lượng trong tam giác & Vecto')}`}>{checkTopic('Hệ thức lượng trong tam giác & Vecto').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2">
              <ul className="list-disc pl-4 space-y-1">
                <li>Định lý sin/cos</li>
                <li>Tính diện tích/Giải tam giác</li>
              </ul>
            </td>
          </tr>
          <tr className={getRowClass('Toạ độ Oxy')}>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Toạ độ Oxy')}`}>
              Toạ độ Oxy <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Toạ độ Oxy')}`}>{checkTopic('Toạ độ Oxy').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2">
              <ul className="list-disc pl-4 space-y-1">
                <li>Toạ độ vecto</li>
                <li>Phương trình đường thẳng/đường tròn</li>
                <li>Khoảng cách/góc</li>
              </ul>
            </td>
          </tr>
          <tr className={getRowClass('Hình học không gian')}>
            <td className={`border border-slate-200 px-3 py-2 font-medium ${getCellClass('Hình học không gian')}`}>
              Hình học không gian <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Hình học không gian')}`}>{checkTopic('Hình học không gian').text}</div>
            </td>
            <td className="border border-slate-200 px-3 py-2">
              <ul className="list-disc pl-4 space-y-1">
                <li>Đường thẳng/mặt phẳng trong không gian</li>
                <li>Quan hệ song song/vuông góc</li>
                <li>Khoảng cách/góc</li>
                <li>Tính thể tích/diện tích</li>
              </ul>
            </td>
          </tr>

          {/* Logic */}
          <tr className={getRowClass('Logic sắp xếp')}>
            <td className="border border-slate-200 px-3 py-2 font-bold text-slate-800 bg-white" rowSpan={2}>Logic</td>
            <td className={`border border-slate-200 px-3 py-2 ${getCellClass('Logic sắp xếp')}`} colSpan={2}>
              Logic sắp xếp <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Logic sắp xếp')}`}>{checkTopic('Logic sắp xếp').text}</div>
            </td>
          </tr>
          <tr className={getRowClass('Logic phân nhóm')}>
            <td className={`border border-slate-200 px-3 py-2 ${getCellClass('Logic phân nhóm')}`} colSpan={2}>
              Logic phân nhóm <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Logic phân nhóm')}`}>{checkTopic('Logic phân nhóm').text}</div>
            </td>
          </tr>

          {/* PTSL */}
          <tr className={getRowClass('Dữ liệu bảng')}>
            <td className="border border-slate-200 px-3 py-2 font-bold text-slate-800 bg-white" rowSpan={3}>PTSL</td>
            <td className={`border border-slate-200 px-3 py-2 ${getCellClass('Dữ liệu bảng')}`} colSpan={2}>
              Dữ liệu bảng <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Dữ liệu bảng')}`}>{checkTopic('Dữ liệu bảng').text}</div>
            </td>
          </tr>
          <tr className={getRowClass('Dữ liệu biểu đồ cột')}>
            <td className={`border border-slate-200 px-3 py-2 ${getCellClass('Dữ liệu biểu đồ cột')}`} colSpan={2}>
              Dữ liệu biểu đồ cột <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Dữ liệu biểu đồ cột')}`}>{checkTopic('Dữ liệu biểu đồ cột').text}</div>
            </td>
          </tr>
          <tr className={getRowClass('Dữ liệu biểu đồ tròn')}>
            <td className={`border border-slate-200 px-3 py-2 ${getCellClass('Dữ liệu biểu đồ tròn')}`} colSpan={2}>
              Dữ liệu biểu đồ tròn <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Dữ liệu biểu đồ tròn')}`}>{checkTopic('Dữ liệu biểu đồ tròn').text}</div>
            </td>
          </tr>

          {/* SLKH */}
          <tr className={getRowClass('Đọc hiểu KHTN')}>
            <td className="border border-slate-200 px-3 py-2 font-bold text-slate-800 bg-white" rowSpan={2}>SLKH</td>
            <td className={`border border-slate-200 px-3 py-2 ${getCellClass('Đọc hiểu KHTN')}`} colSpan={2}>
              Đọc hiểu KHTN <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Đọc hiểu KHTN')}`}>{checkTopic('Đọc hiểu KHTN').text}</div>
            </td>
          </tr>
          <tr className={getRowClass('Đọc hiểu KHXH')}>
            <td className={`border border-slate-200 px-3 py-2 ${getCellClass('Đọc hiểu KHXH')}`} colSpan={2}>
              Đọc hiểu KHXH <div className={`text-xs font-semibold mt-0.5 ${getSubtitleClass('Đọc hiểu KHXH')}`}>{checkTopic('Đọc hiểu KHXH').text}</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
