
import React, { useState, useRef, useEffect } from 'react';
import { extractInvoiceInfo } from '../services/geminiService';
import { DBService } from '../services/db';
import { InvoiceData, InvoiceItem } from '../types';

interface InvoiceUploaderProps {
  userId: string;
  onComplete: () => void;
}

interface UploadStatus {
  fileName: string;
  status: '等待' | '读取中' | '识别中' | '成功' | '重复' | '识别失败';
  progress: number;
  message?: string;
}

const InvoiceUploader: React.FC<InvoiceUploaderProps> = ({ userId, onComplete }) => {
  const [uploads, setUploads] = useState<UploadStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modelName, setModelName] = useState('Gemini 3 Flash');
  const [showDateModal, setShowDateModal] = useState(false);
  const [selectedInStockDate, setSelectedInStockDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const config = await DBService.getModelConfig();
      if (config) setModelName(config.modelName);
    };
    load();
  }, []);

  const fileToBase64WithProgress = (file: File, onProgress: (p: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setPendingFiles(files);
    setShowDateModal(true);
  };

  const startProcessing = async () => {
    setShowDateModal(false);
    setIsProcessing(true);
    const files = pendingFiles;
    setUploads(files.map(f => ({ fileName: f.name, status: '等待', progress: 0 })));

    let totalSaved = 0;
    const dateObj = new Date(selectedInStockDate);
    const yearMonth = dateObj.getFullYear().toString() + (dateObj.getMonth() + 1).toString().padStart(2, '0');
    
    // 1. 预载入现有发票用于查重和生成流水号
    const existingInvoices = await DBService.getInvoices(userId, true);
    
    let lastSeq = 0;
    existingInvoices.forEach(inv => {
      if (inv.inStockNo && inv.inStockNo.startsWith('wz' + yearMonth)) {
        const seqStr = inv.inStockNo.slice(-3);
        const s = parseInt(seqStr);
        if (s > lastSeq) lastSeq = s;
      }
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: '读取中' } : u));
      
      let base64 = "";
      try {
        base64 = await fileToBase64WithProgress(file, (p) => {
          setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, progress: p * 0.4 } : u));
        });

        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: '识别中', progress: 40 } : u));
        const extracted = await extractInvoiceInfo(base64, file.type);
        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, progress: 80 } : u));

        if (!extracted.invoiceNumber || extracted.invoiceNumber === '未知') {
          throw new Error("无法识别发票号码");
        }

        const isSpecial = extracted.invoiceType.includes('专用');
        const invoiceShortNoBase = extracted.invoiceNumber.slice(-8);

        let savedCountInFile = 0;
        let duplicateCountInFile = 0;

        for (let j = 0; j < extracted.items.length; j++) {
          const item = extracted.items[j];
          
          // --- 去重校验逻辑 ---
          // 只有当 发票号、项目名、金额 三者完全一致时才跳过
          const isDuplicate = existingInvoices.some(inv => 
            inv.invoiceNumber === extracted.invoiceNumber && 
            inv.itemName === item.itemName && 
            Math.abs(inv.amount - item.amount) < 0.01 // 处理浮点数精度
          );

          if (isDuplicate) {
            duplicateCountInFile++;
            continue;
          }

          // 如果不重复，则继续执行录入逻辑
          const currentPurchaseAmount = item.amount + item.taxAmount;
          let currentInStockAmount = isSpecial ? item.amount : (item.amount + item.taxAmount);

          // 仅在确实有新项需要录入时生成/增加流水号
          if (savedCountInFile === 0) {
            lastSeq++;
          }
          const inStockNo = `wz${yearMonth}${lastSeq.toString().padStart(3, '0')}`;

          const newRecord: InvoiceData = {
            userId,
            invoiceType: extracted.invoiceType,
            invoiceNumber: extracted.invoiceNumber,
            date: extracted.date,
            buyerName: extracted.buyer?.name || '',
            buyerTaxId: extracted.buyer?.taxId || '',
            sellerName: extracted.seller?.name || '',
            sellerTaxId: extracted.seller?.taxId || '',
            totalAmountWords: extracted.total?.amountWords || '',
            totalAmountNum: extracted.total?.amountNum || 0,
            remark: extracted.remark || '',
            issuer: extracted.issuer || '',
            fileUrl: base64,
            itemName: item.itemName,
            specification: item.specification,
            unit: item.unit,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            taxRate: item.taxRate,
            taxAmount: item.taxAmount,
            createdAt: Date.now(),
            inStockDate: selectedInStockDate,
            inStockAmount: currentInStockAmount,
            purchaseAmount: currentPurchaseAmount,
            invoiceShortNo: j === 0 ? invoiceShortNoBase : "",
            inStockNo: inStockNo,
            useUnit: ""
          };

          await DBService.saveInvoice(newRecord);
          // 同步更新本地缓存列表，防止同批次内重复
          existingInvoices.push(newRecord);
          savedCountInFile++;
        }

        if (savedCountInFile === 0 && duplicateCountInFile > 0) {
          // 全部项目都重复
          setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: '重复', progress: 100 } : u));
        } else {
          // 有新录入项
          totalSaved += savedCountInFile;
          setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: '成功', progress: 100 } : u));
        }

      } catch (err: any) {
        setUploads(prev => prev.map((u, idx) => idx === i ? { ...u, status: '识别失败', progress: 100, message: err.message } : u));
        await DBService.saveFailure({
          userId,
          fileName: file.name,
          error: err.message,
          fileUrl: base64 || '',
          createdAt: Date.now()
        });
      }
    }
    
    setIsProcessing(false);
    // 只要有新保存的，就刷新台账
    if (totalSaved > 0) setTimeout(() => onComplete(), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto py-10">
      <div 
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-4 border-dashed rounded-[4rem] p-16 text-center cursor-pointer transition-all duration-500 group ${isProcessing ? 'bg-slate-50 border-slate-300 pointer-events-none' : 'hover:border-indigo-500 hover:bg-indigo-50 border-slate-200'}`}
      >
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-cloud-arrow-up text-3xl"></i>
        </div>
        <h3 className="text-3xl font-black mb-3 text-slate-800 tracking-tight">批量智能采集 (增强查重模式)</h3>
        <p className="text-slate-400 font-medium mb-8 text-sm">
          自动识别发票明细，检测“发票号+项目+金额”重复记录
        </p>
        <button className={`px-12 py-5 rounded-2xl font-black shadow-2xl transition-all ${isProcessing ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}>
          {isProcessing ? '正在处理队列...' : '上传并发票识别'}
        </button>
        <input type="file" ref={fileInputRef} multiple onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
      </div>

      {showDateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20">
            <h4 className="text-xl font-black text-slate-800 mb-6 text-center">确认批次入库日期</h4>
            <input 
              type="date" 
              value={selectedInStockDate}
              onChange={(e) => setSelectedInStockDate(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none mb-8 font-bold text-slate-700 shadow-inner"
            />
            <div className="flex gap-4">
              <button onClick={() => setShowDateModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl font-bold hover:bg-slate-200 transition-colors">取消</button>
              <button onClick={startProcessing} className="flex-1 py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">开始提取</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-12 space-y-4">
        {uploads.map((u, idx) => (
          <div key={idx} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden relative">
            <div className="absolute bottom-0 left-0 h-1 bg-slate-50 w-full">
               <div 
                 className={`h-full transition-all duration-300 ${u.status === '成功' ? 'bg-emerald-500' : u.status === '重复' ? 'bg-amber-500' : u.status === '识别失败' ? 'bg-red-500' : 'bg-indigo-500'}`} 
                 style={{ width: `${u.progress}%` }}
               ></div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
                  u.status === '成功' ? 'bg-emerald-50 text-emerald-500' : 
                  u.status === '重复' ? 'bg-amber-50 text-amber-500' :
                  u.status === '识别失败' ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-500'
                }`}>
                  {u.status === '读取中' || u.status === '识别中' ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                    <i className={`fa-solid ${
                      u.status === '成功' ? 'fa-check-double' : 
                      u.status === '重复' ? 'fa-clone' : 
                      u.status === '识别失败' ? 'fa-triangle-exclamation' : 'fa-hourglass-start'
                    }`}></i>
                  )}
                </div>
                <div>
                  <span className="font-black text-slate-700 block text-lg truncate max-w-[300px]">{u.fileName}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      u.status === '成功' ? 'text-emerald-500' : 
                      u.status === '重复' ? 'text-amber-500' :
                      u.status === '识别失败' ? 'text-red-500' : 'text-indigo-400'
                    }`}>
                      {u.status}
                    </span>
                    {u.message && <span className="text-[10px] text-slate-400 font-medium">({u.message})</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InvoiceUploader;
