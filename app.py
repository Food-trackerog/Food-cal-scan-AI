import os
import re
import base64
import json
import sqlite3
import secrets
import uuid
import smtplib
from datetime import datetime, timedelta
from functools import wraps
from email.mime.text import MIMEText

import requests
from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-fallback-change-in-production")

UPLOAD_FOLDER = "uploads"
DB_NAME = "scans.db"
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash:generateContent"
)

GMAIL_ADDRESS = os.environ.get("GMAIL_ADDRESS")
GMAIL_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD")

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
RESET_TOKEN_VALID_MINUTES = 30


# ---------- DATABASE ----------
def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            food_name TEXT,
            veg_status TEXT,
            serving_description TEXT,
            calories REAL,
            protein REAL,
            fat REAL,
            carbs REAL,
            sugar REAL,
            fiber REAL,
            sodium REAL,
            weight_category TEXT,
            healthy_status TEXT,
            scanned_at TEXT
        )
    """)

    conn.commit()
    conn.close()


def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def to_num(value):
    if value is None:
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


# ---------- AUTH HELPERS ----------
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def send_reset_email(to_email, reset_link):
    if not GMAIL_ADDRESS or not GMAIL_APP_PASSWORD:
        raise Exception(
            "Email sending isn't configured. Set GMAIL_ADDRESS and "
            "GMAIL_APP_PASSWORD in your .env file."
        )

    body = (
        f"Hi,\n\nWe received a request to reset your Food Scanner password.\n\n"
        f"Click the link below to set a new password (valid for "
        f"{RESET_TOKEN_VALID_MINUTES} minutes):\n\n{reset_link}\n\n"
        f"If you didn't request this, you can safely ignore this email."
    )
    msg = MIMEText(body)
    msg["Subject"] = "Reset your Food Scanner password"
    msg["From"] = GMAIL_ADDRESS
    msg["To"] = to_email

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(GMAIL_ADDRESS, GMAIL_APP_PASSWORD)
        server.send_message(msg)


# ---------- AUTH ROUTES ----------
@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "GET":
        return render_template("login.html", initial_face="signup", show_intro=False)

    name = request.form.get("name", "").strip()
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")
    confirm_password = request.form.get("confirm_password", "")

    def fail(msg):
        return render_template("login.html", initial_face="signup", show_intro=False, error=msg)

    if not name or not email or not password:
        return fail("Please fill in all fields.")
    if not EMAIL_REGEX.match(email):
        return fail("Please enter a valid email address.")
    if len(password) < 6:
        return fail("Password must be at least 6 characters.")
    if password != confirm_password:
        return fail("Passwords do not match.")

    conn = get_db_connection()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return fail("An account with this email already exists.")

    password_hash = generate_password_hash(password)
    cursor = conn.execute(
        "INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
        (name, email, password_hash, datetime.now().strftime("%Y-%m-%d %H:%M")),
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    session["user_id"] = user_id
    session["user_name"] = name
    return redirect(url_for("index"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html", initial_face="login", show_intro=True)

    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return render_template(
            "login.html", initial_face="login", show_intro=False,
            error="Incorrect email or password."
        )

    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    return redirect(url_for("index"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "GET":
        return render_template("forgot_password.html")

    email = request.form.get("email", "").strip().lower()

    conn = get_db_connection()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    # Always show the same message whether or not the account exists (avoids
    # leaking which emails are registered), but only actually send an email
    # if the account is real.
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now() + timedelta(minutes=RESET_TOKEN_VALID_MINUTES)).strftime("%Y-%m-%d %H:%M:%S")
        conn.execute(
            "INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
            (user["id"], token, expires_at),
        )
        conn.commit()
        reset_link = url_for("reset_password", token=token, _external=True)

        try:
            send_reset_email(email, reset_link)
        except Exception as e:
            conn.close()
            return render_template("forgot_password.html", error=f"Couldn't send email: {str(e)}")

    conn.close()
    return render_template(
        "forgot_password.html",
        success="If an account with that email exists, we've sent a password reset link to it."
    )


@app.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):
    conn = get_db_connection()
    reset_row = conn.execute(
        "SELECT * FROM reset_tokens WHERE token = ?", (token,)
    ).fetchone()

    valid = (
        reset_row is not None
        and reset_row["used"] == 0
        and datetime.strptime(reset_row["expires_at"], "%Y-%m-%d %H:%M:%S") > datetime.now()
    )

    if not valid:
        conn.close()
        return render_template("reset_password.html", invalid=True)

    if request.method == "GET":
        conn.close()
        return render_template("reset_password.html", token=token)

    password = request.form.get("password", "")
    confirm_password = request.form.get("confirm_password", "")

    if len(password) < 6:
        conn.close()
        return render_template("reset_password.html", token=token, error="Password must be at least 6 characters.")
    if password != confirm_password:
        conn.close()
        return render_template("reset_password.html", token=token, error="Passwords do not match.")

    password_hash = generate_password_hash(password)
    conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (password_hash, reset_row["user_id"]))
    conn.execute("UPDATE reset_tokens SET used = 1 WHERE id = ?", (reset_row["id"],))
    conn.commit()
    conn.close()

    return redirect(url_for("login"))


# ---------- IDENTIFY FOOD + GET NUTRITION IN ONE STEP (Gemini Vision) ----------
def analyze_food_image(image_path):
    with open(image_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    ext = image_path.rsplit(".", 1)[1].lower()
    mime_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"

    prompt = (
        "You are a nutrition expert. Identify the food item in this image and "
        "estimate its nutrition for ONE typical serving/plate as commonly eaten "
        "(be as accurate as possible using real-world nutrition knowledge, "
        "including for regional and Indian dishes like paneer, samosa, biryani, dal, etc). "
        "Reply with ONLY a JSON object, no other text, no markdown fences, "
        "in this exact format:\n"
        '{"food_name": "<simple common food name>", '
        '"veg_status": "Veg" or "Non-Veg", '
        '"serving_description": "<e.g. 1 plate (~250g)>", '
        '"calories": <number, kcal for the serving>, '
        '"protein_g": <number>, '
        '"fat_g": <number>, '
        '"carbs_g": <number>, '
        '"sugar_g": <number>, '
        '"fiber_g": <number>, '
        '"sodium_mg": <number>}'
    )

    body = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {"inline_data": {"mime_type": mime_type, "data": image_data}},
                ]
            }
        ]
    }

    response = requests.post(GEMINI_URL, params={"key": GEMINI_API_KEY}, json=body, timeout=30)

    if response.status_code != 200:
        raise Exception(
            f"Gemini API error ({response.status_code}): {response.text}. "
            f"Check that GEMINI_API_KEY in your .env file is correct."
        )

    data = response.json()

    try:
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError):
        raise Exception(
            "Gemini didn't return a usable response for this image "
            "(it may have been blocked or the image is unclear). Try a different photo."
        )

    raw_text = raw_text.replace("```json", "").replace("```", "").strip()

    try:
        parsed = json.loads(raw_text)
    except json.JSONDecodeError:
        raise Exception(f"Couldn't parse Gemini's response as JSON: {raw_text[:200]}")

    return {
        "food_name": str(parsed.get("food_name", "Unknown food")).strip(),
        "veg_status": parsed.get("veg_status", "Veg"),
        "serving_description": parsed.get("serving_description", "1 serving"),
        "calories": to_num(parsed.get("calories")),
        "protein_g": to_num(parsed.get("protein_g")),
        "fat_g": to_num(parsed.get("fat_g")),
        "carbs_g": to_num(parsed.get("carbs_g")),
        "sugar_g": to_num(parsed.get("sugar_g")),
        "fiber_g": to_num(parsed.get("fiber_g")),
        "sodium_mg": to_num(parsed.get("sodium_mg")),
    }


# ---------- CLASSIFY ----------
def classify_weight_category(calories):
    if calories < 200:
        return "Light"
    elif calories < 450:
        return "Medium"
    else:
        return "Heavy"


def classify_healthy(calories, protein, fat, sugar):
    score = 0
    if calories > 500:
        score -= 2
    elif calories > 350:
        score -= 1
    elif calories < 200:
        score += 1

    if fat > 20:
        score -= 1
    elif fat < 10:
        score += 1

    if sugar > 15:
        score -= 1
    elif sugar < 5:
        score += 1

    if protein > 10:
        score += 1

    if score >= 2:
        return "Healthy"
    elif score >= 0:
        return "Moderate — okay in controlled portions"
    else:
        return "Not Healthy — consume occasionally"


# ---------- MAIN ROUTES (protected) ----------
@app.route("/")
@login_required
def index():
    conn = get_db_connection()
    history = conn.execute(
        "SELECT * FROM scans WHERE user_id = ? ORDER BY id DESC LIMIT 10",
        (session["user_id"],)
    ).fetchall()
    conn.close()
    return render_template("index.html", history=history, user_name=session.get("user_name"))


@app.route("/scan", methods=["POST"])
@login_required
def scan():
    if "photo" not in request.files:
        return redirect(url_for("index"))

    file = request.files["photo"]
    if file.filename == "" or not allowed_file(file.filename):
        return render_template(
            "index.html",
            error="Please choose or capture a valid image file (jpg/png/webp).",
            history=[],
            user_name=session.get("user_name"),
        )

    ext = file.filename.rsplit(".", 1)[1].lower()
    unique_filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], unique_filename)
    file.save(filepath)
    try:
        info = analyze_food_image(filepath)

        weight_category = classify_weight_category(info["calories"])
        healthy_status = classify_healthy(
            info["calories"], info["protein_g"], info["fat_g"], info["sugar_g"]
        )

        result = {
            "food_name": info["food_name"].title(),
            "veg_status": info["veg_status"],
            "serving_description": info["serving_description"],
            "calories": round(info["calories"], 1),
            "protein": round(info["protein_g"], 1),
            "fat": round(info["fat_g"], 1),
            "carbs": round(info["carbs_g"], 1),
            "sugar": round(info["sugar_g"], 1),
            "fiber": round(info["fiber_g"], 1),
            "sodium": round(info["sodium_mg"], 1),
            "weight_category": weight_category,
            "healthy_status": healthy_status,
        }

        conn = get_db_connection()
        conn.execute("""
            INSERT INTO scans (user_id, food_name, veg_status, serving_description, calories, protein, fat,
                                carbs, sugar, fiber, sodium, weight_category, healthy_status, scanned_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            session["user_id"], result["food_name"], result["veg_status"], result["serving_description"],
            result["calories"], result["protein"], result["fat"], result["carbs"],
            result["sugar"], result["fiber"], result["sodium"],
            result["weight_category"], result["healthy_status"],
            datetime.now().strftime("%Y-%m-%d %H:%M")
        ))
        conn.commit()
        conn.close()

        return render_template("result.html", result=result)

    except Exception as e:
        return render_template(
            "index.html", error=f"Something went wrong: {str(e)}",
            history=[], user_name=session.get("user_name")
        )

    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5000))
    debug_mode = os.environ.get("FLASK_DEBUG", "False") == "True"
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
else:
    init_db()
