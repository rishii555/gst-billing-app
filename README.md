# 🧾 GST Billing App

A full-stack GST billing and inventory management web application built with **Next.js, PostgreSQL, and Prisma ORM**. The application helps manage stock, invoices, sales, and user access through a centralized web interface with Google authentication.

## ✨ Features

- **🔐 Google Authentication** — Sign in using Google OAuth.
- **👥 User Management** — Manage user accounts and sessions.
- **🛡️ Role-Based Access Control** — Support for administrative access using the `ADMIN` role.
- **📦 Inventory Management** — Store and manage stock information in PostgreSQL.
- **🧾 Invoice Management** — Persist and manage invoice records.
- **💰 Sales Management** — Organize sales-related information.
- **🗄️ Persistent Database** — Store application data in PostgreSQL instead of relying on local or serverless filesystem storage.
- **🔄 Database Migrations** — Manage database schema changes using Prisma.
- **☁️ Cloud Deployment** — Deploy the application on Vercel.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Next.js | Full-stack web application framework |
| React | User interface |
| JavaScript | Application logic |
| PostgreSQL | Relational database |
| Prisma ORM | Database access and migrations |
| Google OAuth | Authentication |
| Node.js | JavaScript runtime |
| Vercel | Deployment and hosting |

## 🏗️ Project Structure

```text
gst-billing-app/
├── app/                  # Application pages and routes
├── lib/                  # Shared utilities and application logic
├── prisma/               # Database schema and migrations
├── public/               # Static assets
├── .env.example          # Environment variable template
├── prisma.config.ts      # Prisma configuration
├── next.config.mjs       # Next.js configuration
├── package.json          # Dependencies and npm scripts
├── package-lock.json     # Dependency lockfile
└── README.md             # Project documentation
```

## ⚙️ Getting Started

### Prerequisites

Install the following before running the application:

- [Node.js](https://nodejs.org/) — compatible with the project dependencies
- npm
- A running PostgreSQL database
- A Google OAuth client configured in [Google Cloud Console](https://console.cloud.google.com/)

### 1. Clone the repository

```bash
git clone https://github.com/rishii555/gst-billing-app.git
```

Navigate to the project directory:

```bash
cd gst-billing-app
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

Create your local environment file from the example.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

Configure the following variables in `.env`:

```env
DATABASE_URL="your_postgresql_connection_string"
ADMIN_EMAIL="your_admin_email@example.com"
GOOGLE_CLIENT_ID="your_google_oauth_client_id"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your_google_oauth_client_id"
```

Replace the example values with your actual configuration. Use the same Google OAuth client ID for both Google client ID variables.

**Important:** Keep `.env` private. Never commit database credentials, OAuth secrets, or other sensitive configuration to GitHub.

### 4. Set up the database

Ensure your PostgreSQL database exists and `DATABASE_URL` points to it.

Apply the project's database migrations:

```bash
npm run db:deploy
```

This prepares the database schema using the project's migration workflow.

### 5. Start the development server

```bash
npm run dev
```

Open the application in your browser:

http://localhost:3000

## 🔑 Google OAuth Configuration

To enable Google authentication:

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a project.
3. Configure the OAuth consent screen as required.
4. Create a Google OAuth client ID for a web application.
5. Add your local application origin to the authorized JavaScript origins:

   `http://localhost:3000`

6. Add the same client ID to the relevant environment variables.
7. Configure the authorized origins for your deployed application as well.

Authentication behavior also depends on the Google OAuth configuration and the application's implementation.

## 🗃️ Database and Migrations

The application uses PostgreSQL for persistent storage and Prisma ORM to interact with the database.

Database setup and migration commands:

```bash
# Install dependencies
npm ci

# Apply existing migrations
npm run db:deploy

# Generate the Prisma client
npx prisma generate
```

Run migrations against the intended database before deploying a new version that requires schema changes. Back up production data before making significant database changes.

## 🚀 Deployment on Vercel

The application can be deployed using [Vercel](https://vercel.com/).

1. Push your project to GitHub.
2. Import the repository into Vercel.
3. Create or connect a PostgreSQL database using a provider such as [Neon](https://neon.tech/) or [Supabase](https://supabase.com/).
4. Configure the required environment variables in Vercel.
5. Add the deployed domain to your Google OAuth client's authorized JavaScript origins.
6. Apply production database migrations before the first deployment:

   ```bash
   npm ci
   npx prisma migrate deploy
   ```

7. Deploy the application and verify authentication, database connectivity, and the main application workflows.

The configured build process runs Prisma client generation followed by the Next.js production build.

## 🔒 Security Considerations

- Store database credentials in environment variables.
- Never expose private OAuth credentials in client-side code.
- Restrict administrative privileges to authorized users.
- Validate and authorize sensitive operations on the server.
- Use HTTPS for deployed environments.
- Keep dependencies updated and review database access permissions.

## 🎯 Project Goals

This project demonstrates practical full-stack development concepts, including:

- Building a web application with Next.js and React.
- Integrating a relational database with Prisma ORM.
- Implementing Google OAuth authentication.
- Managing persistent business data.
- Working with database migrations.
- Configuring environment variables and production deployment.

## 🔮 Future Enhancements

Potential improvements include:

- GST breakdowns for CGST, SGST, and IGST.
- Automated invoice totals and tax calculations.
- PDF invoice generation and printing.
- Customer and supplier management.
- Low-stock alerts and inventory reports.
- Sales analytics and dashboards.
- Invoice search, filtering, and export.

These are proposed enhancements and should not be considered implemented features unless they are present in the codebase.

## 👨‍💻 Author

**Rishi Kumar**

- GitHub: [@rishii555](https://github.com/rishii555)
- Project Repository: [GST Billing App](https://github.com/rishii555/gst-billing-app)

## 📄 License

No license has been specified here. Add a `LICENSE` file if you intend to distribute the project under an open-source license.
