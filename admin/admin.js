import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";


/* =========================================================
   ELEMENTS
   ========================================================= */

const loginView =
  document.querySelector("#admin-login-view");

const dashboard =
  document.querySelector("#admin-dashboard");

const loginButton =
  document.querySelector("#admin-google-login");

const loginStatus =
  document.querySelector("#admin-login-status");

const signoutButton =
  document.querySelector("#admin-signout");

const userMenu =
  document.querySelector("#admin-user-menu");

const userEmail =
  document.querySelector("#admin-user-email");

const refreshButton =
  document.querySelector("#admin-refresh");

const searchInput =
  document.querySelector("#admin-search");

const noteList =
  document.querySelector("#admin-note-list");

const listLabel =
  document.querySelector("#admin-list-label");

const listCount =
  document.querySelector("#admin-list-count");

const securityTitle =
  document.querySelector("#admin-security-title");

const securityCopy =
  document.querySelector("#admin-security-copy");

const copyUidButton =
  document.querySelector("#admin-copy-uid");

const deleteDialog =
  document.querySelector("#admin-delete-dialog");

const toast =
  document.querySelector("#admin-toast");


/* =========================================================
   CONFIG
   ========================================================= */

const firebaseConfig =
  window.LIMUN_FIREBASE_CONFIG || {};

const configReady =
  Boolean(
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes("REPLACE_") &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );

let auth = null;
let provider = null;

let currentUser = null;
let adminInfo = null;
let notes = [];

let activeStatus = "pending";
let searchTerm = "";
let pendingDeleteId = null;
let toastTimer = null;


/* =========================================================
   FIREBASE INIT
   ========================================================= */

if (configReady) {
  const app =
    initializeApp(firebaseConfig);

  auth =
    getAuth(app);

  provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account"
  });

} else {
  if (loginButton) {
    loginButton.disabled = true;
  }

  if (loginStatus) {
    loginStatus.textContent =
      "Firebase Web config belum diisi di admin/firebase-config.js.";
  }
}


/* =========================================================
   HELPERS
   ========================================================= */

function setLoginStatus(message = "") {
  if (!loginStatus) return;
  loginStatus.textContent = message;
}


function showToast(
  message,
  type = "success"
) {
  if (!toast) return;

  window.clearTimeout(toastTimer);

  toast.textContent =
    message;

  toast.className =
    `admin-toast is-visible${
      type === "error"
        ? " is-error"
        : ""
    }`;

  toastTimer =
    window.setTimeout(
      () => {
        toast.className =
          "admin-toast";
      },
      3000
    );
}


function formatDate(value) {
  if (!value) {
    return "No timestamp";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "No timestamp";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);
}


function normalizeStatus(note) {
  if (note.status === "approved") {
    return "approved";
  }

  if (note.status === "rejected") {
    return "rejected";
  }

  if (note.approved === true) {
    return "approved";
  }

  return "pending";
}


function getCounts() {
  const counts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    all: notes.length
  };

  notes.forEach(note => {
    const status =
      normalizeStatus(note);

    counts[status] += 1;
  });

  return counts;
}


/* =========================================================
   API
   ========================================================= */

async function apiRequest(
  path,
  options = {}
) {
  if (!currentUser) {
    throw new Error(
      "You are not signed in."
    );
  }

  const token =
    await currentUser
      .getIdToken();

  const response =
    await fetch(
      path,
      {
        ...options,

        headers: {
          Accept:
            "application/json",

          Authorization:
            `Bearer ${token}`,

          ...(options.body
            ? {
                "Content-Type":
                  "application/json"
              }
            : {}),

          ...(options.headers || {})
        },

        cache:
          "no-store"
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => ({})
      );

  if (!response.ok) {
    if (
      response.status === 401 ||
      response.status === 403
    ) {
      throw Object.assign(
        new Error(
          data.message ||
          "Admin access denied."
        ),
        {
          authError: true
        }
      );
    }

    throw new Error(
      data.message ||
      "Request failed."
    );
  }

  return data;
}


/* =========================================================
   AUTH
   ========================================================= */

async function handleLogin() {
  if (
    !auth ||
    !provider
  ) {
    setLoginStatus(
      "Firebase Web config belum siap."
    );
    return;
  }

  loginButton.disabled =
    true;

  setLoginStatus(
    "Opening Google sign-in..."
  );

  try {
    /*
      Redirect is more dependable on small/mobile browsers.
      Desktop uses popup for a quicker experience.
    */
    if (
      window.matchMedia(
        "(max-width: 700px)"
      ).matches
    ) {
      await signInWithRedirect(
        auth,
        provider
      );

      return;
    }

    await signInWithPopup(
      auth,
      provider
    );

  } catch (error) {
    const fallbackCodes = [
      "auth/popup-blocked",
      "auth/cancelled-popup-request",
      "auth/operation-not-supported-in-this-environment"
    ];

    if (
      fallbackCodes.includes(
        error?.code
      )
    ) {
      await signInWithRedirect(
        auth,
        provider
      );

      return;
    }

    setLoginStatus(
      error?.message ||
      "Could not sign in."
    );

  } finally {
    loginButton.disabled =
      false;
  }
}


async function handleSignout() {
  if (!auth) return;

  await signOut(auth);
}


async function handleSignedIn(user) {
  currentUser = user;

  loginButton.disabled = true;

  setLoginStatus(
    "Verifying admin access..."
  );


  try {

    const token =
      await user.getIdToken(
        true
      );


    const response =
      await fetch(
        "/api/admin/session",
        {
          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${token}`
          },

          cache:
            "no-store"
        }
      );


    const data =
      await response.json();


    /* NOT AUTHORIZED */

    if (
      !response.ok ||
      data.authorized !== true
    ) {

      await signOut(auth);


      dashboard.hidden =
        true;

      loginView.hidden =
        false;


      setLoginStatus(
        data.message ||
        "This Google account is not authorized."
      );


      return;
    }


    /* AUTHORIZED */

    adminInfo =
      data.admin;


    if (userEmail) {
      userEmail.textContent =
        adminInfo.email ||
        user.email ||
        "Admin";
    }


    if (userMenu) {
      userMenu.hidden =
        false;
    }


    updateSecurityCard();


    loginView.hidden =
      true;

    dashboard.hidden =
      false;


    setLoginStatus("");


    await loadNotes();


  } catch (error) {

    console.error(
      "Admin session verification:",
      error
    );


    dashboard.hidden =
      true;

    loginView.hidden =
      false;


    setLoginStatus(
      "Could not verify admin access."
    );


  } finally {

    loginButton.disabled =
      false;
  }
}


function handleSignedOut() {
  currentUser = null;
  adminInfo = null;
  notes = [];

  if (userMenu) {
    userMenu.hidden = true;
  }

  dashboard.hidden =
    true;

  loginView.hidden =
    false;
}


/* =========================================================
   DATA
   ========================================================= */

async function loadNotes() {
  showLoading();

  refreshButton?.classList.add(
    "is-loading"
  );

  if (refreshButton) {
    refreshButton.disabled = true;
  }

  try {
    const data =
      await apiRequest(
        "/api/admin/guestbook"
      );

    notes =
      Array.isArray(data.notes)
        ? data.notes
        : [];

    adminInfo =
      data.admin || null;

    updateSecurityCard();
    updateStats();
    renderNotes();

  } catch (error) {
    if (error.authError) {
      setLoginStatus(
        error.message
      );

      showToast(
        error.message,
        "error"
      );

      await handleSignout();
      return;
    }

    showErrorState(
      error.message ||
      "Could not load guestbook."
    );

  } finally {
    refreshButton?.classList.remove(
      "is-loading"
    );

    if (refreshButton) {
      refreshButton.disabled = false;
    }
  }
}


async function moderateNote(
  id,
  action
) {
  setCardBusy(
    id,
    true
  );

  try {
    const data =
      await apiRequest(
        "/api/admin/guestbook",
        {
          method: "PATCH",

          body:
            JSON.stringify({
              id,
              action
            })
        }
      );

    const verb = {
      approve: "approved",
      reject: "rejected",
      pending: "moved to pending"
    }[action] || "updated";

    showToast(
      `Note ${verb}.`
    );

    await loadNotes();

    return data;

  } catch (error) {
    showToast(
      error.message ||
      "Could not update note.",
      "error"
    );

  } finally {
    setCardBusy(
      id,
      false
    );
  }
}


async function deleteNote(id) {
  try {
    await apiRequest(
      "/api/admin/guestbook",
      {
        method: "DELETE",

        body:
          JSON.stringify({
            id
          })
      }
    );

    showToast(
      "Note deleted permanently."
    );

    await loadNotes();

  } catch (error) {
    showToast(
      error.message ||
      "Could not delete note.",
      "error"
    );
  }
}


/* =========================================================
   RENDER
   ========================================================= */

function updateSecurityCard() {
  if (!adminInfo) {
    return;
  }


  securityTitle.textContent =
    "Admin verified";


  securityCopy.textContent =
    `Authenticated as ${
      adminInfo.email || "admin"
    }`;


  copyUidButton.dataset.uid =
    adminInfo.uid || "";


  copyUidButton.hidden =
    !adminInfo.uid;
}


function updateStats() {
  const counts =
    getCounts();

  const ids = [
    "pending",
    "approved",
    "rejected"
  ];

  ids.forEach(status => {
    const stat =
      document.querySelector(
        `#stat-${status}`
      );

    const tab =
      document.querySelector(
        `#tab-count-${status}`
      );

    if (stat) {
      stat.textContent =
        String(
          counts[status]
        );
    }

    if (tab) {
      tab.textContent =
        String(
          counts[status]
        );
    }
  });

  const allCount =
    document.querySelector(
      "#tab-count-all"
    );

  if (allCount) {
    allCount.textContent =
      String(
        counts.all
      );
  }
}


function getFilteredNotes() {
  const term =
    searchTerm
      .trim()
      .toLowerCase();

  return notes.filter(note => {
    const status =
      normalizeStatus(note);

    if (
      activeStatus !== "all" &&
      status !== activeStatus
    ) {
      return false;
    }

    if (!term) {
      return true;
    }

    return (
      String(note.name || "")
        .toLowerCase()
        .includes(term) ||

      String(note.message || "")
        .toLowerCase()
        .includes(term)
    );
  });
}


function renderNotes() {
  const filtered =
    getFilteredNotes();

  noteList.innerHTML = "";

  const labelMap = {
    pending:
      "Pending notes",

    approved:
      "Approved notes",

    rejected:
      "Rejected notes",

    all:
      "All notes"
  };

  listLabel.textContent =
    labelMap[activeStatus];

  listCount.textContent =
    `${filtered.length} result${
      filtered.length === 1
        ? ""
        : "s"
    }`;

  if (!filtered.length) {
    showEmptyState();
    return;
  }

  filtered.forEach(note => {
    noteList.append(
      createNoteCard(note)
    );
  });
}


function createNoteCard(note) {
  const status =
    normalizeStatus(note);

  const article =
    document.createElement(
      "article"
    );

  article.className =
    "admin-note-card";

  article.dataset.noteId =
    note.id;

  article.dataset.status =
    status;


  const body =
    document.createElement(
      "div"
    );

  body.className =
    "admin-note-body";


  const head =
    document.createElement(
      "div"
    );

  head.className =
    "admin-note-head";


  const name =
    document.createElement(
      "strong"
    );

  name.className =
    "admin-note-name";

  name.textContent =
    note.name ||
    "Anonymous";


  const badge =
    document.createElement(
      "span"
    );

  badge.className =
    `admin-status-badge ${status}`;

  badge.textContent =
    status;


  const date =
    document.createElement(
      "span"
    );

  date.className =
    "admin-note-date";

  date.textContent =
    formatDate(
      note.createdAt
    );


  const message =
    document.createElement(
      "p"
    );

  message.className =
    "admin-note-message";

  /*
    textContent prevents user notes
    from becoming executable HTML.
  */
  message.textContent =
    note.message || "";


  const id =
    document.createElement(
      "p"
    );

  id.className =
    "admin-note-id";

  id.textContent =
    `ID: ${note.id}`;


  head.append(
    name,
    badge,
    date
  );

  body.append(
    head,
    message,
    id
  );


  const actions =
    document.createElement(
      "div"
    );

  actions.className =
    "admin-note-actions";


  if (
    status !== "approved"
  ) {
    actions.append(
      createActionButton(
        "✓ Approve",
        "approve",
        "admin-action-approve",
        note.id
      )
    );
  }


  if (
    status === "pending"
  ) {
    actions.append(
      createActionButton(
        "Reject",
        "reject",
        "admin-action-reject",
        note.id
      )
    );
  }


  if (
    status === "approved" ||
    status === "rejected"
  ) {
    actions.append(
      createActionButton(
        "Move to pending",
        "pending",
        "admin-action-pending",
        note.id
      )
    );
  }


  actions.append(
    createActionButton(
      "Delete",
      "delete",
      "admin-action-delete",
      note.id
    )
  );


  article.append(
    body,
    actions
  );


  return article;
}


function createActionButton(
  label,
  action,
  className,
  noteId
) {
  const button =
    document.createElement(
      "button"
    );

  button.type =
    "button";

  button.className =
    `admin-action ${className}`;

  button.dataset.action =
    action;

  button.dataset.noteId =
    noteId;

  button.textContent =
    label;

  return button;
}


function showLoading() {
  noteList.innerHTML = `
    <div class="admin-loading">
      <div>
        <div class="admin-loading-dot"></div>
      </div>
    </div>
  `;
}


function showEmptyState() {
  noteList.innerHTML = `
    <div class="admin-empty">
      <div class="admin-empty-inner">
        <span>✦</span>
        <strong>Nothing here.</strong>
        <p>No notes match this filter right now.</p>
      </div>
    </div>
  `;
}


function showErrorState(
  message
) {
  noteList.innerHTML = "";

  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    "admin-empty";


  const inner =
    document.createElement(
      "div"
    );

  inner.className =
    "admin-empty-inner";


  const icon =
    document.createElement(
      "span"
    );

  icon.textContent = "!";


  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    "Could not load notes.";


  const copy =
    document.createElement(
      "p"
    );

  copy.textContent =
    message;


  inner.append(
    icon,
    title,
    copy
  );

  wrapper.append(
    inner
  );

  noteList.append(
    wrapper
  );
}


function setCardBusy(
  id,
  busy
) {
  const selector =
    `[data-note-id="${CSS.escape(id)}"]`;

  const card =
    noteList.querySelector(
      selector
    );

  if (!card) return;

  card
    .querySelectorAll("button")
    .forEach(button => {
      button.disabled =
        busy;
    });
}


/* =========================================================
   EVENTS
   ========================================================= */

loginButton?.addEventListener(
  "click",
  handleLogin
);


signoutButton?.addEventListener(
  "click",
  handleSignout
);


refreshButton?.addEventListener(
  "click",
  loadNotes
);


searchInput?.addEventListener(
  "input",
  event => {
    searchTerm =
      event.target.value || "";

    renderNotes();
  }
);


document
  .querySelectorAll(
    "[data-status-filter]"
  )
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        activeStatus =
          button.dataset
            .statusFilter;

        document
          .querySelectorAll(
            "[data-status-filter]"
          )
          .forEach(tab => {
            tab.classList.toggle(
              "is-active",
              tab === button
            );
          });

        renderNotes();
      }
    );
  });


noteList?.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) {
      return;
    }

    const action =
      button.dataset.action;

    const noteId =
      button.dataset.noteId;

    if (
      !action ||
      !noteId
    ) {
      return;
    }

    if (
      action === "delete"
    ) {
      pendingDeleteId =
        noteId;

      if (
        deleteDialog?.showModal
      ) {
        deleteDialog.showModal();

      } else if (
        window.confirm(
          "Delete this note permanently?"
        )
      ) {
        deleteNote(
          noteId
        );
      }

      return;
    }

    moderateNote(
      noteId,
      action
    );
  }
);


deleteDialog?.addEventListener(
  "close",
  () => {

    if (
      deleteDialog.returnValue ===
        "delete" &&
      pendingDeleteId
    ) {
      const id =
        pendingDeleteId;

      pendingDeleteId =
        null;

      deleteNote(id);

    } else {
      pendingDeleteId =
        null;
    }
  }
);


copyUidButton?.addEventListener(
  "click",
  async () => {

    const uid =
      copyUidButton.dataset.uid;

    if (!uid) return;

    try {
      await navigator.clipboard
        .writeText(uid);

      showToast(
        "Admin UID copied."
      );

    } catch {
      showToast(
        `UID: ${uid}`
      );
    }
  }
);


/* =========================================================
   START AUTH SESSION
   ========================================================= */

if (auth) {
  getRedirectResult(auth)
    .catch(error => {
      setLoginStatus(
        error?.message ||
        "Google sign-in failed."
      );
    });


  onAuthStateChanged(
    auth,
    user => {

      if (user) {
        handleSignedIn(user);

      } else {
        handleSignedOut();
      }
    }
  );
}
