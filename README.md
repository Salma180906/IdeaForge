# IdeaForge — Production Full-Stack Application

> **An Idea Evolution and Collaboration Platform where concepts don't just sit still — they iterate, evolve, and mature through community contributions, version diffing, development roadmaps, and verified reputation.**

---

## 🏗️ Technology Architecture

* **Frontend**: React 18, Vite, React Router 6, Lucide Icons, Canvas Embers & Motion CSS
* **Backend**: Node.js, Express, Helmet, CORS, Express-Rate-Limit, BCrypt (cost factor 12)
* **Database**: MySQL 8.0+ (Aiven Cloud Managed MySQL with SSL connection pooling)
* **Authentication**: JWT-based session tokens, TOTP Authenticator (RFC 6238), Cryptographic OAuth 2.0 PKCE flow, Single-use verification tickets
* **Transactional Email**: Multi-provider email engine supporting **Gmail SMTP (App Passwords)**, **Resend API**, **Brevo API**, and custom SMTP
* **AI Intelligence**: Google Gemini API for strategic critique, roadmaps, and structural summaries

---

## 🚀 Key Features

### 1. Genuine OAuth 2.0 & Production Authentication
* **Continue with Google, GitHub, & Discord**: Real OAuth 2.0 consent flow with state validation in HttpOnly cookies, secure exchange tickets, and verified email linking.
* **Honest Configuration Badging**: When OAuth keys are not configured in `.env`, the UI displays a clear "Setup needed" status badge and instructions — never simulating fake logins.
* **Strong Password Security**: Minimum 8 characters, mix of characters and digits, common password blocking, and BCrypt salt cost 12.
* **Account Security**: Two-factor authentication (TOTP authenticator app + backup codes), session invalidation on password change, device revocation.

### 2. Idea Evolution Engine & Version Log
* **Drafts vs Published**: Private drafts editable in place; published ideas evolve version-by-version (`v1.0`, `v2.0`, `v3.0`).
* **Visual Word Diffs**: Side-by-side comparison highlighting word additions and deletions between any two version snapshots.
* **Version Restoration**: Idea owners can restore any historical version as a new current version, preserving full audit history without deleting past iterations.
* **Suggestion Workflow**: Community peers can submit concrete change suggestions. The owner can accept them into a new version, automatically crediting the contributor.

### 3. Development Roadmap & Milestones
* **Interactive Roadmap**: Track deliverables (`todo`, `in_progress`, `completed`) with priority tags (`low`, `medium`, `high`) and due dates.
* **Live Completion Progress**: Dynamic progress percentage bar tracking milestone velocity.

### 4. Verified Analytics & Reputation
* **Real Database Analytics**: Aggregated live views, votes, followers, version velocity, and suggestion acceptance rate.
* **Verified Reputation Scoring**: User reputation calculated directly from database records:
  $$\text{Reputation} = (\text{Ideas} \times 10) + (\text{Accepted Suggestions} \times 25) + (\text{Versions} \times 15) + (\text{Votes} \times 5)$$

### 5. Bookmarks Collection
* Personal bookmarking system (`POST /api/ideas/:id/bookmark`) with dedicated `/bookmarks` view.

---

## 📧 How to Configure Real Email Delivery (Gmail SMTP)

To receive real OTP codes and verification emails in your Gmail inbox:

1. Visit [Google Account Security](https://myaccount.google.com/security) and ensure **2-Step Verification** is turned **ON**.
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords).
3. Under App name, type `IdeaForge` and click **Create**.
4. Google will give you a 16-character password (e.g., `abcd efgh ijkl mnop`).
5. Open `backend/.env` and configure:
   ```env
   GMAIL_USER=your_email@gmail.com
   GMAIL_PASS=abcdefghijklmnop
   MAIL_FROM=your_email@gmail.com
   MAIL_FROM_NAME=IdeaForge
   REQUIRE_EMAIL_VERIFY=true
   ```
6. Restart the backend server. All OTP emails will now arrive directly in your Gmail inbox!

> **Alternative Providers**: You can alternatively configure `RESEND_API_KEY=re_...` ([resend.com](https://resend.com)) or `BREVO_API_KEY=xkeysib-...` ([brevo.com](https://brevo.com)).

---

## 🔑 How to Configure OAuth 2.0

### Google Sign-In
1. Go to [Google Cloud Console](https://console.cloud.google.com/) -> APIs & Services -> Credentials.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Set Authorized redirect URIs to: `http://localhost:5000/api/auth/oauth/google/callback`
4. Add to `backend/.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

### GitHub Sign-In
1. Go to GitHub Settings -> Developer Settings -> [OAuth Apps](https://github.com/settings/developers).
2. Set Authorization callback URL to: `http://localhost:5000/api/auth/oauth/github/callback`
3. Add to `backend/.env`:
   ```env
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   ```

---

## 🧪 Automated Testing

The backend includes a comprehensive automated test suite testing auth, evolution, milestones, bookmarks, restore, and analytics:

```bash
cd backend
npm test
```

### Verified Test Suite Results (15/15 Passed):
```
✔ 1. Health Check GET / returns running status
✔ 2. Registration enforces strong password validation
✔ 3. User Registration succeeds and stores normalized email
✔ 4. Duplicate Registration is rejected
✔ 5. Login rejects invalid password without exposing account existence
✔ 6. Login succeeds with valid credentials
✔ 7. Register second peer user for collaborative suggestion testing
✔ 8. Create an evolving idea with initial version v1.0
✔ 9. Update idea to generate Version v2.0 with audit trail
✔ 10. Restore earlier Version v1.0 creates a new Version v3.0 preserving history
✔ 11. Peer submits suggestion and idea owner accepts into Version v4.0
✔ 12. Development Roadmap / Milestones CRUD
✔ 13. Bookmarking saves and unsaves idea
✔ 14. Verified Analytics aggregates authentic database metrics
✔ 15. Public Profile calculates database-backed reputation score
```

---

## 📦 Production Build

```bash
cd frontend
npm run build
```
Builds cleanly with zero errors to `frontend/dist`.
