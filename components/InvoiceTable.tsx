
import React, { useState, useRef } from 'react';
import { InvoiceData } from '../types';
import { DBService } from '../services/db';

interface InvoiceTableProps {
  invoices: InvoiceData[];
  loading: boolean;
  onRefresh?: () => void;
}

const USE_UNIT_OPTIONS = [
  'chs', 'kcs', 'xxs', '1', '2', '3', '4', 'yt', 'xha', 'dt', 'jxc', 
  'xxzx', 'bgs', 'ct', 'rsk', 'jyb', 'zgb', 'zjz', 'cw', 'ajb', 'jw', 'gh', 'yj'
];

const InvoiceTable: React.FC<InvoiceTableProps> = ({ invoices, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceData | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [expandedId, setExpandedId] = useState<string | number | null>(null);

  const [colWidths, setColWidths] = useState<Record<string, number>>({
    select: 45,
    expand: 35,
    stockNo: 95,        
    invoiceNo: 110,
    itemName: 160,
    seller: 120,         
    purchaseAmount: 100,
    inStockAmount: 100,
    useUnit: 70,        
    tax: 80,
    date: 95,           
    actions: 90 // 移除删除按钮后略微调窄
  });

  const resizingCol = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const onMouseDown = (col: string, e: React.MouseEvent) => {
    resizingCol.current = col;
    startX.current = e.pageX;
    startWidth.current = colWidths[col];
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingCol.current) return;
    const delta = e.pageX - startX.current;
    const newWidth = Math.max(startWidth.current + delta, 30);
    setColWidths(prev => ({ ...prev, [resizingCol.current!]: newWidth }));
  };

  const onMouseUp = () => {
    resizingCol.current = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'default';
  };

  const filtered = invoices.filter(inv => 
    inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.sellerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    inv.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.inStockDate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.inStockNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.useUnit?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allPageIds = currentData.map(d => d.id!);
      setSelectedIds(new Set([...Array.from(selectedIds), ...allPageIds]));
    } else {
      const currentPageIds = new Set(currentData.map(d => d.id!));
      const next = new Set(Array.from(selectedIds).filter(id => !currentPageIds.has(id)));
      setSelectedIds(next);
    }
  };

  const handleToggleSelect = (e: React.MouseEvent, id: string | number) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBatchDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    
    const confirmMsg = `⚠️ 确定要彻底删除当前选中的 ${count} 项记录吗？\n该操作无法撤销。`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await DBService.deleteInvoicesBatch(Array.from(selectedIds));
      // 清空选中状态
      setSelectedIds(new Set());
      // 强制刷新数据
      if (onRefresh) {
        onRefresh();
      }
      alert(`成功删除 ${count} 条记录`);
    } catch (err: any) { 
      console.error("Batch delete error:", err);
      alert('批量删除失败，请检查数据库状态'); 
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    try {
      await DBService.updateInvoice(editingInvoice);
      setEditingInvoice(null);
      if (onRefresh) onRefresh();
    } catch (err: any) { alert('保存失败'); }
  };

  const handlePreview = (e: React.MouseEvent, fileUrl: string) => {
    e.stopPropagation();
    if (!fileUrl) return;
    if (fileUrl.includes('application/pdf')) {
      const base64Data = fileUrl.includes(',') ? fileUrl.split(',')[1] : fileUrl;
      const binaryString = window.atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      window.open(URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), '_blank');
    } else {
      setPreviewUrl(fileUrl);
    }
  };

  const exportCSV = (mode: 'all' | 'stock') => {
    let headers: string[] = [];
    let rows: any[][] = [];
    if (mode === 'all') {
      headers = ['入库单号', '发票号', '项目名称', '发票类型', '销售方', '采购金额', '入库金额', '税额', '使用单位', '开票日期', '规格型号', '单位', '数量', '单价', '价税合计', '备注'];
      rows = filtered.map(inv => [inv.inStockNo, inv.invoiceNumber, inv.itemName, inv.invoiceType, inv.sellerName, inv.purchaseAmount, inv.inStockAmount, inv.taxAmount, inv.useUnit, inv.date, inv.specification, inv.unit, inv.quantity, inv.unitPrice, inv.totalAmountNum, inv.remark]);
    } else {
      headers = ['入库单号', '入库日期', '项目名称', '规格型号', '单位', '数量', '入库金额', '税率', '采购金额', '销售方名称', '发票号(后8位)', '使用单位'];
      rows = filtered.map(inv => [inv.inStockNo, inv.inStockDate, inv.itemName, inv.specification, inv.unit, inv.quantity, inv.inStockAmount, inv.taxRate, inv.purchaseAmount, inv.sellerName, inv.invoiceShortNo, inv.useUnit]);
    }
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }));
    link.download = `${mode === 'all' ? '全台账' : '入库台账'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const ResizableTh = ({ id, label, className = "", align = "left" }: { id: string, label: string, className?: string, align?: "left" | "right" | "center" }) => (
    <th 
      style={{ width: colWidths[id] }} 
      className={`px-3 py-5 font-black text-[12px] uppercase tracking-wider border-b border-slate-100 sticky top-0 z-10 bg-slate-50/95 backdrop-blur-md text-slate-400 relative group/th ${className}`}
    >
      <div className={`flex items-center ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
      </div>
      <div onMouseDown={(e) => onMouseDown(id, e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400/50 z-20 transition-colors" />
    </th>
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input 
            type="text" placeholder="搜索台账关键字..." value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all font-bold text-slate-700 text-sm"
          />
        </div>
        <div className="flex gap-3">
          {selectedIds.size > 0 && (
            <button 
              onClick={handleBatchDelete} 
              className="bg-red-500 hover:bg-red-600 active:scale-95 text-white px-5 py-3 rounded-2xl font-black text-sm shadow-lg shadow-red-100 transition-all flex items-center"
            >
              <i className="fa-solid fa-trash-can mr-2"></i>批量删除选中项 ({selectedIds.size})
            </button>
          )}
          <button onClick={() => exportCSV('all')} className="bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-sm shadow-lg hover:bg-black transition-colors">
            <i className="fa-solid fa-download mr-2"></i>导出全台账
          </button>
          <button onClick={() => exportCSV('stock')} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-colors">
            <i className="fa-solid fa-file-excel mr-2"></i>导出入库单
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto rounded-[2.5rem] border border-slate-100 bg-white custom-scrollbar shadow-inner relative">
        <table className="w-full text-sm text-left border-collapse table-fixed min-w-[1100px]">
          <thead>
            <tr>
              <th style={{ width: colWidths.select }} className="px-2 py-5 border-b border-slate-100 sticky top-0 z-10 bg-slate-50/95 text-center">
                <input type="checkbox" onChange={handleSelectAll} checked={currentData.length > 0 && currentData.every(d => selectedIds.has(d.id!))} className="w-5 h-5 rounded accent-indigo-600 cursor-pointer" />
              </th>
              <th style={{ width: colWidths.expand }} className="px-1 py-5 border-b border-slate-100 sticky top-0 z-10 bg-slate-50/95"></th>
              <ResizableTh id="stockNo" label="入库单号" />
              <ResizableTh id="invoiceNo" label="发票号码" />
              <ResizableTh id="itemName" label="项目名称" />
              <ResizableTh id="seller" label="供应商" />
              <ResizableTh id="purchaseAmount" label="采购金额" align="right" />
              <ResizableTh id="inStockAmount" label="入库金额" align="right" />
              <ResizableTh id="useUnit" label="单位" align="center" />
              <ResizableTh id="tax" label="税额" align="right" />
              <ResizableTh id="date" label="日期" />
              <ResizableTh id="actions" label="管理" align="center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={12} className="py-40 text-center text-slate-300 font-black text-lg">数据库加载中...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={12} className="py-40 text-center text-slate-300 font-black text-lg">暂无数据记录</td></tr>
            ) : (
              currentData.map((inv) => (
                <React.Fragment key={inv.id}>
                  <tr onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id!)} className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${selectedIds.has(inv.id!) ? 'bg-indigo-50/30' : ''} ${expandedId === inv.id ? 'bg-slate-50' : ''}`}>
                    <td className="px-2 py-4 text-center">
                      <input type="checkbox" checked={selectedIds.has(inv.id!)} onChange={(e) => handleToggleSelect(e as any, inv.id!)} onClick={(e) => e.stopPropagation()} className="w-5 h-5 rounded accent-indigo-600 cursor-pointer" />
                    </td>
                    <td className="px-1 py-4 text-center">
                      <i className={`fa-solid fa-chevron-right transition-transform text-[12px] text-slate-300 ${expandedId === inv.id ? 'rotate-90 text-indigo-500' : ''}`}></i>
                    </td>
                    <td className="px-3 py-4 font-mono text-slate-400 text-xs truncate">{inv.inStockNo}</td>
                    <td className="px-3 py-4 font-mono text-indigo-600 font-black text-sm truncate">{inv.invoiceNumber}</td>
                    <td className="px-3 py-4 font-bold text-slate-700 text-sm truncate">{inv.itemName}</td>
                    <td className="px-3 py-4 text-slate-500 truncate" title={inv.sellerName}>{inv.sellerName}</td>
                    <td className="px-3 py-4 text-right font-bold text-slate-900 text-sm">¥{inv.purchaseAmount?.toFixed(2)}</td>
                    <td className="px-3 py-4 text-right font-black text-indigo-600 text-sm">¥{inv.inStockAmount?.toFixed(2)}</td>
                    <td className="px-3 py-4 text-center text-slate-500 font-black uppercase text-xs">{inv.useUnit || '--'}</td>
                    <td className="px-3 py-4 text-right font-bold text-slate-400 text-sm">¥{inv.taxAmount?.toFixed(2)}</td>
                    <td className="px-3 py-4 text-slate-500 truncate text-xs">{inv.date}</td>
                    <td className="px-3 py-4">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => handlePreview(e, inv.fileUrl)} className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all" title="查看附件"><i className="fa-solid fa-eye"></i></button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingInvoice({...inv}); }} className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all" title="编辑记录"><i className="fa-solid fa-pen"></i></button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === inv.id && (
                    <tr className="bg-slate-50/50">
                      <td colSpan={12} className="px-10 py-8">
                        <div className="grid grid-cols-4 gap-10 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                          <div className="space-y-3">
                            <h5 className="font-black text-indigo-500 uppercase tracking-widest border-b pb-2 text-[10px]">票据标识</h5>
                            <p className="text-sm"><span className="text-slate-400">发票类型:</span> <span className="font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg ml-1">{inv.invoiceType || '增值税发票'}</span></p>
                            <p className="text-sm"><span className="text-slate-400">发票号码:</span> <span className="font-mono font-bold ml-1">{inv.invoiceNumber}</span></p>
                            <p className="text-sm"><span className="text-slate-400">开票日期:</span> <span className="ml-1">{inv.date}</span></p>
                          </div>
                          <div className="space-y-3">
                            <h5 className="font-black text-emerald-500 uppercase tracking-widest border-b pb-2 text-[10px]">往来单位</h5>
                            <p className="text-sm truncate" title={inv.sellerName}><span className="text-slate-400">销售方:</span> <span className="font-bold ml-1">{inv.sellerName || '--'}</span></p>
                            <p className="text-sm truncate" title={inv.buyerName}><span className="text-slate-400">购买方:</span> <span className="font-bold ml-1">{inv.buyerName || '--'}</span></p>
                          </div>
                          <div className="space-y-3">
                            <h5 className="font-black text-amber-500 uppercase tracking-widest border-b pb-2 text-[10px]">明细规格</h5>
                            <p className="text-sm"><span className="text-slate-400">规格型号:</span> <span className="ml-1">{inv.specification || '--'}</span></p>
                            <p className="text-sm"><span className="text-slate-400">数量单位:</span> <span className="ml-1 font-bold">{inv.quantity} {inv.unit}</span></p>
                            <p className="text-sm"><span className="text-slate-400">使用单位:</span> <span className="font-black text-indigo-600 uppercase ml-1">{inv.useUnit || '--'}</span></p>
                          </div>
                          <div className="space-y-3">
                            <h5 className="font-black text-rose-500 uppercase tracking-widest border-b pb-2 text-[10px]">财务金额</h5>
                            <p className="text-sm"><span className="text-slate-400">入库金额:</span> <span className="font-black text-indigo-600 ml-1">¥{inv.inStockAmount?.toFixed(2)}</span></p>
                            <p className="text-sm"><span className="text-slate-400">采购金额:</span> <span className="font-black text-slate-900 ml-1">¥{inv.purchaseAmount?.toFixed(2)}</span></p>
                            <p className="text-sm"><span className="text-slate-400">备注信息:</span> <span className="italic ml-1 text-slate-500">{inv.remark || '无'}</span></p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-8 py-5 bg-white rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6 font-black text-slate-400 uppercase tracking-widest text-[11px]">
          <span>第 {currentPage} / {totalPages} 页</span>
          <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-slate-50 px-4 py-2 rounded-xl border-none font-bold text-slate-600 outline-none">
            {[15, 30, 50, 100].map(v => <option key={v} value={v}>{v} 条/页</option>)}
          </select>
        </div>
        <div className="flex gap-3">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="px-6 py-3 rounded-2xl bg-slate-50 text-slate-500 disabled:opacity-30 font-black text-sm hover:bg-slate-100 transition-colors">上一页</button>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="px-6 py-3 rounded-2xl bg-slate-50 text-slate-500 disabled:opacity-30 font-black text-sm hover:bg-slate-100 transition-colors">下一页</button>
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-md">
          <button onClick={() => setPreviewUrl(null)} className="absolute top-8 right-8 text-white/50 hover:text-white text-4xl"><i className="fa-solid fa-circle-xmark"></i></button>
          <div className="max-w-6xl w-full h-[92vh] bg-white rounded-[4rem] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 px-12">
              <h4 className="font-black text-slate-800 text-lg tracking-tight">源文件查验</h4>
              <button onClick={() => window.open(previewUrl, '_blank')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl">在新窗口查看</button>
            </div>
            <div className="flex-1 overflow-auto p-12 flex items-center justify-center bg-slate-100">
              <img src={previewUrl} className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border-[12px] border-white" alt="预览" />
            </div>
          </div>
        </div>
      )}

      {editingInvoice && (
        <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[3.5rem] w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-white/20">
            <div className="p-10 border-b flex items-center justify-between px-12 bg-slate-50/50">
              <div className="flex items-center gap-6">
                <div className="bg-amber-100 text-amber-600 w-16 h-16 rounded-[2rem] flex items-center justify-center text-2xl shadow-inner"><i className="fa-solid fa-file-invoice"></i></div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">修正台账明细字段</h3>
              </div>
              <button onClick={() => setEditingInvoice(null)} className="w-14 h-14 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors"><i className="fa-solid fa-times text-2xl"></i></button>
            </div>
            <form onSubmit={handleUpdate} className="flex-1 overflow-auto p-12 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="space-y-8 md:col-span-3">
                  <h5 className="font-black text-slate-900 text-sm uppercase tracking-widest border-l-8 border-indigo-500 pl-6">核心票据标识</h5>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">发票号码</label>
                      <input type="text" value={editingInvoice.invoiceNumber} onChange={e => setEditingInvoice({...editingInvoice, invoiceNumber: e.target.value})} className="w-full px-6 py-5 bg-slate-50 rounded-3xl font-bold text-sm focus:bg-white focus:ring-8 focus:ring-indigo-500/10 outline-none border border-transparent focus:border-indigo-500 transition-all" required />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">发票类型</label>
                      <input type="text" value={editingInvoice.invoiceType} onChange={e => setEditingInvoice({...editingInvoice, invoiceType: e.target.value})} className="w-full px-6 py-5 bg-slate-50 rounded-3xl font-bold text-sm" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">入库单号</label>
                      <input type="text" value={editingInvoice.inStockNo} onChange={e => setEditingInvoice({...editingInvoice, inStockNo: e.target.value})} className="w-full px-6 py-5 bg-slate-50 rounded-3xl font-mono text-sm" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">开票日期</label>
                      <input type="text" value={editingInvoice.date} onChange={e => setEditingInvoice({...editingInvoice, date: e.target.value})} className="w-full px-6 py-5 bg-slate-50 rounded-3xl font-bold text-sm" />
                    </div>
                  </div>
                </div>

                <div className="space-y-8 md:col-span-3">
                  <h5 className="font-black text-slate-900 text-sm uppercase tracking-widest border-l-8 border-emerald-500 pl-6">往来对象明细</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">项目名称</label>
                      <input type="text" value={editingInvoice.itemName} onChange={e => setEditingInvoice({...editingInvoice, itemName: e.target.value})} className="w-full px-6 py-5 bg-slate-50 rounded-3xl font-bold text-sm" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">规格型号</label>
                      <input type="text" value={editingInvoice.specification} onChange={e => setEditingInvoice({...editingInvoice, specification: e.target.value})} className="w-full px-6 py-5 bg-slate-50 rounded-3xl font-bold text-sm" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">销售方 (供应商)</label>
                      <input type="text" value={editingInvoice.sellerName} onChange={e => setEditingInvoice({...editingInvoice, sellerName: e.target.value})} className="w-full px-6 py-5 bg-slate-50 rounded-3xl font-bold text-sm" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-cyan-600 uppercase tracking-widest font-black">使用单位</label>
                      <div className="relative">
                        <select 
                          value={editingInvoice.useUnit} 
                          onChange={e => setEditingInvoice({...editingInvoice, useUnit: e.target.value})} 
                          className="w-full px-6 py-5 bg-white rounded-3xl font-black text-sm border border-cyan-100 outline-none appearance-none hover:border-cyan-400 transition-all shadow-sm"
                        >
                          <option value="">-- 请选择 --</option>
                          {USE_UNIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt.toUpperCase()}</option>)}
                        </select>
                        <i className="fa-solid fa-chevron-down absolute right-6 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none"></i>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8 md:col-span-3">
                  <h5 className="font-black text-slate-900 text-sm uppercase tracking-widest border-l-8 border-rose-500 pl-6">财务金额修正</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest font-black">入库金额</label>
                      <input type="number" step="0.01" value={editingInvoice.inStockAmount} onChange={e => setEditingInvoice({...editingInvoice, inStockAmount: Number(e.target.value)})} className="w-full px-6 py-5 bg-indigo-50 rounded-3xl font-black text-indigo-600 text-base border border-indigo-100" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest font-black">价税合计</label>
                      <input type="number" step="0.01" value={editingInvoice.purchaseAmount} onChange={e => setEditingInvoice({...editingInvoice, purchaseAmount: Number(e.target.value)})} className="w-full px-6 py-5 bg-slate-50 rounded-3xl font-bold text-sm border border-slate-100" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">税额</label>
                      <input type="number" step="0.01" value={editingInvoice.taxAmount} onChange={e => setEditingInvoice({...editingInvoice, taxAmount: Number(e.target.value)})} className="w-full px-6 py-5 bg-slate-50 rounded-3xl text-sm" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-12 border-t flex gap-8 sticky bottom-0 bg-white">
                <button type="button" onClick={() => setEditingInvoice(null)} className="flex-1 py-6 bg-slate-100 text-slate-500 rounded-3xl font-black text-sm hover:bg-slate-200 transition-colors">取消修改</button>
                <button type="submit" className="flex-1 py-6 bg-indigo-600 text-white rounded-3xl font-black text-sm shadow-2xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all">保存更新</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceTable;
