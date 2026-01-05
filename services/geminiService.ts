
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractionResponse, ModelConfig } from "../types";
import { DBService } from "./db";

// Fix: Escaped backticks in the prompt to prevent early termination of the template literal.
const SYSTEM_PROMPT = `你是一个专业的财务发票识别专家。
任务：从提供的发票图像或 PDF 中提取结构化数据。
输出格式：严格的 JSON 对象。

字段映射规则（必须精准）：
- invoiceType: 发票种类名称（例如：增值税专用发票、增值税普通发票）。
- invoiceNumber: 发票号码（通常位于右上角，请完整提取所有数字）。
- date: 开票日期（格式为 YYYY年MM月DD日）。
- buyer: 对象，包含 name (名称) 和 taxId (纳税人识别号)。
- seller: 对象，包含 name (名称) 和 taxId (纳税人识别号)。
- items: 数组，包含发票上的所有明细行。每一行必须包含：
    - itemName: 货物或应税劳务、服务名称
    - specification: 规格型号
    - unit: 单位
    - quantity: 数量（数值类型）
    - unitPrice: 单价（数值类型）
    - amount: 金额（数值类型，不含税）
    - taxRate: 税率（字符串，如 "13%" 或 "3%"）
    - taxAmount: 税额（数值类型）
- total: 对象，包含 amountWords (价税合计大写) 和 amountNum (价税合计小写数值)。
- remark: 备注信息（若无则为空字符串）。
- issuer: 开票人姓名。

重要指令：
1. 仔细识别右上角的发票号码，它是财务入账的关键，不能有误。
2. 必须提取明细表中的所有行，严禁遗漏。
3. 所有金额和数量必须转换为纯数字类型，不得包含货币符号或逗号。
4. 仅输出 JSON 字符串，不得包含任何 Markdown 格式说明符（如 \`\`\`json）。`;

// Fix: Moved helper functions to the top to ensure they are available to all callers.
function robustJsonParse(text: string): any {
  if (!text) return {};
  let cleaned = text.trim();
  // Fix: Improved Markdown tag removal logic.
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Attempt to extract JSON if there's surrounding text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        console.error("Partial JSON parse failed", e2);
      }
    }
    throw new Error("模型返回的数据无法解析，请重试或更换模型。");
  }
}

function mapRawToResponse(raw: any): ExtractionResponse {
  return {
    invoiceType: raw.invoiceType || '普通发票',
    invoiceNumber: raw.invoiceNumber || '未知',
    date: raw.date || '',
    buyer: {
        name: raw.buyer?.name || '',
        taxId: raw.buyer?.taxId || ''
    },
    seller: {
        name: raw.seller?.name || '',
        taxId: raw.seller?.taxId || ''
    },
    items: (Array.isArray(raw.items) ? raw.items : []).map((item: any) => ({
      itemName: item.itemName || '未知项目',
      specification: item.specification || '',
      unit: item.unit || '',
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      amount: Number(item.amount) || 0,
      taxRate: String(item.taxRate || ''),
      taxAmount: Number(item.taxAmount) || 0
    })),
    total: {
        amountWords: raw.total?.amountWords || '',
        amountNum: Number(raw.total?.amountNum) || 0
    },
    remark: raw.remark || '',
    issuer: raw.issuer || ''
  };
}

async function convertPdfToImage(base64Pdf: string): Promise<string> {
  const pdfjs = (window as any).pdfjsLib;
  if (!pdfjs) throw new Error("PDF.js 库未加载，请刷新页面重试。");

  try {
    const base64Content = base64Pdf.includes(',') ? base64Pdf.split(',')[1] : base64Pdf;
    const pdfData = window.atob(base64Content);
    const loadingTask = pdfjs.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.5 }); 

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Canvas context 失败");
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.95);
  } catch (err) {
    throw new Error("PDF 转换为图片失败，可能文件已损坏或格式不支持。");
  }
}

export async function extractInvoiceInfo(base64Data: string, mimeType: string): Promise<ExtractionResponse> {
  const config = await DBService.getModelConfig();

  if (!config || config.provider === 'google') {
    return callGemini(base64Data, mimeType, config);
  } else {
    let processedBase64 = base64Data;
    let processedMimeType = mimeType;

    if (mimeType === 'application/pdf') {
      try {
        processedBase64 = await convertPdfToImage(base64Data);
        processedMimeType = 'image/jpeg';
      } catch (err) {
        console.error("PDF Conversion failed:", err);
        throw new Error("PDF 解析失败，请尝试上传图片。");
      }
    }
    return callCustomModel(processedBase64, processedMimeType, config);
  }
}

async function callGemini(base64Data: string, mimeType: string, config: ModelConfig | null): Promise<ExtractionResponse> {
  const modelName = config?.modelName || 'gemini-3-flash-preview';
  // Always initialize GoogleGenAI with a named parameter.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const dataContent = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    
    // Fix: Using the recommended contents structure for multimodal input.
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: "请识别并提取这张发票的所有结构化信息，输出为 JSON 格式。" },
          {
            inlineData: {
              mimeType: mimeType,
              data: dataContent,
            }
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.1,
        // Using the Type enum from @google/genai as recommended.
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            invoiceType: { type: Type.STRING },
            invoiceNumber: { type: Type.STRING },
            date: { type: Type.STRING },
            buyer: {
              type: Type.OBJECT,
              properties: { name: { type: Type.STRING }, taxId: { type: Type.STRING } }
            },
            seller: {
              type: Type.OBJECT,
              properties: { name: { type: Type.STRING }, taxId: { type: Type.STRING } }
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  itemName: { type: Type.STRING },
                  specification: { type: Type.STRING },
                  unit: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                  amount: { type: Type.NUMBER },
                  taxRate: { type: Type.STRING },
                  taxAmount: { type: Type.NUMBER }
                }
              }
            },
            total: {
              type: Type.OBJECT,
              properties: { amountWords: { type: Type.STRING }, amountNum: { type: Type.NUMBER } }
            },
            remark: { type: Type.STRING },
            issuer: { type: Type.STRING }
          },
          required: ["invoiceNumber", "items", "invoiceType"]
        }
      }
    });

    // Fix: Access response.text directly (it is a property).
    const resultText = response.text;
    if (!resultText) {
      throw new Error("模型未能生成有效内容，请检查发票清晰度。");
    }

    const raw = robustJsonParse(resultText);
    return mapRawToResponse(raw);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes('safety')) throw new Error("发票内容被安全策略拦截，请尝试使用更清晰的扫描件。");
    if (error.message?.includes('quota')) throw new Error("API 配额已耗尽，请稍后再试。");
    throw error;
  }
}

async function callCustomModel(base64Data: string, mimeType: string, config: ModelConfig): Promise<ExtractionResponse> {
  const data = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  let url = config.baseUrl.trim();
  if (!url.endsWith('/chat/completions')) {
    url = url.endsWith('/') ? `${url}chat/completions` : `${url}/chat/completions`;
  }

  const payload = {
    model: config.modelName.trim(),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "识别这张发票并输出 JSON 数据。" },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${data}` } }
        ]
      }
    ],
    temperature: 0.1
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`第三方 API 错误: ${res.status}. ${errText.substring(0, 100)}`);
    }
    const json = await res.json();
    const content = json.choices[0].message.content;
    const raw = robustJsonParse(content);
    return mapRawToResponse(raw);
  } catch (error: any) {
    console.error("Custom Model Error:", error);
    throw error;
  }
}
