# Deployment Guide - Render

## 🚀 Deploy Dual Subtitles Addon to Render

This guide will help you deploy the addon to Render's free tier with HTTPS support.

---

## Prerequisites

- ✅ GitHub repository with the code (already done)
- ✅ Render account (free) - https://render.com
- ✅ OpenSubtitles API key

---

## Step 1: Create Render Account

1. Go to: https://render.com/register
2. **Sign up with GitHub** (recommended for easy integration)
3. Authorize Render to access your GitHub repos

---

## Step 2: Create New Web Service

1. Go to Render Dashboard: https://dashboard.render.com
2. Click **"New +"** button (top right)
3. Select **"Web Service"**

---

## Step 3: Connect Repository

1. Click **"Connect GitHub"** (if not already connected)
2. Search for: `dual-subtitles-stremio-addon`
3. Click **"Connect"**

---

## Step 4: Configure Service

Fill in the following settings:

**Name:**
```
dual-subtitles-addon
```
(or any name you prefer - this becomes part of your URL)

**Region:**
```
Frankfurt (EU Central)
```
(or closest to you)

**Branch:**
```
main
```

**Root Directory:**
```
dual-subtitles-addon
```

**Runtime:**
```
Node
```

**Build Command:**
```
npm install && npm run build
```

**Start Command:**
```
npm start
```

---

## Step 5: Set Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

Add these 3 variables:

**Variable 1:**
- Name: `OPENSUBTITLES_API_KEY`
- Value: `aLTp4b85a1cjDdlCUQP9DvrEDBN2i15R` (your API key)

**Variable 2:**
- Name: `PORT`
- Value: `7001`

**Variable 3:**
- Name: `CACHE_TTL`
- Value: `86400`

---

## Step 6: Select Free Plan

**Instance Type:**
- Select: **"Free"** (0 USD/month)
- Includes: 750 hours/month
- Note: Service spins down after 15 min of inactivity

Click **"Create Web Service"**

---

## Step 7: Wait for Deployment

Render will now:
1. ✅ Clone your GitHub repo
2. ✅ Install dependencies
3. ✅ Build TypeScript → JavaScript
4. ✅ Start the server
5. ✅ Assign HTTPS URL

**Time:** ~3-5 minutes

Watch the **"Logs"** tab for progress.

---

## Step 8: Get Your HTTPS URL

Once deployed, you'll see:

```
Your service is live 🎉
https://dual-subtitles-addon.onrender.com
```

**Manifest URL:**
```
https://dual-subtitles-addon.onrender.com/manifest.json
```

---

## Step 9: Test Deployment

Open in browser:
```
https://your-service-name.onrender.com/manifest.json
```

You should see the JSON manifest.

---

## Step 10: Install in Stremio

1. Open Stremio
2. Go to Addons → Community Addons
3. Paste: `https://your-service-name.onrender.com/manifest.json`
4. Click **"Install"**

---

## Step 11: Test with Content

1. Search for "The Matrix" or "Game of Thrones"
2. Play any source
3. Click subtitles (CC)
4. Select **"ES + FR"**
5. **Subtítulos duales deberían aparecer!** 🎉

---

## 🔧 Troubleshooting

### Service won't start

**Check logs** in Render dashboard:
- Look for errors in build or start commands
- Verify environment variables are set

### First request is slow (~30 sec)

**Normal!** Free tier spins down after 15 min.
- Solution: Wait, it will wake up
- Or: Upgrade to paid plan ($7/month)

### Manifest shows but no subtitles

**Check:**
- OpenSubtitles API key is correct
- Logs show subtitle requests
- Try different content

---

## 🎯 Next Steps

After successful deployment:

1. ✅ Update README with public URL
2. ✅ Test with multiple content types
3. ✅ Share on LinkedIn
4. ✅ Add to portfolio

---

## 📊 Monitoring

**Render Dashboard:**
- View logs in real-time
- Monitor CPU/Memory usage
- See request metrics

**Free tier limits:**
- 750 hours/month (enough for 24/7)
- Spins down after 15 min inactivity
- Bandwidth: Generous for addons

---

**Ready to deploy!** Follow the steps above and your addon will be live with HTTPS! 🚀
