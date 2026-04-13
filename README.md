[![Board Status](https://dev.azure.com/paulasilvatech/bd6c388e-9d28-4a15-901c-9c8a80bd590d/659226c5-a558-4a65-85e2-b876d34b4913/_apis/work/boardbadge/540cf7b4-2028-4beb-a9ee-c66bf3f0a917)](https://dev.azure.com/paulasilvatech/bd6c388e-9d28-4a15-901c-9c8a80bd590d/_boards/board/t/659226c5-a558-4a65-85e2-b876d34b4913/Microsoft.RequirementCategory)
# 🚀 Azure SRE Agent Demo - Full Stack Todo Platform

A comprehensive demonstration platform showcasing Azure SRE Agent capabilities with intentional chaos scenarios, complete monitoring, and automated incident response.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [E2E Testing](#-e2e-testing)
- [Copilot Agents](#-copilot-agents)
- [Chaos Scenarios](#chaos-scenarios)
- [Monitoring & Alerts](#monitoring--alerts)
- [CI/CD Pipeline](#cicd-pipeline)
- [Contributing](#contributing)

## 🎯 Overview

This repository demonstrates:
- ✅ Full-stack Todo application (React + Node.js + TypeScript)
- ✅ Infrastructure as Code with Terraform
- ✅ Comprehensive Azure monitoring and alerting
- ✅ GitHub Actions CI/CD pipelines
- ✅ Intentional bugs and chaos scenarios for SRE Agent demonstration
- ✅ Automated issue creation and resolution workflows
- ✅ End-to-end testing with Playwright and AI-powered test agents
- ✅ Copilot custom agents for automated test generation and execution

## 🏗️ Architecture

```
┌─────────────────┐
│  React Frontend │
│  (Static Web)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Express API    │◄────►│  PostgreSQL  │
│  (App Service)  │      │  (Flexible)  │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Redis Cache    │      │  App Insights│
│                 │      │  + Monitoring│
└─────────────────┘      └──────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Query (TanStack Query)** for data fetching
- **Axios** for HTTP client
- **Azure Static Web Apps** for hosting

### Backend
- **Node.js 20** with Express
- **TypeScript** for type safety
- **Prisma ORM** for database access
- **Redis** for caching
- **Winston** for logging
- **Azure App Service / Container Apps**

### Infrastructure
- **Azure Database for PostgreSQL Flexible Server**
- **Azure Cache for Redis**
- **Azure Application Insights**
- **Azure Key Vault**
- **Azure Monitor & Log Analytics**
- **Terraform** for IaC

### Testing
- **Playwright** for end-to-end browser testing
- **Playwright MCP** for visual exploration and test generation
- **Page Object Model** pattern for maintainable tests
- **API mocking** with `page.route()` for deterministic tests

### DevOps
- **GitHub Actions** for CI/CD
- **Docker** for containerization
- **Azure CLI** for deployment
- **Terraform Cloud** (optional)

## 📦 Prerequisites

- **Node.js 20+** and npm/yarn
- **Docker** and Docker Compose
- **Terraform 1.5+**
- **Azure CLI** 2.50+
- **Azure Subscription** with contributor access
- **GitHub Account** with Actions enabled

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/sre-demo.git
cd sre-demo
```

### 2. Local Development Setup

```bash
# Install dependencies for both frontend and backend
cd frontend && npm install
cd ../backend && npm install

# Start local infrastructure (PostgreSQL + Redis)
docker-compose up -d

# Run database migrations
cd backend
npm run prisma:migrate

# Start backend (terminal 1)
npm run dev

# Start frontend (terminal 2)
cd ../frontend
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3000

### 3. Infrastructure Deployment

```bash
# Login to Azure
az login

# Initialize Terraform
cd terraform/environments/dev
terraform init

# Plan infrastructure
terraform plan -out=tfplan

# Apply infrastructure
terraform apply tfplan
```

### 4. Configure GitHub Secrets

Required secrets for GitHub Actions:
- `AZURE_CREDENTIALS`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `DATABASE_URL`
- `REDIS_CONNECTION_STRING`

## 🧪 E2E Testing

This project includes a comprehensive end-to-end testing infrastructure powered by **Playwright** and **Copilot custom agents**.

### Quick Start

```bash
# Install Playwright (one-time setup)
cd e2e && npm install && npx playwright install chromium

# Run all E2E tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed browser
npm run test:e2e:headed
```

### Test Structure

```
e2e/
  playwright.config.ts    # Playwright configuration (chromium + mobile)
  pages/                  # Page Object Models
  tests/                  # Test spec files
  fixtures/               # Shared mock data and setup
```

### Testing Approach

- **API Mocking**: All tests use `page.route()` to mock API calls — no backend required
- **Page Object Model**: Each page has a dedicated POM class for maintainability
- **Accessible Selectors**: Tests use `getByRole()`, `getByText()`, `getByPlaceholder()` over CSS selectors
- **Multi-viewport**: Tests run on both desktop Chrome and mobile (iPhone 13) viewports
- **Deterministic**: Mocked API responses ensure consistent, reliable test results

### Test Coverage

| Page | Tests | Coverage |
|------|-------|----------|
| Navigation & Layout | Menu, routing, mobile menu, redirects | Core |
| Dashboard | Stats cards, links, priority breakdown | Core |
| Todos | CRUD via modal, search, filters, toggle | Full |
| Projects | List, create, detail view, members | Full |
| Users | List, search, filter, detail view | Full |

See [E2E Testing Instructions](.github/instructions/e2e-testing.instructions.md) for conventions and best practices.

## 🤖 Copilot Agents

This project includes specialized **GitHub Copilot custom agents** for automated test generation and infrastructure management.

### Testing Agents

| Agent | Description | Usage |
|-------|-------------|-------|
| **Playwright E2E Tester** | Orchestrates the full test pipeline: explore → plan → implement → run | `@playwright-tester "Generate tests for Todos page"` |
| **Playwright Explorer** | Navigates the app via Playwright MCP, documents elements and flows | `@playwright-explorer "Explore the Dashboard"` |
| **Playwright Test Planner** | Creates phased test plans from exploration findings | `@playwright-planner "Create test plan"` |
| **Playwright Test Implementer** | Writes Page Objects and test specs, runs and fixes until passing | `@playwright-implementer "Implement Phase 3"` |

### Infrastructure Agent

| Agent | Description |
|-------|-------------|
| **Azure Infrastructure Expert** | Azure IaC, monitoring, troubleshooting, and optimization guidance |

### Agent Pipeline

```
User invokes @playwright-tester
  │
  ├─► @playwright-explorer  →  Navigates site, documents in .testagent/exploration.md
  │
  ├─► @playwright-planner   →  Reads exploration + source, generates .testagent/e2e-plan.md
  │
  └─► @playwright-implementer (per phase)
        ├─ Creates e2e/pages/*.page.ts (Page Objects)
        ├─ Creates e2e/tests/*.spec.ts (with API mocks)
        ├─ Runs npx playwright test
        └─ Fixes failures (up to 3 retries)
```

Agent files are located in [`.github/agents/`](.github/agents/).

## 🔥 Chaos Scenarios

This repository includes intentional bugs and performance issues for demonstration purposes. See [docs/CHAOS_SCENARIOS.md](docs/CHAOS_SCENARIOS.md) for detailed trigger instructions.

### Available Scenarios

| Scenario | Type | Severity | Trigger |
|----------|------|----------|---------|
| Memory Leak | Performance | High | `POST /api/chaos/memory-leak` |
| N+1 Query Problem | Performance | Medium | `GET /api/todos?inefficient=true` |
| Missing Index | Performance | Medium | `GET /api/todos/search?q=term` |
| Connection Pool Exhaustion | Availability | Critical | `POST /api/chaos/exhaust-pool` |
| Unhandled Promise Rejection | Reliability | High | `POST /api/chaos/unhandled-promise` |
| CPU Intensive Loop | Performance | Critical | `POST /api/chaos/cpu-spike` |
| Database Timeout | Availability | High | `POST /api/chaos/db-timeout` |
| Cache Invalidation Bug | Data Integrity | Medium | `PUT /api/todos/:id?skipCache=true` |
| Missing Error Handling | Reliability | Medium | `POST /api/todos` (malformed data) |
| Infrastructure Drift | Configuration | Low | Manual Terraform changes |

## 📊 Monitoring & Alerts

### Configured Alerts

- ⚠️ **High CPU Usage** (>80% for 5 minutes)
- ⚠️ **High Memory Usage** (>85% for 5 minutes)
- ⚠️ **Error Rate Spike** (>5% of requests)
- ⚠️ **Response Time Degradation** (>2s average)
- ⚠️ **Database Connection Issues**
- ⚠️ **Failed Deployments**
- ⚠️ **Infrastructure Drift Detected**

### Dashboards

- Application Performance (Application Insights)
- Infrastructure Health (Azure Monitor)
- Database Performance (PostgreSQL Insights)
- Cache Metrics (Redis Insights)

## 🔄 CI/CD Pipeline

### Workflows

1. **Frontend Deployment** (`.github/workflows/frontend-deploy.yml`)
   - Build React application
   - Run tests and linting
   - Deploy to Azure Static Web Apps

2. **Backend Deployment** (`.github/workflows/backend-deploy.yml`)
   - Build Docker image
   - Run tests and linting
   - Push to Azure Container Registry
   - Deploy to Azure App Service

3. **Infrastructure Deployment** (`.github/workflows/infrastructure-deploy.yml`)
   - Terraform plan
   - Manual approval for production
   - Terraform apply
   - Drift detection

## 📚 Documentation

- 🔑 [**GitHub Setup Guide**](docs/GITHUB_SETUP.md) - **START HERE** - Configure secrets and CI/CD
- 🏗️ [Architecture Details](docs/ARCHITECTURE.md)
- 🔥 [Chaos Scenarios Guide](docs/CHAOS_SCENARIOS.md)
- 🚀 [Deployment Guide](docs/DEPLOYMENT.md)
- 🧪 [E2E Testing Instructions](.github/instructions/e2e-testing.instructions.md) - Testing conventions and patterns
- 🤖 [Copilot Agents](.github/agents/) - Custom agents for test generation and infrastructure

## 🤝 Contributing

This is a demo repository. For suggestions or improvements:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Resources

- [Azure SRE Agent Documentation](https://learn.microsoft.com/azure)
- [GitHub Copilot](https://github.com/features/copilot)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Azure Architecture Center](https://learn.microsoft.com/azure/architecture/)

---

**Built with ❤️ for Azure SRE Agent demonstrations**
# SRE Demo Update Wed Oct 15 14:57:30 -05 2025
