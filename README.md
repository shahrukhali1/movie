# Movies App - Netflix Clone

A React-based Netflix clone that fetches and displays movies from external APIs.

## Features

- 🎬 Movie listings with categories
- 🎥 Video playback with custom Netflix-style player
- 🔍 Search functionality
- 📱 Responsive design
- 🎨 Modern UI/UX

## Deployment

### GitHub Pages

1. **Enable GitHub Pages:**

   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under **Source**, select **GitHub Actions**
   - Save the settings

2. **Push code to trigger deployment:**

   ```bash
   git add .
   git commit -m "Setup GitHub Pages"
   git push origin main
   ```

3. **Check deployment:**
   - Go to **Actions** tab in your repository
   - Wait for the workflow to complete
   - Your site will be available at: `https://shahrukhali1.github.io/movie/`

### Manual Deploy (Alternative)

```bash
npm run deploy
```

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Environment Variables

Optional: Set `VITE_OPENAI_API_KEY` for image generation fallbacks.
