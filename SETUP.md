# Move to its own folder and set up Git from scratch

This project has **no Git history**—it’s a clean copy. Follow these steps to put it in its own folder and connect it to GitHub.

---

## Option A: Move to Desktop (or anywhere), then Git

**1. Move the folder** (in Finder or Terminal):

```bash
mv /Users/cyrus/Desktop/Bookingsfrontend/daily6 /Users/cyrus/Desktop/
```

Now the project lives at `~/Desktop/daily6`.

**2. Go into the folder and start a new Git repo:**

```bash
cd /Users/cyrus/Desktop/daily6

git init
git add .
git commit -m "Initial commit: Daily 6 habit tracker"
git branch -M main
```

**3. Create a new repo on GitHub** (no README, no .gitignore):  
[https://github.com/new](https://github.com/new) → name it e.g. `daily6`.

**4. Add the remote and push:**

```bash
git remote add origin https://github.com/YOUR_USERNAME/daily6.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Option B: Keep it inside Bookingsfrontend and use a fresh Git repo

If you want it to stay under `Bookingsfrontend/daily6` but with its **own** Git repo (not the parent repo):

**1. Go into the folder:**

```bash
cd /Users/cyrus/Desktop/Bookingsfrontend/daily6
```

**2. Start a new Git repo here** (this folder is not yet a git repo, so no need to remove anything):

```bash
git init
git add .
git commit -m "Initial commit: Daily 6 habit tracker"
git branch -M main
```

**3. Create a new repo on GitHub** (empty, no README).

**4. Add remote and push:**

```bash
git remote add origin https://github.com/YOUR_USERNAME/daily6.git
git push -u origin main
```

---

## After pushing: deploy (e.g. Vercel)

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. Import your `daily6` GitHub repo.
3. Leave defaults (Vite: build `npm run build`, output `dist`) → **Deploy**.

You’ll get a live URL for the app.
