# Tech Stack Documentation

This document provides a comprehensive overview of the technologies, frameworks, libraries, and tools used in the SOP AI Chatbot application, including their versions and purposes.

## Table of Contents

- [Core Framework](#core-framework)
- [Frontend Technologies](#frontend-technologies)
- [Backend Technologies](#backend-technologies)
- [Database & Storage](#database--storage)
- [AI/ML Stack](#aiml-stack)
- [Authentication & Security](#authentication--security)
- [File Processing](#file-processing)
- [UI Components & Styling](#ui-components--styling)
- [Development Tools](#development-tools)
- [Runtime & Deployment](#runtime--deployment)
- [Containerization](#containerization)

---

## Core Framework

### Next.js
- **Version**: `16.0.10`
- **Purpose**: Full-stack React framework with App Router
- **Features Used**:
  - Server-side rendering (SSR)
  - API routes
  - Standalone output mode for Docker deployments
  - React Server Components
- **Configuration**: `next.config.ts` with production optimizations enabled

### React
- **Version**: `19.2.1`
- **Purpose**: UI library for building interactive user interfaces
- **Features**: React 19 with latest features and improvements

### React DOM
- **Version**: `19.2.1`
- **Purpose**: React renderer for web browsers

---

## Frontend Technologies

### TypeScript
- **Version**: `^5`
- **Purpose**: Type-safe JavaScript superset
- **Configuration**: 
  - Target: ES2017
  - Module: ESNext
  - JSX: react-jsx
  - Strict mode enabled

### Tailwind CSS
- **Version**: `^4`
- **Purpose**: Utility-first CSS framework
- **PostCSS**: `@tailwindcss/postcss ^4`
- **Additional**: `tw-animate-css ^1.4.0` for animations

### UI Component Libraries

#### Radix UI
- **@radix-ui/react-dialog**: `^1.1.15` - Accessible dialog components
- **@radix-ui/react-popover**: `^1.1.15` - Popover components
- **@radix-ui/react-slot**: `^1.2.4` - Slot component for composition

#### shadcn/ui Components
- Built on Radix UI primitives
- Custom components in `components/ui/`:
  - Button, Card, Input, Table, Sheet, Dialog, Popover, Command

#### Lucide React
- **Version**: `^0.561.0`
- **Purpose**: Icon library with React components

#### Command Menu (cmdk)
- **Version**: `^1.1.1`
- **Purpose**: Command palette component

### Utility Libraries
- **clsx**: `^2.1.1` - Conditional className utility
- **tailwind-merge**: `^3.4.0` - Merge Tailwind CSS classes
- **class-variance-authority**: `^0.7.1` - Component variant management

---

## Backend Technologies

### Node.js
- **Version**: `20` (Alpine Linux base image)
- **Purpose**: JavaScript runtime for server-side execution
- **Used in**: Docker container and local development

### API Framework
- **Next.js API Routes**: Built-in API route handlers
- **File Structure**: `app/api/` directory with route handlers

---

## Database & Storage

### SQLite
- **Driver**: `better-sqlite3 ^12.5.0`
- **Type Definitions**: `@types/better-sqlite3 ^7.6.13`
- **Purpose**: Local file-based database for user management and application data
- **ORM**: Drizzle ORM (see below)

### Drizzle ORM
- **Version**: `^0.45.1`
- **Purpose**: TypeScript ORM for SQLite
- **Kit**: `drizzle-kit ^0.31.8` (dev dependency for migrations)
- **Adapter**: `@auth/drizzle-adapter ^1.11.1` for authentication integration

### ChromaDB
- **Client**: `chromadb ^3.1.7`
- **Purpose**: Vector database for storing and querying SOP document embeddings
- **Deployment**: Docker container (`chromadb/chroma:latest`)
- **Port**: `8000`
- **Persistence**: Enabled with volume mounting

---

## AI/ML Stack

### Ollama
- **Image**: `ollama/ollama:latest`
- **Purpose**: Local LLM inference server
- **Port**: `11434`
- **Models Used**:
  - **qwen2.5:3b** - Large language model for answer generation
  - **nomic-embed-text** - Embedding model for vector search
- **Deployment**: Docker container with persistent volume

### RAG (Retrieval Augmented Generation)
- **Architecture**: Custom implementation in `lib/chroma.ts`
- **Components**:
  - Embedding generation via Ollama API
  - Vector similarity search via ChromaDB
  - Context retrieval and LLM prompt construction
  - Confidence score calculation

---

## Authentication & Security

### Lucia Auth
- **Version**: `^3.2.2`
- **Purpose**: Authentication library for Next.js
- **Adapter**: Drizzle ORM adapter for database integration

### JWT (JSON Web Tokens)
- **Library**: `jsonwebtoken ^9.0.3`
- **Type Definitions**: `@types/jsonwebtoken ^9.0.10`
- **Purpose**: Session token generation and validation

### Password Hashing
- **Library**: `bcryptjs ^3.0.3`
- **Type Definitions**: `@types/bcryptjs ^2.4.6`
- **Purpose**: Secure password hashing and verification

---

## File Processing

### Excel Processing
- **Library**: `xlsx ^0.18.5`
- **Purpose**: Parse and extract data from `.xlsx` and `.xls` files
- **Use Case**: SOP document ingestion from Excel files

### Word Document Processing
- **Library**: `mammoth ^1.11.0`
- **Purpose**: Convert `.docx` and `.doc` files to HTML/text
- **Use Case**: SOP document ingestion from Word documents

---

## UI Components & Styling

### Component Architecture
- **Pattern**: Component-based architecture with reusable UI primitives
- **Location**: `components/` directory
- **Key Components**:
  - `ChatBox.tsx` - Main chat interface
  - `SOPsSidebar.tsx` - Sidebar navigation
  - `UnansweredTable.tsx` - Admin dashboard table
  - `PredefinedQuestionsDropdown.tsx` - Question suggestions
  - `SOPUpload.tsx` - File upload interface
  - `UploadedSOPsList.tsx` - SOP management list

### Styling Approach
- **Methodology**: Utility-first CSS with Tailwind CSS
- **Custom Styles**: `app/globals.css` for global styles
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints

---

## Development Tools

### TypeScript
- **Version**: `^5`
- **Configuration**: `tsconfig.json` with strict mode

### ESLint
- **Version**: `^9`
- **Config**: `eslint-config-next 16.0.10`
- **Purpose**: Code linting and quality checks

### TSX
- **Version**: `^4.21.0`
- **Purpose**: TypeScript execution for scripts
- **Use Cases**: Database seeding, migrations, SOP parsing

### Node.js Type Definitions
- **@types/node**: `^20`
- **@types/react**: `^19`
- **@types/react-dom**: `^19`

---

## Runtime & Deployment

### Docker
- **Base Image**: `node:20-alpine`
- **Purpose**: Containerized deployment
- **Multi-stage Build**: Optimized production image
- **Output**: Standalone Next.js build

### Docker Compose
- **Version**: `3.8`
- **Services**:
  - Ollama service
  - ChromaDB service
  - Persistent volumes for both services

### Environment Variables
- `CHROMA_URL` - ChromaDB server URL (default: `http://localhost:8000`)
- `OLLAMA_URL` - Ollama server URL (default: `http://localhost:11434`)
- `JWT_SECRET` - Secret key for JWT token signing
- `RETRIEVAL_WEIGHT` - Weight for retrieval confidence (default: `0.6`)
- `LLM_WEIGHT` - Weight for LLM confidence (default: `0.4`)
- `NODE_ENV` - Environment mode (`production` or `development`)
- `PORT` - Server port (default: `3000`)
- `HOSTNAME` - Server hostname (default: `0.0.0.0`)

---

## Containerization

### Docker Services

#### Ollama Container
- **Image**: `ollama/ollama:latest`
- **Container Name**: `sop-ai-ollama`
- **Port**: `11434:11434`
- **Volume**: `ollama_data:/root/.ollama`
- **Restart Policy**: `unless-stopped`

#### ChromaDB Container
- **Image**: `chromadb/chroma:latest`
- **Container Name**: `sop-ai-chromadb`
- **Port**: `8000:8000`
- **Volume**: `chroma_data:/chroma/chroma`
- **Environment Variables**:
  - `IS_PERSISTENT=TRUE`
  - `ANONYMIZED_TELEMETRY=FALSE`
- **Restart Policy**: `unless-stopped`

### Production Deployment
- **Dockerfile**: Multi-stage build for optimized production image
- **Docker Compose**: `docker-compose.prod.yml` for production setup
- **Setup Script**: `docker-compose.prod.setup.sh` for automated deployment

---

## Build & Scripts

### NPM Scripts
- `dev` - Start development server (`next dev`)
- `build` - Build for production (`next build`)
- `start` - Start production server (`next start`)
- `lint` - Run ESLint (`eslint`)
- `seed` - Seed database with initial data (`tsx scripts/seed.ts`)
- `parse-sop` - Parse and preview SOP structure (`tsx scripts/parse-sop.ts`)
- `index` - Index SOP documents (`tsx sop-index.ts`)
- `migrate` - Run database migrations (`tsx scripts/migrate.ts`)

---

## Architecture Overview

### Application Type
- **Pattern**: Full-stack Next.js application
- **Routing**: App Router (Next.js 16)
- **API**: RESTful API routes
- **State Management**: React hooks and server components
- **Data Fetching**: Server-side data fetching with Next.js

### Key Features
- **Local-Only**: All processing happens on the local machine
- **No External APIs**: No reliance on external services (except Docker images)
- **RAG System**: Custom implementation for document Q&A
- **File Upload**: Support for Excel and Word document uploads
- **Admin Dashboard**: Management interface for unanswered questions
- **User Authentication**: JWT-based session management

---

## Version Summary

| Category | Technology | Version |
|----------|-----------|---------|
| Framework | Next.js | 16.0.10 |
| UI Library | React | 19.2.1 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| Database | SQLite (better-sqlite3) | ^12.5.0 |
| ORM | Drizzle ORM | ^0.45.1 |
| Vector DB | ChromaDB | ^3.1.7 |
| LLM | Ollama | latest |
| Auth | Lucia | ^3.2.2 |
| JWT | jsonwebtoken | ^9.0.3 |
| Password | bcryptjs | ^3.0.3 |
| Excel | xlsx | ^0.18.5 |
| Word | mammoth | ^1.11.0 |
| Runtime | Node.js | 20 |

---

## Dependencies Summary

### Production Dependencies (17)
- Authentication: `@auth/drizzle-adapter`, `lucia`, `jsonwebtoken`, `bcryptjs`
- Database: `better-sqlite3`, `drizzle-orm`, `chromadb`
- UI: `@radix-ui/*`, `lucide-react`, `cmdk`, `class-variance-authority`, `clsx`, `tailwind-merge`
- File Processing: `xlsx`, `mammoth`
- Core: `next`, `react`, `react-dom`

### Development Dependencies (11)
- Type Definitions: `@types/*` packages
- Build Tools: `typescript`, `tsx`, `drizzle-kit`
- Linting: `eslint`, `eslint-config-next`
- Styling: `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`

---

## Notes

- All versions are locked in `package-lock.json` for reproducible builds
- Docker images use `latest` tags but can be pinned for production stability
- The application is designed to run entirely locally without external dependencies
- All AI/ML processing happens on the local machine via Ollama
- Database and vector store are file-based and persist locally

---

*Last Updated: Based on current `package.json` and project configuration*

