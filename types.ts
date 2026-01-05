
export interface InvoiceItem {
  itemName: string;
  specification: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: string;
  taxAmount: number;
}

export interface InvoiceData {
  id?: string;
  userId: string;
  invoiceType: string;
  invoiceNumber: string;
  date: string;
  buyerName: string;
  buyerTaxId: string;
  sellerName: string;
  sellerTaxId: string;
  totalAmountWords: string;
  totalAmountNum: number;
  remark: string;
  issuer: string;
  fileUrl: string;
  itemName: string;
  specification: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate: string;
  taxAmount: number;
  createdAt: number;
  // 新增字段
  inStockDate: string;      // 入库日期
  inStockAmount: number;    // 入库金额
  purchaseAmount: number;   // 采购金额
  invoiceShortNo: string;   // 发票号（后8位）
  inStockNo: string;        // 入库单号
  useUnit: string;          // 使用单位
}

export interface FailedInvoice {
  id?: number;
  userId: string;
  fileName: string;
  error: string;
  fileUrl: string;
  createdAt: number;
}

export interface User {
  username: string;
  password?: string;
  role: 'admin' | 'user';
  status: 'active' | 'pending';
}

export type ModelProvider = 'google' | 'openai-compatible' | 'zhipu' | 'siliconflow';

export interface ModelConfig {
  provider: ModelProvider;
  baseUrl: string;
  apiKey: string;
  modelName: string;
}

export interface ExtractionResponse {
  invoiceType: string;
  invoiceNumber: string;
  date: string;
  buyer: { name: string; taxId: string; };
  seller: { name: string; taxId: string; };
  items: InvoiceItem[];
  total: { amountWords: string; amountNum: number; };
  remark: string;
  issuer: string;
}
