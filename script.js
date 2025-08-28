// ===== Config =====
const API_KEY = "2d3b818276f13c626f16dc5b2616af73";
const DISCOVER = (sort="popularity.desc", page=1) =>
  `https://api.themoviedb.org/3/discover/movie?sort_by=${encodeURIComponent(sort)}&api_key=${API_KEY}&page=${page}`;
const IMG_PATH = "https://image.tmdb.org/t/p/w1280";
const SEARCHAPI = (q) =>
  `https://api.themoviedb.org/3/search/movie?&api_key=${API_KEY}&query=${encodeURIComponent(q)}`;
const VIDEOS = (id) =>
  `https://api.themoviedb.org/3/movie/${id}/videos?api_key=${API_KEY}`;

const main = document.getElementById("section");
const form = document.getElementById("form");
const search = document.getElementById("query");
const watchBtn = document.getElementById("watchlist-nav");
const watchCount = document.getElementById("watch-count");
const sortSelect = document.getElementById("sort-by");

// Modal elements
const modal = document.getElementById('trailer-modal');
const modalClose = modal ? modal.querySelector('.modal-close') : null;
const trailerFrame = document.getElementById('trailer-frame');
const modalBackdrop = modal ? modal.querySelector('.modal-backdrop') : null;

// ===== App state =====
let currentSort = (sortSelect && sortSelect.value) || "popularity.desc";

// ===== Watchlist (LocalStorage) =====
const WATCH_KEY = "watchlist";
function getWatchlist(){
  try { return JSON.parse(localStorage.getItem(WATCH_KEY)) || []; }
  catch { return []; }
}
function setWatchlist(list){
  localStorage.setItem(WATCH_KEY, JSON.stringify(list));
  updateWatchCount();
}
function updateWatchCount(){
  const n = getWatchlist().length;
  if (watchCount) watchCount.textContent = n;
}
function isSaved(id){
  return getWatchlist().some(m => String(m.id) === String(id));
}
function toggleWatch(movie){
  const list = getWatchlist();
  const i = list.findIndex(m => String(m.id) === String(movie.id));
  if (i >= 0) list.splice(i,1);
  else list.unshift(movie);
  setWatchlist(list);
}

// ===== Skeletons =====
function showSkeletons(count = 12){
  const grid = document.createElement('div');
  grid.className = 'skeleton-grid';
  for (let i=0;i<count;i++){
    const card = document.createElement('div');
    card.className = 'skeleton-card';
    card.innerHTML = `
      <div class="skeleton poster"></div>
      <div class="skeleton line"></div>
      <div class="skeleton line" style="width:60%"></div>`;
    grid.appendChild(card);
  }
  if (main){ main.innerHTML = ''; main.appendChild(grid); }
}
function clearSkeletons(){ if (main) main.innerHTML = ''; }

// ===== Trailer helpers =====
async function fetchTrailerKey(movieId){
  try{
    const res = await fetch(VIDEOS(movieId));
    if(!res.ok) throw new Error('videos ' + res.status);
    const data = await res.json();
    const videos = (data.results || []).filter(v => v.site === 'YouTube');
    let cand = videos.find(v => /trailer/i.test(v.type));
    if (!cand) cand = videos[0];
    return cand ? cand.key : null;
  }catch(e){
    console.error('Trailer fetch failed', e);
    return null;
  }
}

function openTrailer(key){
  if (!modal || !trailerFrame || !key) return;
  trailerFrame.src = 'https://www.youtube.com/embed/' + key + '?autoplay=1&rel=0';
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeTrailer(){
  if (!modal || !trailerFrame) return;
  trailerFrame.src = '';
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}
modalClose && modalClose.addEventListener('click', closeTrailer);
modalBackdrop && modalBackdrop.addEventListener('click', closeTrailer);
window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeTrailer(); });

// ===== Card builder (⭐ + Share + ▶ Trailer + Reviews button fix) =====
function buildCard(element){
  const div_column = document.createElement("div");
  div_column.className = "column";

  const div_card = document.createElement("div");
  div_card.className = "card";

  const center = document.createElement("center");

  if (element.poster_path) {
    const image = document.createElement("img");
    image.className = "thumbnail";
    image.loading = 'lazy';
    image.decoding = 'async';
    image.src = IMG_PATH + element.poster_path;
    image.alt = element.title || 'Movie poster';
    image.addEventListener('error', ()=>{
      image.src = 'icon-192.png';
      image.alt = 'Poster unavailable';
    });
    center.appendChild(image);
  }

  // Title only (no inline reviews link to avoid same style)
  const titleEl = document.createElement("h3");
  titleEl.textContent = element.title || 'Untitled';

  // Footer buttons
  const footer = document.createElement('div');
  footer.className = 'card-footer';

  // Reviews as a secondary button (fixes "looks like title" issue)
  const reviewHref = `movie.html?id=${element.id}&title=${encodeURIComponent(element.title)}`;
  const reviewsBtn = document.createElement('a');
  reviewsBtn.href = reviewHref;
  reviewsBtn.className = 'btn pill subtle';
  reviewsBtn.textContent = 'Reviews';

  // Trailer button
  const trailerBtn = document.createElement('button');
  trailerBtn.className = 'btn trailer-btn';
  trailerBtn.type = 'button';
  trailerBtn.textContent = '▶ Trailer';
  trailerBtn.addEventListener('click', async ()=>{
    trailerBtn.disabled = true;
    const key = await fetchTrailerKey(element.id);
    trailerBtn.disabled = false;
    if (key) openTrailer(key);
    else alert('Trailer not available');
  });

  // Share button (top-right)
  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-fab';
  shareBtn.type = 'button';
  shareBtn.textContent = 'Share';
  const shareUrl = (location.origin + location.pathname.replace(/index\.html?$/, '')) + reviewHref;
  shareBtn.addEventListener('click', async () => {
    try{
      if (navigator.share) {
        await navigator.share({ title: element.title, url: shareUrl });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        alert('Link copied!');
      }
    }catch{}
  });

  // Watch star (top-left)
  const star = document.createElement('button');
  star.className = 'watch-btn';
  star.type = 'button';
  const movieLite = { id: element.id, title: element.title, poster_path: element.poster_path || null };
  function paintStar(){
    star.textContent = isSaved(element.id) ? '★' : '☆';
    star.setAttribute('aria-pressed', isSaved(element.id));
    star.title = isSaved(element.id) ? 'Remove from Watchlist' : 'Save to Watchlist';
  }
  paintStar();
  star.addEventListener('click', ()=>{ toggleWatch(movieLite); paintStar(); });

  footer.appendChild(trailerBtn);
  footer.appendChild(reviewsBtn);

  div_card.appendChild(star);
  div_card.appendChild(shareBtn);
  div_card.appendChild(center);
  div_card.appendChild(titleEl);
  div_card.appendChild(footer);
  div_column.appendChild(div_card);

  return div_column;
}

// ===== Render helpers =====
function renderGrid(list){
  const div_row = document.createElement("div");
  div_row.className = "row";
  list.forEach(el => div_row.appendChild(buildCard(el)));
  clearSkeletons();
  main.appendChild(div_row);
}

// ===== API fetch & list =====
async function loadDiscover(){
  const url = DISCOVER(currentSort, 1);
  await returnMovies(url);
}
async function returnMovies(url) {
  try {
    showSkeletons();
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    renderGrid((data.results || []).filter(x => x && x.title));
  } catch (err) {
    console.error("Movie fetch failed:", err);
    if (main) main.innerHTML = '<p class="error">Search failed. Try again.</p>';
  }
}

// ===== Watchlist view =====
function renderWatchlist(){
  const list = getWatchlist();
  if (!list.length){
    main.innerHTML = '<p class="empty">Your Watchlist is empty. Tap ☆ on any movie to save it.</p>';
    return;
  }
  const items = list.map(m => ({ id: m.id, title: m.title, poster_path: m.poster_path }));
  renderGrid(items);
}

// ===== Init load =====
(function init(){
  updateWatchCount();
  const q = new URL(location.href).searchParams.get('q');
  if (q) {
    returnMovies(SEARCHAPI(q));
    if (search) search.value = q;
  } else {
    loadDiscover();
  }
  if (sortSelect){
    sortSelect.value = currentSort;
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      // If we were on a search URL, clear it because search endpoint doesn't support sort
      history.replaceState({}, '', 'index.html');
      loadDiscover();
    });
  }
})();

// ===== Events =====
if (form) form.addEventListener("submit", (e) => {
  e.preventDefault();
  const searchItem = search && search.value && search.value.trim();
  if (searchItem) {
    history.replaceState({}, '', `?q=${encodeURIComponent(searchItem)}`);
    returnMovies(SEARCHAPI(searchItem));
    if (search) search.value = "";
  }
});

if (watchBtn) watchBtn.addEventListener('click', () => {
  history.replaceState({}, '', 'index.html');
  main.innerHTML = '';
  renderWatchlist();
});
