(() => {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  const $ = id => document.getElementById(id);
  $("year").textContent = new Date().getFullYear();
  $("creator-name").textContent = cfg.CREATOR_NAME || "The site owner";
  $("mobile-menu").addEventListener("click", () => $("main-nav")?.classList.toggle("open"));
  // Navigation menu works on small screens.
  document.querySelector(".mobile-menu").addEventListener("click", () => document.querySelector(".nav").classList.toggle("open"));
  document.querySelectorAll(".nav a").forEach(a => a.addEventListener("click", () => document.querySelector(".nav").classList.remove("open")));

  if (!configured || !window.supabase) {
    $("gallery").innerHTML = '<div class="empty-state">Your website design is ready. Connect Supabase using the beginner guide in README.md to show real uploaded files.</div>';
    $("admin-open").addEventListener("click", () => alert("First connect Supabase by following README.md."));
    $("file-count").textContent = "0";
    return;
  }

  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const BUCKET = "media";
  let allFiles = [];
  let activeCategory = "All";

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const niceDate = value => new Date(value).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});
  const mediaKind = category => category === "Videos" ? "video" : category === "Audio" ? "audio" : "image";

  async function loadFiles() {
    $("gallery").innerHTML = '<div class="empty-state">Loading the collection…</div>';
    const {data,error} = await client.from("media_files").select("*").order("created_at",{ascending:false});
    if (error) {
      $("gallery").innerHTML = '<div class="empty-state">We could not load the gallery. Please check the setup guide.</div>';
      $("status").textContent = error.message;
      return;
    }
    allFiles = data || [];
    $("file-count").textContent = allFiles.length;
    render();
  }

  function render() {
    const q = $("search").value.trim().toLowerCase();
    const visible = allFiles.filter(f =>
      (activeCategory === "All" || f.category === activeCategory) &&
      [f.title,f.description,f.category].some(v => String(v || "").toLowerCase().includes(q))
    );
    if (!visible.length) {
      $("gallery").innerHTML = '<div class="empty-state">No media found. Try another search or category. New uploads will appear here.</div>';
      return;
    }
    $("gallery").innerHTML = visible.map(f => {
      const kind = mediaKind(f.category);
      const preview = kind === "image"
        ? `<img src="${escapeHtml(f.public_url)}" alt="${escapeHtml(f.title)}" loading="lazy">`
        : kind === "video"
          ? `<video src="${escapeHtml(f.public_url)}" controls preload="metadata"></video>`
          : `<div class="audio-art">♫</div><audio src="${escapeHtml(f.public_url)}" controls preload="metadata"></audio>`;
      return `<article class="media-card"><div class="preview">${preview}</div><div class="card-body">
        <div class="card-meta"><span class="category-tag">${escapeHtml(f.category)}</span><span>${niceDate(f.created_at)}</span></div>
        <h3>${escapeHtml(f.title)}</h3><div class="description">${escapeHtml(f.description || "No description provided.")}</div>
        <a class="download" href="${escapeHtml(f.public_url)}" download="${escapeHtml(f.original_name || f.title)}" target="_blank" rel="noopener">↓ &nbsp; Download file</a>
      </div></article>`;
    }).join("");
  }

  $("search").addEventListener("input",render);
  $("category-filters").addEventListener("click",e => {
    const button = e.target.closest("[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    document.querySelectorAll(".filter").forEach(b => b.classList.toggle("active",b === button));
    render();
  });

  const dialog = $("admin-dialog");
  $("admin-open").addEventListener("click",async () => {
    const {data} = await client.auth.getSession();
    showAdmin(!!data.session);
    dialog.showModal();
  });
  function showAdmin(isLoggedIn) {
    $("login-panel").hidden = isLoggedIn;
    $("upload-panel").hidden = !isLoggedIn;
    $("login-error").textContent = "";
  }
  client.auth.onAuthStateChange((_event,session) => {
    if (dialog.open) showAdmin(!!session);
  });

  $("login-form").addEventListener("submit",async e => {
    e.preventDefault();
    $("login-error").textContent = "Checking your login…";
    const {error} = await client.auth.signInWithPassword({
      email:$("admin-email").value.trim(),password:$("admin-password").value
    });
    $("login-error").textContent = error ? error.message : "";
    if (!error) showAdmin(true);
  });

  $("logout").addEventListener("click",async () => {
    await client.auth.signOut();
    showAdmin(false);
  });

  $("upload-form").addEventListener("submit",async e => {
    e.preventDefault();
    const file = $("media-file").files[0];
    if (!file) return;
    const category = $("media-category").value;
    const expected = category === "Videos" ? "video/" : category === "Audio" ? "audio/" : "image/";
    if (!file.type.startsWith(expected)) {
      $("upload-status").textContent = `Please choose a ${category.toLowerCase()} file for this category.`;
      return;
    }
    const {data:sessionData} = await client.auth.getSession();
    const session = sessionData.session;
    if (!session) { showAdmin(false); return; }

    const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-100);
    const path = `${crypto.randomUUID()}-${safeName}`;
    const endpoint = `${cfg.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;
    const button = $("upload-button");
    const bar = $("progress-bar");
    button.disabled = true; bar.style.width = "0%";
    $("upload-status").textContent = "Starting upload…";

    try {
      await new Promise((resolve,reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST",endpoint);
        xhr.setRequestHeader("apikey",cfg.SUPABASE_ANON_KEY);
        xhr.setRequestHeader("Authorization",`Bearer ${session.access_token}`);
        xhr.setRequestHeader("Content-Type",file.type || "application/octet-stream");
        xhr.upload.onprogress = ev => {
          if (ev.lengthComputable) {
            const percent = Math.round(ev.loaded / ev.total * 100);
            bar.style.width = percent + "%";
            $("upload-status").textContent = `Uploading… ${percent}%`;
          }
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
        xhr.onerror = () => reject(new Error("Network error. Please try again."));
        xhr.send(file);
      });
      const {data:{publicUrl}} = client.storage.from(BUCKET).getPublicUrl(path);
      const {error:insertError} = await client.from("media_files").insert({
        title:$("media-title").value.trim(),description:$("media-description").value.trim(),
        category,original_name:file.name,storage_path:path,public_url:publicUrl
      });
      if (insertError) throw insertError;
      $("upload-status").textContent = "Success! Your file is now in the gallery.";
      $("upload-form").reset(); bar.style.width = "100%";
      await loadFiles();
    } catch (err) {
      $("upload-status").textContent = `Upload error: ${err.message}`;
    } finally { button.disabled = false; }
  });

  loadFiles();
})();
