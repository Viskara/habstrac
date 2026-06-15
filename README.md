# Recomp Tracker (Habstrac)

A sleek, mobile-first Progressive Web App (PWA) designed to track daily fitness/nutrition goals and manage meal prep recipes. 

Instead of a traditional database, this app uses **Google Sheets** and **Google Apps Script** as a backend, making it entirely free to host and incredibly easy to manage your data.

## Features

- **Progressive Web App (PWA):** Installable on iOS and Android home screens for a native app experience.
- **Daily Logs:** View and check off daily fitness, nutrition, and habit tasks.
- **Meal Prep Recipes:** Browse recipes complete with macronutrient breakdowns (Calories & Protein).
- **Modern UI:** Dark mode by default, featuring glassmorphism elements, custom checkboxes, and smooth animations.
- **Secure:** The API endpoint is stored locally on the user's device (`localStorage`), meaning no sensitive database URLs are hardcoded in the public repository.

## Project Structure

- `index.html` - The main UI structure and inline CSS styling.
- `app.js` - The frontend logic (tab switching, fetching data, updating logs).
- `manifest.json` - PWA configuration for home screen installation.
- `icon-192.png` / `icon-512.png` - App icons for the PWA.

## Setup & Installation

### 1. Host the Frontend
Because this is a completely static frontend, you can host it for free using **GitHub Pages**:
1. Push this code to a GitHub repository.
2. Go to **Settings > Pages**.
3. Select your `main` branch and click **Save**.

### 2. Set up the Backend (Google Sheets)
This app requires a Google Sheet with specific columns and an attached Google Apps Script to serve as the API.

1. Create a Google Sheet to store your `Logs` and `Recipes`.
2. Go to **Extensions > Apps Script**.
3. Write a script to handle `GET` and `POST` requests for your data (returning JSON).
4. Click **Deploy > New deployment**.
5. Select **Web app**.
6. **Important settings for deployment:**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy the generated Web App URL.

### 3. Connect the App
1. Open your hosted app on your phone or browser.
2. Navigate to the **Settings** tab.
3. Paste your Google Apps Script Web App URL into the input field.
4. Click **Save Endpoint**. The app will immediately fetch your data!

## Technologies Used

- HTML5 / CSS3 / Vanilla JavaScript
- Fetch API
- PWA (Web App Manifest)
- Google Apps Script (Backend/API)

---
*Built as a personal habit and fitness recomp tracker.*