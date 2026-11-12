# My Media Gallery — Beginner Setup Guide

Welcome! You do NOT need to know programming to follow this guide. The website source code is included in this folder. You do NOT need a social-media account. You only need an email address to create the hosting and database accounts.

## What you are building

- A public website visitors can open without signing in.
- Visitors can search and filter videos, audio, and photos.
- Visitors can play/view and download public files.
- A private Admin login lets only your chosen account upload files.
- Upload progress, file descriptions, and newest-first ordering.
- Homepage, About section, creator name, and FAQ.

## Before you start: what you need

1. An email address you can open.
2. A phone or computer with internet.
3. About 30–60 minutes for the first setup.
4. This project folder.

No Facebook, Instagram, TikTok, or other social account is needed.

## PART A — Make your database and admin login (Supabase)

Supabase stores your media files and checks the admin login.

### Step 1: Create your Supabase account
1. Open https://supabase.com/ in Chrome.
2. Press **Start your project** (or Sign up).
3. Choose email sign-up, enter your email and create a password. If asked, verify your email.
4. Sign in.

### Step 2: Create a project
1. Press **New project**.
2. Choose an organisation (create one if it asks).
3. Project name: `my-media-gallery`.
4. Create a strong database password. Save it somewhere private; this is NOT your website admin password.
5. Choose a region close to Nepal if available.
6. Press **Create new project** and wait until it finishes.

### Step 3: Create your admin login
1. In the left menu, choose **Authentication**.
2. Open **Users**.
3. Press **Add user** / **Create new user**.
4. Enter your admin email and a strong password. This is the login you will use on your website.
5. Create the user.
6. Find the new user in the list and copy their **User UID** (a long ID made of letters and numbers). Keep this page open.

### Step 4: Set up the database rules
1. In the left menu, open **SQL Editor**.
2. Choose **New query**.
3. On your phone, open the file `supabase-setup.sql` from this project using a text editor. On a computer, open it with Notepad.
4. Find the words `PASTE-ADMIN-USER-UUID-HERE`.
5. Replace those words (keep the single quote marks around the ID) with the User UID you copied in Step 3.
   Example only: `select auth.uid() = '12345678-abcd-1234-abcd-123456789012'::uuid;`
6. Copy ALL the text in `supabase-setup.sql` and paste it into the Supabase SQL Editor.
7. Press **Run**. It should complete without an error. If it shows an error, stop and ask for help rather than guessing.

### Step 5: Create the file storage bucket
1. In Supabase left menu, open **Storage**.
2. Press **New bucket**.
3. Bucket name must be exactly `media` (all lowercase).
4. Turn **Public bucket** ON.
5. Create/save the bucket.

The bucket is public so visitors can see and download the media you choose to publish. Do not upload private photos or documents.

### Step 6: Copy the website connection details
1. In Supabase, open **Project Settings** (gear icon).
2. Find **API** or **Data API / API Keys**.
3. Copy the **Project URL**.
4. Copy the **anon / publishable public key**. It may be labelled `anon` or `publishable`.
5. Do NOT copy a `service_role`, `secret`, or private key.

## PART B — Connect the source code

### Step 7: Open the project files
1. Extract/unzip `my_media_gallery_complete.zip`.
2. Open the folder named `my_media_gallery_complete`.
3. Find `config.js`.
4. Open it with a text editor (Notepad on Windows; a plain-text editor on a phone).
5. Replace `https://YOUR-PROJECT.supabase.co` with your Project URL.
6. Replace `YOUR_SUPABASE_ANON_KEY` with your anon/publishable public key.
7. Change `The site owner` to the creator name you want displayed.
8. Save the file.

Do not paste your admin password or database password into `config.js`.

## PART C — Put the website on the internet (Netlify)

Netlify publishes your website so visitors can open it.

### Step 8: Create a Netlify account
1. Open https://www.netlify.com/.
2. Choose Sign up.
3. Sign up with email if available. You do not need a social account.
4. Verify your email and sign in.

### Step 9: Publish the website folder
1. Open https://app.netlify.com/drop (Netlify Drop).
2. On a computer, drag the entire `my_media_gallery_complete` folder onto the upload area.
3. On a phone, if folder upload is unavailable, use a computer or another supported deployment method; do not upload only the ZIP as if it were a website page.
4. Wait for Netlify to publish it.
5. Netlify gives you a website address ending in `netlify.app`. Open it. That is your public website link.

### Step 10: Test everything
1. Open the public site link in a private/incognito browser tab (signed out).
2. Check that the homepage and gallery open.
3. Press **Admin login**.
4. Enter the admin email and password you created in Supabase.
5. Upload a small test photo first. Choose Photos as category and enter a title.
6. Sign out. Check that the photo is visible to a visitor and can be downloaded.
7. Test audio and video with small files.

## PART D — How to use it after setup

- To upload: open your website → Admin login → enter your admin email/password → choose a file → title → category → description → Upload.
- To let people visit: send them your Netlify website address. You do not need to create social media accounts.
- To change creator name: edit `CREATOR_NAME` in `config.js`, save, and upload the updated folder to Netlify again.

## Important safety and cost notes

- Free plans have storage, bandwidth, and file-size limits. These limits can change. Check Supabase and Netlify pricing/limits before uploading many large videos.
- Public means anyone with the site or file link may view/download published files. Never upload private or sensitive content.
- Only the one Supabase User UID inserted into the SQL function is allowed to upload through the website policies. Keep your admin login private.
- Do not share your Supabase database password, admin password, or secret/service-role keys.
- This starter version has no visitor accounts and no social login.
- If you want to change the website address to a custom domain later, that is an optional separate step.

## If something goes wrong

Take a screenshot of the page/error (hide passwords and secret keys) and ask for help. Tell us which step number you reached.
