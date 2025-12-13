# SOP AI Assistant

A fully local SOP-only AI assistant web app for a 6-person company. This app provides instant natural language answers about Standard Operating Procedures, complementing task management tools like 10x Task.

## Features

- **Authentication**: SQLite-based user management with JWT sessions
- **Chat Interface**: Ask questions about SOPs and get instant answers using RAG (Retrieval Augmented Generation)
- **Admin Dashboard**: Review unanswered questions and manage the SOP index
- **Local-Only**: Runs entirely on a single machine, no external services required
- **RAG System**: Uses Ollama (mistral:7b + nomic-embed-text) + ChromaDB for intelligent SOP queries

## Tech Stack

- **Backend**: Next.js 15 (App Router) + TypeScript
- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Database**: SQLite (via drizzle-orm)
- **Vector DB**: ChromaDB (local process via Docker)
- **LLM**: Ollama (mistral:7b + nomic-embed-text)
- **SOP Sources**: Excel files (`.xlsx`, `.xls`) and Word documents (`.docx`, `.doc`)

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose (for Ollama and ChromaDB)

### One-Command Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Seed the database** (creates 6 users + 1 admin):
   ```bash
   npm run seed
   ```

3. **Start Docker services** (Ollama + ChromaDB):
   ```bash
   docker-compose up -d
   ```

4. **Pull Ollama models** (after Ollama container is running):
   ```bash
   docker exec sop-ai-ollama ollama pull mistral:7b
   docker exec sop-ai-ollama ollama pull nomic-embed-text
   ```

5. **Index SOP documents**:
   ```bash
   npm run index
   ```
   This will automatically process:
   - The default Excel file: `S4_-_SOPs_-_MF_Transactions.xlsx`
   - All Word documents in: `template_sample/` folder
   
   Or specify a custom file/directory:
   ```bash
   npm run index /path/to/your/sop-file.xlsx
   npm run index /path/to/sop-directory
   ```

6. **Start the development server**:
   ```bash
   npm run dev
   ```

7. **Access the app**:
   - Open `http://localhost:3000` (or `http://192.168.x.x:3000` from other devices on your LAN)
   - Login with default credentials (see below)

### Default Credentials

- **Admin**: `admin@sop-ai.local` / `admin123`
- **Users**: 
  - `alice@sop-ai.local` / `user123`
  - `bob@sop-ai.local` / `user123`
  - `charlie@sop-ai.local` / `user123`
  - `diana@sop-ai.local` / `user123`
  - `eve@sop-ai.local` / `user123`
  - `frank@sop-ai.local` / `user123`

## Project Structure

```
sop-ai/
├── app/
│   ├── api/
│   │   ├── ask/route.ts          # Main Q&A endpoint (RAG)
│   │   ├── auth/                  # Authentication endpoints
│   │   ├── unanswered/route.ts    # Admin: unanswered questions
│   │   ├── recent/route.ts        # Recent questions per user
│   │   └── rebuild-index/route.ts # Admin: rebuild SOP index
│   ├── login/page.tsx             # Login page
│   ├── page.tsx                   # Main chat interface
│   └── admin/page.tsx             # Admin dashboard
├── components/
│   ├── ChatBox.tsx                # Chat UI component
│   └── UnansweredTable.tsx        # Admin table component
├── lib/
│   ├── db.ts                      # Database schema & connection
│   ├── auth.ts                    # JWT authentication
│   ├── chroma.ts                  # ChromaDB + Ollama RAG integration
│   ├── init-db.ts                 # Database initialization
│   └── seed.ts                    # Database seeding
├── scripts/
│   ├── seed.ts                    # Database seeding script
│   └── parse-sop.ts               # Excel SOP parser
├── sop-index.ts                   # SOP ingestion script
└── docker-compose.yml             # Ollama + ChromaDB services
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run seed` - Seed database with users
- `npm run parse-sop` - Parse and preview SOP Excel file structure
- `npm run index` - Index SOP documents into ChromaDB
- `npm run build` - Build for production

## How It Works

1. **SOP Ingestion**: 
   - Excel files (`.xlsx`, `.xls`) are parsed with structured extraction (Tasks, Who, Tools, etc.)
   - Word documents (`.docx`, `.doc`) are parsed and split into logical sections
   - All SOP entries are extracted and prepared for indexing
2. **Embedding Generation**: Each SOP entry is converted to embeddings using Ollama's `nomic-embed-text` model
3. **Vector Storage**: Embeddings are stored in ChromaDB for similarity search
4. **Query Processing**: When a user asks a question:
   - Question is embedded using the same model
   - Similar SOP entries are retrieved from ChromaDB
   - Context is passed to `mistral:7b` LLM for answer generation
   - Answer is returned with confidence score and sources

## Environment Variables

- `CHROMA_URL` - ChromaDB server URL (default: `http://localhost:8000`)
- `OLLAMA_URL` - Ollama server URL (default: `http://localhost:11434`)
- `JWT_SECRET` - Secret for JWT tokens (set in production!)

## Notes

- This is a **local-only** application designed for a small team
- All data stays on the machine running the app
- No external API calls or subscriptions required
- Perfect for sensitive company SOPs that shouldn't leave the network
- **SOP File Locations**:
  - Default Excel file: `/Users/Swarup/Documents/SOP_AI_Chatbot/S4_-_SOPs_-_MF_Transactions.xlsx`
  - Word documents folder: `/Users/Swarup/Documents/SOP_AI_Chatbot/template_sample/`
- Both Excel and Word documents are automatically indexed when running `npm run index`
