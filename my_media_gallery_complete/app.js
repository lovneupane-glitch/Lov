
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
const BUCKET = "media";

const $ = id => document.getElementById(id);

const escapeHtml = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

const categoryName = category => {
  const value = String(category || "").toLowerCase();

  if (value === "video" || value === "videos") return "Videos";
  if (value === "audio") return "Audio";

  return "Photos";
};

const mediaKind = category => {
  const name = categoryName(category);

  if (name === "Videos") return "video";
  if (name === "Audio") return "audio";

  return "image";
};

const safeUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
};

const getDate = value => {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const niceDate = value => {
  const date = getDate(value);

  return date
    ? date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric"
      })
    : "Recently added";
};

// --------------------------------------------------
// PAGE SETUP
// --------------------------------------------------

if ($("year")) {
  $("year").textContent = new Date().getFullYear();
}

if ($("creator-name")) {
  $("creator-name").textContent =
    cfg.CREATOR_NAME || "The site owner";
}

const menuButton = $("mobile-menu");
const navigation = $("main-nav") || document.querySelector(".nav");

menuButton?.addEventListener("click", () => {
  navigation?.classList.toggle("open");
});

document.querySelectorAll(".nav a").forEach(link => {
  link.addEventListener("click", () => {
    navigation?.classList.remove("open");
  });
});

// --------------------------------------------------
// CHECK CONFIGURATION
// --------------------------------------------------

if (
  !cfg.SUPABASE_URL ||
  !cfg.SUPABASE_ANON_KEY ||
  !window.supabase
) {
  if ($("gallery")) {
    $("gallery").innerHTML =
      '<div class="empty-state">Configuration missing. Please check config.js and the Supabase library.</div>';
  }

  if ($("status")) {
    $("status").textContent = "Configuration error.";
  }

  throw new Error("Supabase configuration is missing.");
}

// --------------------------------------------------
// SUPABASE CLIENT
// Firebase ID token is used for Supabase authentication.
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
// GALLERY
// --------------------------------------------------

let allFiles = [];
let activeCategory = "All";

async function loadFiles() {
  if ($("gallery")) {
    $("gallery").innerHTML =
      '<div class="empty-state">Loading your collection...</div>';
  }

  try {
    const snapshot = await getDocs(
      collection(db, "media_files")
    );

    allFiles = snapshot.docs.map(document => ({
      id: document.id,
      ...document.data()
    }));

    allFiles.sort((a, b) => {
      const dateA = getDate(a.created_at)?.getTime() || 0;
      const dateB = getDate(b.created_at)?.getTime() || 0;

      return dateB - dateA;
    });

    if ($("file-count")) {
      $("file-count").textContent = allFiles.length;
    }

    renderGallery();

    if ($("status")) {
      $("status").textContent = "";
    }

  } catch (error) {
    console.error("Gallery loading error:", error);

    if ($("gallery")) {
      $("gallery").innerHTML =
        '<div class="empty-state">Unable to load the gallery. Check your Firestore security rules.</div>';
    }

    if ($("status")) {
      $("status").textContent = error.message;
    }
  }
}

// --------------------------------------------------
// DISPLAY MEDIA
// --------------------------------------------------

function renderGallery() {
  const search = $("search");

  const query = search
    ? search.value.trim().toLowerCase()
    : "";

  const visible = allFiles.filter(file => {
    const category = categoryName(file.category);

    const categoryMatches =
      activeCategory === "All" ||
      category === activeCategory;

    const searchMatches = [
      file.title,
      file.description,
      category
    ].some(value =>
      String(value || "").toLowerCase().includes(query)
    );

    return categoryMatches && searchMatches;
  });

  if (!visible.length) {
    $("gallery").innerHTML =
      '<div class="empty-state">No media found. Try another search or category.</div>';

    return;
  }

  $("gallery").innerHTML = visible.map(file => {
    const kind = mediaKind(file.category);
    const url = safeUrl(file.public_url);

    let preview = "";

    if (!url) {
      preview = '<div class="audio-art">Preview unavailable</div>';
    } else if (kind === "image") {
      preview = `
        <img
          src="${escapeHtml(url)}"
          alt="${escapeHtml(file.title)}"
          loading="lazy"
        >
      `;
    } else if (kind === "video") {
      preview = `
        <video
          src="${escapeHtml(url)}"
          controls
          preload="metadata"
        ></video>
      `;
    } else {
      preview = `
        <div class="audio-art">♫</div>
        <audio
          src="${escapeHtml(url)}"
          controls
          preload="metadata"
        ></audio>
      `;
    }

    const downloadLink = url
      ? `<a class="download"
           href="${escapeHtml(url)}"
           download="${escapeHtml(file.original_name || file.title)}"
           target="_blank"
           rel="noopener">
           ↓ &nbsp; Download file
         </a>`
      : "";

    return `
      <article class="media-card">
        <div class="preview">
          ${preview}
        </div>

        <div class="card-body">
          <div class="card-meta">
            <span class="category-tag">
              ${escapeHtml(categoryName(file.category))}
            </span>

            <span>${escapeHtml(niceDate(file.created_at))}</span>
          </div>

          <h3>${escapeHtml(file.title || "Untitled")}</h3>

          <div class="description">
            ${escapeHtml(file.description || "No description provided.")}
          </div>

          ${downloadLink}
        </div>
      </article>
    `;
  }).join("");
}

// --------------------------------------------------
// SEARCH AND CATEGORY FILTERS
// --------------------------------------------------

$("search")?.addEventListener("input", renderGallery);

$("category-filters")?.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");

  if (!button) return;

  activeCategory = button.dataset.category;

  document.querySelectorAll(".filter").forEach(filter => {
    filter.classList.toggle("active", filter === button);
  });

  renderGallery();
});

// --------------------------------------------------
// ADMIN LOGIN
// --------------------------------------------------

const dialog = $("admin-dialog");

function showAdmin(isLoggedIn) {
  if ($("login-panel")) {
    $("login-panel").hidden = isLoggedIn;
  }

  if ($("upload-panel")) {
    $("upload-panel").hidden = !isLoggedIn;
  }

  if ($("login-error")) {
    $("login-error").textContent = "";
  }
}

$("admin-open")?.addEventListener("click", () => {
  showAdmin(!!auth.currentUser);

  if (dialog && !dialog.open) {
    dialog.showModal();
  }
});

// Monitor Firebase authentication.

onAuthStateChanged(auth, async user => {
  showAdmin(!!user);

  if (user) {
    try {
      // Refresh token so the latest custom claims are included.
      await user.getIdToken(true);
    } catch (error) {
      console.error("Token refresh error:", error);
    }
  }
});

// --------------------------------------------------
// LOGIN FORM
// --------------------------------------------------

$("login-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("admin-email").value.trim();
  const password = $("admin-password").value;

  $("login-error").textContent = "Checking your login...";

  try {
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    await result.user.getIdToken(true);

    $("login-error").textContent = "";
    showAdmin(true);

  } catch (error) {
    console.error("Login error:", error);

    $("login-error").textContent =
      error.code === "auth/invalid-credential"
        ? "Incorrect email or password."
        : error.message;
  }
});

// --------------------------------------------------
// LOGOUT
// --------------------------------------------------

$("logout")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showAdmin(false);
  } catch (error) {
    console.error("Logout error:", error);
  }
});

// --------------------------------------------------
// UPLOAD MEDIA
// --------------------------------------------------

$("upload-form")?.addEventListener("submit", async event => {
  event.preventDefault();

  const file = $("media-file").files[0];

  if (!file) {
    $("upload-status").textContent = "Please select a file.";
    return;
  }

  const user = auth.currentUser;

  if (!user) {
    showAdmin(false);
    $("upload-status").textContent =
      "Please sign in first.";

    return;
  }

  const category = $("media-category").value;

  const expectedType =
    category === "Videos" ? "video/" :
    category === "Audio" ? "audio/" :
    "image/";

  if (!file.type.startsWith(expectedType)) {
    $("upload-status").textContent =
      `Please select a valid ${category.toLowerCase()} file.`;

    return;
  }

  const button = $("upload-button");
  const bar = $("progress-bar");

  button.disabled = true;

  if (bar) bar.style.width = "10%";

  $("upload-status").textContent = "Preparing upload...";

  try {
    // Refresh Firebase token before upload.
    await user.getIdToken(true);

    const safeName = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .slice(-100);

    const path = `${crypto.randomUUID()}-${safeName}`;

    $("upload-status").textContent = "Uploading to Supabase...";

    if (bar) bar.style.width = "40%";

    // Upload actual file to Supabase Storage.
    const { error: uploadError } =
      await storageClient.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false
        });

    if (uploadError) throw uploadError;

    if (bar) bar.style.width = "80%";

    // Get public file URL.
    const { data: publicData } =
      storageClient.storage
        .from(BUCKET)
        .getPublicUrl(path);

    const publicUrl = publicData.publicUrl;

    // Save file information in Firestore.
    await addDoc(collection(db, "media_files"), {
      title: $("media-title").value.trim(),
      description: $("media-description").value.trim(),
      category: mediaKind(category),
      original_name: file.name,
      storage_path: path,
      public_url: publicUrl,
      created_at: serverTimestamp()
    });

    if (bar) bar.style.width = "100%";

    $("upload-status").textContent =
      "Success! Your file has been added to the gallery.";

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
// START WEBSITE
// --------------------------------------------------

loadFiles();
