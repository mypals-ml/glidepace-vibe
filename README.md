# Glidelines

A modern, high-performance **Reactive Gantt Chart** dashboard designed for seamlessly visualizing and managing GitHub tasks, dependencies, and project timelines.

Glidelines bridges the gap between GitHub's robust task tracking and project management needs by providing a real-time, MS Project-style interface that works across **Web, iOS, and Android**.

---

## 🛠️ Technology Stack
*   **Engine:** [Vite](https://vitejs.dev/) + [React](https://react.dev/)
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) (Glassmorphism & Dynamic Themes)
*   **Logic:** Typed [TypeScript](https://www.typescriptlang.org/)
*   **Mobile:** [Capacitor](https://capacitorjs.com/) (Native Web Wrapper)
*   **Real-time:** [Supabase](https://supabase.com/) (Live Webhook Relay)
*   **Localization:** [i18next](https://www.i18next.com/) (EN, JA, ZH-CN)

---

## 📖 Essential Documentation

### 🚀 Getting Started
*   **[Local Development Guide](docs/LOCAL_DEVELOPMENT.md):** 🗺️ Your onboarding map to the `localhost` setup.
*   **[Production Deployment](docs/PRODUCTION_DEPLOYMENT.md):** 🛰️ Steps to launch Glidelines on Vercel.
*   **[Antigravity AI Agent](ANTIGRAVITY.md):** 🤖 Instructions and protocols for the Antigravity agent.
*   **[Jules AI Agent](JULES.md):** 🦾 Instructions and protocols for the Jules agent.
*   **[Vibe Coding Rules](RULES.md):** 📜 Core principles and guidelines for project development.

### 🏗️ Architecture & Core Logic
*   **[Architecture Overview](docs/ARCHITECTURE.md):** 🏛️ High-level technical design and module breakdown.
*   **[Feature Specifications](docs/FEATURES.md):** 📋 Details on what's live vs. what's on the roadmap.
*   **[Sync & Webhooks](docs/AUTOMATIC_SYNC.md):** 🔄 Deep dive into the GitHub -> Supabase -> UI relay.

### ⚙️ Deep-Dive Setup
*   **[GitHub OAuth Setup](docs/GITHUB_OAUTH_SETUP.md):** Secure user authentication.
*   **[GitHub App & Webhooks](docs/GITHUB_APP_SETUP.md):** Background triggers and auto-sync.
*   **[Supabase Configuration](docs/SUPABASE_SETUP.md):** Setting up the real-time broadcast layer.

---

## 👥 Development Team
This project is a collaborative effort between human expertise and advanced AI intelligence.

*   **Lead Developers:** [willwhui](https://github.com/willwhui)
*   **AI Collaborators:** Google Antigravity, Google Jules, GitHub Copilot, and OpenAI Codex.
