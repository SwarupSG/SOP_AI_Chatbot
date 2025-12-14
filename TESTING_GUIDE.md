# SOP AI Chatbot - Step-by-Step Testing Guide

This guide will walk you through testing the SOP AI Chatbot application from start to finish.

## Prerequisites Check

Before we begin, let's verify what's already set up:

### ✅ Current Status:
- ✅ Dependencies installed (node_modules exists)
- ✅ Database file exists (sop-ai.db)
- ❌ Docker services not running (needs to be started)

---

## Step 1: Start Docker Services

The application requires Ollama and ChromaDB to be running in Docker containers.

**Action:**
```bash
cd /Users/Swarup/Documents/SOP_AI_Chatbot/sop-ai
docker-compose up -d
```

**Expected Result:**
- Two containers should start: `sop-ai-ollama` and `sop-ai-chromadb`
- You should see "Creating..." and "Started" messages

**Verify:**
```bash
docker ps --filter "name=sop-ai"
```
You should see both containers running.

---

## Step 2: Pull Required Ollama Models

Ollama needs two models: `mistral:7b` (for LLM) and `nomic-embed-text` (for embeddings).

**Action:**
```bash
# Pull the LLM model (this may take several minutes - ~4GB download)
docker exec sop-ai-ollama ollama pull mistral:7b

# Pull the embedding model (this is smaller)
docker exec sop-ai-ollama ollama pull nomic-embed-text
```

**Expected Result:**
- Progress bars showing download progress
- "success" messages when complete
- Models are now available in the container

**Verify:**
```bash
docker exec sop-ai-ollama ollama list
```
You should see both `mistral:7b` and `nomic-embed-text` in the list.

---

## Step 3: Verify Database is Seeded

Check if users exist in the database.

**Action:**
```bash
cd /Users/Swarup/Documents/SOP_AI_Chatbot/sop-ai
npm run seed
```

**Expected Result:**
- If database is empty: Creates 6 users + 1 admin
- If database already has users: May show errors (that's okay)

**Default Credentials:**
- **Admin**: `admin@sop-ai.local` / `admin123`
- **Users**: 
  - `alice@sop-ai.local` / `user123`
  - `bob@sop-ai.local` / `user123`
  - `charlie@sop-ai.local` / `user123`
  - `diana@sop-ai.local` / `user123`
  - `eve@sop-ai.local` / `user123`
  - `frank@sop-ai.local` / `user123`

---

## Step 4: Index SOP Documents

Index the SOP documents into ChromaDB for RAG (Retrieval Augmented Generation).

**Action:**
```bash
cd /Users/Swarup/Documents/SOP_AI_Chatbot/sop-ai
npm run index
```

**Expected Result:**
- Processes the Excel file: `S4_-_SOPs_-_MF_Transactions.xlsx`
- Processes Word documents from `template_sample/` (if any exist)
- Shows progress: "Processing batch X/Y"
- Final message: "Successfully indexed X SOP entries into ChromaDB"

**Note:** This may take several minutes as it generates embeddings for each SOP entry.

---

## Step 5: Start the Development Server

Start the Next.js development server.

**Action:**
```bash
cd /Users/Swarup/Documents/SOP_AI_Chatbot/sop-ai
npm run dev
```

**Expected Result:**
- Server starts on `http://localhost:3000`
- You should see: "Ready in X ms" and "Local: http://localhost:3000"

**Keep this terminal open** - the server needs to keep running.

---

## Step 6: Test Authentication

### 6.1: Access the Login Page

**Action:**
1. Open browser and go to: `http://localhost:3000`
2. You should be redirected to `/login` automatically

**Expected Result:**
- Login page displays
- Email and password input fields visible
- "Login" button present

### 6.2: Test Regular User Login

**Action:**
1. Enter email: `alice@sop-ai.local`
2. Enter password: `user123`
3. Click "Login"

**Expected Result:**
- Redirected to main chat page (`/`)
- Header shows "SOP AI Assistant"
- User email/name displayed in header
- "Logout" button visible
- **No "Admin Dashboard" button** (regular users don't see this)

### 6.3: Test Admin Login

**Action:**
1. Click "Logout"
2. Login with:
   - Email: `admin@sop-ai.local`
   - Password: `admin123`

**Expected Result:**
- Redirected to main chat page
- Header shows "Admin Dashboard" button (admin-only feature)

---

## Step 7: Test Chat Interface (Main Feature)

### 7.1: Basic Question Test

**Action:**
1. In the chat interface, type a question related to SOPs
2. Example: "How do I process a SIP order?"
3. Click "Ask" button

**Expected Result:**
- Button shows "Asking..." while processing
- Answer appears in a card below
- Confidence score displayed (0-100%)
- If confidence < 30%, shows warning about being logged for review

**Note:** First query may take 10-30 seconds as Ollama loads the model.

### 7.2: Test Recent Questions

**Action:**
1. Ask 2-3 different questions
2. Scroll down to "Recent Questions" section

**Expected Result:**
- All previous questions listed
- Shows question, truncated answer, timestamp, and confidence
- Questions ordered by most recent first

### 7.3: Test Low Confidence Handling

**Action:**
1. Ask a question that's completely unrelated to SOPs
2. Example: "What's the weather today?"

**Expected Result:**
- Answer may be generic or indicate no relevant SOPs found
- Confidence score should be low (< 30%)
- Warning message appears: "This question has been logged for review"
- Question is automatically added to unanswered questions (admin can see this)

---

## Step 8: Test Admin Dashboard

### 8.1: Access Admin Dashboard

**Action:**
1. Make sure you're logged in as admin (`admin@sop-ai.local`)
2. Click "Admin Dashboard" button in header

**Expected Result:**
- Redirected to `/admin`
- Page title: "Admin Dashboard"
- Unanswered questions table visible

### 8.2: View Unanswered Questions

**Action:**
1. If you asked questions with low confidence, they should appear here
2. Review the table

**Expected Result:**
- Table shows:
  - Question text
  - User who asked it
  - Status (pending/answered)
  - Created date
  - Notes column (for admin to add notes)

### 8.3: Test Rebuild Index (Admin Feature)

**Action:**
1. Look for "Rebuild Index" button/functionality
2. Click it (if available)

**Expected Result:**
- Re-indexes all SOP documents
- Shows progress messages
- Updates ChromaDB with latest SOP content

**Note:** This may take several minutes depending on document size.

---

## Step 9: Test API Endpoints Directly (Optional)

You can test the API endpoints using curl or Postman.

### 9.1: Test Authentication Endpoint

**Action:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@sop-ai.local","password":"user123"}' \
  -c cookies.txt
```

**Expected Result:**
- Returns JSON with user object
- Sets `auth-token` cookie

### 9.2: Test Ask Endpoint

**Action:**
```bash
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"question":"How do I process a refund?"}'
```

**Expected Result:**
- Returns JSON with:
  - `answer`: The generated answer
  - `confidence`: Number between 0 and 1
  - `sources`: Array of source titles

### 9.3: Test Recent Questions Endpoint

**Action:**
```bash
curl http://localhost:3000/api/recent -b cookies.txt
```

**Expected Result:**
- Returns JSON with array of recent questions for the logged-in user

---

## Step 10: Test Edge Cases

### 10.1: Test Unauthenticated Access

**Action:**
1. Logout
2. Try to access `http://localhost:3000` directly

**Expected Result:**
- Automatically redirected to `/login`

### 10.2: Test Invalid Credentials

**Action:**
1. Try logging in with wrong password
2. Example: `alice@sop-ai.local` / `wrongpassword`

**Expected Result:**
- Error message displayed
- Remains on login page

### 10.3: Test Empty Question

**Action:**
1. Try submitting an empty question in chat

**Expected Result:**
- Submit button disabled
- No API call made

### 10.4: Test Long Questions

**Action:**
1. Submit a very long question (500+ characters)

**Expected Result:**
- Question is processed
- Answer generated (may take longer)

---

## Step 11: Test with Multiple Users

### 11.1: Test User Isolation

**Action:**
1. Login as `alice@sop-ai.local`
2. Ask a few questions
3. Logout
4. Login as `bob@sop-ai.local`
5. Check recent questions

**Expected Result:**
- Bob only sees his own recent questions
- Alice's questions are not visible to Bob

### 11.2: Test Admin Access

**Action:**
1. Login as admin
2. Go to Admin Dashboard
3. Check unanswered questions

**Expected Result:**
- Admin can see unanswered questions from all users
- Questions show which user asked them

---

## Step 12: Performance Testing

### 12.1: Test Response Time

**Action:**
1. Ask several questions in sequence
2. Note the response time for each

**Expected Result:**
- First question: 10-30 seconds (model loading)
- Subsequent questions: 3-10 seconds (model already loaded)
- Response time depends on question complexity and document size

### 12.2: Test Concurrent Requests

**Action:**
1. Open multiple browser tabs
2. Ask questions simultaneously from different tabs

**Expected Result:**
- All requests are processed
- No errors or crashes
- Each user's questions are tracked separately

---

## Troubleshooting

### Issue: Docker containers won't start
**Solution:** 
- Check if Docker Desktop is running
- Try: `docker-compose down` then `docker-compose up -d`

### Issue: Ollama models not found
**Solution:**
- Verify models are pulled: `docker exec sop-ai-ollama ollama list`
- Re-pull if missing: `docker exec sop-ai-ollama ollama pull mistral:7b`

### Issue: ChromaDB connection error
**Solution:**
- Check if container is running: `docker ps`
- Check logs: `docker logs sop-ai-chromadb`
- Restart: `docker-compose restart chromadb`

### Issue: No answers or low confidence
**Solution:**
- Verify SOPs are indexed: Check console output from `npm run index`
- Re-index if needed: `npm run index`
- Check if documents exist in expected locations

### Issue: Database errors
**Solution:**
- Re-seed database: `npm run seed`
- Check if database file exists: `ls -la sop-ai.db`

---

## Success Criteria Checklist

- [ ] Docker services running (Ollama + ChromaDB)
- [ ] Ollama models downloaded (mistral:7b, nomic-embed-text)
- [ ] Database seeded with users
- [ ] SOP documents indexed successfully
- [ ] Development server running on localhost:3000
- [ ] Can login as regular user
- [ ] Can login as admin
- [ ] Can ask questions and get answers
- [ ] Confidence scores displayed
- [ ] Recent questions visible
- [ ] Low confidence questions logged
- [ ] Admin dashboard accessible
- [ ] Unanswered questions visible to admin
- [ ] User isolation working (users see only their questions)
- [ ] Logout functionality works
- [ ] Authentication redirects work correctly

---

## Next Steps After Testing

1. **Review unanswered questions** in admin dashboard
2. **Add more SOP documents** if needed
3. **Re-index** when SOPs are updated
4. **Monitor performance** and response times
5. **Gather user feedback** on answer quality

---

## Notes

- The application is **local-only** - all data stays on your machine
- First query may be slow as Ollama loads the model into memory
- Indexing may take time depending on document size
- All SOPs are stored in ChromaDB for fast similarity search
- Questions with confidence < 30% are automatically flagged for review

