# 🍽️ DietMitra — AI Nutrition Analyzer

Open your camera, point it at any food (samosa, paneer, biryani, salad, etc.),
and get an instant, accurate nutrition breakdown: calories, protein, fat,
carbs, sugar, fiber, sodium, veg/non-veg tag, portion-weight category
(Light/Medium/Heavy), and a healthy-or-not verdict.

## How it works (pipeline)

```
[Camera capture or photo upload] → [Gemini AI Vision identifies the food AND
estimates its nutrition] → [App classifies: Light/Medium/Heavy + Healthy/Not]
→ [Result shown + saved to history]
```

## Features
- **Login / Signup** — animated welcome intro on the login page, secure password hashing, each user has their own private scan history
- **Forgot Password** — sends a real password-reset email via Gmail
- **Live camera scan** — opens your device camera and captures the food photo
  directly; a manual file-upload option is also available as a fallback
- AI identifies the food from the photo
- Accurate nutrition breakdown per typical serving, powered by Gemini's own
  nutrition knowledge (more reliable than generic nutrition-lookup APIs,
  especially for regional/Indian dishes)
- Veg / Non-Veg tag, Light/Medium/Heavy portion-size tag, Healthy/Not verdict
- Scan history saved locally in SQLite, per user

## Project Structure

| Requirement | What we used | Where |
|---|---|---|
| Frontend | HTML + CSS + JS (camera capture, login animation) | `templates/`, `static/` |
| Backend | Python (Flask) + Gemini AI Vision + Auth | `app.py` |
| Database | SQLite (users, scans, reset tokens) | `scans.db` (auto-created) |
| Deployment | Render.com | steps below |

## ⚠️ Setup — you need these in your `.env` file

### 1. Gemini API key (food recognition + nutrition) — free, no card
1. Go to https://aistudio.google.com
2. Sign in with any Google account
3. Click **"Get API key"** (left sidebar) → **"Create API key"**
4. Copy the key

### 2. SECRET_KEY (for secure login sessions)
Any random long string works — e.g. run this to generate one:
```bash
python3 -c "import secrets; print(secrets.token_hex(24))"
```

### 3. Gmail App Password (to send "forgot password" emails)
Regular Gmail passwords don't work for this — you need an **App Password**:
1. Go to your Google Account → **Security**
2. Turn on **2-Step Verification** (if not already on)
3. Go to https://myaccount.google.com/apppasswords
4. Create a new App Password (name it "DietMitra")
5. Copy the 16-character password shown

### Set up your `.env` file
```bash
cp .env.example .env
```
Fill in all four values: `GEMINI_API_KEY`, `SECRET_KEY`, `GMAIL_ADDRESS`, `GMAIL_APP_PASSWORD`

## How to run locally

```bash
pip install -r requirements.txt
python app.py
```

Open `http://127.0.0.1:5000` in your browser.
- Click **"Open Camera"** → allow camera access → point at food → tap
  **"Capture & Scan"**. It scans automatically.
- Or use the file picker below to upload an existing photo instead.

Note: browsers only allow camera access on `localhost` or over HTTPS — this
works fine for local testing and after deploying to Render (Render serves
over HTTPS by default).

## How to deploy (free) on Render.com

1. Push this project to a GitHub repo (⚠️ do NOT commit your real `.env` file
   — it's already excluded via `.gitignore`)
2. On Render: **New +** → **Web Service** → connect your repo
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `gunicorn app:app`
5. Under **Environment**, add all four variables:
   - `GEMINI_API_KEY`
   - `SECRET_KEY`
   - `GMAIL_ADDRESS`
   - `GMAIL_APP_PASSWORD`
6. Deploy — you'll get a live HTTPS link like `https://your-app.onrender.com`,
   which you can open on your phone to demo the live camera scan

## How to explain it in your presentation

- **Frontend** = the camera-capture page and result page (HTML/CSS/JS) the
  user sees; JavaScript's `getUserMedia` API opens the device camera directly
  in the browser
- **Backend** = `app.py` — receives the captured/uploaded photo, sends it to
  Google Gemini AI which both *identifies* the food and *estimates* its
  nutrition in one step
- **Database** = SQLite `scans.db`, stores every scan so there's a history
- **Deployment** = live Render link, so anyone can scan food from their phone
- **AI part** = this is what makes it "accurate": instead of a keyword-based
  nutrition lookup, Gemini's vision model reads the actual photo and applies
  real nutrition knowledge — including for regional dishes a plain database
  API often gets wrong

## Notes on accuracy

- Works best with clear, well-lit, single-dish photos
- Nutrition values are AI-estimated per typical serving; actual values vary
  by portion size and recipe
- The "Healthy/Not Healthy" verdict is a simple rule-of-thumb (based on
  calories, fat, sugar, protein) meant for a class project — not medical advice
