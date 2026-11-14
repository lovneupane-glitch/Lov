
import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";

import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

/* --------------------------------------------------
   CONFIGURATION
-------------------------------------------------- */

const cfg = window.APP_CONFIG || {};
const BUCKET = "media";
const FAVORITES_KEY = "myMediaGalleryFavorites";

const $ = id => document.getElementById(id);

let allFiles = [];
let currentUserIsAdmin = false;
let activePage = "home";
let storageClient = null;

const requiredIds = [
  "year", "creator-name", "mobile-menu", "sidebar",
  "sidebar-overlay", "close-menu", "page-title",
  "file-count", "home-page", "media-page",
  "favorites-page", "developer-page", "gallery",
  "category-gallery", "favorites-gallery",
  "search", "category-search", "media-heading",
  "admin-open", "admin-dialog", "login-panel",
  "upload-panel", "login-form", "upload-form",
  "logout", "media-file", "media-title",
  "media-description", "media-category",
  "upload-button", "progress-bar", "upload-status",
  "login-error", "status", "developer-name",
  "developer-role", "developer-about",
  "edit-developer", "developer-form",
  "dev-name-input", "dev-role-input",
  "dev-about-input", "developer-status",
  "cancel-developer", "media-viewer",
  "viewer-title", "viewer-content",
  "viewer-description", "viewer-download",
  "viewer-close", "dialog-close"
];

const missing = requiredIds.filter(id => !$(id));

if (missing.length) {
  console.error("Missing HTML elements:", missing);
  throw new Error("Some required HTML elements are missing. Check index.html.");
}

/* --------------------------------------------------
   INITIAL SETUP
-------------------------------------------------- */

$("year").textContent = new Date().getFullYear();
$("creator-name").textContent = cfg.CREATOR_NAME || "The site owner";

const adminDialog = $("admin-dialog");
const mediaViewer = $("media-viewer");

function showStatus(message) {
  $("status").textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function mediaKind(category) {
  const value = String(category || "").toLowerCase();

  if (value === "video" || value === "videos") return "video";
  if (value === "audio" || value === "audios") return "audio";

  return "image";
}

function formatDate(value) {
  if (!value) return "Recently added";

  const date = value.toDate
    ? value.toDate()
    : new Date(value);

  if (Number.isNaN(date.getTime())) return "Recently added";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

/* --------------------------------------------------
   FAVORITES
-------------------------------------------------- */

function getFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  updateFavoriteCount();
}

function isFavorite(id) {
  return getFavorites().includes(id);
}

function toggleFavorite(id) {
  const favorites = getFavorites();

  const updated = favorites.includes(id)
    ? favorites.filter(item => item !== id)
    : [...favorites, id];

  saveFavorites(updated);
  renderAll();

  showStatus(
    updated.includes(id)
      ? "Added to Favorites."
      : "Removed from Favorites."
  );
}

function updateFavoriteCount() {
  $("favorite-count").textContent = getFavorites().length;
}

/* --------------------------------------------------
   NAVIGATION
-------------------------------------------------- */

const pageIds = {
  home: "home-page",
  Photos: "media-page",
  Videos: "media-page",
  Audio: "media-page",
  favorites: "favorites-page",
  developer: "developer-page"
};

function openPage(page) {
  if (!pageIds[page]) return;

  activePage = page;

  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active");
  });

  $(pageIds[page]).classList.add("active");

  document.querySelectorAll("[data-page]").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });

  const titles = {
    home: "Home",
    Photos: "Photos",
    Videos: "Videos",
    Audio: "Audio",
    favorites: "Favorites",
    developer: "Developer Information"
  };

  $("page-title").textContent = titles[page];

  if (["Photos", "Videos", "Audio"].includes(page)) {
    $("media-heading").textContent = page;
    $("category-search").value = "";
    renderCategory();
  }

  if (page === "favorites") {
    renderFavorites();
  }

  closeSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button) return;

  event.preventDefault();
  openPage(button.dataset.page);
});

function openSidebar() {
  $("sidebar").classList.add("open");
  $("sidebar-overlay").classList.add("active");
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("sidebar-overlay").classList.remove("active");
}

$("mobile-menu").addEventListener("click", openSidebar);
$("close-menu").addEventListener("click", closeSidebar);
$("sidebar-overlay").addEventListener("click", closeSidebar);

/* --------------------------------------------------
   SUPABASE STORAGE
-------------------------------------------------- */

const configured =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_ANON_KEY &&
  !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
  !cfg.SUPABASE_ANON_KEY.includes("YOUR_");

if (configured && window.supabase) {
  storageClient = window.supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_ANON_KEY,
    {
      accessToken: async () => {
        if (!auth.currentUser) {
          throw new Error("Administrator login required.");
        }

        return await auth.currentUser.getIdToken();
      }
    }
  );
} else {
  console.error("Supabase configuration is missing.");
}

/* --------------------------------------------------
   MEDIA CARD
-------------------------------------------------- */

function createMediaCard(file) {
  const kind = mediaKind(file.category);
  const url = safeUrl(file.public_url);

  if (!url) return "";

  const card = document.createElement("article");
  card.className = "media-card";

  let preview = "";

  if (kind === "image") {
    preview = `
      <img src="${escapeHtml(url)}"
        alt="${escapeHtml(file.title)}"
        loading="lazy">
    `;
  } else if (kind === "video") {
    preview = `
      <video src="${escapeHtml(url)}"
        controls preload="metadata"></video>
    `;
  } else {
    preview = `
      <div class="audio-art">♫</div>
      <audio src="${escapeHtml(url)}"
        controls preload="metadata"></audio>
    `;
  }

  card.innerHTML = `
    <div class="preview">${preview}</div>

    <div class="media-card-content">
      <p class="media-date">${escapeHtml(formatDate(file.created_at))}</p>

      <h3>${escapeHtml(file.title || "Untitled")}</h3>

      <p>${escapeHtml(file.description || "No description provided.")}</p>

      <button type="button" data-action="preview"
        data-id="${escapeHtml(file.id)}">
        View
      </button>

      <button type="button" data-action="favorite"
        data-id="${escapeHtml(file.id)}">
        ${isFavorite(file.id) ? "♥ Saved" : "♡ Favorite"}
      </button>

      <a class="download"
        href="${escapeHtml(url)}"
        download="${escapeHtml(file.original_name || file.title || "media")}"
        target="_blank" rel="noopener">
        ↓ Download
      </a>
    </div>
  `;

  return card;
}

function displayFiles(container, files) {
  container.innerHTML = "";

  if (!files.length) {
    container.innerHTML = `
      <p class="empty-state">No media found.</p>
    `;
    return;
  }

  files.forEach(file => {
    const card = createMediaCard(file);
    if (card) container.appendChild(card);
  });
}

/* --------------------------------------------------
   LOAD MEDIA FROM FIRESTORE
-------------------------------------------------- */

async function loadFiles() {
  $("gallery").innerHTML = `
    <p class="empty-state">Loading media...</p>
  `;

  try {
    const snapshot = await getDocs(collection(db, "media_files"));

    allFiles = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    allFiles.sort((a, b) => {
      const dateA = a.created_at?.toMillis
        ? a.created_at.toMillis()
        : new Date(a.created_at || 0).getTime();

      const dateB = b.created_at?.toMillis
        ? b.created_at.toMillis()
        : new Date(b.created_at || 0).getTime();

      return dateB - dateA;
    });

    $("file-count").textContent = `${allFiles.length} items`;

    renderAll();

  } catch (error) {
    console.error("Firestore error:", error);

    $("gallery").innerHTML = `
      <p class="empty-state">
        Could not load media. Check Firestore permissions.
      </p>
    `;

    showStatus(error.message);
  }
}

/* --------------------------------------------------
   RENDER GALLERIES
-------------------------------------------------- */

function renderHome() {
  const query = $("search").value.trim().toLowerCase();

  const files = allFiles.filter(file => {
    return [
      file.title,
      file.description,
      file.category
    ].some(value =>
      String(value || "").toLowerCase().includes(query)
    );
  });

  displayFiles($("gallery"), files);
}

function renderCategory() {
  const category = mediaKind(activePage);
  const query = $("category-search").value.trim().toLowerCase();

  const files = allFiles.filter(file => {
    const categoryMatches = mediaKind(file.category) === category;

    const searchMatches = [
      file.title,
      file.description
    ].some(value =>
      String(value || "").toLowerCase().includes(query)
    );

    return categoryMatches && searchMatches;
  });

  displayFiles($("category-gallery"), files);
}

function renderFavorites() {
  const favorites = getFavorites();

  const files = allFiles.filter(file =>
    favorites.includes(file.id)
  );

  displayFiles($("favorites-gallery"), files);
}

function renderAll() {
  renderHome();
  renderFavorites();

  if (["Photos", "Videos", "Audio"].includes(activePage)) {
    renderCategory();
  }

  updateFavoriteCount();
}

$("search").addEventListener("input", renderHome);
$("category-search").addEventListener("input", renderCategory);

/* --------------------------------------------------
   MEDIA ACTIONS AND VIEWER
-------------------------------------------------- */

document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const file = allFiles.find(item => item.id === id);

  if (!file) return;

  if (button.dataset.action === "favorite") {
    toggleFavorite(id);
  }

  if (button.dataset.action === "preview") {
    openViewer(file);
  }
});

function openViewer(file) {
  const url = safeUrl(file.public_url);
  if (!url) return;

  const kind = mediaKind(file.category);

  $("viewer-title").textContent = file.title || "Media Preview";
  $("viewer-description").textContent = file.description || "";

  let content = "";

  if (kind === "image") {
    content = `<img src="${escapeHtml(url)}" alt="${escapeHtml(file.title)}">`;
  } else if (kind === "video") {
    content = `<video src="${escapeHtml(url)}" controls autoplay></video>`;
  } else {
    content = `<audio src="${escapeHtml(url)}" controls autoplay></audio>`;
  }

  $("viewer-content").innerHTML = content;
  $("viewer-download").href = url;
  $("viewer-download").download =
    file.original_name || file.title || "media";

  mediaViewer.showModal();
}

function closeViewer() {
  $("viewer-content").innerHTML = "";
  mediaViewer.close();
}

$("viewer-close").addEventListener("click", closeViewer);

/* --------------------------------------------------
   ADMIN LOGIN
-------------------------------------------------- */

function showAdmin(isLoggedIn) {
  $("login-panel").hidden = isLoggedIn;
  $("upload-panel").hidden = !isLoggedIn;
  $("login-error").textContent = "";
}

$("admin-open").addEventListener("click", () => {
  showAdmin(currentUserIsAdmin);
  adminDialog.showModal();
});

$("dialog-close").addEventListener("click", () => {
  adminDialog.close();
});

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();

  $("login-error").textContent = "Checking login...";

  try {
    await signInWithEmailAndPassword(
      auth,
      $("admin-email").value.trim(),
      $("admin-password").value
    );

    await auth.currentUser.getIdToken(true);

    $("login-error").textContent = "Login successful.";

  } catch (error) {
    console.error("Login error:", error);
    $("login-error").textContent = "Login failed: " + error.message;
  }
});

$("logout").addEventListener("click", async () => {
  try {
    await signOut(auth);
    showAdmin(false);
    adminDialog.close();
    showStatus("You have signed out.");
  } catch (error) {
    showStatus(error.message);
  }
});

/* --------------------------------------------------
   AUTHENTICATION STATE
-------------------------------------------------- */

onAuthStateChanged(auth, async user => {
  currentUserIsAdmin = false;

  if (user) {
    try {
      const token = await user.getIdTokenResult(true);

      // The admin custom claim was configured on your Firebase user.
      currentUserIsAdmin =
        token.claims.role === "authenticated";

    } catch (error) {
      console.error("Could not verify administrator claim:", error);
    }
  }

  $("edit-developer").hidden = !currentUserIsAdmin;

  if (adminDialog.open) {
    showAdmin(currentUserIsAdmin);
  }

  if (currentUserIsAdmin) {
    loadDeveloperInfo();
  }
});

/* --------------------------------------------------
   GOOGLE DRIVE UPLOAD + FIRESTORE RECORD
   Existing Supabase media remains readable.
-------------------------------------------------- */

function requestGoogleDriveToken() {
  return new Promise((resolve, reject) => {
    if (!cfg.GOOGLE_CLIENT_ID) {
      reject(new Error("Google Client ID is missing from config.js."));
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google sign-in library did not load. Refresh the page and try again."));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: cfg.GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: response => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || "Google authorization was not completed."));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: error => {
        reject(new Error(error?.message || "Google authorization popup could not be opened."));
      }
    });

    // Called directly from the upload button action so the browser permits the popup.
    tokenClient.requestAccessToken({ prompt: "select_account" });
  });
}

async function uploadToGoogleDrive(file, accessToken) {
  const metadata = {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    description: "Uploaded through My Media Gallery"
  };

  const boundary = "-------MyMediaGalleryBoundary" + crypto.randomUUID().replaceAll("-", "");
  const body = new Blob([
    `--${boundary}\r\n`,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${metadata.mimeType}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`
  ], { type: `multipart/related; boundary=${boundary}` });

  const uploadResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body
    }
  );

  const uploaded = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) {
    throw new Error(uploaded.error?.message || `Google Drive upload failed (${uploadResponse.status}).`);
  }
  if (!uploaded.id) throw new Error("Google Drive did not return a file ID.");

  // Gallery media is intended to be viewable by visitors without signing in.
  const permissionResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(uploaded.id)}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ type: "anyone", role: "reader" })
    }
  );

  if (!permissionResponse.ok) {
    const permissionError = await permissionResponse.json().catch(() => ({}));
    throw new Error(permissionError.error?.message || "The file uploaded, but Google Drive could not make it publicly viewable. Check your Google account's sharing settings.");
  }

  return {
    id: uploaded.id,
    name: uploaded.name || file.name,
    mimeType: uploaded.mimeType || metadata.mimeType,
    webViewLink: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    // This URL is used by the existing gallery preview/download components.
    publicUrl: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(uploaded.id)}`
  };
}

$("upload-form").addEventListener("submit", async event => {
  event.preventDefault();

  const file = $("media-file").files[0];
  const user = auth.currentUser;

  if (!user || !currentUserIsAdmin) {
    $("upload-status").textContent = "Administrator access is required.";
    return;
  }
  if (!file) return;

  const category = $("media-category").value;
  const expectedType = {
    Photos: "image/",
    Videos: "video/",
    Audio: "audio/"
  }[category];

  if (!expectedType || !file.type.startsWith(expectedType)) {
    $("upload-status").textContent = "Please select a file matching the selected category.";
    return;
  }

  const button = $("upload-button");
  const progress = $("progress-bar");
  button.disabled = true;
  progress.value = 5;
  $("upload-status").textContent = "Connect your Google Drive account...";

  try {
    // Request Google authorization immediately from the user's upload click.
    const driveTokenPromise = requestGoogleDriveToken();
    await user.getIdToken(true);
    const driveToken = await driveTokenPromise;

    progress.value = 20;
    $("upload-status").textContent = "Uploading media to Google Drive...";
    const driveFile = await uploadToGoogleDrive(file, driveToken);

    progress.value = 80;
    $("upload-status").textContent = "Saving media information...";

    await addDoc(collection(db, "media_files"), {
      title: $("media-title").value.trim(),
      description: $("media-description").value.trim(),
      category: mediaKind(category),
      original_name: file.name,
      storage_provider: "google_drive",
      drive_file_id: driveFile.id,
      storage_path: driveFile.id,
      public_url: driveFile.publicUrl,
      drive_view_url: driveFile.webViewLink,
      mime_type: driveFile.mimeType,
      created_at: serverTimestamp()
    });

    progress.value = 100;
    $("upload-status").textContent = "Upload successful! Your media is now in Google Drive.";
    $("upload-form").reset();
    await loadFiles();

  } catch (error) {
    console.error("Google Drive upload error:", error);
    $("upload-status").textContent = "Upload failed: " + error.message;
  } finally {
    button.disabled = false;
  }
});

/* --------------------------------------------------
   DEVELOPER INFORMATION
-------------------------------------------------- */

// Public information is stored in:
// Firestore collection: site_info
// Document ID: developer

async function loadDeveloperInfo() {
  try {
    const reference = doc(db, "site_info", "developer");
    const snapshot = await getDoc(reference);

    if (!snapshot.exists()) return;

    const data = snapshot.data();

    $("developer-name").textContent = data.name || "Website Developer";
    $("developer-role").textContent = data.role || "";
    $("developer-about").textContent = data.about || "";

    $("dev-name-input").value = data.name || "";
    $("dev-role-input").value = data.role || "";
    $("dev-about-input").value = data.about || "";

  } catch (error) {
    console.error("Developer information loading error:", error);
    $("developer-status").textContent =
      "Could not load developer information.";
  }
}

$("edit-developer").addEventListener("click", () => {
  if (!currentUserIsAdmin) return;

  $("developer-form").hidden = false;
  $("developer-status").textContent = "";
});

$("cancel-developer").addEventListener("click", () => {
  $("developer-form").hidden = true;
  loadDeveloperInfo();
});

$("developer-form").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUserIsAdmin || !auth.currentUser) {
    $("developer-status").textContent =
      "Administrator access is required.";
    return;
  }

  $("developer-status").textContent = "Saving information...";

  try {
    await setDoc(
      doc(db, "site_info", "developer"),
      {
        name: $("dev-name-input").value.trim(),
        role: $("dev-role-input").value.trim(),
        about: $("dev-about-input").value.trim(),
        updated_at: serverTimestamp()
      },
      { merge: true }
    );

    $("developer-name").textContent =
      $("dev-name-input").value.trim();

    $("developer-role").textContent =
      $("dev-role-input").value.trim();

    $("developer-about").textContent =
      $("dev-about-input").value.trim();

    $("developer-form").hidden = true;
    $("developer-status").textContent =
      "Developer information saved.";

  } catch (error) {
    console.error("Developer information save error:", error);

    $("developer-status").textContent =
      "Could not save: " + error.message;
  }
});

/* --------------------------------------------------
   START WEBSITE
-------------------------------------------------- */

updateFavoriteCount();
openPage("home");
loadFiles();
loadDeveloperInfo();
