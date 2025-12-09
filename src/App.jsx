import { useState, useEffect, useRef, useMemo } from "react";
import "./App.css";

// OpenAPI key for image generation (set via environment variable)
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";

// Movie categories from the website (matching the actual URL slugs)
const MOVIE_CATEGORIES = [
  { id: "all", name: "All Movies", slug: "" },
  { id: "drama", name: "Drama", slug: "drama" },
  { id: "action", name: "Action", slug: "action" },
  { id: "comedy", name: "Comedy", slug: "comedy" },
  { id: "romance", name: "Romance", slug: "romance" },
  { id: "thriller", name: "Thriller", slug: "thriller" },
  { id: "crime", name: "Crime", slug: "crime" },
  { id: "horror", name: "Horror", slug: "horror" },
  { id: "adventure", name: "Adventure", slug: "adventure" },
  { id: "science-fiction", name: "Science Fiction", slug: "science-fiction" },
  { id: "mystery", name: "Mystery", slug: "mystery" },
  { id: "fantasy", name: "Fantasy", slug: "fantasy" },
  { id: "family", name: "Family", slug: "family" },
  { id: "tv-show", name: "TV Show", slug: "tv-show" },
  {
    id: "action-adventure",
    name: "Action & Adventure",
    slug: "action-adventure",
  },
  { id: "history", name: "History", slug: "history" },
  { id: "war", name: "War", slug: "war" },
  { id: "music", name: "Music", slug: "music" },
  { id: "biography", name: "Biography", slug: "biography" },
  { id: "documentary", name: "Documentary", slug: "documentary" },
  { id: "sci-fi-fantasy", name: "Sci-Fi & Fantasy", slug: "sci-fi-fantasy" },
  { id: "animation", name: "Animation", slug: "animation" },
  { id: "sports", name: "Sports", slug: "sports" },
  { id: "western", name: "Western", slug: "western" },
  { id: "war-politics", name: "War & Politics", slug: "war-politics" },
];

function App() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const [showSearch, setShowSearch] = useState(false);
  const [featuredMovie, setFeaturedMovie] = useState(null);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0); // Default to normal speed
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [showNetflixIntro, setShowNetflixIntro] = useState(true);
  const [lastPlayedPosition, setLastPlayedPosition] = useState(0);
  const [watchedMovies, setWatchedMovies] = useState(() => {
    // Load from localStorage
    try {
      const saved = localStorage.getItem("watchedMovies");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const scrollContainerRef = useRef(null);
  const videoRef = useRef(null);
  const speedMenuRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const videoContainerRef = useRef(null);
  const netflixIntroTimeoutRef = useRef(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const [allMoviesDisplayCount, setAllMoviesDisplayCount] = useState(10); // Show 10 initially (1 page)

  // Generate image using OpenAI DALL-E API as fallback
  const generateImageFromOpenAI = async (movieTitle) => {
    if (!OPENAI_API_KEY) {
      console.warn("OpenAI API key not found. Skipping image generation.");
      return null;
    }

    try {
      const response = await fetch(
        "https://api.openai.com/v1/images/generations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "dall-e-3",
            prompt: `Movie poster for "${movieTitle}", cinematic, professional, high quality, 16:9 aspect ratio`,
            n: 1,
            size: "1024x1024",
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data?.[0]?.url || null;
    } catch (err) {
      console.error("Error generating image from OpenAI:", err);
      return null;
    }
  };

  // Helper function to convert cmlhz.com video URLs to use proxy (to avoid CORS)
  const getProxiedVideoUrl = (url) => {
    if (!url) return url;

    // If URL contains video-proxy or vercel, convert to /video proxy
    if (url.includes("/api/video-proxy") || url.includes("vercel.app")) {
      // Extract the actual video path from video-proxy URL
      const videoPathMatch = url.match(/\/api\/video-proxy(\/.+?)(?:\?|$)/);
      if (videoPathMatch) {
        return `/video${videoPathMatch[1]}`;
      }
      // Fallback: try to extract from vercel URL
      const vercelMatch = url.match(/\/movies-xxx\/.+\.mp4/);
      if (vercelMatch) {
        return `/video${vercelMatch[0]}`;
      }
    }

    // Handle both absolute and relative URLs
    let fullUrl = url;
    if (!url.startsWith("http") && !url.startsWith("/")) {
      // Relative URL, make it absolute
      fullUrl = `https://cmlhz.com${url.startsWith("/") ? url : `/${url}`}`;
    }

    // If URL is from cmlhz.com, convert it to use local proxy
    if (fullUrl.includes("cmlhz.com/movies-xxx")) {
      try {
        const urlObj = new URL(fullUrl);
        const proxyUrl = `/video${urlObj.pathname}${urlObj.search}`;
        return proxyUrl;
      } catch (e) {
        // Fallback: try to extract path manually
        const match = fullUrl.match(/cmlhz\.com(\/.*)/);
        if (match) {
          const proxyUrl = `/video${match[1]}`;
          return proxyUrl;
        }
        return url; // Return original if can't convert
      }
    }

    // If URL contains movies-xxx path but no domain, assume it needs /video prefix
    if (
      url.includes("movies-xxx") &&
      !url.startsWith("/video") &&
      !url.startsWith("http")
    ) {
      return `/video${url.startsWith("/") ? url : `/${url}`}`;
    }

    return url;
  };

  const fetchMovies = async (
    page = 1,
    category = selectedCategory,
    searchQueryParam = null
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch from the website
      const baseUrl = "https://111.90.159.132";
      let apiUrl;

      // If search query is provided, use search API
      if (searchQueryParam && searchQueryParam.trim() !== "") {
        // Use website's search format: /?s={query}
        const encodedQuery = encodeURIComponent(searchQueryParam.trim());
        apiUrl = `${baseUrl}/?s=${encodedQuery}`;
        // Search doesn't support pagination, so we'll fetch all results
      } else if (category === "all" || !category) {
        // Fetch all movies from homepage
        apiUrl = page === 1 ? `${baseUrl}/` : `${baseUrl}/page/${page}/`;
      } else {
        // Fetch movies from specific category
        const categoryObj = MOVIE_CATEGORIES.find((cat) => cat.id === category);
        const categorySlug = categoryObj?.slug || category;
        apiUrl =
          page === 1
            ? `${baseUrl}/${categorySlug}/`
            : `${baseUrl}/${categorySlug}/page/${page}/`;
      }

      // Console log API URL (show localhost instead of actual API)
      const displayUrl = apiUrl.replace(
        "https://111.90.159.132",
        "http://localhost:5173/api"
      );
      console.log("🎬 ===== MOVIE DATA API CALL =====");
      console.log("📡 API URL:", displayUrl);
      console.log("📄 Page:", page);
      console.log("🏷️ Category:", category || "all");
      console.log("🔍 Search Query:", searchQueryParam || "none");

      let response;
      // Always use proxy in dev mode to hide actual API URLs from network tab
      if (import.meta.env.DEV) {
        // Convert API URL to use proxy
        const proxyUrl = apiUrl.replace("https://111.90.159.132", "/api");
        response = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            Accept: "application/json, text/html, */*",
          },
        });
      } else {
        // Production: try direct fetch first
        try {
          response = await fetch(apiUrl, {
            method: "GET",
            mode: "cors",
            headers: {
              Accept: "application/json, text/html, */*",
            },
          });
        } catch (corsError) {
          // CORS error, trying with proxy
          const proxyUrl = apiUrl.replace("https://111.90.159.132", "/api");
          response = await fetch(proxyUrl, {
            method: "GET",
            headers: {
              Accept: "application/json, text/html, */*",
            },
          });
        }
      }

      if (!response.ok) {
        // Try to get more details about the error
        let errorText = "";
        try {
          errorText = await response.text();
          console.error("Error response:", errorText.substring(0, 500));
        } catch (e) {
          console.error("Could not read error response");
        }
        throw new Error(
          `HTTP error! status: ${response.status} - ${response.statusText}`
        );
      }

      const html = await response.text();
      console.log("HTML received, length:", html.length);

      // Parse HTML to extract movie data
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract total pages from pagination links
      let maxPage = 1;
      const paginationLinks = doc.querySelectorAll(
        "a[href*='/page/'], .pagination a, .page-numbers a, nav a[href*='page']"
      );
      paginationLinks.forEach((link) => {
        const href = link.getAttribute("href") || "";
        const pageMatch = href.match(/\/page\/(\d+)\//);
        if (pageMatch) {
          const pageNum = parseInt(pageMatch[1]);
          if (pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
        // Also check text content for page numbers
        const text = link.textContent.trim();
        const textPageMatch = text.match(/^(\d+)$/);
        if (textPageMatch) {
          const pageNum = parseInt(textPageMatch[1]);
          if (pageNum > maxPage) {
            maxPage = pageNum;
          }
        }
      });

      // If no pagination found but we have movies, estimate pages (assume ~10 movies per page for categories)
      if (maxPage === 1) {
        const movieItems = doc.querySelectorAll(
          "article.movie-item, .movie-item, article, .item-movie, [class*='movie'], [class*='item']"
        );
        if (movieItems.length >= 10) {
          // If we got a full page (10+ movies), there might be more pages
          // Estimate based on typical website structure (usually many pages)
          maxPage = 50; // Conservative estimate, will be updated as user navigates
        }
      }

      // Only set total pages if not searching (search doesn't have pagination)
      if (!searchQueryParam || searchQueryParam.trim() === "") {
        setTotalPages(maxPage);
        console.log("Total pages detected:", maxPage);
      } else {
        setTotalPages(1); // Search results are single page
      }

      // Find all movie items - adjust selector based on actual HTML structure
      const movieItems = doc.querySelectorAll(
        "article.movie-item, .movie-item, article, .item-movie, [class*='movie'], [class*='item']"
      );

      if (movieItems.length === 0) {
        // Try alternative selectors
        const altItems = doc.querySelectorAll(
          "a[href*='movie'], a[href*='film']"
        );
      }

      const newMovies = [];
      const movieMap = new Map(); // To deduplicate movies with multiple audio versions

      movieItems.forEach((item, index) => {
        try {
          // Try to find image
          const img =
            item.querySelector("img") ||
            item.querySelector("[style*='background-image']");
          let imageUrl = null;

          if (img) {
            imageUrl =
              img.getAttribute("src") ||
              img.getAttribute("data-src") ||
              img.getAttribute("data-lazy-src");
            if (!imageUrl && img.style.backgroundImage) {
              const bgMatch = img.style.backgroundImage.match(
                /url\(['"]?(.*?)['"]?\)/
              );
              if (bgMatch) imageUrl = bgMatch[1];
            }
            // Make image URL absolute if relative
            if (imageUrl && !imageUrl.startsWith("http")) {
              if (imageUrl.startsWith("//")) {
                imageUrl = `https:${imageUrl}`;
              } else if (imageUrl.startsWith("/")) {
                imageUrl = `https://111.90.159.132${imageUrl}`;
              } else {
                imageUrl = `https://111.90.159.132/${imageUrl}`;
              }
            }
          }

          // Try to find title
          const titleEl =
            item.querySelector(
              "h2, h3, .title, .movie-title, [class*='title']"
            ) || item.querySelector("a");
          let title = titleEl
            ? titleEl.textContent.trim()
            : `Movie ${index + 1}`;

          // Try to find link
          const linkEl = item.querySelector("a");
          let url = linkEl
            ? linkEl.getAttribute("href")
            : item.getAttribute("href") || "#";

          // Make URL absolute if relative
          if (url && !url.startsWith("http")) {
            if (url.startsWith("//")) {
              url = `https:${url}`;
            } else if (url.startsWith("/")) {
              url = `https://111.90.159.132${url}`;
            } else {
              url = `https://111.90.159.132/${url}`;
            }
          }

          // Try to find rating
          const ratingEl = item.querySelector(
            ".rating, .imdb, [class*='rating'], [class*='score']"
          );
          const rating = ratingEl ? ratingEl.textContent.trim() : null;

          // Try to find duration
          const durationEl = item.querySelector(
            ".duration, .time, [class*='duration'], [class*='time']"
          );
          const duration = durationEl ? durationEl.textContent.trim() : null;

          // Try to find genres
          const genreEls = item.querySelectorAll(
            ".genre, .genres, [class*='genre'] a, [class*='category']"
          );
          const genres = Array.from(genreEls).map((el) =>
            el.textContent.trim()
          );

          // Extract year from title if present
          const yearMatch = title.match(/\b(19|20)\d{2}\b/);
          const year = yearMatch ? yearMatch[0] : null;

          // Create slug from title
          const createSlug = (text) => {
            return text
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "");
          };

          const movieSlug = createSlug(title.replace(/\s*\([^)]*\)\s*/g, ""));

          // Clean slug (Title-Case-With-Hyphens format)
          const cleanSlug = movieSlug
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join("-");

          // Detect audio language from title/URL
          const isHindi =
            title.toLowerCase().includes("hindi") ||
            url.toLowerCase().includes("hindi") ||
            cleanSlug.toLowerCase().includes("hindi");
          const isEnglish =
            title.toLowerCase().includes("english") ||
            url.toLowerCase().includes("english") ||
            cleanSlug.toLowerCase().includes("english");

          // Create base movie key (without language suffix)
          const baseTitle = title
            .replace(/\s*\([^)]*\)\s*/g, "")
            .replace(/\s*(Hindi|English|HINDI|ENGLISH)\s*/gi, "")
            .trim();
          const baseKey = `${baseTitle}-${year || "unknown"}`.toLowerCase();

          // Validate movie data - filter out invalid entries
          const isValidUrl =
            url && url !== "#" && url !== "" && url.startsWith("http");
          const isValidTitle =
            baseTitle &&
            baseTitle !== "Movie" &&
            baseTitle.length > 2 &&
            !/^\d{4}$/.test(baseTitle.trim()); // Reject titles that are just a year (e.g., "2025")
          const hasValidData = isValidUrl && isValidTitle;

          if (hasValidData) {
            const movieData = {
              id: `movie-${index}-${Date.now()}`,
              name: baseTitle || title,
              imageUrl: imageUrl,
              url: url,
              rating: rating,
              duration: duration,
              genres: genres.length > 0 ? genres : [],
              year: year,
              movieSlug: movieSlug,
              cleanSlug: cleanSlug,
              videoBaseUrl: "https://cmlhz.com/movies-xxx/jun-24",
              possiblePaths: [
                `${cleanSlug}${year ? `-${year}` : ""}.mp4`,
                `${cleanSlug}.mp4`,
                `${movieSlug}${year ? `-${year}` : ""}.mp4`,
                `${movieSlug}.mp4`,
              ],
              audioTracks: [], // Will be populated during deduplication
            };

            // Check if movie already exists (for deduplication)
            if (movieMap.has(baseKey)) {
              const existingMovie = movieMap.get(baseKey);
              // Add audio track info if not already present
              if (isHindi) {
                const hasHindi = existingMovie.audioTracks.some(
                  (t) => t.language === "Hindi"
                );
                if (!hasHindi) {
                  existingMovie.audioTracks.push({
                    language: "Hindi",
                    url: url,
                    label: "Hindi",
                  });
                }
              } else if (isEnglish) {
                const hasEnglish = existingMovie.audioTracks.some(
                  (t) => t.language === "English"
                );
                if (!hasEnglish) {
                  existingMovie.audioTracks.push({
                    language: "English",
                    url: url,
                    label: "English",
                  });
                }
              } else {
                // If no language detected and no tracks exist, add default
                if (existingMovie.audioTracks.length === 0) {
                  existingMovie.audioTracks.push({
                    language: "English",
                    url: url,
                    label: "English",
                  });
                }
              }
              // Use better image if available
              if (!existingMovie.imageUrl && imageUrl) {
                existingMovie.imageUrl = imageUrl;
              }
            } else {
              // Initialize audio tracks
              if (isHindi) {
                movieData.audioTracks.push({
                  language: "Hindi",
                  url: url,
                  label: "Hindi",
                });
              } else if (isEnglish) {
                movieData.audioTracks.push({
                  language: "English",
                  url: url,
                  label: "English",
                });
              } else {
                // Default to English if no language detected
                movieData.audioTracks.push({
                  language: "English",
                  url: url,
                  label: "English",
                });
              }
              movieMap.set(baseKey, movieData);
            }
          }
        } catch (e) {
          console.error("Error parsing movie item:", e);
        }
      });

      // Convert map to array (deduplicated movies)
      const deduplicatedMovies = Array.from(movieMap.values());

      // Final validation: Filter out any movies that still don't have valid URLs or titles
      const validMovies = deduplicatedMovies.filter((movie) => {
        const hasValidUrl =
          movie.url &&
          movie.url !== "#" &&
          movie.url !== "" &&
          movie.url.startsWith("http");
        const hasValidName =
          movie.name &&
          movie.name.length > 2 &&
          !/^\d{4}$/.test(movie.name.trim()); // Reject names that are just a year
        return hasValidUrl && hasValidName;
      });

      newMovies.push(...validMovies);

      console.log(
        "Parsed movies:",
        newMovies.length,
        "(deduplicated and validated from",
        movieItems.length,
        "items)"
      );

      // Sort movies: Latest first (by year descending, then by index)
      const sortedMovies = newMovies.sort((a, b) => {
        // If both have years, sort by year descending (newest first)
        if (a.year && b.year) {
          return parseInt(b.year) - parseInt(a.year);
        }
        // If only one has year, prioritize it
        if (a.year && !b.year) return -1;
        if (!a.year && b.year) return 1;
        // Otherwise maintain original order (latest fetched = latest)
        return 0;
      });

      // Generate images for movies without images using OpenAI (async, don't block)
      sortedMovies.forEach((movie) => {
        if (
          !movie.imageUrl ||
          movie.imageUrl.includes("placeholder") ||
          movie.imageUrl.includes("No Image")
        ) {
          // Generate image asynchronously without blocking
          generateImageFromOpenAI(movie.name)
            .then((generatedImage) => {
              if (generatedImage) {
                movie.imageUrl = generatedImage;
                // Force re-render by updating state
                setMovies((prevMovies) => {
                  const updated = prevMovies.map((m) =>
                    m.url === movie.url ? { ...m, imageUrl: generatedImage } : m
                  );
                  return updated;
                });
              }
            })
            .catch(() => {
              // Silently fail, will use gradient placeholder
            });
        }
      });

      if (page === 1) {
        setMovies(sortedMovies);
        // Set first (latest) movie as featured
        if (sortedMovies.length > 0) {
          setFeaturedMovie(sortedMovies[0]);
        }
      } else {
        // For pagination, append new movies to existing ones
        setMovies((prevMovies) => {
          // Merge and deduplicate by URL
          const existingUrls = new Set(prevMovies.map((m) => m.url));
          const newUniqueMovies = sortedMovies.filter(
            (m) => !existingUrls.has(m.url)
          );
          return [...prevMovies, ...newUniqueMovies];
        });
      }

      // Check if there are more pages
      setHasMore(page < totalPages && sortedMovies.length > 0);
      setLoading(false);
      setIsLoadingMore(false);

      // Auto-load next page if we got 10+ movies and there are more pages
      // Only for non-search, non-loading states
      // Note: Use newMovies.length instead of sortedMovies (which is computed later)
      if (
        newMovies.length >= 10 &&
        page < totalPages &&
        !searchQueryParam &&
        !loading &&
        category === "all"
      ) {
        // Small delay to ensure UI updates, then auto-load next page
        setTimeout(() => {
          if (!isLoadingMore && hasMore) {
            setIsLoadingMore(true);
            const nextPage = page + 1;
            setCurrentPage(nextPage);
            fetchMovies(nextPage, category, null);
          }
        }, 800);
      }
    } catch (err) {
      console.error("Error fetching movies:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Filter out empty/invalid items - stricter filtering (memoized for performance)
  // MUST be defined before any useEffect that uses it
  const validMovies = useMemo(() => {
    // Get all category names to filter them out
    const categoryNames = MOVIE_CATEGORIES.map((cat) => cat.name.toLowerCase());

    return movies.filter((movie) => {
      // Filter out empty items
      if (!movie || !movie.name || movie.name.trim() === "") return false;
      if (!movie.url || movie.url === "" || movie.url === "#") return false;

      const movieNameLower = movie.name.trim().toLowerCase();

      // Filter out category names (Drama, Action, Comedy, etc.)
      if (categoryNames.includes(movieNameLower)) return false;

      // Filter out items that are just years (e.g., "2025")
      if (/^\d{4}$/.test(movie.name.trim())) return false;

      // Filter out items with invalid titles
      if (movie.name.length < 2) return false;

      // Filter out items with generic names
      if (
        /^(movie|film|video|item|genres?|category|categories|latest movies|year|all movies)$/i.test(
          movie.name.trim()
        )
      )
        return false;

      // Filter out items without proper image or URL
      if (!movie.imageUrl && !movie.url.includes("http")) return false;

      // Filter out items with empty imageUrl that are placeholders
      if (
        movie.imageUrl &&
        (movie.imageUrl.includes("placeholder") ||
          movie.imageUrl.includes("No Image"))
      ) {
        // Allow if it's a valid URL structure
        if (!movie.url.includes("http")) return false;
      }

      return true;
    });
  }, [movies]);

  // Get Continue Watching movies (watched movies with position > 0)
  const continueWatchingMovies = useMemo(() => {
    return Object.values(watchedMovies)
      .filter((watched) => watched.position > 0 && watched.duration > 0)
      .sort((a, b) => b.timestamp - a.timestamp) // Most recent first
      .slice(0, 20) // Limit to 20
      .map((watched) => ({
        ...watched.movie,
        resumePosition: watched.position,
        resumeDuration: watched.duration,
        progressPercent: (watched.position / watched.duration) * 100,
      }));
  }, [watchedMovies]);

  // Sort movies: Latest first (by year descending) - memoized for performance
  // MUST be defined before any useEffect that uses it
  const sortedMovies = useMemo(() => {
    return [...validMovies].sort((a, b) => {
      if (a.year && b.year) {
        return parseInt(b.year) - parseInt(a.year);
      }
      if (a.year && !b.year) return -1;
      if (!a.year && b.year) return 1;
      return 0;
    });
  }, [validMovies]);

  // Initial load
  useEffect(() => {
    fetchMovies(1, selectedCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update featured movie to latest when movies change
  useEffect(() => {
    if (movies.length > 0 && !selectedMovie) {
      const latestMovie = [...movies].sort((a, b) => {
        if (a.year && b.year) {
          return parseInt(b.year) - parseInt(a.year);
        }
        if (a.year && !b.year) return -1;
        if (!a.year && b.year) return 1;
        return 0;
      })[0];

      if (
        !featuredMovie ||
        (latestMovie.year &&
          featuredMovie.year &&
          parseInt(latestMovie.year) > parseInt(featuredMovie.year)) ||
        (!featuredMovie.year && latestMovie.year)
      ) {
        setFeaturedMovie(latestMovie);
      }
    }
  }, [movies, selectedMovie, featuredMovie]);

  // Set playback speed when video loads
  useEffect(() => {
    if (videoRef.current && selectedMovie) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [selectedMovie, playbackSpeed]);

  // Netflix intro animation - Show only once for 10 seconds when video starts loading
  useEffect(() => {
    if (!selectedMovie) {
      setShowNetflixIntro(false);
      return;
    }

    // Show intro immediately when movie is selected
    setShowNetflixIntro(true);

    // Clear any existing timeout
    if (netflixIntroTimeoutRef.current) {
      clearTimeout(netflixIntroTimeoutRef.current);
    }

    // Show intro for exactly 10 seconds, then hide and play video
    netflixIntroTimeoutRef.current = setTimeout(() => {
      setShowNetflixIntro(false);
      const video = videoRef.current;
      if (video) {
        // Resume from last position if available
        if (lastPlayedPosition > 0) {
          video.currentTime = lastPlayedPosition;
        }
        // Play video after intro ends
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Video started playing successfully
              setIsPlaying(true);
            })
            .catch((err) => {
              // Auto-play was prevented - user needs to click play
              console.log("Auto-play prevented:", err);
              setIsPlaying(false);
            });
        }
      }
    }, 10000); // 10 second intro animation

    return () => {
      // Cleanup: clear timeout when movie changes or component unmounts
      if (netflixIntroTimeoutRef.current) {
        clearTimeout(netflixIntroTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMovie?.url]); // Only trigger when movie URL changes (new movie selected), NOT lastPlayedPosition

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      // Save position every 5 seconds
      if (Math.floor(video.currentTime) % 5 === 0) {
        setLastPlayedPosition(video.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      video.playbackRate = playbackSpeed;
      // Don't resume position here - let intro animation handle it
      // Intro will set position after 10 seconds
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => {
      setIsPlaying(false);
      // Save position when paused
      if (video.currentTime > 0 && selectedMovie) {
        const newPosition = video.currentTime;
        setLastPlayedPosition(newPosition);
        // Save to watched movies
        setWatchedMovies((prev) => {
          const updated = {
            ...prev,
            [selectedMovie.url]: {
              movie: selectedMovie,
              position: newPosition,
              duration: video.duration,
              timestamp: Date.now(),
            },
          };
          localStorage.setItem("watchedMovies", JSON.stringify(updated));
          return updated;
        });
      }
    };
    const handleVolumeChange = () => setVolume(video.volume);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("volumechange", handleVolumeChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("volumechange", handleVolumeChange);
    };
  }, [selectedMovie, playbackSpeed, lastPlayedPosition, showNetflixIntro]);

  // Auto-hide controls
  useEffect(() => {
    if (isPlaying && !isHovering) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    } else {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, isHovering]);

  // Close audio menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      const audioMenus = document.querySelectorAll(".netflix-audio-menu");
      audioMenus.forEach((menu) => {
        if (
          !menu.contains(e.target) &&
          !e.target.closest(".netflix-audio-btn")
        ) {
          menu.classList.remove("show");
        }
      });
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Infinite scroll handler - auto-load when near bottom
  useEffect(() => {
    const handleScroll = () => {
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Debounce scroll check
      scrollTimeoutRef.current = setTimeout(() => {
        // Check if user is near bottom of page
        const scrollTop =
          window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        // Auto-load when we have 10+ movies loaded and user scrolls down
        // Also trigger if we're near bottom (300px from bottom)
        const shouldLoadMore =
          (movies.length >= 10 && currentPage < totalPages) ||
          (scrollTop + windowHeight >= documentHeight - 300 &&
            currentPage < totalPages);

        // For "All Movies" section, load more movies when scrolling (10 per page)
        if (
          selectedCategory === "all" &&
          allMoviesDisplayCount < sortedMovies.length &&
          !isLoadingMore
        ) {
          if (scrollTop + windowHeight >= documentHeight - 300) {
            // Load next 10 movies
            const nextCount = allMoviesDisplayCount + 10;
            setAllMoviesDisplayCount(nextCount);

            // If we need more movies from API, fetch next page
            if (
              nextCount >= sortedMovies.length &&
              hasMore &&
              currentPage < totalPages
            ) {
              setIsLoadingMore(true);
              const nextPage = currentPage + 1;
              setCurrentPage(nextPage);
              fetchMovies(nextPage, "all").catch(() => {
                setIsLoadingMore(false);
              });
            }
          }
        }

        if (
          shouldLoadMore &&
          !loading &&
          !isLoadingMore &&
          hasMore &&
          !isSearching
        ) {
          setIsLoadingMore(true);
          const nextPage = currentPage + 1;
          setCurrentPage(nextPage);
          fetchMovies(nextPage, selectedCategory).catch(() => {
            setIsLoadingMore(false);
          });
        }
      }, 150);
    };

    window.addEventListener("scroll", handleScroll);
    // Also check on mount/resize
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading,
    isLoadingMore,
    hasMore,
    isSearching,
    currentPage,
    totalPages,
    selectedCategory,
    movies.length, // Re-check when movies change
    sortedMovies.length, // Re-check when sorted movies change
    allMoviesDisplayCount, // Re-check when display count changes
  ]);

  // Format time helper
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Play/Pause handler
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setShowNetflixIntro(false); // Hide intro when user manually plays
          })
          .catch((err) => {
            console.error("Error playing video:", err);
            alert("Unable to play video. Please try again.");
          });
      }
    }
  };

  // Seek handler
  const handleSeek = (e) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = percent * duration;
    }
  };

  // Volume handler
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement && videoContainerRef.current) {
      videoContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // Forward 15 minutes handler
  const handleForward15Min = () => {
    if (videoRef.current) {
      const newTime = Math.min(
        videoRef.current.currentTime + 15 * 60,
        duration
      );
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Backward 10 seconds handler (Netflix style)
  const handleBackward10Sec = () => {
    if (videoRef.current) {
      const newTime = Math.max(videoRef.current.currentTime - 10, 0);
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Close speed menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        speedMenuRef.current &&
        !speedMenuRef.current.contains(event.target)
      ) {
        setShowSpeedMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle category change
  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    setMovies([]); // Clear existing movies when category changes
    setFeaturedMovie(null); // Reset featured movie
    setTotalPages(1);
    setAllMoviesDisplayCount(10); // Reset to 10 movies when category changes
    fetchMovies(1, categoryId);
  };

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top when page changes
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (isSearching) {
        fetchMovies(newPage, selectedCategory, searchQuery);
      } else {
        fetchMovies(newPage, selectedCategory);
      }
    }
  };

  // Handle search input change with debouncing
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If query is empty, reset to normal browsing
    if (query.trim() === "") {
      setIsSearching(false);
      setCurrentPage(1);
      setMovies([]);
      fetchMovies(1, selectedCategory);
      return;
    }

    // Don't set searching state immediately - wait for debounce
    // Only show loader when we actually start searching (after debounce)

    // Debounce search: wait 500ms after user stops typing
    // Only search if query has at least 2 characters
    searchTimeoutRef.current = setTimeout(() => {
      if (query.trim().length >= 2) {
        // Now set searching state and start fetch
        setIsSearching(true);
        setCurrentPage(1);
        setMovies([]);
        fetchMovies(1, selectedCategory, query);
      } else {
        // Query too short, don't search yet
        setIsSearching(false);
      }
    }, 500); // Increased to 500ms for better UX
  };

  // Handle search on Enter key
  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      // Clear timeout and search immediately
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      const query = e.target.value.trim();
      if (query === "" || query.length < 2) {
        setIsSearching(false);
        setCurrentPage(1);
        setMovies([]);
        fetchMovies(1, selectedCategory);
      } else {
        setIsSearching(true);
        setCurrentPage(1);
        setMovies([]);
        fetchMovies(1, selectedCategory, query);
      }
    }
  };

  // Handle audio track change
  const handleAudioTrackChange = (track) => {
    setSelectedAudioTrack(track);
    if (videoRef.current) {
      videoRef.current.load(); // Reload video with new source
    }
  };

  // Handle playback speed change
  const handleSpeedChange = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const handleMovieClick = async (movie) => {
    console.log("🎬 ===== MOVIE CLICKED =====");
    console.log("🎥 Movie Name:", movie.name);
    // Show localhost URL instead of actual API URL
    const displayMovieUrl =
      movie.url && movie.url.includes("111.90.159.132")
        ? movie.url.replace(
            "https://111.90.159.132",
            "http://localhost:5173/api"
          )
        : movie.url;
    console.log("🔗 Movie URL:", displayMovieUrl);
    console.log("📸 Movie Image:", movie.imageUrl);

    setLoading(true);
    setSelectedMovie(null);

    try {
      // Fetch the individual movie page to get the actual video URL
      let moviePageResponse;
      const moviePageUrl = movie.url;
      // Show localhost URL instead of actual API URL
      const displayMovieUrl = moviePageUrl.replace(
        "https://111.90.159.132",
        "http://localhost:5173/api"
      );
      console.log("📡 Fetching Movie Page:", displayMovieUrl);

      // Always use proxy in dev mode to hide actual API URLs from network tab
      if (import.meta.env.DEV) {
        const proxyUrl = moviePageUrl.replace("https://111.90.159.132", "/api");
        // Show localhost URL in console
        const displayProxyUrl = proxyUrl.startsWith("/")
          ? `http://localhost:5173${proxyUrl}`
          : proxyUrl;
        console.log("🔄 Using Proxy URL:", displayProxyUrl);
        moviePageResponse = await fetch(proxyUrl, {
          method: "GET",
          headers: {
            Accept: "application/json, text/html, */*",
          },
        });
      } else {
        // Production: try direct fetch first
        try {
          moviePageResponse = await fetch(moviePageUrl, {
            method: "GET",
            mode: "cors",
          });
        } catch (corsError) {
          console.log("⚠️ CORS error on movie page, trying proxy");
          const proxyUrl = moviePageUrl.replace(
            "https://111.90.159.132",
            "/api"
          );
          moviePageResponse = await fetch(proxyUrl, {
            method: "GET",
            headers: {
              Accept: "application/json, text/html, */*",
            },
          });
        }
      }

      if (!moviePageResponse.ok) {
        throw new Error(
          `Failed to fetch movie page: ${moviePageResponse.status}`
        );
      }

      const movieHtml = await moviePageResponse.text();
      const movieParser = new DOMParser();
      const movieDoc = movieParser.parseFromString(movieHtml, "text/html");

      let videoUrl = null;
      let videoType = null;
      const subtitleUrls = [];

      // Find all video elements, source tags, and iframes
      const videoElements = movieDoc.querySelectorAll("video");
      const videoTags = movieDoc.querySelectorAll("source");
      const iframes = movieDoc.querySelectorAll("iframe");

      // Check Video.js player FIRST (most common on this website)
      if (!videoUrl) {
        const vjsVideo = movieDoc.querySelector("#video_html5_api");
        if (vjsVideo) {
          let vjsSrc = vjsVideo.getAttribute("src");
          if (!vjsSrc) {
            const vjsSource = vjsVideo.querySelector("source");
            if (vjsSource) {
              vjsSrc = vjsSource.getAttribute("src");
            }
          }
          if (
            vjsSrc &&
            (vjsSrc.includes("cmlhz.com/movies-xxx") || vjsSrc.includes(".mp4"))
          ) {
            videoUrl = vjsSrc.startsWith("http") ? vjsSrc : `https:${vjsSrc}`;
            videoType = "mp4";
            console.log(
              `✅ Found video URL from Video.js player (#video_html5_api): ${videoUrl}`
            );
          }
        }
      }

      // Check video elements directly
      if (!videoUrl) {
        for (const video of videoElements) {
          let src = video.getAttribute("src");
          if (!src) {
            const sourceEl = video.querySelector("source");
            if (sourceEl) {
              src = sourceEl.getAttribute("src");
            }
          }
          if (!src) {
            src = video.getAttribute("data-src");
          }
          if (!src) {
            src = video.getAttribute("data-video-src");
          }

          if (
            src &&
            (src.includes("cmlhz.com/movies-xxx") || src.includes(".mp4"))
          ) {
            videoUrl = src.startsWith("http") ? src : `https:${src}`;
            videoType = "mp4";
            break;
          }
        }
      }

      // Check video source tags
      if (!videoUrl) {
        for (const source of videoTags) {
          let src = source.getAttribute("src");
          if (!src) {
            src = source.getAttribute("data-src");
          }
          if (
            src &&
            (src.includes("cmlhz.com/movies-xxx") || src.includes(".mp4"))
          ) {
            videoUrl = src.startsWith("http") ? src : `https:${src}`;
            videoType = "mp4";
            break;
          }
        }
      }

      // Search in script tags for video URLs
      if (!videoUrl) {
        const scripts = movieDoc.querySelectorAll("script");
        for (const script of scripts) {
          const scriptContent = script.textContent || script.innerHTML;
          if (
            scriptContent.includes(".mp4") ||
            scriptContent.includes(".vtt")
          ) {
            // Try multiple patterns to find video URLs
            const patterns = [
              /https?:\/\/[^\s"']+\.mp4/gi,
              /["']([^"']+\.mp4)["']/gi,
              /src["']?\s*[:=]\s*["']([^"']+\.mp4)["']/gi,
              /file["']?\s*[:=]\s*["']([^"']+\.mp4)["']/gi,
              /source["']?\s*[:=]\s*["']([^"']+\.mp4)["']/gi,
              /video["']?\s*[:=]\s*["']([^"']+\.mp4)["']/gi,
              /url["']?\s*[:=]\s*["']([^"']+\.mp4)["']/gi,
            ];

            for (const pattern of patterns) {
              const matches = scriptContent.match(pattern);
              if (matches && matches.length > 0) {
                for (const match of matches) {
                  let url = match
                    .replace(/["']/g, "")
                    .replace(/^[^:]*:\s*/, "");
                  if (
                    url.includes("cmlhz.com/movies-xxx") &&
                    url.includes(".mp4")
                  ) {
                    videoUrl = url.startsWith("http") ? url : `https:${url}`;
                    videoType = "mp4";
                    break;
                  }
                }
                if (videoUrl) break;
              }
            }

            // Also search for .vtt files (subtitles)
            const vttPatterns = [
              /https?:\/\/[^\s"']+\.vtt/gi,
              /["']([^"']+\.vtt)["']/gi,
            ];
            for (const pattern of vttPatterns) {
              const matches = scriptContent.match(pattern);
              if (matches && matches.length > 0) {
                for (const match of matches) {
                  let url = match
                    .replace(/["']/g, "")
                    .replace(/^[^:]*:\s*/, "");
                  if (
                    url.includes("cmlhz.com/movies-xxx") &&
                    url.includes(".vtt")
                  ) {
                    if (!subtitleUrls.includes(url)) {
                      subtitleUrls.push(url);
                    }
                    // Try to find corresponding .mp4
                    const mp4Url = url
                      .replace(/\.vtt$/, ".mp4")
                      .replace(/-Hindi\.mp4$/, ".mp4")
                      .replace(/-English\.mp4$/, ".mp4");
                    if (!videoUrl) {
                      try {
                        const testResponse = await fetch(mp4Url, {
                          method: "GET",
                          headers: { Range: "bytes=0-1" },
                        });
                        if (testResponse.ok || testResponse.status === 206) {
                          videoUrl = mp4Url;
                          videoType = "mp4";
                          break;
                        }
                      } catch (e) {
                        // Try lowercase
                        const lowerMp4Url = mp4Url.toLowerCase();
                        try {
                          const lowerResponse = await fetch(lowerMp4Url, {
                            method: "GET",
                            headers: { Range: "bytes=0-1" },
                          });
                          if (
                            lowerResponse.ok ||
                            lowerResponse.status === 206
                          ) {
                            videoUrl = lowerMp4Url;
                            videoType = "mp4";
                            console.log(
                              `✅ Found mp4 (lowercase): ${videoUrl}`
                            );
                            break;
                          }
                        } catch (e2) {
                          continue;
                        }
                        continue;
                      }
                    }
                  }
                }
              }
            }
            if (videoUrl) break;
          }
        }
      }

      // Check data attributes on all elements
      if (!videoUrl) {
        const allElements = movieDoc.querySelectorAll("*");
        for (const el of allElements) {
          const dataVideo =
            el.getAttribute("data-video") ||
            el.getAttribute("data-src") ||
            el.getAttribute("data-url");
          if (
            dataVideo &&
            (dataVideo.includes("cmlhz.com/movies-xxx") ||
              dataVideo.includes(".mp4"))
          ) {
            videoUrl = dataVideo.startsWith("http")
              ? dataVideo
              : `https:${dataVideo}`;
            videoType = "mp4";
            break;
          }
        }
      }

      // If still no video found, try using constructed URLs
      if (!videoUrl && movie.possiblePaths && movie.possiblePaths.length > 0) {
        // No verified URL found, trying all constructed URLs
        for (const path of movie.possiblePaths) {
          const constructedUrl = `${movie.videoBaseUrl}/${path}`;
          videoUrl = constructedUrl;
          videoType = "mp4";
          break;
        }
      }

      // If still no video found, show movie page link
      if (!videoUrl) {
        videoUrl = movie.url;
        videoType = "link";
      }

      // Convert video URL and subtitle URLs to use proxy (to avoid CORS)
      const proxiedVideoUrl = getProxiedVideoUrl(videoUrl);
      const proxiedSubtitleUrls = subtitleUrls.map((url) =>
        getProxiedVideoUrl(url)
      );

      // Console log video URL extraction (hide actual API URLs)
      console.log("🎬 ===== VIDEO URL EXTRACTION =====");
      // Show localhost URLs instead of actual API URLs
      const displayVideoUrl =
        videoUrl && videoUrl.includes("cmlhz.com")
          ? videoUrl.replace("https://cmlhz.com", "http://localhost:5173/video")
          : videoUrl;
      const displayProxiedVideoUrl =
        proxiedVideoUrl && proxiedVideoUrl.startsWith("/video")
          ? `http://localhost:5173${proxiedVideoUrl}`
          : proxiedVideoUrl;
      const displaySubtitleUrls = subtitleUrls.map((url) =>
        url && url.includes("cmlhz.com")
          ? url.replace("https://cmlhz.com", "http://localhost:5173/video")
          : url
      );
      const displayProxiedSubtitleUrls = proxiedSubtitleUrls.map((url) =>
        url && url.startsWith("/video") ? `http://localhost:5173${url}` : url
      );
      console.log("🔍 Original Video URL:", displayVideoUrl);
      console.log("🔄 Proxied Video URL:", displayProxiedVideoUrl);
      console.log("📝 Video Type:", videoType);
      console.log("📋 Subtitle URLs:", displaySubtitleUrls);
      console.log("🔄 Proxied Subtitle URLs:", displayProxiedSubtitleUrls);

      // Prepare audio tracks (if movie has multiple audio versions)
      let audioTracks = [];
      if (movie.audioTracks && movie.audioTracks.length > 1) {
        // Multiple audio tracks detected - try to construct video URLs
        for (const track of movie.audioTracks) {
          // Try to construct video URL based on language
          const basePath = proxiedVideoUrl.replace(
            /\/video\/movies-xxx\/[^\/]+\//,
            "/video/movies-xxx/jun-24/"
          );
          const fileName = basePath.split("/").pop() || "";
          const baseFileName = fileName
            .replace(/\.mp4$/, "")
            .replace(/-Hindi$|-English$/i, "");

          let trackVideoUrl = proxiedVideoUrl;
          if (track.language === "Hindi") {
            // Try Hindi version
            const hindiVariants = [
              `${basePath.replace(fileName, "")}${baseFileName}-Hindi.mp4`,
              `${basePath.replace(fileName, "")}${baseFileName}-hindi.mp4`,
              `${basePath.replace(fileName, "")}${baseFileName}-Hindi-${
                movie.year || ""
              }.mp4`,
            ];
            // Use main video URL for now, will be improved
            trackVideoUrl = proxiedVideoUrl;
          } else if (track.language === "English") {
            // Try English version
            const englishVariants = [
              `${basePath.replace(fileName, "")}${baseFileName}-English.mp4`,
              `${basePath.replace(fileName, "")}${baseFileName}-english.mp4`,
              `${basePath.replace(fileName, "")}${baseFileName}-English-${
                movie.year || ""
              }.mp4`,
            ];
            trackVideoUrl = proxiedVideoUrl;
          }

          audioTracks.push({
            ...track,
            videoUrl: trackVideoUrl,
          });
        }
      } else {
        // Single audio track or no tracks - use main video URL
        audioTracks = [
          {
            language: movie.audioTracks?.[0]?.language || "English",
            label: movie.audioTracks?.[0]?.label || "Default",
            videoUrl: proxiedVideoUrl,
          },
        ];
      }

      const finalMovieData = {
        ...movie,
        videoUrl: proxiedVideoUrl,
        videoType: videoType,
        subtitleUrls: proxiedSubtitleUrls,
        audioTracks: audioTracks,
      };

      console.log("✅ ===== MOVIE DATA SET FOR PLAYER =====");
      console.log("🎥 Final Movie Data:", finalMovieData);
      // Show localhost URL instead of actual API URL
      const displayProxiedVideoUrlForPlayer =
        proxiedVideoUrl && proxiedVideoUrl.startsWith("/video")
          ? `http://localhost:5173${proxiedVideoUrl}`
          : proxiedVideoUrl;
      console.log("🎬 Video URL for Player:", displayProxiedVideoUrlForPlayer);
      console.log("🎵 Audio Tracks:", audioTracks);

      setSelectedMovie(finalMovieData);
      setSelectedAudioTrack(audioTracks[0]); // Set first track as default
      setLoading(false);
    } catch (err) {
      console.error("Error loading movie:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  // No local filtering - search is done server-side
  const filteredMovies = sortedMovies;

  const scrollRow = (direction, containerRef) => {
    if (containerRef.current) {
      const scrollAmount = 600;
      containerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  if (loading && movies.length === 0) {
    return (
      <div className="netflix-container">
        <div className="loading-screen">
          <div className="netflix-logo">NETFLIX</div>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error && movies.length === 0) {
    return (
      <div className="netflix-container">
        <div className="error-screen">
          <h1>NETFLIX</h1>
          <p>Error loading data: {error}</p>
          <button onClick={() => fetchMovies(1, selectedCategory)}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (selectedMovie) {
    // Convert video URL to use proxy to hide actual endpoint
    let rawVideoUrl = selectedAudioTrack?.videoUrl || selectedMovie.videoUrl;
    let currentVideoUrl = rawVideoUrl;

    // Detect environment: localhost/ngrok = dev, Vercel = production
    const isLocalDev =
      import.meta.env.DEV ||
      window.location.hostname === "localhost" ||
      window.location.hostname.includes("ngrok") ||
      window.location.hostname === "127.0.0.1";

    const isVercel = window.location.hostname.includes("vercel.app");

    if (rawVideoUrl) {
      // Extract video path from various URL formats
      let videoPath = null;

      // If URL contains video-proxy, extract the actual path
      if (rawVideoUrl.includes("/api/video-proxy")) {
        const videoPathMatch = rawVideoUrl.match(
          /\/api\/video-proxy(\/.+?)(?:\?|$)/
        );
        if (videoPathMatch) {
          videoPath = videoPathMatch[1];
        }
      }
      // If URL contains vercel.app, extract path
      else if (rawVideoUrl.includes("vercel.app")) {
        const vercelMatch = rawVideoUrl.match(/\/movies-xxx\/.+\.mp4/);
        if (vercelMatch) {
          videoPath = vercelMatch[0];
        }
      }
      // If URL starts with /video, extract the path
      else if (rawVideoUrl.startsWith("/video")) {
        videoPath = rawVideoUrl.replace("/video", "");
      }
      // If URL contains cmlhz.com, extract path
      else if (rawVideoUrl.includes("cmlhz.com")) {
        const urlMatch = rawVideoUrl.match(/cmlhz\.com(\/.+?)(?:\?|$)/);
        if (urlMatch) {
          videoPath = urlMatch[1];
        }
      }
      // If URL contains movies-xxx path, extract it
      else if (rawVideoUrl.includes("movies-xxx")) {
        const pathMatch = rawVideoUrl.match(/\/movies-xxx\/.+\.mp4/);
        if (pathMatch) {
          videoPath = pathMatch[0];
        } else {
          videoPath = rawVideoUrl.startsWith("/")
            ? rawVideoUrl
            : `/${rawVideoUrl}`;
        }
      }
      // Relative URL without http or /
      else if (
        !rawVideoUrl.startsWith("http") &&
        !rawVideoUrl.startsWith("/")
      ) {
        videoPath = `/${rawVideoUrl}`;
      }
      // If it's already a full http URL and not cmlhz.com, keep it
      else if (
        rawVideoUrl.startsWith("http") &&
        !rawVideoUrl.includes("cmlhz.com")
      ) {
        currentVideoUrl = rawVideoUrl;
        videoPath = null; // Don't process further
      }

      // Convert to appropriate URL based on environment
      // Always use /video proxy to hide actual API URL (works on both local and Vercel)
      if (videoPath) {
        // Always use /video proxy - hides actual API URL
        // On localhost: Vite proxy handles it
        // On Vercel: API route will handle it (see api/video/[...path].js)
        currentVideoUrl = `/video${videoPath}`;
      }
    }

    // Console log video player URL (show localhost instead of actual API)
    console.log("▶️ ===== VIDEO PLAYER SETUP =====");
    console.log("🎬 Selected Movie:", selectedMovie.name);
    // Hide actual API URLs, show localhost
    const displayRawVideoUrl =
      rawVideoUrl && rawVideoUrl.includes("cmlhz.com")
        ? rawVideoUrl.replace(
            "https://cmlhz.com",
            "http://localhost:5173/video"
          )
        : rawVideoUrl;
    const displayCurrentVideoUrl =
      currentVideoUrl && currentVideoUrl.startsWith("/video")
        ? `http://localhost:5173${currentVideoUrl}`
        : currentVideoUrl;
    console.log("🔗 Raw Video URL:", displayRawVideoUrl);
    console.log("🔄 Current Video URL (for player):", displayCurrentVideoUrl);
    console.log("🎵 Selected Audio Track:", selectedAudioTrack);
    console.log("📝 Video Type:", selectedMovie.videoType);

    return (
      <div
        className="video-modal-overlay"
        onClick={() => {
          setSelectedMovie(null);
          setSelectedAudioTrack(null);
        }}
      >
        <div className="video-modal" onClick={(e) => e.stopPropagation()}>
          <button
            className="close-button"
            onClick={() => {
              setSelectedMovie(null);
              setSelectedAudioTrack(null);
            }}
          >
            ✕
          </button>
          <div className="video-wrapper">
            {selectedMovie.videoType === "mp4" ? (
              <>
                <div
                  ref={videoContainerRef}
                  className="netflix-video-container"
                  onMouseEnter={() => {
                    setIsHovering(true);
                    setShowControls(true);
                  }}
                  onMouseLeave={() => setIsHovering(false)}
                  onMouseMove={() => {
                    setShowControls(true);
                    if (controlsTimeoutRef.current) {
                      clearTimeout(controlsTimeoutRef.current);
                    }
                  }}
                >
                  {/* Netflix Opening Animation with Controls Visible */}
                  {showNetflixIntro && (
                    <div className="netflix-intro-overlay">
                      <div className="netflix-intro-logo">
                        <svg
                          viewBox="0 0 111 30"
                          className="netflix-logo-svg"
                          fill="#e50914"
                        >
                          <path d="M105.062 14.28L111 30c-1.75-.25-3.499-.563-5.28-.845l-3.345-8.686-3.437 7.969c-1.687-.282-3.344-.376-5.031-.595l6.031-13.75L94.468 0h5.28l3.062 7.875L105.875 0h5.28l-5.28 14.28zm-9.75 2.345c-2.531.357-5.06.845-7.594 1.187l.187-2.28 7.407-1.875-.187 2.968-7.406 1.875zm-12.469 3.282c-2.219.376-4.5.75-6.719 1.187l.282-2.345 6.657-1.688-.282 2.968-6.656 1.688zm-10.75 1.875c-1.969.282-3.938.657-5.906 1.031l.187-1.969 5.75-1.406-.187 2.345-5.75 1.406zm-5.28 1.031c-1.75.25-3.531.532-5.28.845l.282-2.219 5.28-1.25-.282 2.219-5.28 1.25zM74 21.28c-1.688.282-3.344.376-5.031.595l6.031-13.75L68.75 6.22l-5.28 14.28L58.22 21.28c-1.532.188-3.062.376-4.562.657l1.875-4.5-7.5-1.875.187-2.28 7.5 1.875 1.875-4.5c-1.375-.25-2.656-.376-4.031-.532l.282-2.345 4.03-.532 3.345-8.686L47.53 0h5.28l3.062 7.875L58.875 0h5.28l-5.28 14.28 3.437 7.969c-1.688-.282-3.344-.376-5.031-.595l6.031-13.75L52.75 6.22l-5.28 14.28L42.22 21.28c-1.532.188-3.062.376-4.562.657l1.875-4.5-7.5-1.875.187-2.28 7.5 1.875 1.875-4.5c-1.375-.25-2.656-.376-4.031-.532l.282-2.345 4.03-.532 3.345-8.686L31.53 0h5.28l3.062 7.875L42.875 0h5.28l-5.28 14.28 3.437 7.969c-1.688-.282-3.344-.376-5.031-.595l6.031-13.75L36.75 6.22l-5.28 14.28L26.22 21.28c-1.532.188-3.062.376-4.562.657l1.875-4.5-7.5-1.875.187-2.28 7.5 1.875 1.875-4.5c-1.375-.25-2.656-.376-4.031-.532l.282-2.345 4.03-.532 3.345-8.686L15.53 0h5.28l3.062 7.875L26.875 0h5.28l-5.28 14.28 3.437 7.969c-1.688-.282-3.344-.376-5.031-.595l6.031-13.75L20.75 6.22l-5.28 14.28L10.22 21.28c-1.532.188-3.062.376-4.562.657l1.875-4.5-7.5-1.875.187-2.28 7.5 1.875 1.875-4.5c-1.375-.25-2.656-.376-4.031-.532l.282-2.345 4.03-.532L5.28 0h5.28l3.062 7.875L16.875 0h5.28l-5.28 14.28z" />
                        </svg>
                      </div>
                      {/* Show controls during intro */}
                      <div className="netflix-video-controls show">
                        <div className="netflix-controls-bar">
                          <div className="netflix-controls-left">
                            <button
                              className="netflix-play-pause-btn"
                              onClick={togglePlayPause}
                            >
                              {isPlaying ? (
                                <svg
                                  width="24"
                                  height="24"
                                  viewBox="0 0 24 24"
                                  fill="#e50914"
                                >
                                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                </svg>
                              ) : (
                                <svg
                                  width="24"
                                  height="24"
                                  viewBox="0 0 24 24"
                                  fill="#e50914"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <video
                    ref={videoRef}
                    key={currentVideoUrl}
                    autoPlay={false}
                    playsInline
                    preload="auto"
                    className="netflix-video-player"
                    onLoadedMetadata={(e) => {
                      console.log("📹 Video Metadata Loaded");
                      console.log("⏱️ Duration:", e.target.duration, "seconds");
                      console.log(
                        "📏 Video Dimensions:",
                        e.target.videoWidth,
                        "x",
                        e.target.videoHeight
                      );
                      e.target.playbackRate = playbackSpeed;
                      // Video metadata loaded, but intro will still show for 10 seconds
                    }}
                    onCanPlay={(e) => {
                      console.log("▶️ Video Can Play - Ready to start");
                      console.log("🎬 Video Source:", e.target.currentSrc);
                      // Video can start playing, but intro overlay will handle when to start
                      e.target.playbackRate = playbackSpeed;
                    }}
                    onError={(e) => {
                      const video = e.target;
                      if (video.error) {
                        // Show error to user
                        alert(
                          `Video Error: ${
                            video.error.message || "Failed to load video"
                          }`
                        );
                      }
                    }}
                    onClick={togglePlayPause}
                  >
                    <source src={currentVideoUrl} type="video/mp4" />
                    {/* Console log will show in browser console when video element loads */}
                    {selectedMovie.subtitleUrls &&
                    selectedMovie.subtitleUrls.length > 0
                      ? selectedMovie.subtitleUrls.map((subtitleUrl, index) => {
                          // Convert subtitle URL to proxy if needed
                          const proxySubtitleUrl =
                            subtitleUrl && subtitleUrl.includes("cmlhz.com")
                              ? subtitleUrl.replace(
                                  "https://cmlhz.com",
                                  "/video"
                                )
                              : subtitleUrl;
                          const lang = subtitleUrl.includes("-Hindi")
                            ? "hi"
                            : subtitleUrl.includes("-English")
                            ? "en"
                            : "en";
                          const label = subtitleUrl.includes("-Hindi")
                            ? "Hindi"
                            : subtitleUrl.includes("-English")
                            ? "English"
                            : "Subtitles";
                          return (
                            <track
                              key={index}
                              kind="subtitles"
                              src={proxySubtitleUrl}
                              srcLang={lang}
                              label={label}
                              default={index === 0}
                            />
                          );
                        })
                      : null}
                    Your browser does not support the video tag.
                  </video>

                  {/* Custom Netflix-style Controls */}
                  <div
                    className={`netflix-video-controls ${
                      showControls || !isPlaying ? "show" : ""
                    }`}
                  >
                    {/* Progress Bar */}
                    <div
                      className="netflix-progress-container"
                      onClick={handleSeek}
                    >
                      <div className="netflix-progress-bar">
                        <div
                          className="netflix-progress-filled"
                          style={{
                            width: `${(currentTime / duration) * 100}%`,
                          }}
                        />
                        <div
                          className="netflix-progress-handle"
                          style={{
                            left: `${(currentTime / duration) * 100}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Bottom Controls Bar */}
                    <div className="netflix-controls-bar">
                      {/* Left Controls */}
                      <div className="netflix-controls-left">
                        <button
                          className="netflix-play-pause-btn"
                          onClick={togglePlayPause}
                          aria-label={isPlaying ? "Pause" : "Play"}
                        >
                          {isPlaying ? (
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="#e50914"
                            >
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                          ) : (
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="#e50914"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>

                        {/* Backward 10 Seconds */}
                        <button
                          className="netflix-skip-btn"
                          onClick={handleBackward10Sec}
                          title="Rewind 10 seconds"
                        >
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="#e50914"
                          >
                            <path d="M11.99 5V1l-5 5 5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                          </svg>
                          <span>10</span>
                        </button>

                        {/* Forward 15 Minutes */}
                        <button
                          className="netflix-skip-btn"
                          onClick={handleForward15Min}
                          title="Forward 15 minutes"
                        >
                          <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="#e50914"
                          >
                            <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
                          </svg>
                          <span>15</span>
                        </button>

                        {/* Volume Control */}
                        <div className="netflix-volume-control">
                          <button
                            className="netflix-volume-btn"
                            onClick={() => {
                              if (videoRef.current) {
                                videoRef.current.volume = volume > 0 ? 0 : 1;
                                setVolume(volume > 0 ? 0 : 1);
                              }
                            }}
                          >
                            {volume === 0 ? (
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="#e50914"
                              >
                                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                              </svg>
                            ) : volume < 0.5 ? (
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="#e50914"
                              >
                                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                              </svg>
                            ) : (
                              <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="#e50914"
                              >
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                              </svg>
                            )}
                          </button>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={handleVolumeChange}
                            className="netflix-volume-slider"
                          />
                        </div>

                        {/* Time Display */}
                        <div className="netflix-time-display">
                          <span>{formatTime(currentTime)}</span>
                          <span> / </span>
                          <span>{formatTime(duration)}</span>
                        </div>
                      </div>

                      {/* Right Controls */}
                      <div className="netflix-controls-right">
                        {/* Audio Track Selector */}
                        {selectedMovie.audioTracks &&
                          selectedMovie.audioTracks.length > 0 && (
                            <div className="netflix-audio-selector">
                              <button
                                className="netflix-audio-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const audioMenu =
                                    e.currentTarget.nextElementSibling;
                                  audioMenu?.classList.toggle("show");
                                }}
                                title="Audio & Subtitles"
                              >
                                <svg
                                  width="24"
                                  height="24"
                                  viewBox="0 0 24 24"
                                  fill="#e50914"
                                >
                                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                </svg>
                              </button>
                              <div className="netflix-audio-menu">
                                <div className="netflix-audio-menu-title">
                                  Audio
                                </div>
                                {selectedMovie.audioTracks.map(
                                  (track, index) => (
                                    <button
                                      key={index}
                                      className={`netflix-audio-option ${
                                        (selectedAudioTrack?.language ||
                                          selectedMovie.audioTracks[0]
                                            ?.language) === track.language
                                          ? "active"
                                          : ""
                                      }`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAudioTrackChange(track);
                                        e.currentTarget.parentElement.classList.remove(
                                          "show"
                                        );
                                      }}
                                    >
                                      {track.label}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                        {/* Fullscreen */}
                        <button
                          className="netflix-fullscreen-btn"
                          onClick={toggleFullscreen}
                          aria-label="Fullscreen"
                        >
                          {isFullscreen ? (
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="#e50914"
                            >
                              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                            </svg>
                          ) : (
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="#e50914"
                            >
                              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Movie Info Overlay (shown when paused) */}
                    {!isPlaying && (
                      <div className="netflix-movie-info-overlay">
                        <h2 className="netflix-movie-title-overlay">
                          {selectedMovie.name}
                        </h2>
                        <div className="netflix-movie-meta-overlay">
                          {selectedMovie.rating && (
                            <span>⭐ {selectedMovie.rating}</span>
                          )}
                          {selectedMovie.duration && (
                            <span>⏱️ {selectedMovie.duration}</span>
                          )}
                          {selectedMovie.year && (
                            <span>📅 {selectedMovie.year}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="video-placeholder">
                <p>Video not available</p>
                <a
                  href={selectedMovie.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="watch-link"
                >
                  Watch on Website
                </a>
              </div>
            )}
          </div>
          <div className="video-info-modal">
            <h2>{selectedMovie.name}</h2>
            <div className="movie-meta">
              {selectedMovie.rating && <span>⭐ {selectedMovie.rating}</span>}
              {selectedMovie.duration && (
                <span>⏱️ {selectedMovie.duration}</span>
              )}
              {selectedMovie.year && <span>📅 {selectedMovie.year}</span>}
            </div>
            {selectedMovie.genres && selectedMovie.genres.length > 0 && (
              <div className="movie-genres-modal">
                {selectedMovie.genres.join(" • ")}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="netflix-container">
      {/* Header */}
      <header className="netflix-header">
        <div className="header-content">
          <div className="netflix-logo-header">NETFLIX</div>
          <nav className="header-nav">
            <a href="#" className="nav-link active">
              Home
            </a>
            <a href="#" className="nav-link">
              Movies
            </a>
            <a href="#" className="nav-link">
              TV Shows
            </a>
            <a href="#" className="nav-link">
              My List
            </a>
          </nav>
          <div className="header-actions">
            {/* Category Selector */}
            <div className="category-selector-container">
              <select
                className="category-select-dropdown"
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                title="Select Category"
              >
                {MOVIE_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="search-container">
              {showSearch && (
                <input
                  type="text"
                  className="search-input"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onKeyPress={handleSearchKeyPress}
                  placeholder="Search movies (case-sensitive)..."
                  autoFocus={true}
                />
              )}
              <button
                className="search-button"
                onClick={() => setShowSearch(!showSearch)}
              >
                🔍
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      {featuredMovie && (
        <div
          className="hero-banner"
          style={{
            backgroundImage: featuredMovie.imageUrl
              ? `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.8)), url(${featuredMovie.imageUrl})`
              : "linear-gradient(to bottom, rgba(0,0,0,0.6), rgba(0,0,0,0.9))",
          }}
        >
          <div className="hero-content">
            <h1 className="hero-title">{featuredMovie.name}</h1>
            <div className="hero-meta">
              {featuredMovie.rating && <span>⭐ {featuredMovie.rating}</span>}
              {featuredMovie.duration && (
                <span>⏱️ {featuredMovie.duration}</span>
              )}
              {featuredMovie.year && <span>📅 {featuredMovie.year}</span>}
            </div>
            <p className="hero-description">
              {featuredMovie.genres && featuredMovie.genres.length > 0
                ? featuredMovie.genres.join(" • ")
                : "Watch now"}
            </p>
            <div className="hero-buttons">
              <button
                className="play-button"
                onClick={() => {
                  if (featuredMovie) {
                    handleMovieClick(featuredMovie);
                  }
                }}
              >
                ▶ Play
              </button>
              <button
                className="info-button"
                onClick={() => {
                  if (featuredMovie) {
                    handleMovieClick(featuredMovie);
                  }
                }}
              >
                ℹ️ More Info
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movie Rows */}
      <main className="netflix-main">
        {/* Category Header - Show as Title (Netflix Style) */}
        {selectedCategory !== "all" && (
          <div className="category-header-netflix">
            <h1 className="category-title-netflix">
              {MOVIE_CATEGORIES.find((cat) => cat.id === selectedCategory)
                ?.name || "Movies"}
            </h1>
            <p className="category-description-netflix">
              Browse movies in the{" "}
              {MOVIE_CATEGORIES.find((cat) => cat.id === selectedCategory)
                ?.name || "selected"}{" "}
              category
            </p>
          </div>
        )}
        {/* Search Results Header */}
        {isSearching && searchQuery && (
          <div className="search-results-header">
            <h2 className="section-title">
              Search Results for:{" "}
              <span className="search-query">"{searchQuery}"</span>
            </h2>
            <button
              className="clear-search-btn"
              onClick={() => {
                setSearchQuery("");
                setIsSearching(false);
                setCurrentPage(1);
                setMovies([]);
                fetchMovies(1, selectedCategory);
              }}
            >
              Clear Search
            </button>
          </div>
        )}

        {isSearching && searchQuery ? (
          <div className="search-results">
            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Searching...</p>
              </div>
            ) : filteredMovies.length > 0 && validMovies.length > 0 ? (
              <div className="movies-row">
                {filteredMovies.map((movie, index) => (
                  <div
                    key={movie.id || index}
                    className="movie-card-netflix"
                    onClick={() => handleMovieClick(movie)}
                  >
                    <img
                      src={movie.imageUrl || "/placeholder.jpg"}
                      alt={movie.name}
                      className="movie-poster-netflix"
                      loading="lazy"
                      decoding="async"
                      onError={async (e) => {
                        // Try to generate image from OpenAI if available
                        const generatedImage = await generateImageFromOpenAI(
                          movie.name
                        );
                        if (generatedImage) {
                          e.target.src = generatedImage;
                          // Update movie's imageUrl for future use
                          movie.imageUrl = generatedImage;
                        } else {
                          // Fallback to placeholder
                          e.target.src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect fill='%23333' width='300' height='450'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='20' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3ENo Image%3C/text%3E%3C/svg%3E";
                        }
                      }}
                    />
                    <div className="movie-overlay">
                      <div className="movie-title-overlay">{movie.name}</div>
                      {movie.rating && (
                        <div className="movie-rating-overlay">
                          ⭐ {movie.rating}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : !loading ? (
              <div className="no-search-results">
                <p>No movies found for "{searchQuery}"</p>
                <p className="search-hint">Try a different search term</p>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {/* Continue Watching Section - Always show on homepage */}
            {continueWatchingMovies.length > 0 && !isSearching && (
              <section className="movie-section">
                <h2 className="section-title">Continue Watching</h2>
                <div className="row-container">
                  <button
                    className="scroll-button left"
                    onClick={() => scrollRow("left", scrollContainerRef)}
                  >
                    ‹
                  </button>
                  <div className="movies-row">
                    {continueWatchingMovies.map((movie, index) => (
                      <div
                        key={movie.id || `continue-${index}`}
                        className="movie-card-netflix continue-watching-card"
                        onClick={() => {
                          // Set resume position before opening
                          setLastPlayedPosition(movie.resumePosition || 0);
                          handleMovieClick(movie);
                        }}
                        title={`Resume: ${movie.name}`}
                      >
                        <img
                          src={movie.imageUrl || "/placeholder.jpg"}
                          alt={movie.name}
                          className="movie-poster-netflix"
                          loading="lazy"
                          decoding="async"
                          onError={async (e) => {
                            const generatedImage =
                              await generateImageFromOpenAI(movie.name);
                            if (generatedImage) {
                              e.target.src = generatedImage;
                              movie.imageUrl = generatedImage;
                            } else {
                              e.target.src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23141414;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23333;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad)' width='300' height='450'/%3E%3C/svg%3E";
                            }
                          }}
                        />
                        {/* Progress Bar */}
                        <div className="continue-watching-progress">
                          <div
                            className="continue-watching-progress-bar"
                            style={{
                              width: `${movie.progressPercent || 0}%`,
                            }}
                          />
                        </div>
                        <div className="movie-overlay">
                          <div className="movie-title-overlay">
                            {movie.name}
                          </div>
                          <div className="resume-hint">
                            ▶ Resume from{" "}
                            {Math.floor((movie.resumePosition || 0) / 60)}:
                            {String(
                              Math.floor((movie.resumePosition || 0) % 60)
                            ).padStart(2, "0")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="scroll-button right"
                    onClick={() => scrollRow("right", scrollContainerRef)}
                  >
                    ›
                  </button>
                </div>
              </section>
            )}

            {/* Latest Releases - Always at Top */}
            {sortedMovies.length > 0 && (
              <section className="movie-section">
                <h2 className="section-title">Latest Releases</h2>
                <div className="row-container">
                  <button
                    className="scroll-button left"
                    onClick={() => scrollRow("left", scrollContainerRef)}
                  >
                    ‹
                  </button>
                  <div className="movies-row" ref={scrollContainerRef}>
                    {sortedMovies
                      .filter((m) => m.year && parseInt(m.year) >= 2020)
                      .slice(0, 20)
                      .map((movie, index) => (
                        <div
                          key={movie.id || `latest-${index}`}
                          className="movie-card-netflix"
                          onClick={() => handleMovieClick(movie)}
                          title={`Click to play: ${movie.name}`}
                        >
                          <img
                            src={movie.imageUrl || "/placeholder.jpg"}
                            alt={movie.name}
                            className="movie-poster-netflix"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.target.src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect fill='%23333' width='300' height='450'/%3E%3Ctext fill='%23999' font-family='sans-serif' font-size='20' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3ENo Image%3C/text%3E%3C/svg%3E";
                            }}
                          />
                          <div className="movie-overlay">
                            <div className="movie-title-overlay">
                              {movie.name}
                            </div>
                            {/* Genre badges only (no category badge) */}
                            {movie.genres && movie.genres.length > 0 && (
                              <div className="movie-genres-badge">
                                {movie.genres.slice(0, 2).join(" • ")}
                              </div>
                            )}
                            {movie.rating && (
                              <div className="movie-rating-overlay">
                                ⭐ {movie.rating}
                              </div>
                            )}
                            {movie.year && (
                              <div className="movie-year-overlay">
                                📅 {movie.year}
                              </div>
                            )}
                            <div className="play-hint">▶ Click to Play</div>
                          </div>
                        </div>
                      ))}
                  </div>
                  <button
                    className="scroll-button right"
                    onClick={() => scrollRow("right", scrollContainerRef)}
                  >
                    ›
                  </button>
                </div>
              </section>
            )}

            {/* Trending Now */}
            {movies.length > 0 && (
              <section className="movie-section">
                <h2 className="section-title">Trending Now</h2>
                <div className="row-container">
                  <button
                    className="scroll-button left"
                    onClick={() => scrollRow("left", scrollContainerRef)}
                  >
                    ‹
                  </button>
                  <div className="movies-row">
                    {sortedMovies.slice(0, 20).map((movie, index) => (
                      <div
                        key={movie.id || `trending-${index}`}
                        className="movie-card-netflix"
                        onClick={() => handleMovieClick(movie)}
                        title={`Click to play: ${movie.name}`}
                      >
                        <img
                          src={movie.imageUrl || "/placeholder.jpg"}
                          alt={movie.name}
                          className="movie-poster-netflix"
                          loading="lazy"
                          decoding="async"
                          onError={async (e) => {
                            // Try to generate image from OpenAI if available
                            const generatedImage =
                              await generateImageFromOpenAI(movie.name);
                            if (generatedImage) {
                              e.target.src = generatedImage;
                              // Update movie's imageUrl for future use
                              movie.imageUrl = generatedImage;
                            } else {
                              // Fallback to a simple gradient placeholder (no "No Image" text)
                              e.target.src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23141414;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23333;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad)' width='300' height='450'/%3E%3C/svg%3E";
                            }
                          }}
                        />
                        <div className="movie-overlay">
                          <div className="movie-title-overlay">
                            {movie.name}
                          </div>
                          {movie.rating && (
                            <div className="movie-rating-overlay">
                              ⭐ {movie.rating}
                            </div>
                          )}
                          <div className="play-hint">▶ Click to Play</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="scroll-button right"
                    onClick={() => scrollRow("right", scrollContainerRef)}
                  >
                    ›
                  </button>
                </div>
              </section>
            )}

            {/* Category-wise Movies - Only show when category is selected */}
            {selectedCategory !== "all" && sortedMovies.length > 0 && (
              <section className="movie-section">
                <h2 className="section-title">
                  {MOVIE_CATEGORIES.find((cat) => cat.id === selectedCategory)
                    ?.name || "Movies"}
                </h2>
                <div className="movies-grid-netflix">
                  {sortedMovies.map((movie, index) => (
                    <div
                      key={movie.id || `all-${index}`}
                      className="movie-card-netflix"
                      onClick={() => handleMovieClick(movie)}
                      title={`Click to play: ${movie.name}`}
                    >
                      <img
                        src={movie.imageUrl || "/placeholder.jpg"}
                        alt={movie.name}
                        className="movie-poster-netflix"
                        onError={async (e) => {
                          // Try to generate image from OpenAI if available
                          const generatedImage = await generateImageFromOpenAI(
                            movie.name
                          );
                          if (generatedImage) {
                            e.target.src = generatedImage;
                            // Update movie's imageUrl for future use
                            movie.imageUrl = generatedImage;
                          } else {
                            // Fallback to a simple gradient placeholder (no "No Image" text)
                            e.target.src =
                              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23141414;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23333;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad)' width='300' height='450'/%3E%3C/svg%3E";
                          }
                        }}
                      />
                      <div className="movie-overlay">
                        <div className="movie-title-overlay">{movie.name}</div>
                        {movie.rating && (
                          <div className="movie-rating-overlay">
                            ⭐ {movie.rating}
                          </div>
                        )}
                        {movie.year && (
                          <div className="movie-year-overlay">
                            📅 {movie.year}
                          </div>
                        )}
                        <div className="play-hint">▶ Click to Play</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* All Movies - Only show when "all" category is selected */}
            {selectedCategory === "all" && sortedMovies.length > 0 && (
              <section className="movie-section">
                <h2 className="section-title">All Movies</h2>
                <div className="movies-grid-netflix">
                  {sortedMovies
                    .slice(0, allMoviesDisplayCount)
                    .map((movie, index) => (
                      <div
                        key={movie.id || `all-${index}`}
                        className="movie-card-netflix"
                        onClick={() => handleMovieClick(movie)}
                        title={`Click to play: ${movie.name}`}
                      >
                        <img
                          src={movie.imageUrl || "/placeholder.jpg"}
                          alt={movie.name}
                          className="movie-poster-netflix"
                          loading="lazy"
                          decoding="async"
                          onError={async (e) => {
                            // Try to generate image from OpenAI if available
                            const generatedImage =
                              await generateImageFromOpenAI(movie.name);
                            if (generatedImage) {
                              e.target.src = generatedImage;
                              // Update movie's imageUrl for future use
                              movie.imageUrl = generatedImage;
                            } else {
                              // Fallback to a simple gradient placeholder (no "No Image" text)
                              e.target.src =
                                "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23141414;stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:%23333;stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23grad)' width='300' height='450'/%3E%3C/svg%3E";
                            }
                          }}
                        />
                        <div className="movie-overlay">
                          <div className="movie-title-overlay">
                            {movie.name}
                          </div>
                          {movie.rating && (
                            <div className="movie-rating-overlay">
                              ⭐ {movie.rating}
                            </div>
                          )}
                          {movie.year && (
                            <div className="movie-year-overlay">
                              📅 {movie.year}
                            </div>
                          )}
                          <div className="play-hint">▶ Click to Play</div>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Loading More Indicator */}
            {isLoadingMore && (
              <div className="loading-more-container">
                <div className="loading-spinner"></div>
                <p>Loading more movies...</p>
              </div>
            )}

            {/* Pagination Info - Only show when all movies are loaded */}
            {!isSearching &&
              !hasMore &&
              !isLoadingMore &&
              movies.length > 0 && (
                <div className="pagination-info">
                  <p>
                    Loaded {movies.length} movies • Scroll down to load more
                    automatically
                  </p>
                </div>
              )}

            {/* Pagination Controls - REMOVED: Infinite scroll automatically loads pages */}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
