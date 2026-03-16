# 🌌 E-Photo Gallery: The Digital E-Book Experience

![E-Photo Gallery Banner](file:///C:/Users/chirag/.gemini/antigravity/brain/e326087a-0063-4107-a5eb-3d4a0cbc0186/e_photo_gallery_banner_1773370471980.png)

A premium **Multi-Page Application (MPA)** that reimagines digital archiving as a **3D Virtual Photo Album**. It provides a centralized platform for users to create, organize, and experience their memories with a high-fidelity "Page-Flip" ritual, all while managing access through a robust subscription model.

---

## 🚀 Key Features

-   **📖 3D Virtual Album Experience:** Every album is a living 3D book with realistic page-flip animations, transforming static grids into tactile journeys.
-   **🖼️ Intelligent Media Pipeline:** Powered by the **Sharp Engine**, images and videos are automatically optimized during ingestion for fluid, lag-free delivery.
-   **💳 Subscription Portal:** Secure subscription-based access model with a built-in simulated gateway for local testing.
-   **👨‍💼 Dynamic Admin Panel:** A dedicated suite for managing users, monitoring global activity, and controlling subscription plans.
-   **🔒 Secure Authentication:** JWT-based secure session management with Bcrypt password hashing.
-   **📁 Local Storage Layer:** High-performance local file storage implementation for all your photos and videos.
-   **🎨 Premium UI System:** A custom, dark-themed design system optimized for high-end visual storytelling.

---

## 🛠️ Technology Stack

-   **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Custom Design System).
-   **Backend:** [Node.js](https://nodejs.org/) & [Express.js](https://expressjs.com/).
-   **Database:** [MySQL 8.0+](https://www.mysql.com/).
-   **Image Engine:** [Sharp](https://sharp.pixelplumbing.com/).
-   **Payments:** Simulated Gateway.
-   **Authentication:** JSON Web Tokens (JWT) & Bcrypt.

---

## 📥 Quick Start: Installation & Setup

Follow these steps to get the system running on your local machine.

### 1. Clone the Repository
```bash
git clone https://github.com/chirag-parmar16/e-photo-gallary.git
cd e-photo-gallary
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Create a `.env` file in the root directory and update your credentials:
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database (MySQL)
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=photo_gallery_new

# Security
JWT_SECRET=your_super_secret_key

# Providers
STORAGE_PROVIDER=local
PAYMENT_GATEWAY=simulated
```

### 4. Database Initialization
1. Ensure your MySQL service is running.
2. Manually create the database schema once:
   ```sql
   CREATE DATABASE photo_gallery_new;
   ```
3. **Automatic Table Creation:** The system will automatically initialize all tables, seed subscription plans, and create the default admin account on the first launch.

### 5. Run the Application
```bash
# Development Mode (with auto-restart)
npm run dev

# Production Mode
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** to explore!

---

## 🏗️ System Architecture

The project follows a modular **Three-Layer Architecture**:

1.  **Presentation Layer**: Vanilla JS frontend serving dynamic views from `/public/views`.
2.  **Application Layer**: Express.js REST API handling business logic and subscription validation.
3.  **Data Layer**: MySQL 8.0 handling relational persistence for users, books, and media.

### 📂 Directory Structure
```text
├── public/                 # Static Assets & Frontend
│   ├── css/                # Custom Design System
│   ├── js/                 # Page-Flip Logic & API Handlers
│   ├── views/              # MPA Templates (Login, Dashboard, Editor)
│   └── components/         # Reusable HTML fragments
├── server/                 # Backend Infrastructure
│   ├── routes/             # Auth, Admin, Book & Payment APIs
│   ├── database.js         # Auto-initialization Logic
│   └── index.js            # Main Express Server
└── tests/                  # Logic Validation & Smoke Tests
```

---

## 👤 Default Admin Credentials

For testing and management purposes, use the auto-generated admin account:
- **Email:** `admin@gmail.com`
- **Password:** `admin`
*(Note: The Admin account is for system management and user monitoring; it does not contain default albums.)*

---

## 🧪 Running Tests

The project includes a minimal smoke test. To run it:
```bash
npm test
```
You can add more tests under the `tests/` directory using the built‑in Node.js test runner.

---

## ⚙️ Extending the Project

- **API Validation:** Integrate a validation library such as `express-validator` or `zod`.
- **Real Payments:** Replace the simulated gateway with Stripe/PayPal SDKs.
- **Front‑End Framework:** Migrate UI to React, Vue, or Svelte for richer interactivity.
- **Docker:** Add a `Dockerfile` and `docker‑compose.yml` to containerize the app and MySQL.
- **CI/CD:** The repository already contains a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs linting and tests on each push.

---

## 🐞 Troubleshooting

| Symptom | Possible Cause | Fix |
|---------|----------------|-----|
| Server crashes on start – `FATAL ERROR: JWT_SECRET is not defined` | Missing `JWT_SECRET` in `.env` | Add `JWT_SECRET=your_secret_key` to `.env`. |
| Unable to login (401/403) | Wrong credentials or DB not seeded | Ensure admin account exists (`admin@gmail.com` / `admin`). |
| Uploads not saving | `public/uploads` missing write permission | Verify the directory exists and is writable. |
| Subscription limits not enforced | DB query failure or missing `subscription_plan` | Check DB connection and that the user row has a plan set. |
| Media not displayed | Incorrect `media_path` URL | Ensure `express.static` serves from `../public` and paths are `/uploads/...`. |
| Payment not activating | Invalid simulated payment ID | Use IDs prefixed with `pay_sim_` when calling `handlePaymentSuccess`. |

---

## 📚 Further Documentation

For a comprehensive guide, see the **User Manual** included in the project repository (generated by the assistant). It covers architecture, API details, subscription workflow, and more.

---
For testing and management purposes, use the auto-generated admin account:
- **Email:** `admin@gmail.com`
- **Password:** `admin`
*(Note: The Admin account is for system management and user monitoring; it does not contain default albums.)*

---

> "Bridging the gap between high-performance cloud tech and the emotional weight of physical memories."
