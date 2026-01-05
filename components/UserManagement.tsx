
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { DBService } from '../services/db';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const data = await DBService.getAllUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'pending' : 'active';
    await DBService.saveUser({ ...user, status: newStatus });
    fetchUsers();
  };

  const toggleRole = async (user: User) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    await DBService.saveUser({ ...user, role: newRole });
    fetchUsers();
  };

  if (loading) return <div className="p-20 text-center font-bold text-slate-400">正在加载用户数据...</div>;

  return (
    <div className="space-y-8">
      <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex items-center gap-4">
        <div className="bg-amber-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-lg">
           <i className="fa-solid fa-shield-halved"></i>
        </div>
        <div>
          <h4 className="font-black text-amber-800 tracking-tight">安全中心</h4>
          <p className="text-xs text-amber-600 font-bold uppercase tracking-widest">
            您可以激活新用户或调整权限级别。
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 bg-white">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">用户名</th>
              <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">角色级别</th>
              <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">当前状态</th>
              <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">权限管理</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => (
              <tr key={u.username} className="hover:bg-slate-50 transition-colors">
                <td className="px-10 py-8 font-black text-slate-800 text-lg">{u.username}</td>
                <td className="px-10 py-8">
                  <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${u.role === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-200 text-slate-600'}`}>
                    {u.role === 'admin' ? '🔥 总管理员' : '💻 操作员'}
                  </span>
                </td>
                <td className="px-10 py-8 text-center">
                  <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {u.status === 'active' ? '已授权' : '待审核'}
                  </span>
                </td>
                <td className="px-10 py-8 text-right space-x-3">
                   <button 
                    onClick={() => toggleStatus(u)}
                    className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${u.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                   >
                     {u.status === 'active' ? '禁用账号' : '立即激活'}
                   </button>
                   <button 
                    onClick={() => toggleRole(u)}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all"
                   >
                     切换角色
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
