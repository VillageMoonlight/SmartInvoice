
import React, { useState, useEffect } from 'react';
import { User, InvoiceData, ModelConfig, FailedInvoice } from '../types';
import { DBService } from '../services/db';
import InvoiceUploader from './InvoiceUploader';
import InvoiceTable from './InvoiceTable';
import ModelSettings from './ModelSettings';
import FailureTable from './FailureTable';
import UserManagement from './UserManagement';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [failures, setFailures] = useState<FailedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'view' | 'upload' | 'failures' | 'settings' | 'users'>('view');
  const [modelConfig, setModelConfig] = useState<ModelConfig | null>(null);

  const isAdmin = user.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    try {
      const invData = await DBService.getInvoices(user.username, isAdmin);
      const failData = await DBService.getFailures(user.username, isAdmin);
      setInvoices(invData);
      setFailures(failData);
    } catch (e) {
      console.error("Data fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    const config = await DBService.getModelConfig();
    setModelConfig(config);
  };

  useEffect(() => {
    fetchData();
    loadSettings();
  }, [user.username]);

  const uniqueInvoices = new Set(invoices.map(inv => inv.invoiceNumber));
  const invoiceCount = uniqueInvoices.size;
  const itemCount = invoices.length;
  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalTax = invoices.reduce((sum, inv) => sum + inv.taxAmount, 0);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <aside className="w-full md:w-72 bg-slate-900 text-white p-8 flex flex-col shadow-2xl z-20">
        <div className="flex items-center gap-4 mb-12 px-2">
          <div className="bg-indigo-500 w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/40 transform rotate-12">
            <i className="fa-solid fa-file-invoice-dollar text-white text-2xl"></i>
          </div>
          <span className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">智能发票管理</span>
        </div>

        <nav className="flex-1 space-y-3">
          {[
            { id: 'view', icon: 'fa-table-list', label: '发票台账' },
            { id: 'upload', icon: 'fa-plus-circle', label: '智能采集' },
            { id: 'failures', icon: 'fa-circle-exclamation', label: '识别异常', badge: failures.length },
            { id: 'settings', icon: 'fa-sliders', label: '模型参数' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 font-bold ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 translate-x-2' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}
            >
              <div className="flex items-center gap-4">
                <i className={`fa-solid ${item.icon} text-lg`}></i>
                <span>{item.label}</span>
              </div>
              {item.badge ? (
                <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{item.badge}</span>
              ) : null}
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold ${activeTab === 'users' ? 'bg-amber-500 text-white shadow-xl shadow-amber-500/30 translate-x-2' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}
            >
              <i className="fa-solid fa-users-gear text-lg"></i>
              <span>账号管理</span>
            </button>
          )}
        </nav>

        <div className="mt-auto pt-8 border-t border-slate-800">
          <div className="flex items-center gap-4 mb-6 px-2">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner ${isAdmin ? 'bg-amber-500' : 'bg-indigo-500'}`}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-black truncate max-w-[120px]">{user.username}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                本地数据模式
              </p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-4 px-5 py-3 rounded-2xl text-red-400 hover:bg-red-500/10 transition-colors font-bold">
            <i className="fa-solid fa-right-from-bracket"></i>
            <span>安全退出</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-auto">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
              {activeTab === 'view' ? '发票数字化台账' : 
               activeTab === 'upload' ? '多模态智能识别' : 
               activeTab === 'failures' ? '异常复核清单' :
               activeTab === 'users' ? '系统权限中心' : '识别引擎参数'}
            </h2>
            <div className="flex items-center gap-3 mt-4">
              <span className="text-xs font-black px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-2xl shadow-sm">
                归档记录: <span className="text-indigo-600">{invoices.length}</span>
              </span>
              <span className="text-xs font-black px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl">
                 <i className="fa-solid fa-database mr-2"></i>浏览器本地 IndexedDB 存储
              </span>
            </div>
          </div>

          {activeTab === 'view' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full lg:w-auto">
              <StatCard icon="fa-file-invoice" label="发票数量" value={`${invoiceCount} 张`} color="blue" />
              <StatCard icon="fa-list-check" label="明细项目" value={`${itemCount} 条`} color="purple" />
              <StatCard icon="fa-coins" label="总计金额" value={`¥${totalAmount.toFixed(2)}`} color="indigo" />
              <StatCard icon="fa-chart-pie" label="累计税金" value={`¥${totalTax.toFixed(2)}`} color="emerald" />
            </div>
          )}
        </header>

        <section className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/60 border border-slate-100 p-10 min-h-[700px]">
          {activeTab === 'upload' ? (
            <InvoiceUploader 
              userId={user.username} 
              onComplete={() => { setActiveTab('view'); fetchData(); }} 
            />
          ) : activeTab === 'settings' ? (
            <ModelSettings onSave={() => { loadSettings(); setActiveTab('view'); }} />
          ) : activeTab === 'failures' ? (
            <FailureTable 
              failures={failures} 
              onRefresh={fetchData} 
            />
          ) : activeTab === 'users' ? (
            <UserManagement />
          ) : (
            <InvoiceTable 
              invoices={invoices} 
              loading={loading} 
              onRefresh={fetchData} 
            />
          )}
        </section>
      </main>
    </div>
  );
};

const StatCard = ({ icon, label, value, color }: any) => {
  const colorMap: any = {
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50'
  };
  return (
    <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 flex-1 min-w-[140px]">
      <div className={`${colorMap[color] || 'text-slate-600 bg-slate-50'} w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-inner`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div>
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-0.5">{label}</p>
        <p className="text-lg font-black text-slate-900 whitespace-nowrap">{value}</p>
      </div>
    </div>
  );
};

export default Dashboard;
