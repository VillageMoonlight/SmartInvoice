
import React, { useState } from 'react';
import { User } from '../types';
import { DBService } from '../services/db';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError('');

    try {
      const users = await DBService.getAllUsers();
      const existingUser = await DBService.getUser(username);

      if (existingUser) {
        if (existingUser.password === password) {
          if (existingUser.status === 'pending' && existingUser.role !== 'admin') {
            setError('您的账号尚未激活，请联系管理员审批');
          } else {
            onLogin(existingUser);
          }
        } else {
          setError('密码错误');
        }
      } else {
        // Register logic
        const isFirstUser = !users || users.length === 0;
        const newUser: User = {
          username,
          password,
          role: isFirstUser ? 'admin' : 'user',
          status: isFirstUser ? 'active' : 'pending'
        };
        await DBService.saveUser(newUser);
        
        if (isFirstUser) {
          onLogin(newUser);
        } else {
          setError('注册成功！请等待管理员激活您的账号');
        }
      }
    } catch (err: any) {
      console.error("Login detail error:", err);
      setError(err.message || '系统繁忙，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-slate-900 to-black p-4">
      <div className="bg-white/95 backdrop-blur-xl p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-white/20">
        <div className="text-center mb-10">
          <div className="bg-indigo-600 text-white w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/40 transform -rotate-6">
            <i className="fa-solid fa-file-invoice-dollar text-4xl"></i>
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">智能发票管理</h1>
          <p className="text-slate-400 font-medium mt-3">
            首次使用？首位注册者即为管理员
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-slate-700"
              placeholder="请输入用户名"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">安全密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-bold text-slate-700"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-start gap-3 animate-in fade-in zoom-in-95 duration-200 ${error.includes('注册成功') ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
              <i className={`fa-solid ${error.includes('注册成功') ? 'fa-circle-check' : 'fa-triangle-exclamation'} mt-1`}></i>
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-indigo-600/30 active:scale-95 disabled:opacity-50"
          >
            {loading ? <i className="fa-solid fa-spinner fa-spin mr-2"></i> : null}
            进入系统
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
