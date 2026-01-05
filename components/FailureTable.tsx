
import React, { useState } from 'react';
import { FailedInvoice } from '../types';
import { DBService } from '../services/db';

interface FailureTableProps {
  failures: FailedInvoice[];
  onRefresh: () => void;
}

const FailureTable: React.FC<FailureTableProps> = ({ failures, onRefresh }) => {
  const [showImagePreview, setShowImagePreview] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const isPdf = (data: string | null) => {
    if (!data) return false;
    return data.startsWith('data:application/pdf') || 
           data.toLowerCase().includes('.pdf') || 
           data.startsWith('JVBERi0') ||
           data.includes('application/pdf');
  };

  const handlePreview = (fileUrl: string) => {
    if (!fileUrl) return;
    if (isPdf(fileUrl)) {
      try {
        const base64Data = fileUrl.includes(',') ? fileUrl.split(',')[1] : fileUrl;
        const binaryString = window.atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } catch (e) {
        alert('无法解析异常 PDF 文件');
      }
    } else {
      setShowImagePreview(fileUrl);
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id || !window.confirm('确定清除这条异常记录吗？')) return;
    await DBService.deleteFailure(id);
    onRefresh();
  };

  const totalPages = Math.ceil(failures.length / itemsPerPage);
  const currentData = failures.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
  };

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
         <p className="text-slate-400 font-bold italic text-xs">
           <i className="fa-solid fa-circle-info mr-2 text-indigo-400"></i>
           包含识别失败、网络超时或校验不通过的记录，点击“放大镜”可复核源文件。
         </p>
         <div className="flex items-center gap-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">每页展示数量</span>
            <select 
              value={itemsPerPage} 
              onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
            >
              {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v} 条/页</option>)}
            </select>
         </div>
      </div>

      <div className="flex-1 overflow-x-auto rounded-[2.5rem] border border-slate-100 shadow-sm bg-white overflow-hidden relative">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-[0.15em] text-[10px] border-b border-slate-100">
            <tr>
              <th className="px-10 py-6">源文件名</th>
              <th className="px-10 py-6">失败原因 / 状态反馈</th>
              <th className="px-10 py-6 text-center">产生时间</th>
              <th className="px-10 py-6 text-center">操作管理</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {failures.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-32 text-center text-slate-300 font-bold">
                  <div className="mb-6 opacity-20">
                    <i className="fa-solid fa-face-laugh-beam text-6xl"></i>
                  </div>
                  目前没有任何识别异常记录，系统运行良好
                </td>
              </tr>
            ) : (
              currentData.map(f => (
                <tr key={f.id} className="hover:bg-red-50/30 transition-colors group">
                  <td className="px-10 py-6 font-black text-slate-700 max-w-[240px] truncate" title={f.fileName}>{f.fileName}</td>
                  <td className="px-10 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-red-500 font-black text-[10px] bg-red-50 px-3 py-1.5 rounded-lg uppercase tracking-wider border border-red-100/50 inline-block self-start">
                        {f.error || '解析链路错误'}
                      </span>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-center text-slate-400 font-mono text-xs">
                    {new Date(f.createdAt).toLocaleString()}
                  </td>
                  <td className="px-10 py-6 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button 
                        onClick={() => handlePreview(f.fileUrl)} 
                        className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm flex items-center justify-center"
                        title={isPdf(f.fileUrl) ? "在新窗口预览 PDF" : "点击放大图片预览"}
                      >
                        <i className={`fa-solid ${isPdf(f.fileUrl) ? 'fa-file-pdf' : 'fa-magnifying-glass'}`}></i>
                      </button>
                      <button 
                        onClick={() => handleDelete(f.id)} 
                        className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center justify-center"
                        title="删除此异常记录"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
         <div className="mt-6 flex items-center justify-center gap-4">
            <button 
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              className="p-3 px-6 bg-white border border-slate-100 rounded-xl font-bold text-xs disabled:opacity-20 hover:bg-slate-50 transition-all"
            >
              上一页
            </button>
            <span className="text-xs font-black text-slate-400">{currentPage} / {totalPages}</span>
            <button 
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              className="p-3 px-6 bg-white border border-slate-100 rounded-xl font-bold text-xs disabled:opacity-20 hover:bg-slate-50 transition-all"
            >
              下一页
            </button>
         </div>
      )}

      {showImagePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-6 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="relative bg-white rounded-[3rem] w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-white/20">
              <div className="p-8 border-b flex items-center justify-between bg-white px-12 sticky top-0 z-10">
                <div className="flex items-center gap-5">
                  <div className="bg-red-50 p-4 rounded-2xl text-red-600 shadow-inner">
                    <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">异常源文件复核</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-1">您可以查看原始图片以分析识别失败的具体原因</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowImagePreview(null)} 
                  className="w-14 h-14 rounded-full hover:bg-slate-100 flex items-center justify-center transition-all text-slate-400"
                >
                  <i className="fa-solid fa-xmark text-3xl"></i>
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-12 bg-slate-900 flex items-center justify-center custom-scrollbar">
                  <img 
                    src={showImagePreview} 
                    className="max-w-full max-h-full object-contain bg-white rounded-2xl shadow-2xl border-4 border-white" 
                    alt="异常发票源件预览" 
                  />
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default FailureTable;
