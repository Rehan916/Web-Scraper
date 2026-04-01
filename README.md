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

## What You Push to GitHub

Push the code, but not secrets.

Safe to push:

- `extension/`
- `backend/api/`
- `backend/lib/`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/server.js`
- `backend/vercel.json`
- `backend/.env.example`
- `.gitignore`
- `README.md`

Do not push:

- `backend/.env`
- `node_modules`

## What You Deploy on Vercel

Deploy only the `backend/` folder.

Do not deploy the `extension/` folder to Vercel.

Vercel will host your API endpoints:

- `/api/health`
- `/api/products`

Those endpoints will connect to MongoDB Atlas using environment variables stored in Vercel.

## What You Share With the Client

Share only the `extension/` folder with the client.

That means the client only needs:

- `manifest.json`
- `popup.html`
- `popup.js`
- `content.js`

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

## Free Vercel Deployment Steps

You can deploy the backend on Vercel free tier.

### Option A: Deploy from GitHub

1. Push this repo to GitHub
2. Go to `https://vercel.com`
3. Sign in with GitHub
4. Click `Add New Project`
5. Import your GitHub repository
6. In project settings, set the Root Directory to `backend`
7. Add environment variable:

```text
MONGODB_URI = your real MongoDB Atlas connection string
```

8. Click `Deploy`

After deployment, Vercel gives you a URL like:

```text
https://scraper-extension.vercel.app
```

Your API will then be:

```text
https://scraper-extension.vercel.app/api/products
https://scraper-extension.vercel.app/api/health
```

### Option B: Deploy using Vercel CLI

Inside `backend/`:

```bash
npm install -g vercel
vercel
```

Then follow the prompts.

## After Vercel Deployment

Once Vercel gives you the live URL, update `extension/popup.js`.

Change this:

```js
const API_BASE_URL = "http://localhost:3000";
```

To something like this:

```js
const API_BASE_URL = "https://scraper-extension.vercel.app";
```

Then reload the extension in Chrome.

Now the client can use the extension without running a local server.

## Client Installation Process

If you send the client the `extension/` folder zip:

1. client extracts the zip
2. client opens `chrome://extensions/`
3. client enables `Developer mode`
4. client clicks `Load unpacked`
5. client selects the extracted `extension/` folder
6. client opens a target website
7. client clicks the extension
8. client clicks `Scrape Data`

Because the backend is on Vercel, the client does not need to start a server.

## How The Hosted Server Starts Working

When deployed on Vercel:

1. Vercel hosts your backend files inside `backend/api/`
2. your environment variable `MONGODB_URI` is stored in Vercel settings
3. when the extension sends a request to `/api/products`, Vercel runs that function
4. the function connects to MongoDB Atlas
5. the data is saved
6. Vercel returns a response to the extension

So the server is not manually started with `npm start` in production.
Vercel runs the API automatically whenever a request comes in.

## Recommended Real Workflow

Use this final flow:

1. keep backend deployed on Vercel
2. keep MongoDB in Atlas
3. update `extension/popup.js` to the live Vercel URL
4. zip the `extension/` folder
5. send only that zip to the client

## Important Security Rule

Never share:

- `backend/.env`
- MongoDB password
- full connection string with real password in public places

If a real password is ever exposed, rotate it immediately in MongoDB Atlas.
