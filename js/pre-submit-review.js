/** Owns pre-submit sentence gap review, note routing, and resolve actions before final submit. */
(function () {
  var root = document.getElementById("presubmit-view");
  var titleEl = document.getElementById("presubmit-title");
  var gapsEl = document.getElementById("presubmit-gaps");
  var statusEl = document.getElementById("presubmit-status");
  var statusCopyEl = document.getElementById("presubmit-status-copy");
  var toolbarEl = document.getElementById("presubmit-toolbar");
  var presubmitCount = document.getElementById("presubmit-count");
  var presubmitKeepAll = document.getElementById("presubmit-keep-all");
  var submitWrapEl = document.getElementById("presubmit-submit-wrap");
  var presubmitSubmitBtn = document.getElementById("presubmit-submit");
  var textarea = document.getElementById("shift-notes");

  if (!root || !gapsEl || !textarea) return;

  var TITLE_UNRESOLVED = "Before you submit";
  var TITLE_COMPLETE = "Ready to submit";
  var STATUS_COMPLETE = "All checked. Nothing you wrote was left out.";

  var USER_ICON_HTML =
    '<svg class="presubmit-gap-card__icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />' +
    "</svg>";

  var sentenceState = [];
  var manualResolutions = {};
  var lastCanSubmit = false;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function splitSentences(text) {
    var trimmed = text.trim();
    if (!trimmed) return [];

    return trimmed
      .split(/(?<=[.!?])\s+/)
      .map(function (part) {
        return part.trim();
      })
      .filter(function (part) {
        return part.length > 0;
      });
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[\u2013\u2014-]/g, " ")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sentenceMatchesIncident(sentence, incident) {
    var sentenceNorm = normalizeText(sentence);
    if (!sentenceNorm) return false;

    var sources = [incident.source, incident.logged, incident.desc, incident.title]
      .filter(Boolean)
      .map(normalizeText);

    for (var i = 0; i < sources.length; i++) {
      var sourceNorm = sources[i];
      if (!sourceNorm) continue;
      if (sentenceNorm.indexOf(sourceNorm) !== -1 || sourceNorm.indexOf(sentenceNorm) !== -1) return true;
    }

    var sentenceWords = sentenceNorm.split(" ").filter(function (word) {
      return word.length > 3;
    });
    if (!sentenceWords.length) return false;

    return sources.some(function (sourceNorm) {
      if (!sourceNorm) return false;
      var matches = sentenceWords.filter(function (word) {
        return sourceNorm.indexOf(word) !== -1;
      }).length;
      return matches >= Math.min(3, sentenceWords.length);
    });
  }

  function getIncidents() {
    if (!window.ShiftReview || !window.ShiftReview.getAllIncidents) return [];
    return window.ShiftReview.getAllIncidents();
  }

  function isAttentionClear() {
    if (!window.ShiftReview || !window.ShiftReview.isAttentionClear) return true;
    return window.ShiftReview.isAttentionClear();
  }

  function suggestedSection(sentence) {
    if (window.ShiftReview && window.ShiftReview.suggestSectionForSentence) {
      return window.ShiftReview.suggestSectionForSentence(sentence);
    }
    return "general";
  }

  function sectionTitle(sectionId) {
    if (window.ShiftReview && window.ShiftReview.getReportSection) {
      var section = window.ShiftReview.getReportSection(sectionId);
      if (section) return section.title;
    }
    return "General overview";
  }

  function getManual(entry) {
    return manualResolutions[entry.text] || null;
  }

  function buildSentenceState() {
    var incidents = getIncidents();
    var sentences = splitSentences(textarea.value);

    return sentences.map(function (sentence, index) {
      var matched = incidents.some(function (incident) {
        return sentenceMatchesIncident(sentence, incident);
      });
      var manual = manualResolutions[sentence];

      return {
        id: String(index),
        text: sentence,
        matched: matched,
        resolved: matched || !!(manual && (manual.resolution === "note" || manual.confirmed)),
        resolution: manual ? manual.resolution : matched ? "matched" : null,
        sectionId: manual ? manual.sectionId : null,
        incidentId: manual ? manual.incidentId : null,
        confirmed: manual ? !!manual.confirmed : false,
      };
    });
  }

  function uncardedSentences() {
    return sentenceState.filter(function (entry) {
      if (manualResolutions[entry.text]) return true;
      return !entry.matched;
    });
  }

  function hasPlainUnresolvedSentences() {
    return sentenceState.some(function (entry) {
      if (entry.matched) return false;
      var manual = getManual(entry);
      return !manual;
    });
  }

  function unresolvedGapCount() {
    var count = 0;

    sentenceState.forEach(function (entry) {
      var manual = getManual(entry);

      if (manual) {
        if (manual.resolution === "incident" && !manual.confirmed) {
          count += 1;
        }
        return;
      }

      if (entry.matched) return;

      count += 1;
    });

    return count;
  }

  function remainingLabel(count) {
    if (count === 1) return "1 left to check";
    return count + " left to check";
  }

  function canSubmitFromPresubmit() {
    if (!textarea.value.trim()) return false;
    return unresolvedGapCount() === 0 && isAttentionClear();
  }

  function animateSystemSignals(root) {
    if (!root) return;
    root.querySelectorAll(".presence-dot--system").forEach(function (dot) {
      dot.classList.add("presence-dot--enter");
    });
  }

  function gapCardHtml(entry) {
    var sectionId = suggestedSection(entry.text);
    var sectionLabel = sectionTitle(sectionId);

    return (
      '<li class="presubmit-gap-card card" data-sentence-id="' +
      escapeHtml(entry.id) +
      '">' +
      '<div class="presubmit-gap-card__body">' +
      '<p class="presubmit-gap-card__line">' +
      '<span class="presubmit-gap-card__icon">' +
      USER_ICON_HTML +
      "</span>" +
      '<span class="presubmit-gap-card__text">' +
      escapeHtml(entry.text) +
      "</span>" +
      "</p>" +
      "</div>" +
      '<div class="presubmit-gap-card__footer">' +
      '<button type="button" class="btn btn--ghost" data-action="make-incident">Make this an incident</button>' +
      '<button type="button" class="btn btn--ghost" data-action="keep-note" data-section-id="' +
      escapeHtml(sectionId) +
      '">Keep as a note in ' +
      escapeHtml(sectionLabel) +
      "</button>" +
      "</div></li>"
    );
  }

  function presubmitIncidentCardHtml(entry, item) {
    if (!window.ShiftReview || !window.ShiftReview.renderAttentionCardHtml) return "";

    return (
      '<li class="presubmit-incident-card" data-sentence-id="' +
      escapeHtml(entry.id) +
      '" data-incident-id="' +
      escapeHtml(item.id) +
      '">' +
      window.ShiftReview.renderAttentionCardHtml(item) +
      "</li>"
    );
  }

  function resolvedSourceLineHtml(sentence) {
    return (
      '<p class="presubmit-resolved__source">' +
      '<span class="presubmit-resolved__icon" aria-hidden="true">' +
      USER_ICON_HTML +
      "</span>" +
      '<em class="presubmit-resolved__sentence ai-transform__value--input">' +
      escapeHtml(sentence) +
      "</em></p>"
    );
  }

  function incidentConfirmedRowHtml(entry) {
    var manual = getManual(entry);
    var summary = null;
    if (window.ShiftReview && window.ShiftReview.getAcceptedIncidentSummary && manual.incidentId) {
      summary = window.ShiftReview.getAcceptedIncidentSummary(manual.incidentId);
    }

    var typeLabel = summary && summary.type ? summary.type : "Incident";
    var timeHtml =
      summary && summary.time
        ? '<span class="presubmit-resolved__decision-time t-mono-meta">' + escapeHtml(summary.time) + "</span>"
        : "";

    return (
      '<li class="presubmit-resolved" data-sentence-id="' +
      escapeHtml(entry.id) +
      '" data-incident-id="' +
      escapeHtml(manual.incidentId || "") +
      '">' +
      '<div class="presubmit-resolved__head">' +
      '<p class="presubmit-resolved__decision">' +
      '<span class="presubmit-resolved__decision-muted">Logged as incident</span>' +
      '<span class="presubmit-resolved__decision-em">' +
      escapeHtml(typeLabel) +
      "</span>" +
      timeHtml +
      "</p>" +
      '<button type="button" class="btn btn--quiet presubmit-resolved__undo" data-action="undo-incident" data-incident-id="' +
      escapeHtml(manual.incidentId || "") +
      '">Undo</button>' +
      "</div>" +
      resolvedSourceLineHtml(entry.text) +
      "</li>"
    );
  }

  function noteResolvedRowHtml(entry) {
    var manual = getManual(entry);
    var sectionLabel = sectionTitle(manual.sectionId);

    return (
      '<li class="presubmit-resolved" data-sentence-id="' +
      escapeHtml(entry.id) +
      '">' +
      '<div class="presubmit-resolved__head">' +
      '<p class="presubmit-resolved__decision">' +
      '<span class="presubmit-resolved__decision-muted">Kept as a note in</span>' +
      '<span class="presubmit-resolved__decision-em">' +
      escapeHtml(sectionLabel) +
      "</span>" +
      "</p>" +
      '<button type="button" class="btn btn--quiet presubmit-resolved__undo" data-action="undo-note" data-section-id="' +
      escapeHtml(manual.sectionId || "") +
      '">Undo</button>' +
      "</div>" +
      resolvedSourceLineHtml(entry.text) +
      "</li>"
    );
  }

  function renderEntryHtml(entry) {
    var manual = getManual(entry);

    if (!manual && !entry.matched) {
      return gapCardHtml(entry);
    }

    if (manual && manual.resolution === "incident") {
      if (manual.confirmed) {
        return incidentConfirmedRowHtml(
          Object.assign({}, entry, { incidentId: manual.incidentId })
        );
      }

      if (window.ShiftReview && window.ShiftReview.getAttentionItemById) {
        var item = window.ShiftReview.getAttentionItemById(manual.incidentId);
        if (item) return presubmitIncidentCardHtml(entry, item);
      }

      return gapCardHtml(entry);
    }

    if (manual && manual.resolution === "note") {
      return noteResolvedRowHtml(entry);
    }

    return "";
  }

  function bindPresubmitIncidentCards() {
    if (!window.ShiftReview || !window.ShiftReview.bindAttentionCard) return;

    gapsEl.querySelectorAll(".presubmit-incident-card").forEach(function (host) {
      var item = window.ShiftReview.getAttentionItemById(host.dataset.incidentId);
      var card = host.querySelector(".card--attention");
      if (!item || !card) return;
      window.ShiftReview.bindAttentionCard(card, item);
      animateSystemSignals(card);
    });
  }

  function reconcilePresubmitIncidents() {
    sentenceState.forEach(function (entry) {
      var manual = getManual(entry);
      if (!manual || manual.resolution !== "incident" || manual.confirmed) return;

      if (window.ShiftReview && window.ShiftReview.getAttentionItemById(manual.incidentId)) {
        return;
      }

      if (
        manual.incidentId &&
        window.ShiftReview &&
        window.ShiftReview.getAcceptedIncidentSummary &&
        window.ShiftReview.getAcceptedIncidentSummary(manual.incidentId)
      ) {
        manualResolutions[entry.text] = {
          resolved: true,
          resolution: "incident",
          incidentId: manual.incidentId,
          confirmed: true,
        };
      }
    });
  }

  function renderGaps() {
    var items = uncardedSentences();

    gapsEl.innerHTML = items.map(renderEntryHtml).join("");

    bindGapActions();
    bindPresubmitIncidentCards();
  }

  function isPresubmitComplete() {
    var items = uncardedSentences();
    if (!items.length) return false;
    return unresolvedGapCount() === 0 && canSubmitFromPresubmit();
  }

  function updateHeading() {
    if (!titleEl) return;
    titleEl.textContent = isPresubmitComplete() ? TITLE_COMPLETE : TITLE_UNRESOLVED;
  }

  function updateToolbar() {
    var unresolved = unresolvedGapCount();
    var items = uncardedSentences();
    var plainSentences = hasPlainUnresolvedSentences();
    var complete = isPresubmitComplete();
    if (toolbarEl) toolbarEl.hidden = complete || unresolved === 0;
    if (presubmitCount) presubmitCount.textContent = remainingLabel(unresolved);
    if (presubmitKeepAll) presubmitKeepAll.hidden = complete || unresolved === 0 || !plainSentences;
    if (gapsEl) gapsEl.hidden = items.length === 0;
  }

  function updateSubmitButton() {
    if (submitWrapEl) submitWrapEl.hidden = !isPresubmitComplete();
  }

  function updateStatusLine() {
    if (!statusEl || !statusCopyEl) return;

    var items = uncardedSentences();
    var plainSentences = hasPlainUnresolvedSentences();
    var complete = isPresubmitComplete();

    if (!items.length) {
      statusEl.hidden = true;
      statusCopyEl.textContent = "";
      return;
    }

    if (complete) {
      statusEl.hidden = false;
      statusCopyEl.textContent = STATUS_COMPLETE;
      animateSystemSignals(statusEl);
      return;
    }

    if (plainSentences) {
      statusEl.hidden = false;
      statusCopyEl.textContent = "I didn't pick anything up from these. Should I have?";
      return;
    }

    statusEl.hidden = true;
    statusCopyEl.textContent = "";
  }

  function resolveSentence(sentenceId, resolution, options) {
    options = options || {};
    var entry = sentenceState.find(function (item) {
      return item.id === sentenceId;
    });
    if (!entry || entry.matched) return;

    manualResolutions[entry.text] = {
      resolved: resolution === "note",
      resolution: resolution,
      sectionId: options.sectionId || null,
      incidentId: options.incidentId || null,
      confirmed: !!options.confirmed,
    };

    if (resolution === "note" && options.sectionId && window.ShiftReview && window.ShiftReview.keepNoteInSection) {
      window.ShiftReview.keepNoteInSection(options.sectionId, entry.text);
    }

    render();
  }

  function startIncidentFromSentence(sentenceId) {
    var entry = sentenceState.find(function (item) {
      return item.id === sentenceId;
    });
    if (!entry || entry.matched || getManual(entry)) return;

    var incidentId = null;
    var result = null;
    if (window.ShiftReview && window.ShiftReview.addIncidentFromSentence) {
      result = window.ShiftReview.addIncidentFromSentence(entry.text, {
        presubmit: true,
        sentenceId: entry.id,
      });
      if (result && result.id) incidentId = result.id;
    }

    if (!incidentId) return;

    var wentToAccepted = result && result.destination === "accepted";

    manualResolutions[entry.text] = {
      resolved: wentToAccepted,
      resolution: "incident",
      incidentId: incidentId,
      confirmed: wentToAccepted,
    };

    render();
  }

  function revertIncident(sentenceId, incidentId) {
    var entry = sentenceState.find(function (item) {
      return item.id === sentenceId;
    });
    if (!entry) return;

    if (window.ShiftReview && window.ShiftReview.discardPresubmitIncident) {
      window.ShiftReview.discardPresubmitIncident(incidentId);
    }

    delete manualResolutions[entry.text];
    render();
  }

  function confirmIncident(sentenceId, incidentId) {
    var entry = sentenceState.find(function (item) {
      return item.id === sentenceId;
    });
    if (!entry) return;

    var manual = getManual(entry);
    if (!manual || manual.resolution !== "incident") return;

    manualResolutions[entry.text] = {
      resolved: true,
      resolution: "incident",
      incidentId: incidentId || manual.incidentId,
      confirmed: true,
    };

    render();
  }

  function undoIncidentConfirmation(sentenceId, incidentId) {
    var entry = sentenceState.find(function (item) {
      return item.id === sentenceId;
    });
    if (!entry) return;

    if (window.ShiftReview && window.ShiftReview.removeAcceptedPresubmitIncident) {
      window.ShiftReview.removeAcceptedPresubmitIncident(incidentId);
    }

    delete manualResolutions[entry.text];
    render();
  }

  function undoNoteResolution(sentenceId) {
    var entry = sentenceState.find(function (item) {
      return item.id === sentenceId;
    });
    var manual = getManual(entry);
    if (!entry || !manual || manual.resolution !== "note") return;

    var sectionId = manual.sectionId;
    delete manualResolutions[entry.text];

    if (sectionId && window.ShiftReview && window.ShiftReview.undoNoteInSection) {
      window.ShiftReview.undoNoteInSection(sectionId, entry.text);
    }

    render();
  }

  function keepAllAsNotes() {
    gapSentences().forEach(function (entry) {
      var sectionId = suggestedSection(entry.text);
      manualResolutions[entry.text] = {
        resolved: true,
        resolution: "note",
        sectionId: sectionId,
        incidentId: null,
        confirmed: true,
      };
      if (window.ShiftReview && window.ShiftReview.keepNoteInSection) {
        window.ShiftReview.keepNoteInSection(sectionId, entry.text);
      }
    });

    render();
  }

  function gapSentences() {
    return uncardedSentences().filter(function (entry) {
      return !getManual(entry);
    });
  }

  function bindGapActions() {
    gapsEl.querySelectorAll('[data-action="make-incident"]').forEach(function (button) {
      button.addEventListener("click", function () {
        var gap = button.closest("[data-sentence-id]");
        if (!gap) return;
        startIncidentFromSentence(gap.dataset.sentenceId);
      });
    });

    gapsEl.querySelectorAll('[data-action="keep-note"]').forEach(function (button) {
      button.addEventListener("click", function () {
        var gap = button.closest("[data-sentence-id]");
        if (!gap) return;

        resolveSentence(gap.dataset.sentenceId, "note", { sectionId: button.dataset.sectionId });
      });
    });

    gapsEl.querySelectorAll('[data-action="undo-note"]').forEach(function (button) {
      button.addEventListener("click", function () {
        var gap = button.closest("[data-sentence-id]");
        if (!gap) return;
        undoNoteResolution(gap.dataset.sentenceId);
      });
    });

    gapsEl.querySelectorAll('[data-action="undo-incident"]').forEach(function (button) {
      button.addEventListener("click", function () {
        var gap = button.closest("[data-sentence-id]");
        if (!gap) return;
        undoIncidentConfirmation(gap.dataset.sentenceId, button.dataset.incidentId);
      });
    });
  }

  function render() {
    sentenceState = buildSentenceState();
    reconcilePresubmitIncidents();
    sentenceState = buildSentenceState();
    var hasNotes = textarea.value.trim().length > 0;
    var items = uncardedSentences();

    if (!hasNotes || !items.length) {
      if (gapsEl) gapsEl.innerHTML = "";
      if (toolbarEl) toolbarEl.hidden = true;
      if (gapsEl) gapsEl.hidden = true;
      if (statusEl) statusEl.hidden = true;
      if (statusCopyEl) statusCopyEl.textContent = "";
      if (submitWrapEl) submitWrapEl.hidden = true;
      if (titleEl) titleEl.textContent = TITLE_UNRESOLVED;
    } else {
      renderGaps();
      updateHeading();
      updateToolbar();
      updateStatusLine();
      updateSubmitButton();
    }

    var canSubmit = canSubmitFromPresubmit();
    var becameReady = canSubmit && !lastCanSubmit && isPresubmitComplete();
    if (becameReady) {
      document.dispatchEvent(new CustomEvent("presubmit:ready"));
    }
    lastCanSubmit = canSubmit;

    document.dispatchEvent(new CustomEvent("presubmit:changed"));

    if (window.ShiftReview && window.ShiftReview.syncPanelState) {
      window.ShiftReview.syncPanelState();
    }
  }

  window.PreSubmitReview = {
    render: render,
    hasShiftNotes: function () {
      return textarea.value.trim().length > 0;
    },
    hasHighlights: function () {
      return unresolvedGapCount() > 0;
    },
    isFullyResolved: function () {
      if (!textarea.value.trim()) return true;
      return unresolvedGapCount() === 0;
    },
    isComplete: isPresubmitComplete,
    focusSubmitButton: function () {
      if (presubmitSubmitBtn && !presubmitSubmitBtn.hidden) {
        presubmitSubmitBtn.focus();
      }
    },
    getUnresolvedCount: function () {
      return unresolvedGapCount();
    },
    getProgress: function () {
      var gaps = unresolvedGapCount();
      return {
        resolved: sentenceState.length - gaps,
        total: sentenceState.length,
        unresolved: gaps,
      };
    },
    getNotesKeptCount: function () {
      if (window.ShiftReview && window.ShiftReview.getNotesKeptCount) {
        return window.ShiftReview.getNotesKeptCount();
      }
      return 0;
    },
  };

  if (presubmitKeepAll) {
    presubmitKeepAll.addEventListener("click", keepAllAsNotes);
  }

  document.addEventListener("shiftreview:changed", function () {
    if (!root.hidden) render();
  });

  document.addEventListener("presubmit:incident-confirmed", function (event) {
    if (!event.detail) return;
    confirmIncident(event.detail.sentenceId, event.detail.incidentId);
  });

  document.addEventListener("presubmit:revert-incident", function (event) {
    if (!event.detail) return;
    revertIncident(event.detail.sentenceId, event.detail.incidentId);
  });

  textarea.addEventListener("input", function () {
    if (!root.hidden) render();
  });

  render();
})();
