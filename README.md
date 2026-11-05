# DeID Pad (offline clinical text de-identifier)

> **IMPORTANT:** This is a **rule-based** (regex/heuristic) tool. It is **NOT a certified de-identification** and it does not guarantee HIPAA Safe Harbor compliance. **Read every output before you use or share it.** It will miss some identifiers (unusual names, free-text locations, rare ID formats). It can also over-redact clinical text.

## Version 1.7.0: rebuilt detection engine (November 2026)

Earlier versions were mostly label-driven regular expressions. They let patient names, dates of birth, family names, phone numbers and towns through whenever a note did not use the expected labels, for example lowercase dictation, OCR typos and spelled-out numbers. Version 1.7.0 replaces the detection engine (`deid-engine.js` + `deid-lexicon.js`, built into `index.html`). Formatting, AI note, queue and export features are unchanged.

### Root causes fixed
- **DOB/age bug:** "date of birth 01/…" could be read as year 2001, which gave a wrong age. Spoken DOBs ("march fourth nineteen thirty one") were not parsed.
- **Labels only:** names were removed only after labels such as "Patient:" or "Dr.". Prose such as "daughter marisol quenby", "husband ozwald came in" or "patient is gertrude plimsoll" leaked, and so did lowercase speech-to-text (STT) output.
- **Spelled-out numbers:** spoken phone numbers, IDs and dates ("three oh two five five five…", "alpha bravo seven seven…") were not detected.
- **OCR damage:** OCR typos defeated label matching ("Har0Id", "Ivers0n").
- **Medical-suffix filter:** this filter stopped real names and towns that happen to end like drug or disease words ("harrowgate falls").
- **Weak location matching:** towns were caught only next to a state or ZIP.
- **Facility default:** "Remove facility names" was **off** by default.
- **No final check:** nothing re-checked the output before copy or send.

### Engine layers (fail-closed)
1. **Session known terms.** The "Redact these exact terms" box removes the listed terms, including close misspellings, and handles "Patient:/DOB:/Daughter:" prefixes. It is held in page memory only: never written to storage, and wiped by Clear all or by closing the page.
2. **Patterns.** Covers emails, URLs, IPs, labelled and unlabelled IDs, digit and spoken phone numbers, numeric, written and spoken dates, ages over 89, and street addresses.
3. **Dictionaries.** About 120k common English and medical words with their frequency, US first and last name lists, a town gazetteer (strongest for DE/MD/PA/NJ), and facility words.
4. **Context triggers.** These include patient/pt/resident, kin words (daughter, son, husband, POA…), clinician titles, "lives with … in X", "lives/moved/visits from X", "Lake/Mount/Port X", "Last, First", and labels. Names are grouped so each person keeps one token throughout the note.
5. **Over-redaction on purpose.** When unsure, the engine removes the word and marks it with `?` (for example `[NAME-1?]`). Every removal is highlighted under the output. Tap a highlight to put the original back, and tap it in the "Put back" list to remove it again.
6. **Final leak check.** Copy, Copy note, Send to my AI, queue Send/Copy, Save/export, Send to MA and Complete all re-scan the exact outgoing text. If anything still looks like an identifier, the action is **blocked**. A dialog lists what was found, with "Redact all and continue", a "Not an identifier" button per item, and Cancel. If the engine throws an error, the action is blocked.
7. **Stable tokens.** Within a session the same person keeps the same token across notes. The token-to-name map exists only in page memory and is wiped by Clear all.

**Why there is no machine-learning NER model:** a useful clinical NER model is tens to hundreds of MB. It would make this offline iPhone web app slow to load and to run, and it would need its own validation. Small browser models also do poorly on lowercase dictation, which is where most leaks happened. The rules above are deterministic, fast and tested against the corpus below. They are not perfect.

### Accuracy on a synthetic (fake) corpus. This is not a certification.
All documents are invented by `tools/gen-corpus.js`. **No real patient data was used.** The corpus mixes typed notes, ALL-CAPS notes, OCR-damaged text and lowercase dictation. There are 1,135 documents in total (dev 335, held-out 150 + 200 + 200 + 250).

Headline: **the final held-out set** (250 documents, new name/town/street pools). The recall numbers are from its **first, untuned run**. A later fix for multi-word towns raised Locations from 96.1% to 96.9%. Precision is from the current build.

| Category | Recall (first run) | Span precision |
|---|---|---|
| Names | 99.5% (1459/1467) | 97.6% |
| Dates of birth | 100% (273/273) | 93.3% (all dates)* |
| Other dates | 100% (194/194) | |
| Phones/fax | 100% (337/337) | 100% |
| Street addresses/ZIP | 100% (207/207) | 100% |
| Towns/cities | 96.1% (247/257) | 98.7% |
| IDs (MRN/SSN/insurance/plate…) | 100% (379/379) | 100% |
| Email/URL/IP | 100% (151/151) | 100% |
| Facilities | 100% (185/185) | 100% |
| Ages over 89 | 100% (81/81) | 87.8%** |
| **All identifiers** | **99.5% (3513/3531)** | word precision 98.1% |

\* Date false hits are almost all the given name "June" read as the month. \** Most "false" age hits are real ages over 89 that the generator did not label.

- **Over-redaction:** 0.7% of non-identifier words are removed. Most often these are june, joy, pa, de, park and will.
- **By style:** OCR 100%, ALL-CAPS 100%, typed 99.7%, lowercase dictation 98.6%. Dictation is the weakest.
- **Sets used for tuning:** dev 99.9%, novel 99.9%, fresh 99.6%, fresh2 99.5%. These were looked at while tuning, so they overstate accuracy.
- Reproduce: `node tools/eval.js corpus/heldout-final.json` and `node tools/precision-by-cat.js corpus/heldout-final.json`.

### Known weaknesses (read these)
- **Common words used as names in lowercase dictation** ("juniper comes in", "husband lark") can be missed. When there is no capital letter the engine cannot tell them from ordinary words. Put the patient's and family's names in "Redact these exact terms" first.
- **Multi-word towns made of common words** ("Rock Hall") are missed unless they are in the gazetteer or follow "lives in".
- **Over-redaction** of names that are also words (June, Joy, Will, Grant, Hope) and of state codes (PA, MD, DE). The leak check can also flag a capitalized normal word at the start of a sentence ("Hope", "Pain"); tap "Not an identifier".
- **"Redact all" in the leak dialog** replaces the flagged text only where it appears exactly as flagged.
- **Synthetic corpus only.** Real notes will contain patterns the generator never produced. 99.5% recall still means roughly 1 identifier in 200 can be missed.
- Not handled: biometrics, photos, unique characteristics described in free text, and non-US address/phone formats.
- Requires iOS Safari 16.4+ or a current browser. The page is about 2 MB (about 0.7 MB compressed) because of the dictionaries.
- Automated browser tests run in Chromium with an iPhone screen size, not on a real iPhone.
- **This is not HIPAA Safe Harbor certification or expert determination.** Glance at every output.

## Run
- **Simplest (paste only):** double-click `index.html`. De-identification works offline. Dictation and OneDrive export need the page served over `http://localhost` or https (use `node serve.js`).
- **Desktop app (Electron):** `npm install && npm start`. All non-file requests are blocked. It uses a persistent partition so the text draft survives closing the window; cookies, caches and other storage are cleared on close, and the draft is removed only by **Clear all**.
- **Local server (recommended on the Mac):** `node serve.js` → open **http://localhost:5175**
- **Tests:** `npm test` runs `test/deid.test.js` (v1.7 engine regressions), `test/test.js` (de-identification), `test/tx.test.js` (transcription/AI/share/Graph builders with mocked fetch, plus the share server) and `test/note.test.js` (AI Note leak guard, response redaction, compliance guardrails, Document-ID filenames, save helper) and `test/draft.test.js` (draft persistence: save, restore, auto-clear, Clear all wipes every draft key, no keys/audio/images stored) and `test/queue.test.js` (Review queue: save/restore, Clear all, leak guard, OpenAI request with `store:false`, Why-this-level checks, Not documented, wipe on finish). Optional: `test/e2e-persist.py` (Playwright: type, reload, restore, Clear all, reload, empty; `python test/e2e-persist.py http://localhost:5175/`). Optional: `test/queue-screens.js` (headless Chrome, fake patients in demo mode, writes `demo/queue-*.png`; serve `../deid-pad-site` on http://localhost:5199 first). Optional: `test/e2e-browser.js` (headless Chrome end-to-end) and `test/demo-screens.js` (writes `demo/*.png` with fake data and a mocked OpenAI reply). Browser test for v1.7: `node test/e2e-deid17.js` (desktop + iPhone-size viewport, fake data).
- **Editing:** change `deid-engine.js`, `build/tx.js` (integrations), `build/queue.js` (Review queue logic), `build/queue-ui.js` (Review queue screens) or `build/app.html` (UI). Then run `node build/build.js`. That regenerates `index.html` and `deid-transcribe.js` and syncs `../deid-pad-site` (bump `C` in `sw.js` when you ship).

## Privacy
**Entered text is saved on this device until you tap Clear all.** So that an accidental refresh, a discarded tab, an iOS Safari reload or relaunching the Home Screen app does not lose work, the app autosaves a draft (300 ms after each change, and immediately when the page is hidden or closed) to this browser's `localStorage` under the key `deidpad.draft.v1`. The draft contains only these fields: the Paste pane (including dictation transcripts and inserted scanned-page text), the de-identified output pane, the AI note, patient name/MRN, MA label, Document ID, Progression text, the always-remove list, and the AI-note checkboxes/template. It is restored on load before the page is shown, and the output is regenerated from the Paste pane. A green status line under the warning bar shows "Draft saved on this device (time). Cleared only when you tap Clear all".

- **Not saved:** audio (a recording in progress, and held/failed audio chunks are lost on refresh), scanned images and OCR word boxes, API keys and PINs (unless you tick *Remember on this device*, unchanged and off by default), M365 tokens (memory only). The browser asks you to confirm leaving the page while recording, while chunks are being transcribed or held, while scanned pages are open, or if the draft could not be saved. iOS Safari ignores that prompt, so stop the recording before you switch apps.
- **Clear all** stops recording, aborts in-flight requests and wipes the audio, transcript, both panes, the AI note, patient name/MRN, MA label, Document ID, always-remove list and scanned pages, and deletes every `deidpad.draft.*` key. Closing the tab or window no longer clears anything.
- **Optional auto-clear:** Settings → Device → *Auto-clear saved draft* (Off by default; 1/4/8/12/24 h without edits). This preference (no patient data) is kept under `deidpad.draftprefs.v1`.
- **HIPAA trade-off:** the draft is PHI at rest in the browser profile, in plain text (not encrypted by the app). Anyone who can use this browser profile or device can read it. Use the app only on a device with a passcode/login, auto-lock and full-disk encryption (FileVault on the Mac, an iOS passcode, which also turns on iOS data protection). On a shared workstation, tap **Clear all** when you finish each patient, or turn on auto-clear. A private/incognito window drops the draft when it closes. Safari may delete website data for sites you have not opened for 7 days (Home Screen apps are exempt).
- There is no telemetry. The service worker caches only the app files; it never sees the draft. Network access is limited by the page CSP `connect-src` to: `https://*.openai.azure.com`, `https://api.openai.com`, `http://127.0.0.1:*`, `http://localhost:*`, `http://*:5180` (the share server, and the app also requires a private-LAN IP), `http://*:5181` / `https://*:5181` / `https://*.ts.net` (the Mac save helper; the app also requires a private-LAN, Tailscale or loopback address), `https://login.microsoftonline.com` and `https://graph.microsoft.com`. Saving the draft locally does not change the CSP: nothing more can leave the device. The "removed" panel is shown in the app only and is never copied.

## What it does
- Removes names, dates, addresses, towns, phone and fax numbers, emails, IDs (MRN, account, SSN, insurance, NPI…), URLs, IPs and facility names (keeping facilities is an opt-in, not recommended).
- Writes `Demographics (non-identifying): age N, sex male/female` at the top. Age comes from DOB and the visit date (or today), and ages over 89 become `90+`. Sex/Gender header fields are removed.
- Formats the remaining text: section headings (Chief Complaint, HPI, PMH, Medications, Allergies, Exam, Imaging, Labs, Assessment/Plan), bulleted meds/labs/allergies, collapsed whitespace, and no boilerplate or empty/identifier-only fields.

## Limitations
- Names are caught from labels, titles, kin/patient/clinician cues, name dictionaries and the known-terms box. See "Known weaknesses" in the 1.7.0 section for what is still missed.
- A bare year that is followed by punctuation becomes [DATE] (for example "PCI 2019"). Other bare years may survive.
- Towns in prose are found from a gazetteer and context ("lives in X"); multi-word common-word towns can still be missed. ZIP/state detection is biased to US formats.
- Biometrics, photos and free-text unique characteristics are not handled.
- Section detection depends on common heading labels.

---

## Send to my AI (version 1.6.0): one tap to ChatGPT, Gemini, Grok or Perplexity

Under the **De-identified output** box (and in the Review queue: "Send de-identified dictation + report" and "Send draft"):

1. Choose the AI, then the saved project / gem / space, then (optional) a saved instruction such as your Appendix A note instruction.
2. Tap **Send to …**. The app checks the text again for identifiers. If any remain it shows **NOT SENT** and lists them; nothing is copied or opened.
3. Otherwise it copies the instruction + de-identified text and opens your own account at that project. A message says **"Copied — paste (hold → Paste) and send"**.
   For a plain new chat with short text (1500 characters or less) the text is also put in the web address: ChatGPT fills it in (tap Send), Grok and Perplexity start answering. Gemini, and every project/gem/space page, always use paste.

**Destinations & instructions…** lets you add, edit, delete destinations (name + address copied from the address bar), pick one default (★) per AI, and save instructions. The last AI/project/instruction used is remembered. These settings are kept on this device and hold no patient information. The raw (left) box is never sent.

A one-time safety notice (can be shown again or before every send) explains: consumer accounts generally have **no BAA**; de-identification is **rule-based, not certified**; turn off training in each account:
- ChatGPT: Settings → Data controls → turn off "Improve the model for everyone" (https://help.openai.com/en/articles/7730893-data-controls-faq)
- Gemini: turn off "Keep Activity" (https://myactivity.google.com/product/gemini, https://support.google.com/gemini/answer/13594961)
- Grok: Settings → Data → turn off "Improve the Model"; app: Settings → Data Controls (https://x.ai/legal/faq)
- Perplexity: Account settings → Preferences → turn off "AI data retention" (https://www.perplexity.ai/help-center/en/articles/11564572-data-collection-at-perplexity)

Address formats used: `https://chatgpt.com/?q=…` (prefill, not official/documented), `https://grok.com/?q=…` (prefill + auto-send, not official), `https://www.perplexity.ai/search?q=…` (auto-runs, not official), Gemini has no URL prefill. Project/gem/space addresses you paste (e.g. `https://chatgpt.com/g/g-p-…/project`, `https://gemini.google.com/gem/…`, `https://grok.com/project/…`, `https://www.perplexity.ai/spaces/…`) are opened exactly as saved. Providers can change these without notice.

Tests: `node test/export.test.js` (in `npm test`); browser: `BASE=http://localhost:5175/ CHROME=… PW=… node test/e2e-llm.js` (mocks window.open and clipboard). Screenshots: `demo/5-llm-*.png`.

## Scan with camera (version 1.5.0): photograph a paper report, text is read on this device

**On iPhone:** open https://teamtalk360.github.io/deid-pad/ in **Safari**, tap **Share → Add to Home Screen** so it opens like an app (and is not cleared by Safari after 7 days).

1. Tap **📷 Scan with camera** (top of the main page), or **📷 Scan document** next to *Outside report* in the Review queue.
2. Tap **📷 Take photo**. The first time, iPhone asks to allow the camera: tap **Allow**. iPhone may offer *Take Photo* or *Photo Library*. Hold the page flat, fill the frame, good light, no shadow.
3. After the first page, the button says **📷 Add another page** — repeat for each page. **🖼 Choose from Photos** picks one or several existing photos/screenshots.
4. A progress bar shows the reading (about 2–10 s per page; the very first scan loads ~7 MB of text-recognition files). Sideways photos are auto-rotated.
5. Check and correct the recognized text in the box. The **De-identified preview** below shows what the app will use.
6. Tap **Insert all pages** (into the main text box, de-identified on the right), or **Insert + Review queue (outside report)** to also start a queue patient with this as the outside report (or, if you came from the queue, add it to that patient).

**Privacy:** text recognition is Tesseract.js, self-hosted in this site (`vendor/tesseract`); there is no cloud OCR (no Microsoft, Google or other service), and the page's CSP blocks other hosts. Photos are kept only in memory (never saved, never uploaded) and are wiped, together with the OCR worker, when you insert all pages, tap **Done** or **Clear all**. Only the text you insert is saved, like any typed text, until Clear all.

**Offline:** the service worker (cache `deid-pad-v7-scan`) pre-caches the OCR files on first load, so scanning works without a network afterwards.

**Photos:** large photos (12–48 MP) are downscaled to about 2000 px on the long edge; the EXIF orientation of iPhone photos is respected. HEIC: Safari converts camera photos to JPEG; if a HEIC from Photos cannot be opened on another browser, set iPhone *Settings → Camera → Formats → Most Compatible*. PDFs are not read: screenshot the page first. Handwriting reads poorly.

**Tests:** `npm test` includes `test/scan.test.js`. `node test/e2e-camera.js` (Playwright/Chromium, fake patients only) generates fake CT/outside-record images (including a 4032×3024 sideways noisy JPEG), measures OCR accuracy, checks de-identification, the queue hand-off and image wipe, and writes `demo/5-camera-*.png` and `demo/ocr-accuracy.json`. `BASE=https://teamtalk360.github.io/deid-pad/ node test/e2e-camera.js` also tests the live site offline.

---

## Review queue (version 1.4.0): one card per patient, AI draft, you review and paste

Tap **☰ Review queue** at the top. Use it at the end of a session: add every patient, let the AI draft in the background, then go through them one at a time. The goal is about 3 minutes per patient.

**1. Add a patient** (**+ Add patient**)
- **Case label:** a short code with a number, like `A-03` or `Rm 4`. The app refuses names, dates of birth and record numbers here.
- **Setting:** Office, Hospital A, Hospital B or Nursing home. **Visit:** New patient or Established. These choose the code set (office 99202 to 99215, hospital 99221 to 99233, nursing facility 99304 to 99310).
- **Your dictation:** dictate with your keyboard microphone or paste. **Use text from the main page** copies what is in the main text box.
- **Outside report (optional):** paste it, or tap **Scan document** (text is read on this device).
- **Heard so far** ticks off what the app found: new/established, a problem with a status word, data with its source, a risk decision, the exam, and time (optional).
- **What will be sent to the AI** shows the exact de-identified text. Names, dates, record numbers, phone numbers and (in the queue) facility names are replaced by tokens like `[NAME]` on this device first. Tokens stay tokens.
- **Save & add next patient** saves and starts the AI draft (you can turn auto-start off in Settings).

**2. The queue table** shows each patient, the suggested level, how many things you still need to check, and a status: Waiting for draft, Needs answers, Lower level suggested, Ready, Approved. Across the top: how many are finished, your average review time against the 3:00 target, the projected finish time, and open questions. There is **no "approve all" button, on purpose**.

**3. Review one patient** (**Open**). The per-note timer runs while the screen is open and turns orange after 3:00.
- **Draft note** (left) is fully editable. Anything you didn't dictate is written as **"Not documented."**. The app lists those, and offers to add "Not documented." lines for any missing section. The AI is told never to invent facts.
- **1. Questions from the draft:** type short answers, then **Redraft with my answers**. Your answers are added to the dictation, so you can see exactly what was sent.
- **2. Confirm each status / risk word**, for example "threat to limb", "not at goal" or "worsening". Each one shows whether it is in your dictation. **Confirm** it, or **Remove from note**. You cannot approve until every one is confirmed or removed.
- **3. Why this level:** a check on this device of Problems, Data and Risk (2 of 3) and dictated time. It shows the evidence from your dictation for each column. If the AI draft (or a level you dictated, such as "level four") is higher than your dictation supports for 99204/99205 or 99214/99215, it says so in orange and suggests the lower level. Your own billed reads ("our lab, I read it") are not counted as data. It only ever tells you what would *lower* a level. It never suggests words to raise one. It is not coding advice: the coder confirms.
- **4. Approve, then paste:** choose the level you will bill (prefilled with the lower of the AI's level and the on-device estimate), then **Approve note**.

**4. Finish**
- **Copy note & finish** copies the note to the clipboard and **wipes that patient's text from the device**. Only a line with no text is kept: label, setting, level and review time. The next patient opens. Paste the note into the chart yourself.
- You can also copy one section at a time: HPI, Exam, A/P + MDM, Codes, Letter, Patient instructions or Orders.

**AI settings** (Settings → *Review queue: AI drafting*)
- **OpenAI API key:** your own key. It stays in memory only and is gone when you close the tab, unless you tick *Remember settings* under Device. If you leave it blank, the queue uses the OpenAI key from the AI note settings.
- **Endpoint** (default `https://api.openai.com/v1`), **API style** (Responses API with `store: false` by default, or Chat Completions), **Model** (default `gpt-6.1-sol`) and **Reasoning effort**. The queue refuses Microsoft/Azure endpoints and plain http (except a server on this computer). The page security policy only allows `api.openai.com` and local servers, so another OpenAI-compatible host also needs a change to the CSP in `build/app.html`.
- **Drafting instructions:** the Appendix A instructions, editable, with **Reset to Appendix A**.
- Before anything is sent, a second check runs over the label, dictation, report, your answers and the instructions. If it still finds a name, date of birth, record number or phone number, **nothing is sent** and the card shows what was found.

**Demo mode** (tick *Demo mode* in the queue): loads 5 **fake** patients (A-03, B-11, C-04, D-21, E-15) and drafts them on this device with no API key and no network. B-11 deliberately "overcalls" 99215 so you can see the lower-level warning, D-21 dictates "level four" when the dictation supports 99213, and A-03 and E-15 include fake outside reports with fake identifiers that are tokenized. Demo drafts are simple rearrangements of the dictation, not real AI.

**Saved on this device:** the queue (cards, drafts, answers and the finished lines) is saved in this browser under `deidpad.draft.queue.v1`, so a refresh doesn't lose it. It is removed when you finish each patient, when you tap **Clear all**, or by the auto-clear setting. API keys are never stored with it. Like the main draft, it is plain text in browser storage, so use a locked, encrypted device.

**Screenshots** (fake patients): `demo/queue-0-settings.png` through `demo/queue-9-iphone-size-review.png`.

**Limitations:** the E/M check is a rule-based estimate from words in your dictation. It does not model discharge codes (99238/99239), prolonged services, split/shared visits or modifiers. The real OpenAI path is covered by tests with a mocked response only.

## Scan documents (on-device OCR)
Tap **📷 Scan** to read labs, imaging reports or referral letters. On iPhone/iPad, **Camera / add page** opens the camera; **Choose photo / image** picks from Photos or Files. On a Mac you can also paste an image (⌘V) or drag and drop it. Add several pages one after another.

- Text recognition is Tesseract.js 6 (English, LSTM "best_int" model) running in a Web Worker in your browser. The engine, WebAssembly core and `eng.traineddata` are served from this site (`vendor/tesseract/`); no CDN or cloud OCR is contacted, and the page CSP still allows only this site. The OCR files are loaded only the first time you use Scan (about 7 MB; the service worker keeps them for offline use).
- Each photo is scaled to about 2000 px on the long edge, converted to grayscale and contrast-stretched (**Enhance**). **Auto-rotate** tries the other orientations when a page reads poorly; the rotate buttons fix it by hand.
- The recognized words are highlighted on the image (orange = low confidence). Tap a word to select it, drag across words to select a range, double-tap selects a line, or **Select all**. **Copy selection** puts it on the clipboard. **Insert into text box** appends it (or the editable text, if nothing is selected) to the paste pane under `--- Scanned page N ---`, and de-identification runs on it right away. **Insert all pages** does every page.
- Images and recognized text in the Scan view exist only in memory (canvases and variables). They are never saved or uploaded. Text you **Insert** into the Paste pane becomes part of the saved draft (see Privacy) until **Clear all**. **Clear all** wipes the pages and shuts down the OCR worker, and a refresh drops them.

Limitations: printed, reasonably flat and well-lit pages work well. **Handwriting is read poorly or not at all**, and so are faxes of faxes, tiny print, tables with ruled lines and curved or shadowed photos. Always check the text before relying on it, especially numbers (doses, ABIs, dates) and the orange boxes. PDFs are not read directly: screenshot or export the page as an image. The first Scan needs about 7 MB (a few seconds on Wi-Fi, longer on cellular) plus 1–3 s to start the engine; each page then takes a few seconds on a recent iPhone, longer with auto-rotate. Scanning needs the website or `node serve.js` (not the Electron/file:// build).

## Ambient dictation (Whisper)

Press **● Record**, talk (or let the visit run), then press **■ Stop**. The REC indicator and timer show while it records. Audio is cut into standalone chunks (default 25 s; set 10-60 s in Settings). The app restarts MediaRecorder for each chunk so every chunk is a complete file. Chunks are transcribed in order, the text is appended to the **Paste** pane, and de-identification re-runs into the right pane automatically. A failed chunk stays in memory, and **Retry failed** re-sends it (its text is appended at the end). The vocabulary hint and the last ~300 characters of transcript are sent as the Whisper `prompt` to keep context between chunks.

Open **⚙ Settings** and pick a backend. **Test connection** sends 1 s of silence to check it.


**One tap to record.** Record asks for the microphone inside the tap itself and starts as soon as you allow it; nothing reloads. If no transcription backend is set up yet, recording still starts, the audio is held in memory and a banner says "Set up transcription in Settings, or dictate with your keyboard". After setup, tap **Transcribe held audio**. The header shows the mic permission (Mic: allowed / will ask / blocked) where the browser reports it.
*iPhone/iPad tip:* to stop Safari asking every time, open the site, tap **aA** in the address bar > **Website Settings** > **Microphone** > **Allow** (or Settings > Apps > Safari > Microphone > Allow for teamtalk360.github.io). In the Home Screen app the prompt appears once. A new app version installs in the background and is used the next time you open the app; an open session is never reloaded.

### (a) Azure OpenAI Whisper (recommended; Microsoft BAA)
Microsoft's HIPAA BAA is part of the Microsoft Products and Services Data Protection Addendum (DPA) for in-scope services, and Azure OpenAI is one of them. Confirm this with your Microsoft agreement or admin.
1. Azure portal → **Create a resource → Azure OpenAI**. Use the practice's Microsoft tenant/subscription and pick a region that offers `whisper` (check *Model availability*; for example East US 2, North Central US, Sweden Central, West Europe). Network: "All networks" (or restrict to the office IP).
2. Open the resource in **Azure AI Foundry → Deployments → Deploy model → Deploy base model → `whisper`**. Name the deployment `whisper`. Whisper's default quota is low (a few requests per minute). 25-s chunks use about 2.4 requests/min; request more quota if you see HTTP 429. You can also deploy `gpt-4o-transcribe`, put its deployment name in the field, and use the api-version it lists (for example `2025-03-01-preview`).
3. Optional, for **Format with AI**: deploy a chat model (for example `gpt-4o`) and enter its deployment name.
4. **Resource → Keys and Endpoint**. Copy the endpoint `https://<name>.openai.azure.com` and **KEY 1** into Settings. The api-version is `2024-06-01`.
5. Optional: apply for **modified abuse monitoring** so prompts/audio are not kept for abuse review. Azure OpenAI does not train on your data.
- Request: `POST {endpoint}/openai/deployments/{deployment}/audio/transcriptions?api-version=…` with header `api-key`, multipart `file`.
- The CSP only allows `*.openai.azure.com`. If your resource only shows a `*.cognitiveservices.azure.com` endpoint (multi-service "AI Foundry" resource), either create a classic Azure OpenAI resource or add that host to the CSP in `build/app.html` and the `ALLOW` list in `main.js`.

### (b) OpenAI Whisper API: requires an OpenAI BAA and zero data retention
Use this only if the practice has a signed BAA with OpenAI and zero-data-retention is enabled for the project that owns the key. Choose model `whisper-1`, `gpt-4o-transcribe` or `gpt-4o-mini-transcribe`, and paste the key (`Authorization: Bearer`). Endpoint: `https://api.openai.com/v1/audio/transcriptions`.

### (c) Local whisper.cpp on your Mac (audio never leaves the Mac)
```bash
# 1. Install. Homebrew may or may not include the server binary, so check:
brew install whisper-cpp && which whisper-server
# If whisper-server is missing, build it (needs Xcode CLT + cmake; Metal acceleration is automatic on Apple Silicon):
git clone https://github.com/ggml-org/whisper.cpp && cd whisper.cpp
cmake -B build -DWHISPER_BUILD_SERVER=ON && cmake --build build -j --config Release
# 2. Model (~1.6 GB): large-v3-turbo is fast and accurate on M-series Macs
sh ./models/download-ggml-model.sh large-v3-turbo
#   (or: curl -L -o models/ggml-large-v3-turbo.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin)
# 3. Run, bound to loopback only
whisper-server -m models/ggml-large-v3-turbo.bin --host 127.0.0.1 --port 8080 -l en
#   (from a source build: ./build/bin/whisper-server …). Add --convert only if you turn off in-browser WAV conversion (needs: brew install ffmpeg).
```
In Settings choose **Local**. Set the URL to `http://127.0.0.1:8080/inference` and leave **Convert to 16 kHz WAV in browser** on: whisper-server only reads WAV unless started with `--convert`.

**CORS:** recent whisper-server builds send `Access-Control-Allow-Origin: *` and answer the OPTIONS preflight, so the page at `http://localhost:5175` can call it directly. If the browser console shows a CORS or "Private Network Access" error (older builds, or the https-hosted copy calling localhost), run the bundled proxy and point the app at it:
```bash
node whisper-proxy.js              # http://127.0.0.1:8081 → http://127.0.0.1:8080, adds CORS + Private-Network headers, logs nothing
# Settings → Local URL: http://127.0.0.1:8081/inference
```

### AI note (optional, off by default)
See **AI Note** below. It replaces the older "Format with AI (SOAP)" toggle; the SOAP layout is now the default template.

---

## Share to MA (office LAN, RAM only)
`share-server.js` runs on the office Mac/PC. The surgeon clicks **Send to MA** (with an optional short label such as initials or a room, max 24 characters). The note goes into an in-memory queue. The MA opens `http://<office-ip>:5180`, enters the PIN, clicks **Copy**, then **Done (delete)**.
```bash
SHARE_PIN=482913 node share-server.js          # auto-detects the LAN IPv4, port 5180, notes expire after 120 min
node share-server.js --host 192.168.1.20 --port 5180 --pin 482913 --ttl-min 60
# without a PIN it generates a random 6-digit PIN for the session and prints it
```
- It binds only to a private IPv4 (10.x, 172.16-31.x, 192.168.x; 127.x for testing) and refuses to start otherwise. Connections from non-private addresses are dropped.
- Every API call needs the PIN (`X-Share-PIN` header, constant-time compare). 8 wrong PINs from one IP lock that IP out for 5 min.
- Notes live only in a JavaScript `Map`. Nothing is written to disk and note content is never logged. Notes are deleted on Done, after the TTL (swept every 30 s and on every request), and when the server stops or restarts. Limits: 100 notes, 200 KB each.
- What is sent: the SOAP note if *Format with AI* is on and it isn't empty, otherwise the de-identified output pane. The app blocks the send if the note or label contains the patient name or MRN, or if the label looks like an identifier.
- In DeID Pad Settings → *Share to MA*, set the URL `http://<office-ip>:5180` and the PIN. The port must stay **5180** because the CSP allows only that port for LAN hosts.
- macOS will ask to allow incoming connections for `node`. Click Allow. Use the office staff network, not guest Wi-Fi: the traffic is plain HTTP on the LAN.

---

## Complete → OneDrive / SharePoint (Microsoft Graph)
Type or confirm **Patient name** and **MRN** in the toolbar. They are pre-filled from the raw pasted/dictated text: the engine reads them *before* redaction, and they are kept on this device only (in the saved draft until Clear all). Then click **✓ Complete → OneDrive**. The final note (the SOAP note if present, otherwise the de-identified output) is uploaded as `.docx` (or `.md`/`.txt`, set in Settings) and named `LastName_FirstName_MRN_YYYY-MM-DD.docx`, using the date of service if one was found, otherwise today. The name and MRN appear **only** in the filename and in the file's header lines. They are never added to the output pane, the MA queue, the AI request or any log. An existing file is never overwritten (`conflictBehavior=rename`).

### Create the Entra ID app registration (one time, in the practice's M365 tenant)
1. https://entra.microsoft.com → **App registrations → New registration**. Name: `DeID Pad`. Supported account types: **this organizational directory only**.
2. **Authentication → Add a platform → Single-page application**. Redirect URI: `http://localhost:5175/auth-redirect.html`. If you also use the hosted copy, add `https://<your-site>/auth-redirect.html`. Settings → *Export* shows the exact URI to register. Open the app at that same origin (`localhost`, not `127.0.0.1`).
3. **API permissions → Add → Microsoft Graph → Delegated → `Files.ReadWrite`**. For a SharePoint document library (drive ID set) also add `Files.ReadWrite.All`. Click **Grant admin consent** if your tenant requires it. No client secret is needed (public client, auth code + PKCE).
4. Copy the **Application (client) ID** and **Directory (tenant) ID** into Settings. Set the folder path (for example `Clinical Notes/DeID Pad`; create it in OneDrive first). For SharePoint, get the drive ID with Graph Explorer: `GET https://graph.microsoft.com/v1.0/sites/{tenant}.sharepoint.com:/sites/{site}:/drives`.
5. Click **Sign in to M365**. This uses an MSAL.js popup with tokens in memory only (`cacheLocation: memoryStorage`), so the sign-in ends when you close the tab. Upload: `PUT /me/drive/root:/{folder}/{file}:/content` or `PUT /drives/{driveId}/root:/{folder}/{file}:/content`.

MSAL Browser v5.25.1 is bundled in `vendor/` (MIT, `vendor/MSAL-LICENSE.txt`) and only loads when M365 is configured. `auth-redirect.html` is the MSAL v5 redirect-bridge page. It must contain only the bridge script and must not be served with COOP headers.

## Dictation, sharing and export: limitations
- **Browser formats:** Chrome/Edge/Firefox record `audio/webm;codecs=opus`. **iOS/iPadOS Safari records only `audio/mp4` (AAC)**, which is sent as `.m4a`. Azure/OpenAI Whisper accept m4a/mp4/webm/wav/mp3/ogg. For whisper.cpp the browser converts to 16 kHz WAV (or start the server with `--convert` + ffmpeg).
- **Secure context:** the microphone needs https or `http://localhost`/`127.0.0.1`. It may not work from `file://` in Safari. On iPhone, keep the screen on (the app requests a Wake Lock): iOS suspends recording when the screen locks or the app goes to the background.
- **Chunk boundaries:** a word spoken exactly at a chunk boundary can be clipped or duplicated. Whisper can hallucinate on silence. Common phrases ("Thank you.", `[BLANK_AUDIO]`) are filtered, but review the text. No speaker diarization: this is a transcript, not a DAX-style structured note, unless you use *Format with AI*.
- **Patient name/MRN extraction** is heuristic ("Patient: …", "Name: …", "the patient is First Last", "MRN …"). Always confirm both fields before Complete.
- The hosted https copy (`deid-pad-site`) **cannot reach `http://<LAN-IP>:5180`** (mixed content), so use Send to MA from the locally served app (`node serve.js`) or Electron. Chrome may ask for permission to access devices on the local network. The share server is plain HTTP on the LAN with a shared PIN, not per-user accounts.
- The Electron build (`file://`) supports dictation and Share to MA but not OneDrive export, because MSAL needs an http(s) redirect URI. Use `node serve.js` for export.
- CORS for Azure/OpenAI browser calls depends on Microsoft and OpenAI. Both currently allow browser calls with `api-key`/`Authorization` headers. If a tenant policy blocks it, use the local backend.

---

## AI Note (OpenAI API, de-identified text only)

Workflow: dictate with **Wispr Flow** (iOS keyboard) into the Paste box, or use **● Record**, then check the de-identified pane, then tick **AI note**, enter a **Document ID**, pick a template and press **Generate note**. Edit the result, then press **Send / Save**.

1. **What is sent:** only the de-identified output pane, plus your Project instructions, the optional reference snippets and the *Progression* field. It never includes the raw text, audio, patient name, MRN or Document ID. The model writes `Document ID: [DOCID]`, and the app fills that in locally afterwards.
2. **Hard leak guard (before sending):** the de-identification rules are run again on every outgoing part (`DeID.detect`), and the confirmed patient name/MRN and the *Always remove* list are checked too. If anything is found (a name, a date/DOB, an MRN/ID, a phone number, an address, an email…), **nothing is sent**. A red box lists exactly what was found and where ("De-identified note -> Names: "Bob Jones", Dates: "03/14/1946""), and one click replaces those strings with tokens. The guard sits inside `DeIDTx.buildNoteRequest`, so no request object exists until it passes. If the detector is missing, the app refuses to send.
3. **Redaction pass on the AI response (always):** the same detector runs on the model's reply. Any name, DOB/date, address, phone, ID, email or URL it finds is replaced by a token and listed in a yellow box. Blank lines and spacing are kept exactly.
4. **Providers** (Settings → *AI note*):
   - **OpenAI API**: uses the OpenAI key field. Choose **Responses** (`POST /v1/responses`, with `store:false`) or **Chat Completions**. The model is configurable (default `gpt-6.1-sol`; suggestions `gpt-6-astra`, `gpt-6-luna`, `gpt-4o`, `gpt-4.1`), with an optional reasoning effort. Temperature is sent only to non-reasoning models (`gpt-4*`).
   - **Azure OpenAI**: reuses the endpoint and key from the transcription settings plus the *chat deployment* / *chat api-version*.
   - **OpenAI-compatible**: any `/v1/chat/completions` server, for example Ollama/LM Studio on the Mac mini (`http://127.0.0.1:11434/v1`), or through `tailscale serve` (`https://mac-mini.<tailnet>.ts.net/v1`). Because of the CSP, the URL must be https or loopback; to use another https host, add it to `connect-src` in `build/app.html` (and `ALLOW` in `main.js`).
5. **Project instructions:** the ChatGPT app's **Projects cannot be called from the API**, so paste the project's instructions into Settings → *Project instructions* (one per template; *Reset to template default* restores the built-in text). They are kept in memory unless you tick **Remember project instructions and references on this device**, which is separate from the API-key *Remember* setting. Even then they are saved only if the leak detector finds nothing identifying in them. The fixed privacy rule and compliance rules are always appended after your text, and you cannot edit them away.
6. **OpenAI setup:** at https://platform.openai.com, create a project → API keys → create a key → paste it in Settings. **Recommended even though the text is de-identified:** sign OpenAI's BAA (contact OpenAI sales/support for healthcare), and enable **zero data retention** for that project. The rule-based de-identifier is not certified and can miss things, and Responses requests are already sent with `store:false`. Set a monthly spend limit for the project.

### Templates
- **SOAP (Established patient)** (default): an "Established patient" header with condition bullets, then `**S:**` / `**O:**` / `**A:**` / `**P:**`. Paragraphs are separated by two blank lines, and A/P statements by one. Spacing is preserved exactly in the editor and in the saved files. `**bold**` stays as written in .md/.txt and becomes real bold in .docx.
- **Vascular Follow-up / New Patient (E/M)**: plain text for pasting into Cerner/Azalea (the app also removes any markdown/bold/odd bullets from the reply). Sections: subject heading, `Date of Visit: [DATE]`, `Document ID`, Subjective/History (condition, symptoms/functional impact, new changes, surgical/interventional history, medication adherence, tobacco/alcohol, compression), Objective (vitals, general, extremity/neurovascular, wound/incision), Diagnostic Imaging bullets (arterial, venous, carotid, wound/soft tissue), numbered Assessment with reasoning, numbered Plan and Recommendations, Patient Education, a Medical Decision Making paragraph (activities only, no times), and finally an empty `Dictation addendum:` line. The input can be a redacted prior note, a template with meds/vitals, test reports and a short statement of new symptoms/exam changes, all pasted into the Paste box. Reference snippets work well for a standing template.

### Compliance guardrails (Medicare documentation must reflect services actually performed)
- **Attestations are opt-in.** Statements such as "external records personally reviewed", "images independently interpreted", procedural counseling/consent and care-coordination/staff time are allowed only when you tick the matching box (*I reviewed external records*, *I independently interpreted imaging*, *Procedure discussed/consent*, *Care coordination done*). Only the ticked statements are offered to the model. With none ticked, the prompt forbids them. Time statements ("significant physician time", "spent 30 minutes") are never auto-inserted.
- **Severity qualifiers** (progressive, worsening, complicated, poorly controlled…) are allowed only when the input supports them or for conditions you type in *Progression in the following conditions*. Otherwise conditions are described as documented or stable.
- **Progression mode** carries the prior exam forward as stable unless the input states a change, describes the progression you specified, and uses fresh wording instead of copied sentences. It never adds findings.
- Every prompt says: never invent findings, results, studies, counseling or services that are not in the input.
- **After generation** the app flags (it does not silently rewrite) any attestation-like or severity wording you didn't confirm or that the input doesn't support. Edit or delete it before saving. The flags are heuristics: you remain responsible for reading every line. The note must describe what you actually did.

### Send / Save (re-identification happens only here, on your device)
A **Document ID** (your own reference, not the MRN) is required. The file header is `Document ID: <id>` + `Date:` and never includes the patient name or DOB. The default filename is **`<DocumentID>_YYYY-MM-DD.md|txt|docx`**. Tick **Name/MRN in filename** (off by default) to get `Last_First_MRN_<DocumentID>_YYYY-MM-DD.ext`, built from the name/MRN held in memory. Destinations:
- **iCloud Drive / Files (share sheet):** on iPhone/iPad this uses the Web Share API with a file (`navigator.share({files})`). Pick **Save to Files → iCloud Drive → Notes**. If the browser can't share files, the file downloads instead. **Share text (Notes / Shortcut)** shares the note as plain text (for Apple Notes or the Shortcut below).
- **Mac mini folder (save helper):** see below.
- **OneDrive / SharePoint:** the existing Microsoft Graph export, now with the Document-ID filename. **✓ Complete → OneDrive** does the same thing.
- **Download file.**

> **iCloud is not covered by a BAA.** Apple does not sign HIPAA BAAs for iCloud Drive/Notes. Keep the default Document-ID filenames (no name/MRN), and treat iCloud as non-compliant storage for PHI. The same applies to `~/Desktop` if *Desktop & Documents in iCloud* is on. OneDrive/SharePoint under the practice's Microsoft BAA is the compliant destination.

### save-helper.js on the Mac mini
```bash
cd ~/deid-pad && node build/build.js            # creates deid-transcribe.js, which the helper uses
SAVE_PIN=48291377 node save-helper.js           # auto-detects the LAN IP, port 5181, writes to ~/Desktop/Notes
node save-helper.js --icloud --pin 48291377     # -> ~/Library/Mobile Documents/com~apple~CloudDocs/Notes
node save-helper.js --host 100.101.7.3 --folder "~/Documents/Clinic Notes"   # Tailscale IP, custom folder
```
- It binds only to a private LAN IPv4 (10/8, 172.16/12, 192.168/16), a Tailscale IPv4 (100.64/10) or 127.x, and refuses to start on anything else. It drops connections from non-private peers. Requests forwarded by `tailscale serve` must come from a private client, and **Funnel (public) requests are refused**.
- A 6-12 digit PIN is required (`X-Save-PIN`, constant-time compare; 8 bad tries lock the IP out for 5 min). The client cannot choose the folder or the path: the filename is rebuilt on the Mac from the Document ID and date (plus name/MRN only if you opted in) and sanitised. Files are created `0600` and never overwritten (` (2)` suffix). Note text and names are never logged; the console shows only "saved note #n".
- App Settings → *Save helper*: URL + PIN → **Test helper**.
  - Locally served app on the Mac (`node serve.js`) or Electron: `http://<lan-ip>:5181` or `http://127.0.0.1:5181`.
  - **From the iPhone (https Netlify copy):** browsers block http from an https page (mixed content), so serve the helper over HTTPS with Tailscale: `node save-helper.js --host 127.0.0.1` then `tailscale serve --bg --https=443 http://127.0.0.1:5181`, and use `https://<mac-mini>.<tailnet>.ts.net` as the URL. Don't enable Funnel. Alternatively pass `--cert/--key` for your own TLS certificate (then use `https://<ip>:5181`; the iPhone must trust that certificate).
- macOS privacy: the first write to Desktop/Documents/iCloud Drive triggers a "Terminal would like to access…" prompt. Allow it, or grant **System Settings → Privacy & Security → Files and Folders** (or Full Disk Access) to Terminal/node. To start it at login, use a LaunchAgent (`~/Library/LaunchAgents/com.deidpad.save-helper.plist` with `ProgramArguments` = node, the full path to save-helper.js, `--pin`, …, and `RunAtLoad` true). A LaunchAgent needs the same folder permission for `node`.

### Alternative: Apple Shortcut (no helper)
1. Shortcuts app → **+** → name it *Save DeID Note* → (i) → turn on **Show in Share Sheet**, *Receives*: **Text** (and Files).
2. Actions: **Text** (`Shortcut Input`) → **Ask for Input** "Document ID" → **Format Date** (Current Date, custom `yyyy-MM-dd`) → **Text** `[Provided Input]_[Formatted Date].txt` → **Set Name** of Shortcut Input to that text → **Save File** to `iCloud Drive/Notes` (turn off *Ask Where to Save*; turn on *Overwrite If File Exists* only if you want that). Optional: **Create Note** in a "Clinic" folder instead.
3. In DeID Pad choose **Share text (Notes / Shortcut)** → **Send / Save** → pick *Save DeID Note*. iCloud BAA caveat above applies.

### AI Note: limitations
- The leak guard uses the same rule-based detector as the de-identifier, so it misses whatever that misses (a bare first name in prose with no cue, unusual IDs). It can also over-flag: a year followed by punctuation counts as a date, and a capitalised two-word phrase after "patient"/"seen by" counts as a name. Fix the text or replace it with tokens. There is no override switch, by design.
- The response redaction pass can also over-redact, for example a capitalised condition right after "patient" becomes [NAME]. Read the yellow box.
- Compliance flags are keyword heuristics, not a coding audit. The model can still phrase an unconfirmed service in words the heuristics miss.
- `Date of Visit: [DATE]` stays a token. Type the date in the EHR, or edit it in the note before saving.
- The share sheet with files needs iOS/iPadOS 15+ Safari (or a Chromium browser on Android/Windows). Desktop Firefox falls back to download. `navigator.share` must run straight from a tap, so the file is built synchronously.
- The OpenAI browser call depends on OpenAI keeping CORS open for API keys. The key sits in the page (in memory, or in localStorage if you choose Remember). Use a dedicated project key with a spend limit.
- The CSP wildcards `http://*:5181`, `https://*:5181` and `https://*.ts.net` are broad. The app itself only sends to the private/Tailscale URL you configure, and the helper checks peers itself.
