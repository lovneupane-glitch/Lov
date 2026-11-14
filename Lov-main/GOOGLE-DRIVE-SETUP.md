# My Media Gallery — Google Drive hybrid storage setup

## What changed
- Existing Supabase media records remain in Firestore and continue using their existing `public_url`.
- New uploads are sent to the Google Drive account selected during the Google authorization popup.
- Firestore stores the Drive file ID, provider name, MIME type, and public URL for each new upload.
- The existing HTML structure, CSS, Firebase Authentication, Firestore gallery, favorites, viewer, and developer-information features are retained.

## Before publishing
1. In Google Cloud Console, make sure Google Drive API is enabled for the same project as the OAuth client.
2. Confirm the OAuth consent screen includes `https://www.googleapis.com/auth/drive.file`.
3. While the OAuth app is in Testing, add the Google account that will store gallery files as a test user.
4. In the OAuth Web client, authorize this JavaScript origin exactly: `https://lovneupane-glitch.github.io`.
5. Confirm `config.js` contains your Web Client ID in `GOOGLE_CLIENT_ID`. The Client ID is public; do not add a client secret or access/refresh token to this repository.
6. Commit the updated files to the same GitHub Pages branch/folder used by the live site.

## First upload test
1. Open the published site and sign in using the existing Firebase administrator account.
2. Choose a small test image first.
3. Click Upload Media. A Google authorization popup should appear.
4. Select the Google account added as an OAuth test user and approve the requested Drive permission.
5. After upload, check Google Drive for the file and check Firestore `media_files` for a document with `storage_provider: "google_drive"`.
6. Open the public gallery in a signed-out/private browser window to verify visitor access.

## Important privacy and limitations
- This implementation grants public read access (`anyone` / `reader`) to each uploaded media file so gallery visitors can view it without signing in. Do not upload private or personal media.
- The Google OAuth access token is held in page memory for the upload flow; it is not written to Firestore, local storage, or this repository. Google authorization is requested when an administrator uploads.
- The `drive.file` scope limits the app to files it creates or files explicitly opened with the app; it does not grant broad access to the account's entire Drive.
- Google Drive's 15 GB free quota is shared with Gmail and Google Photos. Supabase's separate quota remains independent; this is not a single pooled 16 GB account.
- Google Drive is not a dedicated media CDN. Large videos/audio may have playback, bandwidth, download confirmation, or quota limitations. Test actual media types and sizes before relying on them.
- The progress bar shows upload stages, not byte-accurate network progress.
- If Drive upload succeeds but Firestore saving fails, the uploaded file may remain in Drive without a gallery record. Check Drive before retrying.

## Existing Supabase files
Do not delete the Supabase bucket or existing Firestore documents. The gallery continues to read the existing `public_url` field, so old media remains available while new media is stored in Drive.
