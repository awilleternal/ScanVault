# 🛡️ ScanVault - Advanced Security Intelligence Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-blue)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-green)](https://expressjs.com/)

**ScanVault** is a cutting-edge security vulnerability scanning platform that performs comprehensive automated security analysis on plugins, repositories, and applications. Built for security professionals and development teams who demand enterprise-grade vulnerability detection with an intuitive, modern interface.

🌟 **Live Demo**: [GitHub Repository](https://github.com/awilleternal/ScanVault)

## 🎯 Key Highlights

- **🔍 Multi-Engine Scanning**: Integrates Semgrep, Trivy, and OWASP Dependency Check
- **🚀 Real-time Results**: WebSocket-powered live scanning with progress tracking
- **📊 Comprehensive Reports**: Detailed vulnerability analysis with severity grouping
- **🎨 Modern UI**: Clean, responsive interface built with React + Tailwind CSS
- **🔗 Repository Support**: Direct GitHub/Bitbucket repository scanning
- **⚡ Fast Performance**: Optimized for large codebases and quick results

## 🚀 Features

### 📁 **Input Methods**
- **Drag & Drop**: Upload ZIP files containing your codebase
- **Repository URLs**: Direct scanning of GitHub/Bitbucket repositories
- **Local Folders**: Scan local project directories

### 🔍 **Security Scanning Engines**
- **Semgrep** (via WSL2): Advanced static analysis for security vulnerabilities
- **Trivy** (via WSL2): Container and dependency vulnerability scanning
- **OWASP Dependency Check**: Java/.NET dependency vulnerability detection

### 📊 **Results & Reporting**
- **Real-time Progress**: WebSocket-powered live updates during scanning
- **Severity Classification**: Critical, High, Medium, Low, Info groupings
- **Detailed Analysis**: File locations, line numbers, and vulnerability descriptions
- **Actionable Fixes**: Remediation suggestions and security best practices
- **Export Options**: JSON and PDF report generation

### 🎨 **User Experience**
- **Modern Interface**: Clean, responsive design with Tailwind CSS
- **Progress Monitoring**: Real-time scan progress with detailed logs
- **Error Handling**: Comprehensive error reporting and troubleshooting
- **Mobile Responsive**: Works seamlessly across all device sizes

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- WSL2 (for running Semgrep and Trivy on Windows)
- Git (for repository cloning feature)

## 🛠️ Installation

1. Clone the repository:

```bash
git clone https://github.com/awilleternal/ScanVault.git
cd ScanVault
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
# Backend configuration
cd backend
cp .env.example .env
# Edit .env with your configuration
```

## 🚀 Development

Run both frontend and backend in development mode:

```bash
npm run dev
```

Or run them separately:

```bash
# Frontend only (port 3000)
npm run dev:frontend

# Backend only (port 5000)
npm run dev:backend
```

## 🏗️ Project Structure

```
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API services
│   │   └── App.jsx        # Main app component
│   └── vite.config.js     # Vite configuration
│
├── backend/               # Node.js Express backend
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   └── index.js       # Server entry point
│   └── package.json
│
├── tests/                 # Test suites
│   ├── e2e/              # Playwright E2E tests
│   └── unit/             # Unit tests
│
└── docs/                 # Documentation and guides
```

## 🧪 Testing

Run all tests:

```bash
npm test
```

Run specific test suites:

```bash
# Unit tests with coverage
npm run test:frontend
npm run test:backend

# E2E tests with Playwright
npm run test:e2e
```

## 📦 Building for Production

Build both frontend and backend:

```bash
npm run build
```

## 🔒 Security Considerations

- File uploads are limited to 100MB
- All uploaded files are sandboxed in temporary directories
- Command injection prevention through proper argument escaping
- Input validation on all API endpoints
- Secure WebSocket connections for progress monitoring

## 🤝 Contributing

1. Follow the existing code style (ESLint + Prettier)
2. Write tests for new features
3. Update the CHANGELOG.md with your changes
4. Ensure all tests pass before submitting PR

## 📝 Environment Variables

### Backend (.env)

```bash
# Server Configuration
NODE_ENV=development
PORT=5000
LOG_LEVEL=info

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# Security Scanner Configuration
MOCK_WSL2=false          # Set to true for demo/testing without WSL2
ENABLE_ODC=true          # Enable OWASP Dependency Check
SCAN_TIMEOUT=300000      # 5 minutes timeout

# OWASP Dependency Check Configuration
ODC_PATH=C:\tool_forhackthon\dependency-check\bin\dependency-check.bat  # Path to ODC executable
ODC_NVD_API_KEY=77371f4a-8f08-4ea9-9217-aef9933d3ec4        # Optional: NVD API key for faster updates
```

## 🐛 Troubleshooting

### WSL2 Not Available

If WSL2 is not available on your system, the app will automatically disable Semgrep and Trivy options. Only OWASP Dependency Check will be available on Windows.

### OWASP Dependency Check Setup

1. Download ODC from: https://owasp.org/www-project-dependency-check/
2. Extract the ZIP file to a location on your computer (e.g., `C:\tools\dependency-check`)
3. Add the `bin` directory to your Windows PATH environment variable, OR
4. Set the `ODC_PATH` environment variable to the full path of `dependency-check.bat`
5. Verify installation by running: `dependency-check.bat --version`
6. Optional: Get a free NVD API key from https://nvd.nist.gov/developers/request-an-api-key for faster scans

### Port Already in Use

If ports 3000 or 5000 are already in use, you can change them in:

- Frontend: `frontend/vite.config.js`
- Backend: `.env` file

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📈 Repository Stats

- **Total Files**: 72 files
- **Languages**: JavaScript, React, Node.js, HTML, CSS
- **Test Coverage**: Comprehensive E2E and unit testing with Playwright
- **CI/CD**: GitHub Actions workflow for automated testing

## 🔗 Related Projects

- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [Semgrep](https://semgrep.dev/)
- [Trivy](https://trivy.dev/)

## 🙏 Acknowledgments

- Built with React, Vite, Express, and Tailwind CSS
- Security tools: Semgrep, Trivy, OWASP Dependency Check
- Developed with assistance from Kiro AI
