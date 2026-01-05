
import { InvoiceData, User, ModelConfig, FailedInvoice } from '../types';

const DB_NAME = 'InvoiceManagerDB';
const DB_VERSION = 2; // 升级版本以确保表结构正确

export class DBService {
  private static db: IDBDatabase | null = null;

  private static async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'username' });
        }
        if (!db.objectStoreNames.contains('invoices')) {
          db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('failures')) {
          db.createObjectStore('failures', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private static async perform<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest | void): Promise<T> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      
      const request = action(store);
      
      if (request) {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } else {
        transaction.oncomplete = () => resolve(true as T);
        transaction.onerror = () => reject(transaction.error);
      }
    });
  }

  // 用户相关方法
  static async getAllUsers(): Promise<User[]> {
    return this.perform<User[]>('users', 'readonly', (store) => store.getAll());
  }

  static async getUser(username: string): Promise<User | null> {
    return this.perform<User | null>('users', 'readonly', (store) => store.get(username));
  }

  static async saveUser(user: User): Promise<void> {
    await this.perform('users', 'readwrite', (store) => { store.put(user); });
  }

  // 发票相关方法
  static async saveInvoice(invoice: InvoiceData): Promise<{ id: number }> {
    // 确保不带 ID 插入以使用自增
    const { id, ...data } = invoice;
    const resultId = await this.perform<number>('invoices', 'readwrite', (store) => store.add(data));
    return { id: resultId };
  }

  static async updateInvoice(invoice: InvoiceData): Promise<void> {
    await this.perform('invoices', 'readwrite', (store) => { store.put(invoice); });
  }

  static async deleteInvoice(id: string | number): Promise<void> {
    // 核心修复：IndexedDB 的自增 ID 通常是数字。如果传入字符串，需要转换。
    const key = typeof id === 'string' && !isNaN(Number(id)) ? Number(id) : id;
    await this.perform('invoices', 'readwrite', (store) => { store.delete(key); });
  }

  static async deleteInvoicesBatch(ids: (string | number)[]): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('invoices', 'readwrite');
      const store = transaction.objectStore('invoices');
      
      ids.forEach(id => {
        const key = typeof id === 'string' && !isNaN(Number(id)) ? Number(id) : id;
        store.delete(key);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  static async getInvoices(userId?: string, isAdmin: boolean = false): Promise<InvoiceData[]> {
    const all = await this.perform<InvoiceData[]>('invoices', 'readonly', (store) => store.getAll());
    let filtered = isAdmin ? all : all.filter(inv => inv.userId === userId);
    return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  // 异常记录相关方法
  static async saveFailure(failure: FailedInvoice): Promise<void> {
    await this.perform('failures', 'readwrite', (store) => { store.add(failure); });
  }

  static async getFailures(userId?: string, isAdmin: boolean = false): Promise<FailedInvoice[]> {
    const all = await this.perform<FailedInvoice[]>('failures', 'readonly', (store) => store.getAll());
    let filtered = isAdmin ? all : all.filter(f => f.userId === userId);
    return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  static async deleteFailure(id: number): Promise<void> {
    await this.perform('failures', 'readwrite', (store) => { store.delete(id); });
  }

  // 配置相关方法
  static async getModelConfig(): Promise<ModelConfig | null> {
    const result = await this.perform<{key: string, value: ModelConfig} | null>('settings', 'readonly', (store) => store.get('model_config'));
    return result ? result.value : null;
  }

  static async saveModelConfig(config: ModelConfig): Promise<void> {
    await this.perform('settings', 'readwrite', (store) => { store.put({ key: 'model_config', value: config }); });
  }

  static async isInvoiceDuplicate(userId: string, invoiceNumber: string): Promise<boolean> {
    const invoices = await this.getInvoices(userId, false);
    return invoices.some(inv => inv.invoiceNumber === invoiceNumber);
  }
}
