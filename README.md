# AnchorWatch Dummy - Bitcoin Transaction Viewer

AnchorWatch Dummy is a modern web application that allows users to track and monitor Bitcoin transactions. With a clean and intuitive interface, users can view transaction history, monitor balances, and analyze Bitcoin holdings over time.

## Features

- Real-time Bitcoin balance tracking
- Detailed transaction history with filtering options
- Interactive holdings chart with multiple time ranges (1D, 1WK, 1MO, 3MO, 1YR)
- Responsive design with a modern UI
- Secure email-based authentication

## Prerequisites

Before you begin, ensure you have installed:

- Node.js (v18 or higher)
- npm (v9 or higher)
- PostgreSQL (v15 or higher)

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/anchor-watch.git
   cd anchor-watch
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up your environment variables:
   Create a `.env` file in the root directory with the following variables:

   ```env
   # Database
   DATABASE_URL="postgresql://your-username:your-password@localhost:5432/anchorwatch"

   # Next Auth
   NEXTAUTH_SECRET="your-nextauth-secret"
   NEXTAUTH_URL="http://localhost:3000"

   # Email (SMTP)
   EMAIL_SERVER_HOST="your-smtp-host"
   EMAIL_SERVER_PORT="your-smtp-port"
   EMAIL_SERVER_USER="your-smtp-username"
   EMAIL_SERVER_PASSWORD="your-smtp-password"
   EMAIL_FROM="noreply@yourdomain.com"
   ```

4. Set up the database:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

5. Run the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Authentication

For development and testing purposes, only the following email addresses are allowed to sign in:

- kiwihodl@proton.me
- rob@anchorwatch.com

## Build for Production

To create a production build:

```bash
npm run build
```

To start the production server:

```bash
npm run start
```

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS, Recharts
- **Backend**: Next.js API routes, tRPC
- **Authentication**: NextAuth.js
- **Database**: PostgreSQL with Drizzle ORM
- **Email**: Nodemailer
- **API Integration**: Mempool.space API for Bitcoin data

## Project Structure

```
anchor-watch/
├── src/
│   ├── pages/          # Next.js pages
│   ├── components/     # React components
│   ├── server/        # Server-side code and API routes
│   └── styles/        # Global styles and Tailwind config
├── public/            # Static assets
└── drizzle/          # Database migrations and schema
```

## Development Notes

- The application uses the Mempool.space API for Bitcoin transaction data
- TailwindCSS is used for styling with custom configuration
- The chart component uses Recharts for data visualization
- Authentication is handled through NextAuth.js with email provider
- Database migrations are managed with Drizzle ORM

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.
