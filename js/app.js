/** Owns product navigation, theme toggle, submit flow, and submitted view rendering. */
(function () {
  var workspaceView = document.getElementById("workspace-view");
  var presubmitView = document.getElementById("presubmit-view");
  var submittedView = document.getElementById("submitted-view");
  var layout = document.querySelector(".sr-layout");
  var panel = document.querySelector(".sr-panel");
  var submitBtn = document.getElementById("review-submit");
  var presubmitSubmitBtn = document.getElementById("presubmit-submit");
  var topbarStatus = document.getElementById("topbar-status");
  var presubmitBack = document.getElementById("presubmit-back");
  var devLoadBtn = document.getElementById("dev-load-20");
  var devLoad3amBtn = document.getElementById("dev-load-3am");
  var devTypeLiveBtn = document.getElementById("dev-type-live");
  var devQuietNightBtn = document.getElementById("dev-quiet-night");
  var themeToggle = document.getElementById("theme-toggle");
  var shiftNotesField = document.getElementById("shift-notes");
  var topbarDate = document.getElementById("topbar-date");
  var topbarManager = document.getElementById("topbar-manager");
  var submittedReportId = document.getElementById("submitted-report-id");
  var submittedContext = document.getElementById("submitted-context");
  var submittedSummary = document.getElementById("submitted-summary");
  var submittedQuietSummary = document.getElementById("submitted-quiet-summary");
  var submittedReopen = document.getElementById("submitted-reopen");
  var themeKey = "sr-theme";
  var submittedQuietNight = false;
  var SUBMIT_LABEL_DEFAULT = "Submit shift report";
  var SUBMIT_LABEL_QUIET = "Submit: nothing to report";

  var SUMMARY_ROWS = [
    { key: "incidentsLogged", label: "Incidents logged" },
    { key: "confirmedByYou", label: "Confirmed by you" },
    { key: "removed", label: "Removed" },
    { key: "addedInReview", label: "Added in review" },
    { key: "fieldsLeftUnknown", label: "Fields left unknown" },
    { key: "notesKeptOutsideIncidents", label: "Notes kept outside incidents" },
  ];

  function isQuietNightWorkspace() {
    if (!window.ShiftReview || !window.ShiftReview.isQuietNightWorkspace) return false;
    return window.ShiftReview.isQuietNightWorkspace();
  }

  function hasShiftNotes() {
    return shiftNotesField ? shiftNotesField.value.trim().length > 0 : false;
  }

  function isInPresubmit() {
    return presubmitView && !presubmitView.hidden;
  }

  function isSubmitted() {
    return submittedView && !submittedView.hidden;
  }

  function canOpenPresubmit() {
    if (!window.ShiftReview || !window.ShiftReview.isAttentionClear()) return false;
    return true;
  }

  function canFinalSubmit() {
    if (!canOpenPresubmit()) return false;
    if (!hasShiftNotes()) return true;
    if (window.PreSubmitReview) {
      return window.PreSubmitReview.isFullyResolved();
    }
    return true;
  }

  function getShiftMeta() {
    if (window.ShiftReview && window.ShiftReview.getShiftMeta) {
      return window.ShiftReview.getShiftMeta();
    }
    return {
      managerName: "Jamie Okafor",
      shiftNightLabel: "Night of Sat 3 Oct",
      demoNow: new Date(2026, 9, 4, 3, 12),
    };
  }

  function formatSubmittedDate(date) {
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return days[date.getDay()] + " " + date.getDate() + " " + months[date.getMonth()];
  }

  function formatSubmittedTime(date) {
    var hours = String(date.getHours()).padStart(2, "0");
    var minutes = String(date.getMinutes()).padStart(2, "0");
    return hours + ":" + minutes;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function setTheme(theme) {
    applyTheme(theme);
    localStorage.setItem(themeKey, theme);
  }

  var submitBtnParent = submitBtn ? submitBtn.parentNode : null;
  var submitBtnNextSibling = submitBtn ? submitBtn.nextSibling : null;

  function mountSubmitButton() {
    if (!submitBtn || !submitBtnParent || submitBtn.parentNode) return;
    submitBtn.hidden = false;
    submitBtn.removeAttribute("aria-hidden");
    if (submitBtnNextSibling) {
      submitBtnParent.insertBefore(submitBtn, submitBtnNextSibling);
    } else {
      submitBtnParent.appendChild(submitBtn);
    }
  }

  function unmountSubmitButton() {
    if (!submitBtn || !submitBtn.parentNode) return;
    submitBtn.hidden = true;
    submitBtn.setAttribute("aria-hidden", "true");
    submitBtn.parentNode.removeChild(submitBtn);
  }

  function syncSubmitState() {
    var submitted = isSubmitted();

    if (topbarStatus) topbarStatus.hidden = !submitted;

    if (submitted) {
      unmountSubmitButton();
      if (window.ShiftReview) window.ShiftReview.syncPanelState();
      return;
    }

    mountSubmitButton();

    if (submitBtn) {
      if (isQuietNightWorkspace()) {
        submitBtn.textContent = SUBMIT_LABEL_QUIET;
        submitBtn.disabled = false;
      } else {
        submitBtn.textContent = SUBMIT_LABEL_DEFAULT;
        submitBtn.disabled = isInPresubmit() ? !canFinalSubmit() : !canOpenPresubmit();
      }
    }

    if (window.ShiftReview) window.ShiftReview.syncPanelState();
  }

  function shouldShowPresubmit() {
    return hasShiftNotes();
  }

  function showWorkspace() {
    submittedQuietNight = false;
    if (workspaceView) workspaceView.hidden = false;
    if (presubmitView) presubmitView.hidden = true;
    if (submittedView) submittedView.hidden = true;
    if (layout) layout.classList.remove("sr-layout--submitted");
    if (panel) panel.hidden = false;
    syncSubmitState();
  }

  function showPresubmit() {
    if (!canOpenPresubmit()) return;
    if (workspaceView) workspaceView.hidden = true;
    if (presubmitView) presubmitView.hidden = false;
    if (submittedView) submittedView.hidden = true;
    if (window.PreSubmitReview) window.PreSubmitReview.render();
    syncSubmitState();
  }

  function renderSubmittedSummary() {
    if (!submittedSummary || !window.ShiftReview) return;

    var summary = window.ShiftReview.getSubmissionSummary();

    var meta = getShiftMeta();

    submittedSummary.innerHTML = SUMMARY_ROWS
      .map(function (row) {
        var label = row.key === "confirmedByYou"
          ? "Confirmed by " + meta.managerName
          : row.label;

        return (
          '<div class="submitted-view__row">' +
          "<dt>" + label + "</dt>" +
          "<dd>" + String(summary[row.key] || 0) + "</dd>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderSubmittedView(submittedAt) {
    var meta = getShiftMeta();
    submittedAt = submittedAt || meta.demoNow;

    if (submittedReportId && window.ShiftReview) {
      submittedReportId.textContent = window.ShiftReview.generateReportNumber(submittedAt);
    }

    if (submittedContext) {
      submittedContext.innerHTML =
        meta.shiftNightLabel +
        " · submitted <span class=\"t-mono-meta\">" +
        formatSubmittedDate(submittedAt) +
        " " +
        formatSubmittedTime(submittedAt) +
        "</span> by " +
        meta.managerName;
    }

    if (submittedQuietNight) {
      if (submittedQuietSummary) {
        submittedQuietSummary.hidden = false;
        submittedQuietSummary.textContent =
          "Nothing to report, confirmed by " + meta.managerName;
      }
      if (submittedSummary) submittedSummary.hidden = true;
    } else {
      if (submittedQuietSummary) submittedQuietSummary.hidden = true;
      if (submittedSummary) submittedSummary.hidden = false;
      renderSubmittedSummary();
    }
  }

  function showSubmitted(options) {
    options = options || {};
    var quietNightSubmit =
      !!options.quietNight || (!isInPresubmit() && isQuietNightWorkspace());

    if (!canFinalSubmit() && !quietNightSubmit) return;

    submittedQuietNight = quietNightSubmit;
    var submittedAt = getShiftMeta().demoNow;

    if (workspaceView) workspaceView.hidden = true;
    if (presubmitView) presubmitView.hidden = true;
    if (submittedView) submittedView.hidden = false;
    if (layout) layout.classList.add("sr-layout--submitted");
    if (panel) panel.hidden = true;

    renderSubmittedView(submittedAt);
    syncSubmitState();
  }

  function handleSubmitClick() {
    if (isSubmitted()) return;

    if (isInPresubmit()) {
      if (!canFinalSubmit()) return;
      showSubmitted();
      return;
    }

    if (shouldShowPresubmit()) {
      if (!canOpenPresubmit()) return;
      showPresubmit();
      return;
    }

    showSubmitted();
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", function () {
      if (submitBtn.disabled) return;
      handleSubmitClick();
    });
  }

  if (presubmitSubmitBtn) {
    presubmitSubmitBtn.addEventListener("click", function () {
      if (!isInPresubmit() || !canFinalSubmit()) return;
      handleSubmitClick();
    });
  }

  if (presubmitBack) {
    presubmitBack.addEventListener("click", showWorkspace);
  }

  if (submittedReopen) {
    submittedReopen.addEventListener("click", showWorkspace);
  }

  if (devLoadBtn) {
    devLoadBtn.addEventListener("click", function () {
      if (window.ShiftReview && window.ShiftReview.loadTwentyIncidents) {
        window.ShiftReview.loadTwentyIncidents();
      }
      syncSubmitState();
    });
  }

  if (devLoad3amBtn) {
    devLoad3amBtn.addEventListener("click", function () {
      if (window.CaptureDetect && window.CaptureDetect.loadThreeAmNotes) {
        window.CaptureDetect.loadThreeAmNotes();
      }
      syncSubmitState();
    });
  }

  if (devTypeLiveBtn) {
    devTypeLiveBtn.addEventListener("click", function () {
      if (window.CaptureDetect && window.CaptureDetect.playScriptedLiveTyping) {
        window.CaptureDetect.playScriptedLiveTyping();
      }
      syncSubmitState();
    });
  }

  if (devQuietNightBtn) {
    devQuietNightBtn.addEventListener("click", function () {
      if (isSubmitted()) showWorkspace();
      if (window.ShiftReview && window.ShiftReview.loadQuietNight) {
        window.ShiftReview.loadQuietNight();
      }
      syncSubmitState();
    });
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var current = document.documentElement.getAttribute("data-theme") || "dark";
      setTheme(current === "dark" ? "light" : "dark");
    });
  }

  if (topbarDate || topbarManager) {
    var meta = getShiftMeta();
    if (topbarDate) topbarDate.textContent = meta.shiftNightLabel;
    if (topbarManager) topbarManager.textContent = meta.managerName;
  }

  applyTheme(localStorage.getItem(themeKey) || document.documentElement.getAttribute("data-theme") || "dark");

  if (shiftNotesField) {
    shiftNotesField.addEventListener("input", syncSubmitState);
  }

  document.addEventListener("shiftreview:changed", syncSubmitState);
  document.addEventListener("presubmit:changed", syncSubmitState);
  document.addEventListener("presubmit:ready", function () {
    syncSubmitState();
    if (window.PreSubmitReview && window.PreSubmitReview.focusSubmitButton) {
      window.PreSubmitReview.focusSubmitButton();
    }
  });
  syncSubmitState();
})();
