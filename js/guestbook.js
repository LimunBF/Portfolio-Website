(() => {
  /* =========================================================
     ELEMENTS
     ========================================================= */

  const section = document.querySelector(".prefooter-guestbook");
  const toggle = document.querySelector("#guestbook-toggle");
  const panel = document.querySelector("#guestbook-panel");
  const closeButton = document.querySelector("[data-guestbook-close]");
  const toggleLabel = document.querySelector(
    "[data-guestbook-toggle-label]"
  );

  const form = document.querySelector("#guestbook-form");
  const nameInput = document.querySelector("#guestbook-name");
  const messageInput = document.querySelector("#guestbook-message");
  const charCount = document.querySelector("#guestbook-char-count");

  const notesContainer = document.querySelector("#guestbook-notes");
  const noteCount = document.querySelector("#guestbook-note-count");
  const status = document.querySelector("#guestbook-status");

  if (!section || !toggle || !panel) return;


  /* =========================================================
     CONFIG
     ========================================================= */

  const sitekey = document
    .querySelector('meta[name="turnstile-sitekey"]')
    ?.content
    ?.trim();

  const NOTE_COLORS = [
    "guestbook-note-pink",
    "guestbook-note-yellow",
    "guestbook-note-blue",
    "guestbook-note-aqua",
    "guestbook-note-lavender"
  ];

  let turnstileWidgetId = null;
  let turnstileToken = "";

  let startedAt = Date.now();
  let notesLoaded = false;
  let isSubmitting = false;


  /* =========================================================
     OPEN / CLOSE GUESTBOOK
     ========================================================= */

  function setOpen(open) {
    section.classList.toggle("is-open", open);

    toggle.setAttribute(
      "aria-expanded",
      String(open)
    );

    panel.setAttribute(
      "aria-hidden",
      String(!open)
    );

    panel.inert = !open;

    if (toggleLabel) {
      toggleLabel.textContent =
        open
          ? "Hide the guestbook"
          : "Open the guestbook";
    }


    /*
      Load notes hanya saat guestbook
      pertama kali benar-benar dibuka.
    */
    if (open && !notesLoaded) {
      loadGuestbookNotes();
    }


    /*
      Turnstile juga baru dirender ketika
      guestbook dibuka supaya tidak
      membebani halaman utama.
    */
    if (open) {
      renderGuestbookTurnstile();
    }
  }


  toggle.addEventListener("click", () => {
    const currentlyOpen =
      toggle.getAttribute("aria-expanded") === "true";

    setOpen(!currentlyOpen);
  });


  closeButton?.addEventListener("click", () => {
    setOpen(false);
    toggle.focus();
  });


  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      section.classList.contains("is-open")
    ) {
      setOpen(false);
      toggle.focus();
    }
  });


  /* =========================================================
     STOP IF FORM DOES NOT EXIST
     ========================================================= */

  if (
    !form ||
    !messageInput ||
    !notesContainer
  ) {
    setOpen(false);
    return;
  }


  /* =========================================================
     CHARACTER COUNTER
     ========================================================= */

  function updateCounter() {
    if (!charCount) return;

    charCount.textContent =
      String(messageInput.value.length);
  }


  messageInput.addEventListener(
    "input",
    updateCounter
  );


  /* =========================================================
     STATUS MESSAGE
     ========================================================= */

  function setStatus(message = "", type = "") {
    if (!status) return;

    status.textContent = message;

    status.className =
      `guestbook-status${type ? ` is-${type}` : ""}`;
  }


  /* =========================================================
     TURNSTILE UI
     ========================================================= */

  function createTurnstileArea() {
    let wrapper =
      form.querySelector(
        ".guestbook-turnstile-wrap"
      );

    if (wrapper) return wrapper;


    wrapper = document.createElement("div");

    wrapper.className =
      "guestbook-turnstile-wrap";


    const container =
      document.createElement("div");

    container.id =
      "guestbook-turnstile";


    const hint =
      document.createElement("p");

    hint.className =
      "guestbook-turnstile-hint";

    hint.textContent =
      "Security verification loads here.";


    wrapper.append(
      container,
      hint
    );


    /*
      Taruh Turnstile tepat sebelum
      footer form / submit button.
    */
    const footer =
      form.querySelector(
        ".guestbook-form-footer"
      );

    if (footer) {
      footer.insertAdjacentElement(
        "beforebegin",
        wrapper
      );
    } else {
      form.append(wrapper);
    }


    return wrapper;
  }


  /* =========================================================
     RENDER TURNSTILE
     ========================================================= */

  function renderGuestbookTurnstile() {
    const wrapper =
      createTurnstileArea();

    const container =
      wrapper.querySelector(
        "#guestbook-turnstile"
      );

    const hint =
      wrapper.querySelector(
        ".guestbook-turnstile-hint"
      );


    if (
      !sitekey ||
      sitekey ===
        "REPLACE_WITH_TURNSTILE_SITE_KEY"
    ) {
      hint.textContent =
        "Turnstile sitekey belum dikonfigurasi.";

      hint.classList.add("is-error");

      return;
    }


    /*
      Turnstile script mungkin belum selesai
      loading ketika guestbook dibuka.
    */
    if (!window.turnstile?.render) {
      window.setTimeout(
        renderGuestbookTurnstile,
        150
      );

      return;
    }


    /*
      Jangan render widget dua kali.
    */
    if (turnstileWidgetId !== null) {
      return;
    }


    turnstileWidgetId =
      window.turnstile.render(
        "#guestbook-turnstile",
        {
          sitekey,

          theme: "light",

          size: "flexible",

          appearance:
            "interaction-only",

          /*
            Penting:
            backend nanti harus cek
            action === "guestbook"
          */
          action: "guestbook",


          callback(token) {
            turnstileToken = token;

            hint.textContent =
              "Security verification ready.";

            hint.classList.remove(
              "is-error"
            );
          },


          "expired-callback"() {
            turnstileToken = "";

            hint.textContent =
              "Verification expired. Please try again.";

            hint.classList.add(
              "is-error"
            );
          },


          "error-callback"() {
            turnstileToken = "";

            hint.textContent =
              "Security verification failed.";

            hint.classList.add(
              "is-error"
            );
          },


          "timeout-callback"() {
            turnstileToken = "";

            hint.textContent =
              "Verification timed out.";

            hint.classList.add(
              "is-error"
            );
          }
        }
      );
  }


  /* =========================================================
     RESET TURNSTILE
     ========================================================= */

  function resetTurnstile() {
    turnstileToken = "";

    if (
      turnstileWidgetId !== null &&
      window.turnstile?.reset
    ) {
      window.turnstile.reset(
        turnstileWidgetId
      );
    }
  }


  /* =========================================================
     CREATE NOTE CARD
     ========================================================= */

  function createNoteCard(note, index = 0) {
    const article =
      document.createElement("article");

    article.className =
      `guestbook-note ${
        NOTE_COLORS[
          index % NOTE_COLORS.length
        ]
      }`;


    const quote =
      document.createElement("span");

    quote.className =
      "guestbook-note-mark";

    quote.setAttribute(
      "aria-hidden",
      "true"
    );

    quote.textContent = "“";


    const message =
      document.createElement("p");

    /*
      textContent sengaja digunakan.
      Jangan innerHTML supaya note user
      tidak bisa inject HTML/script.
    */
    message.textContent =
      note.message || "";


    const meta =
      document.createElement("div");

    meta.className =
      "guestbook-note-meta";


    const author =
      document.createElement("strong");

    author.textContent =
      note.name || "Anonymous";


    const date =
      document.createElement("span");

    date.textContent =
      formatDate(note.createdAt);


    meta.append(
      author,
      date
    );


    article.append(
      quote,
      message,
      meta
    );


    return article;
  }


  /* =========================================================
     FORMAT DATE
     ========================================================= */

  function formatDate(value) {
    if (!value) {
      return "";
    }

    try {
      const date =
        new Date(value);

      return new Intl.DateTimeFormat(
        "en",
        {
          month: "short",
          day: "numeric",
          year: "numeric"
        }
      ).format(date);

    } catch {
      return "";
    }
  }


  /* =========================================================
     UPDATE NOTE COUNT
     ========================================================= */

  function updateNoteCount(count) {
    if (!noteCount) return;

    noteCount.textContent =
      String(count).padStart(
        2,
        "0"
      );
  }


  /* =========================================================
     EMPTY STATE
     ========================================================= */

  function showEmptyState() {
    notesContainer.innerHTML = "";


    const empty =
      document.createElement("div");

    empty.className =
      "guestbook-empty-state";


    const mark =
      document.createElement("span");

    mark.textContent = "✦";


    const title =
      document.createElement("strong");

    title.textContent =
      "No notes yet.";


    const description =
      document.createElement("p");

    description.textContent =
      "You could be the first one to leave something here.";


    empty.append(
      mark,
      title,
      description
    );


    notesContainer.append(
      empty
    );


    updateNoteCount(0);
  }


  /* =========================================================
     LOADING STATE
     ========================================================= */

  function showLoadingState() {
    notesContainer.innerHTML = "";


    const loading =
      document.createElement("div");

    loading.className =
      "guestbook-loading";


    loading.innerHTML = `
      <span></span>
      <p>Loading tiny messages...</p>
    `;


    notesContainer.append(
      loading
    );
  }


  /* =========================================================
     LOAD APPROVED NOTES
     ========================================================= */

  async function loadGuestbookNotes() {
    showLoadingState();


    try {
      const response =
        await fetch(
          "/api/guestbook",
          {
            method: "GET",

            headers: {
              Accept:
                "application/json"
            },

            cache:
              "no-store"
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.message ||
          "Could not load guestbook."
        );
      }


      const notes =
        Array.isArray(data.notes)
          ? data.notes
          : [];


      notesContainer.innerHTML = "";


      if (!notes.length) {
        showEmptyState();

      } else {

        notes.forEach(
          (note, index) => {

            notesContainer.append(
              createNoteCard(
                note,
                index
              )
            );

          }
        );


        updateNoteCount(
          notes.length
        );
      }


      notesLoaded = true;

    } catch (error) {

      notesContainer.innerHTML = "";


      const failed =
        document.createElement("div");

      failed.className =
        "guestbook-empty-state";


      failed.innerHTML = `
        <span>!</span>
        <strong>Could not load notes.</strong>
        <p>Please try again later.</p>
      `;


      notesContainer.append(
        failed
      );


      updateNoteCount(0);


      console.error(
        "Guestbook load error:",
        error
      );
    }
  }


  /* =========================================================
     FORM SUBMIT
     ========================================================= */

  form.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      /*
        Hindari double-click submit.
      */
      if (isSubmitting) {
        return;
      }


      setStatus();


      const name =
        nameInput?.value.trim() || "";

      const message =
        messageInput.value.trim();


      /* -------------------------
         CLIENT VALIDATION
         ------------------------- */

      if (
        name.length > 40
      ) {
        setStatus(
          "Name is too long.",
          "error"
        );

        nameInput?.focus();

        return;
      }


      if (
        message.length < 2
      ) {
        setStatus(
          "Write a little more before sending ✦",
          "error"
        );

        messageInput.focus();

        return;
      }


      if (
        message.length > 240
      ) {
        setStatus(
          "Your note is too long.",
          "error"
        );

        messageInput.focus();

        return;
      }


      /* -------------------------
         TURNSTILE TOKEN
         ------------------------- */

      if (
        !turnstileToken &&
        turnstileWidgetId !== null &&
        window.turnstile?.getResponse
      ) {
        turnstileToken =
          window.turnstile.getResponse(
            turnstileWidgetId
          ) || "";
      }


      if (!turnstileToken) {
        setStatus(
          "Please complete the security verification first.",
          "error"
        );

        renderGuestbookTurnstile();

        return;
      }


      /* -------------------------
         REQUEST ID
         ------------------------- */

      const requestId =
        crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${
              Math.random()
                .toString(36)
                .slice(2)
            }`;


      /* -------------------------
         HONEYPOT
         ------------------------- */

      /*
        Field ini dibuat secara dynamic
        supaya tidak perlu edit HTML.
      */
      const honeypot =
        form.querySelector(
          '[name="guestbookWebsite"]'
        )?.value || "";


      const payload = {
        name,

        message,

        website:
          honeypot,

        startedAt,

        turnstileToken,

        requestId
      };


      /* -------------------------
         UI LOADING
         ------------------------- */

      isSubmitting = true;


      const submitButton =
        form.querySelector(
          ".guestbook-submit"
        );


      const originalButtonText =
        submitButton?.innerHTML;


      if (submitButton) {
        submitButton.disabled = true;

        submitButton.innerHTML =
          "<span>Sending...</span>";
      }


      /* -------------------------
         SEND TO API
         ------------------------- */

      try {
        const response =
          await fetch(
            "/api/guestbook",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Accept:
                  "application/json"
              },

              body:
                JSON.stringify(
                  payload
                )
            }
          );


        const data =
          await response
            .json()
            .catch(
              () => ({})
            );


        if (!response.ok) {
          throw new Error(
            data.message ||
            "Could not submit your note."
          );
        }


        /* -------------------------
           SUCCESS
           ------------------------- */

        form.reset();

        updateCounter();

        startedAt =
          Date.now();

        resetTurnstile();


        setStatus(
          "Note received ✦ It’ll appear here after approval.",
          "success"
        );


        /*
          Jangan langsung render note user.

          Karena approved masih false.
          Note baru muncul setelah kamu approve
          di Firestore.
        */


      } catch (error) {

        resetTurnstile();


        setStatus(
          error?.message ||
          "Something went wrong. Please try again.",
          "error"
        );


        console.error(
          "Guestbook submit error:",
          error
        );


      } finally {

        isSubmitting = false;


        if (
          submitButton &&
          originalButtonText
        ) {
          submitButton.disabled =
            false;

          submitButton.innerHTML =
            originalButtonText;
        }
      }
    }
  );


  /* =========================================================
     DYNAMIC HONEYPOT
     ========================================================= */

  function createHoneypot() {
    if (
      form.querySelector(
        '[name="guestbookWebsite"]'
      )
    ) {
      return;
    }


    const wrapper =
      document.createElement("div");

    wrapper.setAttribute(
      "aria-hidden",
      "true"
    );


    wrapper.style.position =
      "absolute";

    wrapper.style.width =
      "1px";

    wrapper.style.height =
      "1px";

    wrapper.style.overflow =
      "hidden";

    wrapper.style.clip =
      "rect(0 0 0 0)";

    wrapper.style.clipPath =
      "inset(50%)";


    const input =
      document.createElement("input");

    input.type = "text";

    input.name =
      "guestbookWebsite";

    input.tabIndex = -1;

    input.autocomplete = "off";


    wrapper.append(input);

    form.append(wrapper);
  }


  /* =========================================================
     INITIALIZE
     ========================================================= */

  createHoneypot();

  updateCounter();

  setOpen(false);

})();