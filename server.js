
import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8080;
const dbDir = path.join(__dirname, 'data');
const dbPath = process.env.DB_PATH || path.join(dbDir, 'database.sqlite');

console.log('--- [SERVER] 正在初始化发票管理系统 ---');

if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (e) {
    console.error('[FS] 目录创建失败:', e.message);
  }
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[DB] 数据库开启失败:', err.message);
    process.exit(1);
  } else {
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT,
      role TEXT,
      status TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      invoiceType TEXT,
      invoiceNumber TEXT,
      date TEXT,
      buyerName TEXT,
      buyerTaxId TEXT,
      sellerName TEXT,
      sellerTaxId TEXT,
      totalAmountWords TEXT,
      totalAmountNum REAL,
      remark TEXT,
      issuer TEXT,
      fileUrl TEXT,
      itemName TEXT,
      specification TEXT,
      unit TEXT,
      quantity REAL,
      unitPrice REAL,
      amount REAL,
      taxRate TEXT,
      taxAmount REAL,
      createdAt INTEGER,
      inStockDate TEXT,
      inStockAmount REAL,
      purchaseAmount REAL,
      invoiceShortNo TEXT,
      inStockNo TEXT,
      useUnit TEXT
    )`, (err) => {
      // 检查是否需要增加新字段（平滑升级旧数据库）
      if (!err) {
        const columns = ['inStockDate', 'inStockAmount', 'purchaseAmount', 'invoiceShortNo', 'inStockNo', 'useUnit'];
        columns.forEach(col => {
          db.run(`ALTER TABLE invoices ADD COLUMN ${col} ${col.includes('Amount') ? 'REAL' : 'TEXT'}`, () => {});
        });
      }
    });
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS failures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT,
      fileName TEXT,
      error TEXT,
      fileUrl TEXT,
      createdAt INTEGER
    )`);
  });
}

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

const apiRouter = express.Router();

apiRouter.get('/users', (req, res) => {
  db.all("SELECT username, role, status FROM users", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

apiRouter.get('/users/:username', (req, res) => {
  db.get("SELECT * FROM users WHERE username = ?", [req.params.username], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || null);
  });
});

apiRouter.post('/users', (req, res) => {
  const { username, password, role, status } = req.body;
  db.run("INSERT OR REPLACE INTO users (username, password, role, status) VALUES (?, ?, ?, ?)", 
    [username, password, role, status], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

apiRouter.get('/invoices', (req, res) => {
  const { userId, isAdmin } = req.query;
  let query = "SELECT * FROM invoices";
  let params = [];
  if (isAdmin !== 'true' && userId) {
    query += " WHERE userId = ?";
    params.push(userId);
  }
  query += " ORDER BY createdAt DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

apiRouter.post('/invoices', (req, res) => {
  const data = req.body;
  const sql = `INSERT INTO invoices (
    userId, invoiceType, invoiceNumber, date, buyerName, buyerTaxId, 
    sellerName, sellerTaxId, totalAmountWords, totalAmountNum, remark, 
    issuer, fileUrl, itemName, specification, unit, quantity, 
    unitPrice, amount, taxRate, taxAmount, createdAt,
    inStockDate, inStockAmount, purchaseAmount, invoiceShortNo, inStockNo, useUnit
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const params = [
    data.userId, data.invoiceType, data.invoiceNumber, data.date, data.buyerName, data.buyerTaxId,
    data.sellerName, data.sellerTaxId, data.totalAmountWords, data.totalAmountNum, data.remark,
    data.issuer, data.fileUrl, data.itemName, data.specification, data.unit, data.quantity,
    data.unitPrice, data.amount, data.taxRate, data.taxAmount, data.createdAt,
    data.inStockDate, data.inStockAmount, data.purchaseAmount, data.invoiceShortNo, data.inStockNo, data.useUnit
  ];
  db.run(sql, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

apiRouter.put('/invoices/:id', (req, res) => {
  const data = req.body;
  const sql = `UPDATE invoices SET 
    invoiceType=?, invoiceNumber=?, date=?, buyerName=?, buyerTaxId=?,
    sellerName=?, sellerTaxId=?, itemName=?, specification=?, unit=?,
    quantity=?, unitPrice=?, amount=?, taxRate=?, taxAmount=?,
    totalAmountNum=?, totalAmountWords=?, remark=?, issuer=?,
    inStockDate=?, inStockAmount=?, purchaseAmount=?, invoiceShortNo=?,
    inStockNo=?, useUnit=?
    WHERE id=?`;
  const params = [
    data.invoiceType, data.invoiceNumber, data.date, data.buyerName, data.buyerTaxId,
    data.sellerName, data.sellerTaxId, data.itemName, data.specification, data.unit,
    data.quantity, data.unitPrice, data.amount, data.taxRate, data.taxAmount,
    data.totalAmountNum, data.totalAmountWords, data.remark, data.issuer,
    data.inStockDate, data.inStockAmount, data.purchaseAmount, data.invoiceShortNo,
    data.inStockNo, data.useUnit, req.params.id
  ];
  db.run(sql, params, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

apiRouter.delete('/invoices/:id', (req, res) => {
  db.run("DELETE FROM invoices WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

apiRouter.post('/invoices/batch-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "无效的ID列表" });
  const placeholders = ids.map(() => '?').join(',');
  db.run(`DELETE FROM invoices WHERE id IN (${placeholders})`, ids, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, deletedCount: ids.length });
  });
});

// Added failure log routes
apiRouter.get('/failures', (req, res) => {
  const { userId, isAdmin } = req.query;
  let query = "SELECT * FROM failures";
  let params = [];
  if (isAdmin !== 'true' && userId) {
    query += " WHERE userId = ?";
    params.push(userId);
  }
  query += " ORDER BY createdAt DESC";
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

apiRouter.post('/failures', (req, res) => {
  const { userId, fileName, error, fileUrl, createdAt } = req.body;
  db.run("INSERT INTO failures (userId, fileName, error, fileUrl, createdAt) VALUES (?, ?, ?, ?, ?)", 
    [userId, fileName, error, fileUrl, createdAt], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});

apiRouter.delete('/failures/:id', (req, res) => {
  db.run("DELETE FROM failures WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

apiRouter.get('/settings/:key', (req, res) => {
  db.get("SELECT value FROM settings WHERE key = ?", [req.params.key], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row ? JSON.parse(row.value) : null);
  });
});

apiRouter.post('/settings/:key', (req, res) => {
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", 
    [req.params.key, JSON.stringify(req.body)], 
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.use('/api', apiRouter);

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`[OK] 后端服务正在监听: http://localhost:${port}`);
});
