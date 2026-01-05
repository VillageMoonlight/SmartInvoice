
# Smart Invoice Manager 🧾✨

An intelligent invoice management tool using **Gemini 3.0** and other Vision LLMs to extract structured data from PDF/images into a searchable, exportable digital ledger.

## 🛠️ Environment Requirements

### 1. Basic Runtime
- **Node.js**: v18.17.0 or higher (v20+ recommended)
- **Package Manager**: NPM v9.0.0 or higher
- **Browser**: Modern browsers with IndexedDB support (Chrome, Edge, Firefox, Safari)

### 2. Operating System
- **Windows**: Windows 10/11 (Requires PowerShell or CMD)
- **Linux**: Ubuntu 20.04+, Debian 11+, or CentOS 7+
- **Docker**: Engine 20.10+ & Compose v2.0+ (Optional for containerized deployment)

### 3. Key Components & Versions
- **React**: ^19.0.0
- **Vite**: ^6.0.5 (Build Tool)
- **TypeScript**: ~5.6.2
- **@google/genai**: ^1.34.0 (Gemini SDK)
- **@types/node**: ^22.10.2 (Critical for environment variable mapping)
- **SQLite3**: ^5.1.7 (For Node.js Server mode)

---

## 🏗️ Compilation & Development

### 1. Installation
```bash
npm install
```

### 2. Environment Configuration
The application requires a **Google Gemini API Key**.
- **Windows (PowerShell)**: `$env:API_KEY="your_key_here"`
- **Windows (CMD)**: `set API_KEY=your_key_here`
- **Linux/macOS**: `export API_KEY=your_key_here`

### 3. Build Process (Strict TS Check)
To compile the frontend for production:
```bash
# This will run TSC for type checking then Vite for bundling
npm run build
```
*Note: If you encounter `TS2688` or `process` errors on Windows, ensure `@types/node` is installed and `tsconfig.json` includes `"types": ["node"]`.*

---

## 🚀 Deployment Options

### Option A: Static Web (Nginx)
The frontend uses **IndexedDB** for local storage by default.
1. Build the project: `npm run build`.
2. Copy `dist/*` to your Nginx html directory.
3. Configuration for SPA:
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```

### Option B: Node.js Server (Full-Stack)
Uses **SQLite** for centralized data persistence.
1. Build the frontend: `npm run build`.
2. Start the server: `node server.js`.
3. Default port: `8080`.

### Option C: Docker (One-Click)
```bash
docker-compose up -d --build
```

---

## 📄 License
MIT License.
