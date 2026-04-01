# scraper_extension

This project is now organized into two parts:

- `extension/`: the Chrome extension you share with the client
- `backend/`: the MongoDB backend you run locally or deploy to Vercel

## Project Structure

```text
scraper_extension/
  extension/
    manifest.json
    popup.html
    popup.js
    content.js
  backend/
    api/
      health.js
      products.js
    lib/
      db.js
      product-model.js
      products-service.js
    .env
    .env.example
    package.json
    package-lock.json
    server.js
    vercel.json
  .gitignore
  README.md
```

## What Each Part Does

### `extension/`

This is the client-side Chrome extension.

It:

1. opens from the browser popup
2. scrapes the current tab
3. converts the result into JSON
4. sends the JSON to your backend API

### `backend/`

This is the server-side code.

It:

1. receives scraped JSON from the extension
2. connects to MongoDB Atlas
3. validates and normalizes the products
4. saves them into MongoDB

You can zip the `extension/` folder and send it to the client.

The client does not need:

- `backend/`
- `.env`
- MongoDB password
- Node.js server setup

## Local Development Flow

If you want to test locally first:

### 1. Backend

Open terminal inside `backend/` and run:

```bash
npm install
npm start
```

Create `backend/.env` like this:

```env
PORT=3000
MONGODB_URI=mongodb+srv://rehantahirdstech_db_user:YOUR_PASSWORD@cluster0.hwxqiwy.mongodb.net/scraperdb?appName=Cluster0
```

### 2. Extension

Open Chrome and go to:

```text
chrome://extensions/
```

Then:

1. turn on `Developer mode`
2. click `Load unpacked`
3. select the `extension/` folder

### 3. Use it

1. open a supported website
2. click the extension
3. click `Scrape Data`
4. extension sends JSON to your backend
5. backend saves the data to MongoDB

## How To Push This Project to GitHub

From the project root:

```bash
git init
git add .
git commit -m "Reorganize scraper into extension and backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/scraper_extension.git
git push -u origin main
```

Before pushing, verify secrets are not included:

```bash
git status
```

