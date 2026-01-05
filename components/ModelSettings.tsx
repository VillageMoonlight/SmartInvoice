
import React, { useState, useEffect } from 'react';
import { DBService } from '../services/db';
import { ModelConfig, ModelProvider } from '../types';

interface ModelSettingsProps {
  onSave: () => void;
}

const ModelSettings: React.FC<ModelSettingsProps> = ({ onSave }) => {
  const [config, setConfig] = useState<ModelConfig>({
    provider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    modelName: 'gemini-3-flash-preview'
  });
  const [isSaving, setIsSaving] = useState(false);

  const presets: Record<ModelProvider, { baseUrl: string; models: string[] }> = {
    google: {
      baseUrl: 'https://generativelanguage.googleapis.com',
      models: ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-flash-lite-latest']
    },
    siliconflow: {
      baseUrl: 'https://api.siliconflow.cn/v1',
      models: [
        'zai-org/GLM-4.6V',
        'THUDM/glm-4v-9b', 
        'Pro/THUDM/glm-4v-9b', 
        'deepseek-ai/deepseek-vl2', 
        'Qwen/Qwen2-VL-72B-Instruct',
        'Qwen/Qwen2-VL-7B-Instruct'
      ]
    },
    zhipu: {
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      models: ['glm-4v-plus', 'glm-4v', 'glm-4v-flash']
    },
    'openai-compatible': {
      baseUrl: '',
      models: ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20240620']
    }
  };

  useEffect(() => {
    const load = async () => {
      const saved = await DBService.getModelConfig();
      if (saved) setConfig(saved);
    };
    load();
  }, []);

  const handleProviderChange = (provider: ModelProvider) => {
    const preset = presets[provider];
    setConfig({
      ...config,
      provider,
      baseUrl: preset.baseUrl,
      modelName: preset.models[0] || ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await DBService.saveModelConfig(config);
      alert('配置已成功更新！');
      onSave();
    } catch (err) {
      alert('保存失败，请重试。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="mb-10 flex items-center gap-5">
        <div className="bg-indigo-600 w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-200">
          <i className="fa-solid fa-microchip"></i>
        </div>
        <div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">智能识别引擎配置</h3>
          <p className="text-slate-500 font-medium">支持 Gemini、硅基流动、智谱 AI 等多种视觉大模型</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">服务提供商</label>
            <div className="relative group">
              <select
                value={config.provider}
                onChange={e => handleProviderChange(e.target.value as ModelProvider)}
                className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none font-bold text-slate-700"
              >
                <option value="google">Google Gemini</option>
                <option value="siliconflow">硅基流动 (SiliconFlow)</option>
                <option value="zhipu">智谱 AI (BigModel)</option>
                <option value="openai-compatible">OpenAI 兼容接口</option>
              </select>
              <i className="fa-solid fa-chevron-down absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-indigo-500 transition-colors"></i>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">模型 ID (Model Name)</label>
            <div className="relative">
              <input
                list="model-list"
                type="text"
                value={config.modelName}
                onChange={e => setConfig({...config, modelName: e.target.value})}
                placeholder="例如: THUDM/glm-4v-9b"
                className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-sm font-bold text-slate-700"
                required
              />
              <datalist id="model-list">
                {presets[config.provider].models.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">API 地址 (Base URL)</label>
          <input
            type="url"
            value={config.baseUrl}
            onChange={e => setConfig({...config, baseUrl: e.target.value})}
            placeholder="https://api.domain.com/v1"
            className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed font-bold text-slate-700"
            required={config.provider !== 'google'}
            disabled={config.provider === 'google'}
          />
        </div>

        {config.provider !== 'google' && (
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">API Key</label>
            <div className="relative">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">
                <i className="fa-solid fa-key"></i>
              </div>
              <input
                type="password"
                value={config.apiKey}
                onChange={e => setConfig({...config, apiKey: e.target.value})}
                placeholder="请输入您的 API Key"
                className="w-full bg-slate-50 pl-14 pr-5 py-4 rounded-2xl border border-transparent focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono text-sm font-bold text-slate-700"
                required={true}
              />
            </div>
          </div>
        )}
        
        {config.provider === 'google' && (
          <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-start gap-3">
            <i className="fa-solid fa-circle-info text-indigo-500 mt-1"></i>
            <p className="text-xs text-indigo-700 font-medium">
              Google Gemini API 密钥已通过系统环境变量安全托管，无需在此手动配置。
            </p>
          </div>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className={`w-full py-5 rounded-3xl font-black text-white shadow-2xl transition-all flex items-center justify-center gap-3 ${isSaving ? 'bg-slate-400' : 'bg-gradient-to-r from-indigo-600 to-indigo-800 hover:scale-[1.02] active:scale-95 shadow-indigo-600/30'}`}
          >
            {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-save"></i>}
            {isSaving ? '保存中...' : '立即应用模型设置'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ModelSettings;
