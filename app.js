
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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const cfg = window.APP_CONFIG || {};

const configured =
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_ANON_KEY &&
  !cfg.SUPABASE_URL.includes("YOUR-PROJECT") &&
  !cfg.SUPABASE_ANON_KEY.includes("YOUR_");

const $ = id => document.getElementById(id);

const BUCKET = "media";

let allFiles = [];
let activeCategory = "All";

// --------------------------------------------------
// INITIAL PAGE SETUP
// --------------------------------------------------

$("year").textContent = new Date().getFullYear();
$("creator-name").textContent =
  cfg.CREATOR_NAME || "The site owner";

$("mobile-menu")?.addEventListener("click", () => {
  $("main-nav")?.classList.toggle("open");
});

document.querySelector(".mobile-menu")?.addEventListener("click", () => {
  document.querySelector(".nav")?.classList.toggle("open");
});

document.querySelectorAll(".nav a").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelector(".nav")?.classList.remove("open");
  });
});

// --------------------------------------------------
// CHECK SUPABASE CONFIGURATION
// --------------------------------------------------

if (!configured || !window.supabase) {
  $("gallery").innerHTML =
    '<div class="empty-state">Supabase configuration is missing. Please check config.js.</div>';

  $("admin-open").addEventListener("click", () => {
    alert("Please configure Supabase in config.js first.");
  });

  $("file-count").textContent = "0";

  throw new Error("Supabase configuration is missing.");
}

// --------------------------------------------------
// SUPABASE STORAGE CLIENT
// Firebase provides the authentication token.
// --------------------------------------------------

const storageClient = window.supabase.createClient(
  cfg.SUPABASE_URL,
  cfg.SUPABASE_ANON_KEY,
  {
    accessToken: async () => {
      const user = auth.currentUser;

      if (!user) {
        throw new Error("Please sign in as the administrator.");
      }

      return await user.getIdToken();
    }
  }
);

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

const escapeHtml = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

function mediaKind(category) {
  const value = String(category || "").toLowerCase();

  if (value === "video" || value === "videos") return "video";
  if (value === "audio" || value === "audios") return "audio";

  return "image";
}

function niceDate(value) {
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

// --------------------------------------------------
// LOAD MEDIA FROM FIRESTORE
// --------------------------------------------------

async function loadFiles() {
  $("gallery").innerHTML =
    '<div class="empty-state">Loading the collection...</div>';

  try {
    const snapshot = await getDocs(collection(db, "media_files"));

    allFiles = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
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

    $("file-count").textContent = allFiles.length;

    render();

  } catch (error) {
    console.error("Firestore loading error:", error);

    $("gallery").innerHTML =
      '<div class="empty-state">We could not load the gallery. Please check your Firestore configuration and security rules.</div>';

    $("status").textContent = error.message;
  }
}

// --------------------------------------------------
// DISPLAY MEDIA
// --------------------------------------------------

function render() {
  const searchInput = $("search");

  const query = searchInput
    ? searchInput.value.trim().toLowerCase()
    : "";

  const visible = allFiles.filter(file => {
    const category = mediaKind(file.category);

    const categoryMatches =
      activeCategory === "All" ||
      mediaKind(activeCategory) === category;

    const searchMatches = [
      file.title,
      file.description,
      file.category
    ].some(value =>
      String(value || "").toLowerCase().includes(query)
    );

    return categoryMatches && searchMatches;
  });

  if (!visible.length) {
    $("gallery").innerHTML =
      '<div class="empty-state">No media found. New uploads will appear here.</div>';

    return;
  }

  $("gallery").innerHTML = visible.map(file => {
    const kind = mediaKind(file.category);

    const preview = kind === "image"
      ? `<img src="${escapeHtml(file.public_url)}"
          alt="${escapeHtml(file.title)}"
          loading="lazy">`

      : kind === "video"
        ? `<video src="${escapeHtml(file.public_url)}"
            controls preload="metadata"></video>`

        : `<div class="audio-art">♫</div>
           <audio src="${escapeHtml(file.public_url)}"
            controls preload="metadata"></audio>`;

    return `
      <article class="media-card">

        <div class="preview">
          ${preview}
        </div>

        <div class="card-body">

          <div class="card-meta">
            <span class="category-tag">
              ${escapeHtml(file.category)}
            </span>

            <span>
              ${niceDate(file.created_at)}
            </span>
          </div>

          <h3>${escapeHtml(file.title)}</h3>

          <div class="description">
            ${escapeHtml(file.description || "No description provided.")}
          </div>

          <a class="download"
             href="${escapeHtml(file.public_url)}"
             download="${escapeHtml(file.original_name || file.title)}"
             target="_blank"
             rel="noopener">
             ↓ &nbsp; Download file
          </a>

        </div>
      </article>
    `;
  }).join("");
}

// --------------------------------------------------
// SEARCH AND CATEGORY FILTERS
// --------------------------------------------------

$("search").addEventListener("input", render);

$("category-filters").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");

  if (!button) return;

  activeCategory = button.dataset.category;

  document.querySelectorAll(".filter").forEach(item => {
    item.classList.toggle("active", item === button);
  });

  render();
});

// --------------------------------------------------
// ADMIN LOGIN DIALOG
// --------------------------------------------------

const dialog = $("admin-dialog");

function showAdmin(isLoggedIn) {
  $("login-panel").hidden = isLoggedIn;
  $("upload-panel").hidden = !isLoggedIn;
  $("login-error").textContent = "";
}

$("admin-open").addEventListener("click", () => {
  showAdmin(!!auth.currentUser);
  dialog.showModal();
});

// --------------------------------------------------
// FIREBASE AUTHENTICATION
// --------------------------------------------------

onAuthStateChanged(auth, async user => {
  if (user) {
    try {
      // Refresh Firebase token to include updated custom claims.
      await user.getIdToken(true);
    } catch (error) {
      console.error("Token refresh error:", error);
    }
  }

  if (dialog.open) {
    showAdmin(!!user);
  }
});

// --------------------------------------------------
// ADMIN LOGIN
// --------------------------------------------------

$("login-form").addEventListener("submit", async event => {
  event.preventDefault();

  $("login-error").textContent = "Checking your login...";

  try {
    await signInWithEmailAndPassword(
      auth,
      $("admin-email").value.trim(),
      $("admin-password").value
    );

    await auth.currentUser.getIdToken(true);

    showAdmin(true);

  } catch (error) {
    console.error("Login error:", error);

    $("login-error").textContent =
      "Login failed: " + error.message;
  }
});

// --------------------------------------------------
// ADMIN LOGOUT
// --------------------------------------------------

$("logout").addEventListener("click", async () => {
  try {
    await signOut(auth);
    showAdmin(false);
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// --------------------------------------------------
// MEDIA UPLOAD
// SUPABASE STORAGE + FIRESTORE
// --------------------------------------------------

$("upload-form").addEventListener("submit", async event => {
  event.preventDefault();

  const file = $("media-file").files[0];

  if (!file) return;

  const user = auth.currentUser;

  if (!user) {
    showAdmin(false);
    return;
  }

  const category = $("media-category").value;

  const expected = category === "Videos"
    ? "video/"
    : category === "Audio"
      ? "audio/"
      : "image/";

  if (!file.type.startsWith(expected)) {
    $("upload-status").textContent =
      `Please choose a ${category.toLowerCase()} file for this category.`;

    return;
  }

  const safeName = file.name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-100);

  const path = `${crypto.randomUUID()}-${safeName}`;

  const button = $("upload-button");
  const bar = $("progress-bar");

  button.disabled = true;
  bar.style.width = "0%";

  $("upload-status").textContent = "Uploading your file...";

  try {
    // Refresh the Firebase authentication token.
    await user.getIdToken(true);

    // Upload file to Supabase Storage.
    const { error: uploadError } = await storageClient
      .storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (uploadError) throw uploadError;

    bar.style.width = "70%";

    $("upload-status").textContent =
      "File uploaded. Saving media information...";

    // Get public URL from Supabase Storage.
    const { data: publicData } = storageClient
      .storage
      .from(BUCKET)
      .getPublicUrl(path);

    const publicUrl = publicData.publicUrl;

    // Save media details in Cloud Firestore.
    await addDoc(collection(db, "media_files"), {
      title: $("media-title").value.trim(),
      description: $("media-description").value.trim(),
      category: mediaKind(category),
      original_name: file.name,
      storage_path: path,
      public_url: publicUrl,
      created_at: serverTimestamp()
    });

    bar.style.width = "100%";

    $("upload-status").textContent =
      "Success! Your file is now in the gallery.";

    $("upload-form").reset();

    await loadFiles();

  } catch (error) {
    console.error("Upload error:", error);

    $("upload-status").textContent =
      "Upload error: " + error.message;

  } finally {
    button.disabled = false;
  }
});

// --------------------------------------------------
// INITIALIZE GALLERY
// --------------------------------------------------

loadFiles();
