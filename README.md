# SafeKosh — DhanRaksha Web App

> **Decentralized micro-savings & microfinance platform for India's gig economy**  
> Built for hackathon · Powered by Supabase · Secured by Polygon blockchain · Payments via Razorpay

---

## 🌟 Overview

**SafeKosh** (DhanRaksha) is a full-stack fintech web application that brings together automated savings, peer-to-peer chit funds, micro-lending, and blockchain-verified income certificates — designed specifically for India's unbanked and underbanked gig workers.

| Feature | Description |
|---|---|
| 🔐 Secure Vault | UPI AutoPay mandate-based automated savings with daily limits |
| 🤝 Chit Fund Circles | Decentralized rotating savings groups with on-chain escrow |
| 💸 P2P Lending | Micro-loan marketplace with interest-bearing offers |
| 📜 Income Certificates | Blockchain-verified PDF income proofs for gig workers |
| 🔔 Smart Nudges | Real-time financial health alerts and savings suggestions |
| 🌐 Bilingual | Full Hindi + English UI support |

---

## 🏗️ Tech Stack

### Frontend (`/client`)
| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Styling | TailwindCSS v4 (custom design system) |
| State | Zustand (auth, vault, chit, app stores) |
| Data Fetching | SWR + Axios with JWT interceptors |
| Real-time | Supabase Realtime (PostgreSQL changes) |
| Auth | Supabase Auth (Email/Password & Google OAuth) |
| Animations | canvas-confetti, CSS micro-animations |
| Offline | Custom offline queue with retry logic |
| PWA | Manifest + icons (192×192, 512×512) |
| Testing | Vitest + React Testing Library |

### Backend (`/server`)
| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (ESM) |
| Framework | Express.js |
| Database | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| Auth | Supabase JWT (`getUser`) + `requireAuth` middleware |
| Payments | Razorpay (UPI mandates, subscriptions, payouts) |
| Blockchain | Ethers.js v6 + Polygon Mumbai (chit escrow + cert registry) |
| Queue | Upstash Redis (BullMQ jobs) with in-process MockQueue fallback |
| Rate Limiting | `express-rate-limit` + Upstash Redis store |
| Monitoring | Sentry Node.js (tracing + PII scrubbing) |
| Logging | Winston (structured JSON logs) |
| Validation | Zod schemas on every route |
| Testing | Jest + Supertest |
| Containerisation | Docker + docker-compose |

### Infrastructure
| Service | Purpose |
|---|---|
| Supabase | PostgreSQL DB, Auth, Realtime, Storage |
| Razorpay | UPI AutoPay mandates, payouts, webhooks |
| Polygon Mumbai | Smart contracts (chit escrow + certificate registry) |
| Upstash Redis | Rate limiting + background job queues |
| AWS S3 | Certificate PDF storage |
| Vercel | Frontend deployment |
| Railway | Backend deployment |
| GitHub Actions | CI/CD pipeline |

---

## 📁 Project Structure

```
SafeKosh/
├── client/                     # React + Vite frontend
│   ├── public/                 # PWA icons, manifest
│   ├── src/
│   │   ├── components/shared/  # AuthProvider, AppLayout, ProtectedRoute, modals
│   │   ├── hooks/              # useRealtime, useNudges
│   │   ├── lib/                # api.js, supabase.js, utils.js, offlineQueue.js
│   │   ├── pages/              # Login, Onboarding, Dashboard, Vault, ChitFund,
│   │   │                       # ChitGroupDetail, Lending, Certificate, Verify
│   │   ├── store/              # Zustand: authStore, vaultStore, chitStore, appStore
│   │   └── tests/              # Vitest test suites
│   └── vite.config.js
│
├── server/                     # Express.js backend
│   ├── src/
│   │   ├── config/             # Environment config
│   │   ├── lib/                # supabase.js, razorpay.js, blockchain.js,
│   │   │                       # logger.js, queue.js, cashfree.js
│   │   ├── middleware/         # auth.js, rateLimiter.js, validate.js,
│   │   │                       # errorHandler.js, security.js
│   │   ├── routes/             # auth, vault, chitfund, lending,
│   │   │                       # certificate, webhooks, nudges
│   │   ├── jobs/               # Background job processors
│   │   └── tests/              # Jest test suites + helpers
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── supabase/
│   └── migrations/             # SQL migrations (init + RPC functions)
│
└── .github/
    └── workflows/deploy.yml    # GitHub Actions CI/CD
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Razorpay](https://razorpay.com) test account

### 1. Clone the repository
```bash
git clone https://github.com/Astro-peek/DhanRaksha-web-app-.git
cd DhanRaksha-web-app-
```

### 2. Set up the database
Run the SQL migrations in your Supabase SQL editor in order:
```
supabase/migrations/01_init.sql        ← Tables, RLS policies, triggers
supabase/migrations/02_rpc_functions.sql ← Stored procedures
```

### 3. Configure environment variables

**Server** (`server/.env`):
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres.xxx:password@pooler.supabase.com:6543/postgres

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=your-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret

# Redis (Upstash) — leave blank for local MemoryStore fallback
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=

# Server
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:5173
```

**Client** (`client/.env`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:3000
```

### 4. Install dependencies & run

```bash
# Server
cd server
npm install
npm run dev       # starts on http://localhost:3000

# Client (new terminal)
cd client
npm install
npm run dev       # starts on http://localhost:5173
```

---

## 🧪 Running Tests

```bash
# Backend (Jest + Supertest)
cd server
npm test                  # run all tests
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report

# Frontend (Vitest + RTL)
cd client
npm run test              # run all tests
```

---

## 🔌 API Endpoints

### Auth (`/api/auth`)
| Method | Path | Description |
|---|---|---|
| POST | `/logout` | Sign out globally |
| GET | `/me` | Get full user profile + vault/chit status |
| PUT | `/profile` | Update profile (name, UPI ID, language) |

### Vault (`/api/vault`)
| Method | Path | Description |
|---|---|---|
| GET | `/account` | Get vault balance and mandate status |
| GET | `/transactions` | Paginated transaction ledger |
| POST | `/setup-mandate` | Initiate Razorpay UPI AutoPay mandate |
| POST | `/save` | Manual savings deposit |
| POST | `/withdraw` | Withdraw to UPI ID |
| PUT | `/settings` | Update save-per-tx and daily limit |
| POST | `/simulate-webhook` | Dev: simulate a UPI credit event |

### Chit Fund (`/api/chitfund`)
| Method | Path | Description |
|---|---|---|
| GET | `/groups` | List all available chit groups |
| POST | `/groups` | Create a new chit group |
| GET | `/groups/:id` | Get group details + members |
| POST | `/groups/:id/join` | Join a group with invite token |
| POST | `/groups/:id/bid` | Submit a bid for current cycle |
| GET | `/groups/:id/ledger` | Group transaction ledger |
| GET | `/my-groups` | Groups the user belongs to |

### Lending (`/api/lending`)
| Method | Path | Description |
|---|---|---|
| POST | `/request` | Request a micro-loan |
| GET | `/marketplace` | Browse open loan requests |
| POST | `/offer` | Make a lending offer |
| POST | `/accept/:offerId` | Accept a loan offer |
| GET | `/my-loans` | User's active loans |
| POST | `/repay/:loanId` | Make a repayment |

### Certificates (`/api/certificate`)
| Method | Path | Description |
|---|---|---|
| POST | `/generate` | Generate income certificate PDF |
| GET | `/my-certificates` | List user certificates |
| GET | `/verify/:ref` | Public: verify a certificate |

### Webhooks (`/api/webhooks`)
| Method | Path | Description |
|---|---|---|
| POST | `/razorpay` | Razorpay mandate/payment events |

---

## 🐳 Docker (Local)

```bash
cd server
docker-compose up --build
# Server on :3000, Redis on :6379
```

---

## 🚢 Deployment

### Frontend → Vercel
```bash
# Set environment variables in Vercel dashboard:
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL
```

### Backend → Railway
```bash
# Set environment variables in Railway dashboard
# Deploy from Dockerfile in /server
```

### CI/CD — GitHub Actions
The `.github/workflows/deploy.yml` pipeline runs on every push to `main`:
1. ✅ Install dependencies
2. ✅ Run backend tests (Jest)
3. ✅ Run frontend tests (Vitest)
4. 🚀 Deploy client to Vercel
5. 🚀 Deploy server to Railway

---

## 🛡️ Security

- **JWT verification** on every protected route via Supabase `auth.getUser()`
- **Zod validation** on all request bodies
- **Rate limiting** per user/IP (auth: 5/15min, vault: 30/min, general: 100/min)
- **Helmet** security headers
- **PII scrubbing** in Sentry (mobile, aadhaar, UPI ID never logged)
- **RLS policies** on all Supabase tables
- **Webhook signature** verification (Razorpay HMAC-SHA256)

---

## 📱 Pages

| Route | Page | Description |
|---|---|---|
| `/login` | Login | Email/Password & Google OAuth login |
| `/onboarding` | Onboarding | Name, UPI ID, user type setup |
| `/dashboard` | Dashboard | Financial overview, quick actions |
| `/vault` | Vault | Savings management, AutoPay setup |
| `/chitfund` | Chit Fund | Browse and manage chit circles |
| `/chit/:id` | Chit Detail | Group bidding, ledger, members |
| `/lending` | Lending | Micro-loan marketplace |
| `/certificate` | Certificate | Generate and view income proofs |
| `/verify/:ref` | Verify | Public certificate verification |

---

## 👨‍💻 Developer Notes

- Use `Authorization: Bearer fake` in dev to bypass JWT auth (creates a persistent dev user)
- Blockchain operations fall back to simulation when private key is not configured
- Redis rate limiting falls back to in-process MemoryStore when Upstash URL is absent
- All background jobs use MockQueue fallback when Redis is unavailable

---

## 📄 License

MIT © 2026 SafeKosh / DhanRaksha
