/** Owns attention and accepted queues, card rendering, live routing, and review panel sync. */
(function () {
  var attentionQueue = document.getElementById("attention-queue");
  var acceptedList = document.getElementById("accepted-list");
  if (!attentionQueue && !acceptedList) return;
  var attentionHeading = document.getElementById("attention-heading");
  var attentionHeadingCount = attentionHeading ? attentionHeading.querySelector(".attention-heading__count") : null;
  var attentionHeadingLabel = attentionHeading ? attentionHeading.querySelector(".attention-heading__label") : null;
  var attentionHeadingClear = document.getElementById("attention-heading-clear");
  var attentionHeadingQuiet = document.getElementById("attention-heading-quiet");
  var attentionQuietNightLine = document.getElementById("attention-quiet-night-line");
  var attentionAllClearLine = document.getElementById("attention-all-clear-line");
  var attentionAllClearCopy = attentionAllClearLine
    ? attentionAllClearLine.querySelector(".attention-all-clear-line__copy")
    : null;
  var attentionQueueBody = document.getElementById("attention-queue-body");
  var attentionStage = document.getElementById("attention-stage");
  var attentionResolving = false;
  var reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  var TIMING = {
    flash: 80,
    exit: 180,
    count: 120,
    collapse: 240,
    accepted: 600,
    reduced: 100,
  };
  var acceptedToggle = document.getElementById("accepted-toggle");
  var acceptedGroup = document.getElementById("accepted-group");
  var acceptedCountEl = acceptedToggle ? acceptedToggle.querySelector(".accepted-group__count") : null;
  var acceptedPeekTimer = null;
  var panel = document.getElementById("review-panel");
  var submissionStats = {
    removed: 0,
  };
  var reportSequence = 14;
  var restOfReportGroup = document.getElementById("rest-of-report");
  var restOfReportToggle = document.getElementById("rest-of-report-toggle");
  var restOfReportList = document.getElementById("rest-of-report-list");
  var addIncidentBtn = document.getElementById("add-incident");
  var reviewIncidentsBlock = document.getElementById("review-incidents-block");
  var reviewProgressBlock = document.getElementById("review-progress-block");
  var shiftNotesField = document.getElementById("shift-notes");
  var captureField = document.getElementById("capture-field");
  var captureLabel = document.getElementById("capture-label");

  var SHIFT_MANAGER_NAME = "Jamie Okafor";
  var SHIFT_NIGHT_LABEL = "Night of Sat 3 Oct";
  var DEMO_CLOCK = new Date(2026, 9, 4, 3, 12);
  var MANUAL_DETECTION_DELAY_MS = 1500;
  var MANUAL_DRAFT_PLACEHOLDER = "Describe what happened, one sentence is enough";

  var REPORT_SECTIONS = [
    { id: "general", title: "General overview" },
    { id: "audience", title: "Audience overview" },
    { id: "security", title: "Security overview" },
    { id: "artist", title: "Artist and crew" },
    { id: "door", title: "Door staff" },
    { id: "run-of-show", title: "Run of show" },
    { id: "bar", title: "Bar staff" },
    { id: "kitchen", title: "Kitchen" },
    { id: "vendors", title: "Third-party vendors" },
    { id: "private", title: "Private events" },
    { id: "maintenance", title: "Maintenance / equipment" },
    { id: "inventory", title: "Inventory notes" },
  ];

  var reportSectionNotes = {};
  REPORT_SECTIONS.forEach(function (section) {
    reportSectionNotes[section.id] = [];
  });

  var NOTE_ICON_SVG =
    '<svg class="other-sections__note-icon-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />' +
    "</svg>";

  var MISSING_FIELD_ORDER = ["Type", "Time", "Location"];

  var INCIDENT_TYPE_OPTIONS = [
    "Fight",
    "Guest injury",
    "Staff injury",
    "Ejection",
    "Refused entry",
    "Theft",
    "Drugs",
    "Property damage",
    "Fire safety",
    "Police",
    "Other",
  ];

  var REQUIRED_FIELDS = [
    {
      key: "type",
      label: "Type",
      inputType: "text",
      prompt: "What type of incident was this?",
      saveLabel: "Save type",
      placeholder: "e.g. Refused entry",
    },
    {
      key: "time",
      label: "Time",
      inputType: "time",
      prompt: "When did this happen?",
      saveLabel: "Save time",
      placeholder: "e.g. 03:05",
    },
    {
      key: "location",
      label: "Location",
      inputType: "text",
      prompt: "Where did this happen?",
      saveLabel: "Save location",
      placeholder: "e.g. Main bar",
    },
  ];

  var MOCK_ATTACHMENTS = [
    { name: "door-photo.jpg", size: "1.4 MB" },
    { name: "incident-note.jpg", size: "890 KB" },
    { name: "cctv-clip.mp4", size: "8.2 MB" },
    { name: "witness-statement.pdf", size: "220 KB" },
    { name: "floor-photo.jpg", size: "1.1 MB" },
    { name: "receipt-scan.pdf", size: "310 KB" },
  ];

  function buildIncidentFields(config) {
    var fields = [
      { label: "Time", value: config.time === undefined ? null : config.time },
      { label: "Location", value: config.location || null },
      { label: "Type", value: config.type || null },
      { label: "Description", value: config.description || null },
    ];

    if (config.extras) {
      config.extras.forEach(function (extra) {
        fields.push({ label: extra.label, value: extra.value });
      });
    }

    return fields;
  }

  function makeIncident(config) {
    return {
      id: config.id,
      title: config.type,
      time: config.time || "",
      source: config.source,
      logged: config.logged,
      provenance: config.provenance || "night",
      captured: config.captured,
      confirmedByUser: config.confirmedByUser,
      type: config.cardType,
      doubt: config.doubt,
      doubtField: config.doubtField,
      missingField: config.missingField,
      evidenceFiles: config.evidenceFiles || [],
      fields: buildIncidentFields({
        time: config.time,
        location: config.location,
        type: config.type,
        description: config.description,
        extras: config.extras,
      }),
    };
  }

  var accepted = [
    makeIncident({
      id: "a1",
      time: "22:15",
      captured: "22:17",
      location: "Main door",
      type: "Refused entry",
      description: "Fake ID at the main door. Guest looked about 17. Door staff kept the ID.",
      source: "fake ID at the main door, lad looked about 17, door staff kept the ID",
      logged: "Refused entry at the main door at 22:15. Fake ID retained by door staff.",
      confirmedByUser: true,
      evidenceFiles: [{ name: "id-photo-2215.jpg", size: "1.8 MB" }],
    }),
    makeIncident({
      id: "a2",
      time: "23:05",
      captured: "23:08",
      location: "Main bar",
      type: "Ejection",
      description: "Guest squared up to bar staff and was ejected. Left without trouble.",
      source: "threw out a guy at 23:05 for squaring up to bar staff at the main bar, left without trouble",
      logged: "Ejection from the main bar at 23:05. Guest left without trouble.",
      confirmedByUser: true,
    }),
    makeIncident({
      id: "a3",
      time: "23:40",
      captured: "23:44",
      location: "Whole venue",
      type: "Capacity check",
      description: "Headcount 412 at 23:40. Venue limit is 450.",
      source: "headcount 412 at 23:40, limit is 450",
      logged: "Capacity check at 23:40. Headcount 412, limit 450.",
      confirmedByUser: true,
    }),
    makeIncident({
      id: "a6",
      time: "01:45",
      captured: "01:50",
      location: "Gents toilets",
      type: "Suspected drugs found",
      description: "Small bag found in the gents at 01:45. Secured in the drugs safe and logged in the book.",
      source: "small bag found in the gents at 1:45, put in the drugs safe, logged in the book",
      logged: "Suspected drugs found in the gents toilets at 01:45. Secured in drugs safe.",
      confirmedByUser: true,
    }),
    makeIncident({
      id: "a7",
      time: "02:10",
      captured: "02:15",
      location: "Cloakroom",
      type: "Theft reported",
      description: "Guest reported phone stolen from the cloakroom area at 02:10. Details taken.",
      source: "girl reported her phone stolen from the cloakroom area at 2:10, took her details",
      logged: "Theft reported from the cloakroom at 02:10. Guest details taken.",
      confirmedByUser: true,
    }),
    makeIncident({
      id: "a8",
      time: "02:30",
      captured: "02:33",
      location: "Smoking area fire exit",
      type: "Fire safety",
      description: "Fire exit by the smoking area propped open at 02:30. Closed it and told door team.",
      source: "fire exit by the smoking area propped open at 2:30, closed it, told door team",
      logged: "Fire exit by the smoking area propped open at 02:30. Closed and door team notified.",
      confirmedByUser: true,
    }),
  ];

  var attention = [
    makeIncident({
      id: "q1",
      cardType: "missing",
      time: null,
      captured: "00:52",
      location: "Mezzanine stairs",
      type: "Guest injury",
      description: "Guest slipped on the stairs to the mezzanine. First aider checked him. He refused an ambulance.",
      source: "guy slipped on the stairs to the mezzanine, first aider checked him, he refused an ambulance",
      logged: "Guest injury on the mezzanine stairs. First aider attended, ambulance refused.",
      missingField: "Time",
    }),
    makeIncident({
      id: "q2",
      cardType: "low",
      time: "01:20",
      captured: "01:34",
      location: "Main bar",
      type: "Fight",
      description: "Fight started at the bar. Bouncers broke it up. No injuries.",
      source: "around 1:20 a fight started at the main bar, bouncers broke it up, no injuries",
      logged: "Fight at the main bar. Bouncers broke it up, no injuries.",
      doubt: "You wrote 'around 1:20'. Keep it approximate?",
      doubtField: "Time",
      evidenceFiles: [{ name: "cctv-bar-0120.mp4", size: "12 MB" }],
      extras: [{ label: "Action taken", value: "Bouncers broke it up, no injuries" }],
    }),
  ];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeCardCopy(value) {
    return String(value)
      .replace(/\u2014/g, "\u2013")
      .replace(/\s*\u2013\s*/g, "\u2013")
      .replace(/\s+-\s+/g, "\u2013");
  }

  function dashSepHtml() {
    return '<span class="text-sep" aria-hidden="true">\u2013</span>';
  }

  function displayText(value) {
    if (value === null || value === undefined) return "";
    var normalized = normalizeCardCopy(value);
    if (!normalized) return "";
    var parts = escapeHtml(normalized).split("\u2013");

    if (parts.length === 1) return parts[0];

    return parts.join(dashSepHtml());
  }

  function approximateTimeDisplay(value) {
    if (isEmptyFieldValue(value)) return "";

    var match = String(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "~" + value;

    return "~" + String(match[1]).padStart(2, "0") + ":" + match[2];
  }

  function isApproximateTimeCard(item) {
    return (
      item.type === "low" &&
      item.doubtField === "Time" &&
      item.doubt &&
      item.timeDoubt !== "outside-shift" &&
      !isEmptyFieldValue(item.time) &&
      !item._editingDoubtTime
    );
  }

  function liveNotesMetaSuffix() {
    return "from notes " + formatEditTime();
  }

  function manualAddedMetaTime(item) {
    return item.addedAt || formatEditTime();
  }

  function manualTimeMetaText(item) {
    var addedMeta = "added by hand " + manualAddedMetaTime(item);

    if (isManualDraftCard(item)) return addedMeta;

    if (isApproximateTimeCard(item)) {
      return approximateTimeDisplay(item.time) + " · added by hand";
    }

    if (item.type === "missing" && isEmptyFieldValue(item.time)) {
      return addedMeta;
    }

    if (!isEmptyFieldValue(item.time)) {
      return item.time + " · added by hand";
    }

    return addedMeta;
  }

  function isUnknownTime(item) {
    return item.time === "unknown" || isUnknownFieldValue(item, "Time");
  }

  function unknownTimeMetaText(item) {
    if (item.provenance === "manual") {
      return "time unknown · added by hand " + manualAddedMetaTime(item);
    }

    if (item.provenance === "live") {
      return "time unknown · " + liveNotesMetaSuffix();
    }

    return "time unknown · from phone " + (item.captured || "23:40");
  }

  function timeMetaText(item) {
    if (isUnknownTime(item)) {
      return unknownTimeMetaText(item);
    }

    if (item.provenance === "manual") {
      return manualTimeMetaText(item);
    }

    if (item.provenance === "live") {
      return item.time ? item.time + " · " + liveNotesMetaSuffix() : liveNotesMetaSuffix();
    }

    if (item.type === "missing" && isEmptyFieldValue(item.time)) {
      return "logged from phone " + (item.captured || "23:40");
    }

    return item.time + " · logged from phone " + (item.captured || "23:40");
  }

  function attentionTimeMetaText(item) {
    if (isUnknownTime(item)) {
      return unknownTimeMetaText(item);
    }

    if (item.provenance === "manual") {
      return manualTimeMetaText(item);
    }

    if (isApproximateTimeCard(item)) {
      if (item.provenance === "live") {
        return approximateTimeDisplay(item.time) + " · " + liveNotesMetaSuffix();
      }
      return approximateTimeDisplay(item.time) + " · logged from phone " + (item.captured || "23:40");
    }

    if (item.provenance === "live") {
      return item.time ? item.time + " · " + liveNotesMetaSuffix() : liveNotesMetaSuffix();
    }

    if (item.type === "missing" && isEmptyFieldValue(item.time)) {
      return "logged from phone " + (item.captured || "23:40");
    }

    if (!isEmptyFieldValue(item.time)) {
      return item.time + " · logged from phone " + (item.captured || "23:40");
    }

    return "logged from phone " + (item.captured || "23:40");
  }

  function timeMetaHtml(item) {
    return '<span class="card__time-meta">' + displayText(timeMetaText(item)) + "</span>";
  }

  function loggedText(item) {
    return item.logged || item.conclusion || item.desc || item.title || "";
  }

  function loggedDisplayText(item) {
    var text = loggedText(item);
    if (!text) return "";

    return String(text)
      .replace(/\s+around\s+\d{1,2}(:\d{2})?/gi, "")
      .replace(/\s+at\s+\d{1,2}:\d{2}/gi, "")
      .replace(/\s+at\s+\d{1,2}\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function itemFields(item) {
    if (item.fields && item.fields.length) return item.fields;
    return [{ label: "Time", value: item.time || null }];
  }

  var CARD_ROW_FIELDS = ["Location", "Type", "Time"];

  function filterCardRowFields(fields) {
    return CARD_ROW_FIELDS.map(function (label) {
      return fields.find(function (field) {
        return field.label === label;
      });
    }).filter(Boolean);
  }

  function acceptedItemFields(item) {
    return displayFields(item);
  }

  function timeInputValue(value) {
    if (!value) return "";

    var match = String(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return "";

    return String(match[1]).padStart(2, "0") + ":" + match[2];
  }

  function isEmptyFieldValue(value) {
    return value === null || value === undefined || value === "";
  }

  function requiredFieldConfig(label) {
    for (var i = 0; i < REQUIRED_FIELDS.length; i++) {
      if (REQUIRED_FIELDS[i].label === label) return REQUIRED_FIELDS[i];
    }
    return null;
  }

  function getFieldValueByLabel(item, label) {
    var fields = itemFields(item);
    var field = fields.find(function (entry) {
      return entry.label === label;
    });

    if (label === "Time") {
      if (field && !isEmptyFieldValue(field.value)) return field.value;
      return item.time || null;
    }

    if (label === "Type" && field && !isEmptyFieldValue(field.value)) return field.value;

    return field ? field.value : null;
  }

  function isUnknownFieldValue(item, label) {
    if (!item || !item.unknownFields) return false;
    return !!item.unknownFields[label];
  }

  function isFieldUnresolved(item, label) {
    if (isUnknownFieldValue(item, label)) return false;

    var value = getFieldValueByLabel(item, label);
    return isEmptyFieldValue(value) || value === "not stated";
  }

  function getRequiredFieldValue(item, config) {
    return getFieldValueByLabel(item, config.label);
  }

  function getMissingRequiredFields(item) {
    if (item.type !== "missing") return [];

    return MISSING_FIELD_ORDER.map(function (label) {
      return requiredFieldConfig(label);
    }).filter(function (config) {
      return config && isFieldUnresolved(item, config.label);
    });
  }

  function ensureRowFields(item) {
    if (!item.fields) item.fields = [];

    CARD_ROW_FIELDS.forEach(function (label) {
      var existing = item.fields.find(function (field) {
        return field.label === label;
      });

      if (!existing) {
        item.fields.push({
          label: label,
          value: label === "Time" ? item.time || null : null,
        });
      }
    });
  }

  function syncMissingFieldState(item) {
    ensureRowFields(item);
    var missing = getMissingRequiredFields(item);

    if (missing.length > 0) {
      item.type = "missing";
      item.missingField = missing[0].label;
      return;
    }

    if (item.type === "missing") {
      item.type = "low";
      item.missingField = null;
      item.missingPrompt = null;
    }
  }

  function needsConfirmFooter(item) {
    return (
      item.type === "low" &&
      !item.doubt &&
      !isApproximateTimeCard(item) &&
      !isOutsideShiftTimeCard(item) &&
      !item._editingDoubtTime
    );
  }

  function advanceMissingField(item, label, value) {
    if (value === "unknown") {
      if (!item.unknownFields) item.unknownFields = {};
      item.unknownFields[label] = true;
      updateItemField(item, label, "unknown");
    } else {
      if (item.unknownFields) delete item.unknownFields[label];
      updateItemField(item, label, value);

      if (label === "Type" && !item.title) {
        item.title = value;
      }
    }

    item.missingField = null;
    item._showMissingTimeInput = false;
    syncMissingFieldState(item);
    replaceAttentionCard(item);
  }

  function primaryMissingFieldConfig(item) {
    var missing = getMissingRequiredFields(item);
    return missing.length ? missing[0] : null;
  }

  function missingFieldLabel(item) {
    if (item.type !== "missing") return null;
    if (item.missingField) return item.missingField;

    var primary = primaryMissingFieldConfig(item);
    return primary ? primary.label : null;
  }

  function missingPromptText(item) {
    if (item.type !== "missing") return "";

    var primary = primaryMissingFieldConfig(item);
    return primary ? primary.prompt : "";
  }

  function missingSaveLabel(item) {
    var primary = primaryMissingFieldConfig(item);
    return primary ? primary.saveLabel : "Save";
  }

  function isManualDraftCard(item) {
    return item.manualDraft === true || item.type === "manual-draft";
  }

  function isMissingLoggedTime(item) {
    return (
      item.type === "missing" &&
      missingFieldLabel(item) === "Time" &&
      isFieldUnresolved(item, "Time") &&
      item.provenance !== "live" &&
      item.provenance !== "manual" &&
      !!item.captured &&
      !item._showMissingTimeInput &&
      !item._editingDoubtTime
    );
  }

  function isOutsideShiftTimeCard(item) {
    return item.type === "low" && item.timeDoubt === "outside-shift" && item.doubtField === "Time";
  }

  function isDoubtApproximateTime(item, field) {
    if (!field || field.label !== "Time") return false;
    return (
      item.doubtField === "Time" &&
      item.doubt &&
      !isEmptyFieldValue(field.value) &&
      !item._editingDoubtTime
    );
  }

  function acceptedRowTimeHtml(item) {
    if (item.time === "unknown" || isUnknownFieldValue(item, "Time")) {
      return '<span class="card__accepted-time t-mono-meta">unknown</span>';
    }

    if (isEmptyFieldValue(item.time)) {
      return '<span class="card__accepted-time t-mono-meta">time unknown</span>';
    }

    return (
      '<time class="card__accepted-time t-mono-meta" datetime="">' + escapeHtml(item.time) + "</time>"
    );
  }

  function isPrimaryMissingField(item, field) {
    return false;
  }

  function isSecondaryMissingRequired(item, field) {
    return false;
  }

  function displayFields(item, fieldsOverride) {
    return filterCardRowFields(fieldsOverride || itemFields(item));
  }

  function textMissingFieldInputHtml(item, field, options) {
    options = options || {};
    var config = requiredFieldConfig(field.label);
    var placeholder = item.placeholder || (config ? config.placeholder : "");

    return (
      '<input class="input ai-transform__field-input" type="text" ' +
      'id="' +
      escapeHtml(options.id || "missing-field-" + item.id) +
      '" ' +
      options.dataAttribute +
      '="' +
      escapeHtml(field.label) +
      '" autocomplete="off" aria-label="' +
      escapeHtml(field.label) +
      '"' +
      (options.describedBy
        ? ' aria-describedby="' + escapeHtml(options.describedBy) + '"'
        : "") +
      (options.autofocus ? " autofocus" : "") +
      (placeholder ? ' placeholder="' + escapeHtml(placeholder) + '"' : "") +
      ' value="' +
      escapeHtml(options.value !== undefined ? options.value : field.value || "") +
      '">'
    );
  }

  function timeFieldInputHtml(item, field, options) {
    options = options || {};

    return (
      '<input class="input ai-transform__field-input ai-transform__field-input--time" type="time" step="60" ' +
      'id="' +
      escapeHtml(options.id || "time-field-" + item.id) +
      '" ' +
      options.dataAttribute +
      '="' +
      escapeHtml(field.label) +
      '" autocomplete="off" aria-label="' +
      escapeHtml(field.label) +
      '"' +
      (options.describedBy
        ? ' aria-describedby="' + escapeHtml(options.describedBy) + '"'
        : "") +
      (options.autofocus ? " autofocus" : "") +
      ' value="' +
      escapeHtml(timeInputValue(options.value !== undefined ? options.value : field.value)) +
      '">'
    );
  }

  function isTimeInputField(item, field) {
    if (field.label !== "Time") return false;
    if (isPrimaryMissingField(item, field)) return true;
    if (item.doubtField && field.label === item.doubtField && item.doubt) {
      if (item._editingDoubtTime) return true;
      if (!isEmptyFieldValue(field.value)) return false;
      return true;
    }
    return false;
  }

  function primaryMissingFieldInputHtml(item, field, value) {
    var config = requiredFieldConfig(field.label);
    var options = {
      id: "missing-field-" + item.id,
      dataAttribute: "data-missing-field",
      describedBy: "missing-prompt-" + item.id,
      value: value,
    };

    if (config && config.inputType === "time") {
      return timeFieldInputHtml(item, field, options);
    }

    return textMissingFieldInputHtml(item, field, options);
  }

  function fieldValueHtml(value, field, item) {
    value = getFieldValueByLabel(item, field.label);

    if (isUnknownFieldValue(item, field.label) || value === "unknown") {
      return '<span class="ai-transform__unstated">unknown</span>';
    }

    if (isDoubtApproximateTime(item, field)) {
      return (
        '<span class="ai-transform__field-value">' +
        escapeHtml(approximateTimeDisplay(value)) +
        "</span>"
      );
    }

    if (value === null || value === undefined || value === "" || value === "not stated") {
      return '<span class="ai-transform__unstated">not stated</span>';
    }

    if (item.doubtField && field.label === item.doubtField && item.doubt) {
      return (
        '<span class="ai-transform__field-editor">' +
        '<button type="button" class="ai-transform__field-value ai-transform__field-value--doubt" data-field-label="' +
        escapeHtml(field.label) +
        '">' +
        displayText(value) +
        "</button></span>"
      );
    }

    return displayText(value);
  }

  function updateItemField(item, label, value) {
    freezeDetectionLink(item);

    if (!item.fields) item.fields = [{ label: "Time", value: item.time || null }];

    item.fields.forEach(function (field) {
      if (field.label === label) field.value = value;
    });

    if (label === "Time") item.time = value;
  }

  function userIconHtml() {
    return (
      '<svg class="ai-transform__icon ai-transform__icon--person" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />' +
      "</svg>"
    );
  }

  function systemSignalHtml() {
    return (
      '<span class="presence-dot presence-dot--system" aria-hidden="true">' +
      '<span class="presence-dot__ring"></span>' +
      '<span class="presence-dot__core"></span></span>'
    );
  }

  function animateSystemSignals(root) {
    if (!root) return;

    root.querySelectorAll(".presence-dot--system").forEach(function (dot) {
      dot.classList.add("presence-dot--enter");
    });
  }

  function transcriptMarkerHtml(inner) {
    return '<span class="ai-transform__marker" aria-hidden="true">' + inner + "</span>";
  }

  function sourceBlockHtml(wrote, logged, loggedLineHtml) {
    return (
      '<div class="ai-transform__source">' +
      transformLineHtml("wrote", "You wrote", wrote || "", "ai-transform__value--input") +
      (loggedLineHtml ||
        transformLineHtml("logged", "I logged", loggedDisplayText({ logged: logged }), "ai-transform__value--output")) +
      "</div>"
    );
  }

  function transformLineHtml(kind, labelText, value, valueClass) {
    var labelIcon = transcriptMarkerHtml(kind === "logged" ? systemSignalHtml() : userIconHtml());
    var labelClass = "ai-transform__label ai-transform__label--" + kind;
    var valueClasses = "ai-transform__value" + (valueClass ? " " + valueClass : "");

    return (
      '<p class="ai-transform__line">' +
      '<span class="' + labelClass + '">' + labelIcon + labelText + ": </span>" +
      '<span class="' + valueClasses + '">' + displayText(value) + "</span>" +
      "</p>"
    );
  }

  function fieldsHtml(item, fieldsOverride) {
    var fields = displayFields(item, fieldsOverride);
    if (!fields.length) return "";

    return (
      '<dl class="ai-transform__fields">' +
      fields
        .map(function (field) {
          var isDoubt = item.doubtField && field.label === item.doubtField && item.doubt;
          var isDoubtApproxTime = isDoubtApproximateTime(item, field);
          var hintHtml =
            isDoubt && !isDoubtApproxTime && item.doubt && item.type !== "low"
              ? '<button type="button" class="ai-transform__field-hint" id="doubt-hint-' +
                escapeHtml(item.id) +
                '" data-action="edit-doubt-field">' +
                displayText(item.doubt) +
                "</button>"
              : "";

          return (
            '<div class="ai-transform__field' +
            (isDoubt ? " ai-transform__field--doubt" : "") +
            (hintHtml ? " ai-transform__field--stack" : "") +
            '">' +
            "<dt>" + escapeHtml(field.label) + "</dt>" +
            "<dd>" + fieldValueHtml(field.value, field, item) + hintHtml + "</dd>" +
            "</div>"
          );
        })
        .join("") +
      "</dl>"
    );
  }

  function aiTransformHtml(item) {
    var wrote = item.source;
    var logged = loggedDisplayText(item);
    var fieldsBlock = fieldsHtml(item);

    if (!wrote && !logged && !fieldsBlock) return "";

    var doubtBlock =
      item.doubt && !item.doubtField && !missingFieldLabel(item)
        ? '<p class="ai-transform__doubt system-line">' + systemSignalHtml() + "<span>" + displayText(item.doubt) + "</span></p>"
        : "";

    return (
      '<div class="ai-transform">' +
      (wrote || logged ? sourceBlockHtml(wrote, logged) : "") +
      fieldsBlock +
      doubtBlock +
      "</div>"
    );
  }

  function shiftTimeSortKey(time) {
    if (isEmptyFieldValue(time)) return -1;

    var match = String(time).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return 99999;

    var hours = parseInt(match[1], 10);
    var minutes = hours * 60 + parseInt(match[2], 10);
    if (hours < 12) minutes += 24 * 60;

    return minutes;
  }

  function sortAcceptedChronologically() {
    accepted.sort(function (a, b) {
      return shiftTimeSortKey(a.time) - shiftTimeSortKey(b.time);
    });
  }

  function formatEditTime(date) {
    date = date || DEMO_CLOCK;
    var hours = String(date.getHours()).padStart(2, "0");
    var minutes = String(date.getMinutes()).padStart(2, "0");
    return hours + ":" + minutes;
  }

  function acceptedEditKeyForField(label) {
    return "field:" + label;
  }

  function acceptedEditStampHtml(item, editKey) {
    if (!item.edits || !item.edits[editKey]) return "";
    return (
      '<span class="accepted-edit-stamp">edited by you ' + escapeHtml(item.edits[editKey]) + "</span>"
    );
  }

  function acceptedEditableValueHtml(value, editKey, item, options) {
    options = options || {};
    var wrapClass = "accepted-edit-wrap" + (options.wrapClass ? " " + options.wrapClass : "");
    var valueClass = "accepted-edit" + (options.valueClass ? " " + options.valueClass : "");

    return (
      '<span class="' +
      wrapClass +
      '">' +
      '<span class="' +
      valueClass +
      '" data-accepted-edit="' +
      escapeHtml(editKey) +
      '" tabindex="0" role="button">' +
      displayText(value || "") +
      "</span>" +
      acceptedEditStampHtml(item, editKey) +
      "</span>"
    );
  }

  function acceptedLoggedLineHtml(item) {
    return (
      '<p class="ai-transform__line">' +
      '<span class="ai-transform__label ai-transform__label--logged">' +
      transcriptMarkerHtml(systemSignalHtml()) +
      "Logged: </span>" +
      acceptedEditableValueHtml(loggedDisplayText(item), "logged", item, {
        wrapClass: "accepted-edit-wrap--logged",
        valueClass: "ai-transform__value ai-transform__value--output",
      }) +
      "</p>"
    );
  }

  function acceptedFieldsBlockHtml(item) {
    var fields = acceptedItemFields(item);
    if (!fields.length) return "";

    return (
      '<dl class="ai-transform__fields">' +
      fields
        .map(function (field) {
          return (
            '<div class="ai-transform__field">' +
            "<dt>" + escapeHtml(field.label) + "</dt>" +
            "<dd>" +
            acceptedEditableValueHtml(field.value, acceptedEditKeyForField(field.label), item) +
            "</dd>" +
            "</div>"
          );
        })
        .join("") +
      "</dl>"
    );
  }

  function acceptedCardBodyHtml(item) {
    var wrote = item.source;
    var fieldsBlock = acceptedFieldsBlockHtml(item);

    return (
      '<div class="ai-transform ai-transform--accepted">' +
      sourceBlockHtml(wrote, loggedDisplayText(item), acceptedLoggedLineHtml(item)) +
      (fieldsBlock ? '<div class="card__accepted-detail">' + fieldsBlock + "</div>" : "") +
      "</div>"
    );
  }

  function freezeDetectionLink(item) {
    if (!item || item.provenance !== "live") return;
    item.detectionLinked = false;
  }

  function findLiveByDetectionKey(key) {
    var pool = accepted.concat(attention);
    var found = null;

    pool.some(function (item) {
      if (item.provenance !== "live" || item.status === "removed") return false;
      if (item.detectionKey === key) {
        found = item;
        return true;
      }
      return false;
    });

    if (found) return found;

    pool.some(function (item) {
      if (item.provenance !== "live" || item.status === "removed" || item.detectionLinked === false) {
        return false;
      }

      var existingKey = item.detectionKey || "";
      if (!existingKey) return false;
      if (existingKey.indexOf(key) === 0 || key.indexOf(existingKey) === 0) {
        found = item;
        return true;
      }
      return false;
    });

    return found;
  }

  function refreshLiveIncidentCard(item) {
    var inAccepted = accepted.some(function (entry) {
      return entry.id === item.id;
    });

    if (inAccepted) {
      renderAccepted();
      return;
    }

    replaceAttentionCard(item);
  }

  function mergeLiveDetection(existing, item) {
    existing.detectionKey = item.detectionKey || existing.detectionKey;
    existing.source = item.source;
    existing.logged = item.logged;
    existing.desc = item.desc || item.logged;
    existing.title = item.title || existing.title;
    existing.time = item.time || existing.time;
    existing.type = item.type || existing.type;
    existing.missingField = item.missingField || existing.missingField;
    existing.doubt = item.doubt;
    existing.doubtField = item.doubtField;
    existing.timeDoubt = item.timeDoubt;
    existing.timeShiftCandidate = item.timeShiftCandidate;
    existing.timeDayCandidate = item.timeDayCandidate;
    existing.missingPrompt = item.missingPrompt;
    existing.confidence = item.confidence;

    if (item.fields) {
      existing.fields = cloneItemFields(item.fields);
    }

    ensureRowFields(existing);
    if (existing.type === "missing") syncMissingFieldState(existing);

    refreshLiveIncidentCard(existing);
    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
  }

  function upsertLiveDetection(item) {
    if (!item.detectionKey) {
      var created = addLiveDetection(item);
      return {
        action: "created",
        destination: created.destination,
        title: created.title,
      };
    }

    var existing = findLiveByDetectionKey(item.detectionKey);

    if (existing) {
      if (existing.detectionLinked === false) {
        return { action: "frozen", title: existing.title };
      }

      mergeLiveDetection(existing, item);
      return {
        action: "updated",
        title: existing.title,
        destination: accepted.some(function (entry) {
          return entry.id === existing.id;
        })
          ? "accepted"
          : "attention",
      };
    }

    item.detectionLinked = true;
    var created = addLiveDetection(item);
    return {
      action: "created",
      destination: created.destination,
      title: created.title,
    };
  }

  function updateAcceptedEdit(item, editKey, value) {
    freezeDetectionLink(item);

    if (editKey === "logged") {
      item.logged = value;
      item.desc = value;
    } else if (editKey.indexOf("field:") === 0) {
      var label = editKey.slice(6);
      if (!item.fields) item.fields = [];
      var found = false;
      item.fields.forEach(function (field) {
        if (field.label === label) {
          field.value = value;
          found = true;
        }
      });
      if (!found) item.fields.push({ label: label, value: value });
      if (label === "Time") item.time = value;
    }

    if (!item.edits) item.edits = {};
    item.edits[editKey] = formatEditTime();
  }

  function refreshAcceptedEditStamp(wrap, item, editKey) {
    if (!wrap) return;

    var stamp = wrap.querySelector(".accepted-edit-stamp");
    var stampTime = item.edits && item.edits[editKey];

    if (!stampTime) {
      if (stamp) stamp.remove();
      return;
    }

    if (!stamp) {
      stamp = document.createElement("span");
      stamp.className = "accepted-edit-stamp";
      wrap.appendChild(stamp);
    }

    stamp.textContent = "edited by you " + stampTime;
  }

  function createAcceptedEditElement(editKey, value, valueClass) {
    var button = document.createElement("span");
    button.className = "accepted-edit" + (valueClass ? " " + valueClass : "");
    button.dataset.acceptedEdit = editKey;
    button.tabIndex = 0;
    button.setAttribute("role", "button");
    button.textContent = value;
    return button;
  }

  function openAcceptedEditor(target, item) {
    if (!target || target.tagName === "INPUT") return;

    var editKey = target.dataset.acceptedEdit;
    if (!editKey) return;

    var original = target.textContent;
    var wrap = target.closest(".accepted-edit-wrap");
    var valueClass = target.className
      .split(" ")
      .filter(function (cls) {
        return cls && cls !== "accepted-edit";
      })
      .join(" ");
    var input = document.createElement("input");
    input.type = "text";
    input.className = "accepted-edit-input" + (valueClass.indexOf("ai-transform__value--output") !== -1 ? " accepted-edit-input--logged" : "");
    input.value = original;
    input.dataset.acceptedEdit = editKey;
    input.defaultValue = original;

    target.replaceWith(input);
    input.focus();
    input.select();

    function revert() {
      if (!input.isConnected) return;
      var restored = createAcceptedEditElement(editKey, original, valueClass);
      input.replaceWith(restored);
      bindAcceptedEditElement(restored, item);
    }

    function save() {
      if (!input.isConnected) return;

      var nextValue = input.value.trim() || original;
      var changed = nextValue !== original;

      if (changed) updateAcceptedEdit(item, editKey, nextValue);

      var restored = createAcceptedEditElement(editKey, nextValue, valueClass);
      input.replaceWith(restored);
      bindAcceptedEditElement(restored, item);
      refreshAcceptedEditStamp(wrap, item, editKey);
      document.dispatchEvent(new CustomEvent("shiftreview:changed"));
    }

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        save();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        revert();
      }
    });

    input.addEventListener("blur", function () {
      save();
    });
  }

  function bindAcceptedEditElement(target, item) {
    target.addEventListener("click", function (event) {
      event.stopPropagation();
      openAcceptedEditor(target, item);
    });

    target.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAcceptedEditor(target, item);
      }
    });
  }

  function bindAcceptedEdits(root, item) {
    root.querySelectorAll("[data-accepted-edit]").forEach(function (target) {
      if (target.tagName === "INPUT") return;
      bindAcceptedEditElement(target, item);
    });
  }

  function questionZoneHtml(item) {
    return (
      '<div class="card__zone card__zone--question">' +
      '<div class="card__title-row">' +
      '<time class="card__time card__eyebrow" datetime="">' +
      '<span class="card__time-meta">' +
      displayText(attentionTimeMetaText(item)) +
      "</span></time>" +
      '<p class="card__title">' + displayText(item.title) + "</p>" +
      "</div></div>"
    );
  }

  function attentionRemoveButtonHtml() {
    return '<button type="button" class="btn btn--quiet" data-action="remove">Remove</button>';
  }

  function presubmitRevertButtonHtml() {
    return '<button type="button" class="btn btn--quiet" data-action="revert-incident">Not an incident after all</button>';
  }

  function footerSecondaryActionHtml(item) {
    if (item && item._presubmit) return presubmitRevertButtonHtml();
    return attentionRemoveButtonHtml();
  }

  function findAttentionCardForItem(item) {
    if (!item) return null;

    var presubmitGaps = document.getElementById("presubmit-gaps");
    if (presubmitGaps) {
      var host = presubmitGaps.querySelector('[data-incident-id="' + item.id + '"]');
      if (host) {
        return host.querySelector(".card--attention") || host;
      }
    }

    if (attentionStage) {
      return attentionStage.querySelector('.card--attention[data-id="' + item.id + '"]');
    }

    return null;
  }

  function manualDraftBodyHtml(item) {
    return (
      '<div class="manual-draft">' +
      '<textarea class="input manual-draft__input" rows="1" data-manual-draft-input ' +
      'placeholder="' +
      escapeHtml(MANUAL_DRAFT_PLACEHOLDER) +
      '" aria-label="Describe what happened">' +
      escapeHtml(item.draftText || "") +
      "</textarea></div>"
    );
  }

  function manualDraftFooterHtml() {
    return attentionFooterHtml(
      null,
      '<button type="button" class="btn btn--primary" data-action="save-manual-draft" disabled>Save incident</button>'
    );
  }

  function manualDraftCardHtml(item) {
    return (
      '<article class="card card--attention card--manual-draft" data-id="' +
      item.id +
      '" tabindex="-1">' +
      questionZoneHtml(item) +
      '<div class="card__zone card__zone--transcript">' +
      manualDraftBodyHtml(item) +
      "</div>" +
      answerZoneHtml(item, manualDraftFooterHtml()) +
      "</article>"
    );
  }

  function growManualDraftInput(input) {
    if (!input) return;
    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
  }

  function sentenceFromManualDraft(text) {
    return String(text || "").trim();
  }

  function buildManualFallbackIncident(sentence) {
    var logged = sentence.trim();
    if (logged && logged.charAt(0).toLowerCase() === logged.charAt(0)) {
      logged = logged.charAt(0).toUpperCase() + logged.slice(1);
    }
    if (logged && !/[.!?]$/.test(logged)) logged += ".";

    return {
      title: "New incident",
      type: "missing",
      missingField: "Type",
      missingPrompt: "What type of incident was this?",
      time: "",
      logged: logged,
      desc: logged,
      fields: [
        { label: "Time", value: null },
        { label: "Location", value: "not stated" },
        { label: "Type", value: null },
        { label: "Description", value: logged },
      ],
    };
  }

  function applyManualDetection(item, sentence) {
    var text = sentenceFromManualDraft(sentence);
    if (!text) return false;

    var built =
      window.CaptureDetect && window.CaptureDetect.buildIncidentFromSentence
        ? window.CaptureDetect.buildIncidentFromSentence(text)
        : null;

    if (!built) {
      built = buildManualFallbackIncident(text);
    }

    item.manualDraft = false;
    item.draftText = text;
    item.source = text;
    item.logged = built.logged;
    item.desc = built.desc || built.logged;
    item.title = built.title || "New incident";
    item.time = built.time || "";
    item.fields = cloneItemFields(built.fields);
    item.missingField = built.missingField;
    item.missingPrompt = built.missingPrompt;
    item.doubt = built.doubt;
    item.doubtField = built.doubtField;
    item.timeDoubt = built.timeDoubt;
    item.timeShiftCandidate = built.timeShiftCandidate;
    item.timeDayCandidate = built.timeDayCandidate;
    item.confidence = built.confidence;

    item.type = built.type || "missing";

    ensureRowFields(item);
    if (item.type === "missing") syncMissingFieldState(item);

    replaceAttentionCard(item);
    return true;
  }

  function discardAttentionItem(item) {
    attention = attention.filter(function (entry) {
      return entry.id !== item.id;
    });
    renderAttention();
    syncReviewPanel();
    syncCaptureFieldState();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
  }

  function attentionFooterHtml(question, buttonsHtml, item) {
    var questionBlock = question
      ? '<div class="card__answer-question-row"><p class="card__answer-question">' +
        displayText(question) +
        "</p></div>"
      : "";

    return (
      questionBlock +
      '<div class="card__answer-actions">' +
      '<div class="card__answer-controls">' +
      (buttonsHtml || "") +
      "</div>" +
      '<div class="card__answer-secondary">' +
      footerSecondaryActionHtml(item) +
      "</div></div>"
    );
  }

  function typeOptionButtonsHtml() {
    return (
      '<div class="card__type-options">' +
      INCIDENT_TYPE_OPTIONS
        .map(function (type) {
          return (
            '<button type="button" class="btn btn--ghost btn--chip" data-action="pick-type" data-type-value="' +
            escapeHtml(type) +
            '">' +
            escapeHtml(type) +
            "</button>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function footerMissingTimeControlsHtml(item) {
    return (
      '<div class="card__answer-field-row">' +
      '<input class="input ai-transform__field-input ai-transform__field-input--time" type="time" step="60" ' +
      'data-missing-field="Time" autocomplete="off" aria-label="Time" ' +
      'id="missing-field-' +
      escapeHtml(item.id) +
      '-time">' +
      '<button type="button" class="btn btn--primary" data-action="save-field" disabled>Save time</button>' +
      '<button type="button" class="btn btn--ghost" data-action="skip">I don\'t know</button>' +
      "</div>"
    );
  }

  function footerDoubtTimeControlsHtml(item) {
    var timeValue = timeInputValue(item.time);

    return (
      '<div class="card__answer-field-row">' +
      '<input class="input ai-transform__field-input ai-transform__field-input--time" type="time" step="60" ' +
      'data-doubt-field="Time" autocomplete="off" aria-label="Time" ' +
      'id="doubt-field-' +
      escapeHtml(item.id) +
      '"' +
      (timeValue ? ' value="' + escapeHtml(timeValue) + '"' : "") +
      ">" +
      '<button type="button" class="btn btn--primary" data-action="save-field"' +
      (timeValue ? "" : " disabled") +
      ">Save time</button>" +
      "</div>"
    );
  }

  function footerMissingLocationControlsHtml(item) {
    return (
      '<div class="card__answer-field-row">' +
      '<input class="input ai-transform__field-input" type="text" data-missing-field="Location" ' +
      'autocomplete="off" aria-label="Location" placeholder="e.g. Main bar" ' +
      'id="missing-field-' +
      escapeHtml(item.id) +
      '-location">' +
      '<button type="button" class="btn btn--primary" data-action="save-field" disabled>Save location</button>' +
      '<button type="button" class="btn btn--ghost" data-action="skip">I don\'t know</button>' +
      "</div>"
    );
  }

  function missingFieldFooterHtml(item) {
    var label = missingFieldLabel(item);

    if (!label) {
      return attentionFooterHtml(
        null,
        '<button type="button" class="btn btn--primary" data-action="accept">Yes, that\'s right</button>',
        item
      );
    }

    if (label === "Type") {
      return attentionFooterHtml("What type of incident was this?", typeOptionButtonsHtml(), item);
    }

    if (label === "Time") {
      return attentionFooterHtml("When did this happen?", footerMissingTimeControlsHtml(item), item);
    }

    if (label === "Location") {
      return attentionFooterHtml("Where did this happen?", footerMissingLocationControlsHtml(item), item);
    }

    return attentionFooterHtml(
      missingPromptText(item),
      '<button type="button" class="btn btn--primary" data-action="accept">Yes, that\'s right</button>',
      item
    );
  }

  function answerZoneHtml(item, bodyHtml) {
    return '<div class="card__zone card__zone--answer">' + bodyHtml + "</div>";
  }

  var CHIP_REMOVE_ICON_HTML =
    '<svg class="chip__remove-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />' +
    "</svg>";

  var CHIP_THUMB_ICON_IMAGE =
    '<svg class="chip__thumb-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />' +
    "</svg>";

  var CHIP_THUMB_ICON_VIDEO =
    '<svg class="chip__thumb-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />' +
    "</svg>";

  var CHIP_THUMB_ICON_DOCUMENT =
    '<svg class="chip__thumb-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />' +
    "</svg>";

  var EVIDENCE_SETTLE_MS = 600;

  function evidenceFileKind(filename) {
    var parts = String(filename || "").split(".");
    var ext = parts.length > 1 ? parts.pop().toLowerCase() : "";

    if (ext === "jpg" || ext === "jpeg" || ext === "png") return "image";
    if (ext === "mp4" || ext === "mov") return "video";
    return "document";
  }

  function chipThumbHtml(filename) {
    var kind = evidenceFileKind(filename);
    var icon =
      kind === "image"
        ? CHIP_THUMB_ICON_IMAGE
        : kind === "video"
          ? CHIP_THUMB_ICON_VIDEO
          : CHIP_THUMB_ICON_DOCUMENT;

    return (
      '<span class="chip__thumb" aria-hidden="true">' +
      '<span class="chip__thumb-tile chip__thumb-tile--' +
      kind +
      '">' +
      icon +
      "</span></span>"
    );
  }

  function isReportClosed() {
    var submittedView = document.getElementById("submitted-view");
    return !!(submittedView && !submittedView.hidden);
  }

  function chipHtml(file, index, removable) {
    var name = file.name;
    var size = file.size;
    var chipClass = "chip chip--evidence" + (file._settling ? " chip--settling" : "");
    var removeBtn = removable
      ? '<button type="button" class="chip__remove" data-action="remove-evidence" data-evidence-index="' +
        index +
        '" aria-label="Remove ' +
        escapeHtml(name) +
        '">' +
        CHIP_REMOVE_ICON_HTML +
        "</button>"
      : "";

    return (
      '<span class="' + chipClass + '">' +
      chipThumbHtml(name) +
      '<span class="chip__name">' + escapeHtml(name) + "</span>" +
      '<span class="chip__size">' + escapeHtml(size) + "</span>" +
      removeBtn +
      "</span>"
    );
  }

  function activeIncidents(list) {
    return list.filter(function (item) {
      return item.status !== "removed";
    });
  }

  function countRemovedIncidents() {
    return accepted.concat(attention).filter(function (item) {
      return item.status === "removed";
    }).length;
  }

  function incidentTypeLabel(item) {
    return item.title || item.type || "Incident";
  }

  function removedIncidentRowHtml(item) {
    return (
      '<div class="card__removed-row">' +
      '<span class="card__removed-label">Removed · ' +
      displayText(incidentTypeLabel(item)) +
      "</span>" +
      '<button type="button" class="btn btn--quiet" data-action="undo-remove">Undo</button>' +
      "</div>"
    );
  }

  function markIncidentRemoved(item) {
    if (item.status === "removed") return;
    item.status = "removed";
    submissionStats.removed = countRemovedIncidents();
  }

  function undoIncidentRemoved(item) {
    if (item.status !== "removed") return;
    delete item.status;
    submissionStats.removed = countRemovedIncidents();
    renderAccepted();
    renderAttention();
    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
  }

  function bindUndoRemove(root, item) {
    var btn = root.querySelector('[data-action="undo-remove"]');
    if (!btn) return;

    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      undoIncidentRemoved(item);
    });
  }

  function removeAcceptedItem(item) {
    markIncidentRemoved(item);
    renderAccepted();
    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
  }

  function getEvidenceList(item) {
    if (item.evidenceFiles && item.evidenceFiles.length) return item.evidenceFiles.slice();
    if (item.evidence) return [item.evidence];
    return [];
  }

  function nextMockAttachment(item) {
    if (!item.evidenceFiles) item.evidenceFiles = getEvidenceList(item);
    var attachedNames = item.evidenceFiles.map(function (file) {
      return file.name;
    });
    var i;

    for (i = 0; i < MOCK_ATTACHMENTS.length; i++) {
      if (attachedNames.indexOf(MOCK_ATTACHMENTS[i].name) === -1) {
        return MOCK_ATTACHMENTS[i];
      }
    }

    var fallback = MOCK_ATTACHMENTS[0];
    var dotIndex = fallback.name.lastIndexOf(".");
    var stem = fallback.name.slice(0, dotIndex);
    var ext = fallback.name.slice(dotIndex);
    var counter = 2;
    var name;

    while (true) {
      name = stem + "-" + counter + ext;
      if (attachedNames.indexOf(name) === -1) {
        return { name: name, size: fallback.size };
      }
      counter += 1;
    }
  }

  function attachMockEvidence(item) {
    if (!item.evidenceFiles) item.evidenceFiles = getEvidenceList(item);
    if (item.evidence) {
      item.evidenceFiles.push(item.evidence);
      delete item.evidence;
    }
    var template = nextMockAttachment(item);
    var next = { name: template.name, size: template.size, _settling: true };
    item.evidenceFiles.push(next);
    return next;
  }

  function settleEvidenceFile(file) {
    if (!file) return;
    delete file._settling;
  }

  var ATTACH_EVIDENCE_ICON_HTML =
    '<svg class="btn__icon btn__icon--attach" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />' +
    "</svg>";

  function attachEvidenceButtonHtml(disabled) {
    return (
      '<button type="button" class="btn btn--ghost btn--chip btn--attach-evidence" data-action="attach-evidence"' +
      (disabled ? " disabled" : "") +
      ">" +
      ATTACH_EVIDENCE_ICON_HTML +
      '<span class="btn--attach-evidence__label">Attach evidence</span></button>'
    );
  }

  function setAttachEvidenceButtonState(btn, disabled) {
    if (!btn) return;
    btn.disabled = disabled;
  }

  function removeEvidenceFile(item, index) {
    if (!item.evidenceFiles) item.evidenceFiles = getEvidenceList(item);
    if (index < 0 || index >= item.evidenceFiles.length) return;
    item.evidenceFiles.splice(index, 1);
  }

  function focusAfterEvidenceRemoval(root, removedIndex) {
    var attachBtn = root.querySelector('[data-action="attach-evidence"]');
    var removeButtons = root.querySelectorAll('[data-action="remove-evidence"]');

    if (removeButtons.length) {
      var focusIndex = Math.min(removedIndex, removeButtons.length - 1);
      removeButtons[focusIndex].focus();
      return;
    }

    if (attachBtn) attachBtn.focus();
  }

  function evidenceBlockHtml(item, options) {
    options = options || {};
    var files = getEvidenceList(item);
    var removableChips = options.removableChips !== false && !isReportClosed();
    var chips = files
      .map(function (file, index) {
        return chipHtml(file, index, removableChips);
      })
      .join("");
    var uploading = item._evidenceUploading;
    var removeBtn = options.showRemove
      ? '<button type="button" class="btn btn--quiet card__evidence-remove" data-action="remove-accepted">Remove</button>'
      : "";
    var evidenceClass = options.showRemove ? "card__evidence card__evidence--accepted" : "card__evidence";

    return (
      '<div class="' + evidenceClass + '">' +
      '<div class="card__evidence-main">' +
      chips +
      attachEvidenceButtonHtml(uploading) +
      "</div>" +
      removeBtn +
      "</div>"
    );
  }

  function refreshEvidenceBlock(root, item, refresh) {
    var block = root.querySelector(".card__evidence");
    if (!block) return;
    var options = {
      showRemove: block.classList.contains("card__evidence--accepted"),
    };
    block.outerHTML = evidenceBlockHtml(item, options);
    bindCardEvidence(root, item, refresh);
  }

  function bindAttachEvidence(root, item, refresh) {
    var btn = root.querySelector('[data-action="attach-evidence"]');
    if (!btn || btn.dataset.bound === "true") return;

    btn.dataset.bound = "true";
    btn.addEventListener("click", function () {
      if (item._evidenceUploading || isReportClosed()) return;

      var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var settleMs = reducedMotion ? 0 : EVIDENCE_SETTLE_MS;
      var addedFile = attachMockEvidence(item);

      item._evidenceUploading = true;
      refresh();

      window.setTimeout(function () {
        settleEvidenceFile(addedFile);
        item._evidenceUploading = false;
        refresh();
      }, settleMs);
    });
  }

  function bindEvidenceRemove(root, item, refresh) {
    root.querySelectorAll('[data-action="remove-evidence"]').forEach(function (btn) {
      if (btn.dataset.bound === "true") return;

      btn.dataset.bound = "true";
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        event.preventDefault();
        if (isReportClosed()) return;

        var chip = btn.closest(".chip");
        if (chip && chip.classList.contains("chip--removing")) return;

        var index = parseInt(btn.getAttribute("data-evidence-index"), 10);
        if (isNaN(index)) return;

        var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        function completeRemoval() {
          removeEvidenceFile(item, index);
          refresh();
          focusAfterEvidenceRemoval(root, index);
        }

        if (chip && !reducedMotion) {
          chip.classList.add("chip--removing");
          window.setTimeout(completeRemoval, 120);
          return;
        }

        completeRemoval();
      });
    });
  }

  function flashDetectedCard(card) {
    card.classList.remove("card--detected-in");
    void card.offsetWidth;
    card.classList.add("card--detected-in");

    card.addEventListener(
      "animationend",
      function (event) {
        if (event.animationName !== "card-detected-in") return;
        card.classList.remove("card--detected-in");
      },
      { once: true }
    );
  }

  function flashAcceptedStackIn(card) {
    card.classList.remove("card--stack-in");
    void card.offsetWidth;
    card.classList.add("card--stack-in");

    card.addEventListener(
      "animationend",
      function (event) {
        if (event.animationName !== "accepted-stack-in") return;
        card.classList.remove("card--stack-in");
      },
      { once: true }
    );
  }

  function tickAcceptedCount() {
    if (!acceptedCountEl) return;
    acceptedCountEl.classList.remove("is-ticking");
    void acceptedCountEl.offsetWidth;
    acceptedCountEl.textContent = String(activeIncidents(accepted).length);
    acceptedCountEl.classList.add("is-ticking");
  }

  function peekAcceptedSection() {
    if (!acceptedGroup) return;

    var wasCollapsed = acceptedGroup.classList.contains("accepted-group--collapsed");
    acceptedGroup.dataset.peeking = "true";
    acceptedGroup.classList.remove("accepted-group--collapsed");
    acceptedToggle.setAttribute("aria-expanded", "true");

    window.clearTimeout(acceptedPeekTimer);
    acceptedPeekTimer = window.setTimeout(function () {
      delete acceptedGroup.dataset.peeking;
      if (wasCollapsed) {
        acceptedGroup.classList.add("accepted-group--collapsed");
        acceptedToggle.setAttribute("aria-expanded", "false");
      }
    }, 2000);
  }

  function isCompleteHighConfidence(item) {
    if (item.confidence !== "high") return false;
    if (item.type === "low" || item.type === "missing") return false;
    if (item.doubt) return false;

    var fields = item.fields || [];
    if (!fields.length) return false;

    for (var i = 0; i < fields.length; i++) {
      if (isEmptyFieldValue(fields[i].value)) return false;
    }

    var timeVal = item.time;
    if (isEmptyFieldValue(timeVal)) {
      var timeField = fields.find(function (field) {
        return field.label === "Time";
      });
      timeVal = timeField ? timeField.value : null;
    }

    return !isEmptyFieldValue(timeVal);
  }

  var ACCEPTED_CHEVRON =
    '<svg class="card__accepted-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5 15.75 12l-7.5 7.5" />' +
    "</svg>";

  function renderAcceptedItem(item, expanded) {
    var li = document.createElement("li");
    li.dataset.id = item.id;

    if (item.status === "removed") {
      li.className = "card card--accepted card--removed card--collapsed";
      li.innerHTML = removedIncidentRowHtml(item);
      bindUndoRemove(li, item);
      return li;
    }

    li.className = "card card--accepted" + (expanded ? " card--expanded" : " card--collapsed");

    li.innerHTML =
      '<button type="button" class="card__accepted-row" aria-expanded="' + (expanded ? "true" : "false") + '">' +
      '<span class="card__accepted-line">' +
      acceptedRowTimeHtml(item) +
      '<span class="editable" data-field="title" tabindex="0">' + displayText(item.title) + "</span>" +
      "</span>" +
      ACCEPTED_CHEVRON +
      "</button>" +
      '<div class="card__expanded-body">' +
      '<div class="card__title-row">' +
      '<time class="card__time card__eyebrow" datetime="">' + timeMetaHtml(item) + "</time>" +
      '<p class="card__title editable" data-field="title" tabindex="0">' + displayText(item.title) + "</p></div>" +
      acceptedCardBodyHtml(item) +
      evidenceBlockHtml(item, { showRemove: true }) +
      "</div>";

    var toggle = li.querySelector(".card__accepted-row");
    toggle.addEventListener("click", function (event) {
      if (
        event.target.closest(".editable") ||
        event.target.closest("[data-accepted-edit]") ||
        event.target.closest(".accepted-edit-input")
      ) {
        event.stopPropagation();
        return;
      }

      if (li.classList.contains("card--expanded")) {
        li.classList.remove("card--expanded");
        li.classList.add("card--collapsed");
        toggle.setAttribute("aria-expanded", "false");
        return;
      }

      collapseAllAccepted();
      li.classList.remove("card--collapsed");
      li.classList.add("card--expanded");
      toggle.setAttribute("aria-expanded", "true");
    });

    var removeBtn = li.querySelector('[data-action="remove-accepted"]');
    if (removeBtn) {
      removeBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        removeAcceptedItem(item);
      });
    }

    bindEditableFields(li, item);
    bindAcceptedEdits(li, item);
    bindCardEvidence(li, item);
    return li;
  }

  function bindCardEvidence(root, item) {
    function refresh() {
      refreshEvidenceBlock(root, item, refresh);
    }
    bindAttachEvidence(root, item, refresh);
    bindEvidenceRemove(root, item, refresh);
  }

  function collapseAllAccepted() {
    acceptedList.querySelectorAll(".card--accepted").forEach(function (card) {
      card.classList.add("card--collapsed");
      card.classList.remove("card--expanded");
      var toggle = card.querySelector(".card__accepted-row");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  }

  function bindEditableFields(root, item) {
    root.querySelectorAll(".editable[data-field]").forEach(function (field) {
      field.addEventListener("click", function (event) {
        event.stopPropagation();
      });
      field.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          field.blur();
        }
      });
      field.addEventListener("focus", function () {
        field.setAttribute("contenteditable", "true");
      });
      field.addEventListener("blur", function () {
        field.removeAttribute("contenteditable");
        var key = field.dataset.field;
        if (key) item[key] = field.textContent.trim();
      });
    });
  }

  function updateAcceptedGroupState(options) {
    options = options || {};
    if (!acceptedToggle || !acceptedGroup) return;

    if (options.tickCount) {
      tickAcceptedCount();
    } else if (acceptedCountEl) {
      acceptedCountEl.textContent = String(activeIncidents(accepted).length);
    }

    if (acceptedGroup.dataset.peeking) return;

    var collapsed = accepted.length > 5;
    if (!acceptedGroup.dataset.userToggled) {
      acceptedGroup.classList.toggle("accepted-group--collapsed", collapsed);
      acceptedToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
  }

  function renderAccepted() {
    sortAcceptedChronologically();
    acceptedList.innerHTML = "";
    accepted.forEach(function (item) {
      acceptedList.appendChild(renderAcceptedItem(item, false));
    });
    updateAcceptedGroupState();
  }

  function motionReduced() {
    return reducedMotionQuery.matches;
  }

  function motionMs(key) {
    if (!motionReduced()) return TIMING[key];
    if (key === "flash") return 0;
    return TIMING.reduced;
  }

  function setSystemLine(lineEl, copyEl, message) {
    if (!lineEl) return;

    var text = String(message || "").trim();
    var copy = copyEl;

    if (!copy && lineEl.children.length > 1) {
      copy = lineEl.children[lineEl.children.length - 1];
    }

    if (!text) {
      lineEl.hidden = true;
      if (copy) copy.textContent = "";
      return;
    }

    if (copy) copy.textContent = text;
    lineEl.hidden = false;
    animateSystemSignals(lineEl);
  }

  function syncAllClearLine(showAllClear) {
    if (!attentionAllClearLine || !attentionAllClearCopy) return;

    if (isQuietNightWorkspace()) {
      attentionAllClearLine.hidden = true;
      attentionAllClearCopy.textContent = "";
      return;
    }

    var confirmed = activeIncidents(accepted).length;
    var pending = activeIncidents(attention).length;
    var shouldShow = !!showAllClear && pending === 0 && confirmed > 0;

    if (!shouldShow) {
      attentionAllClearLine.hidden = true;
      attentionAllClearCopy.textContent = "";
      return;
    }

    setSystemLine(
      attentionAllClearLine,
      attentionAllClearCopy,
      confirmed +
        " incident" +
        (confirmed === 1 ? "" : "s") +
        " confirmed. Submit when you're ready."
    );
  }

  function syncQuietNightState() {
    var showQuiet = isQuietNightWorkspace();

    if (attentionHeadingQuiet) attentionHeadingQuiet.hidden = !showQuiet;
    if (attentionQuietNightLine) attentionQuietNightLine.hidden = !showQuiet;
    if (attentionStage) attentionStage.hidden = showQuiet;

    if (showQuiet) {
      if (attentionHeadingCount) attentionHeadingCount.hidden = true;
      if (attentionHeadingLabel) attentionHeadingLabel.hidden = true;
      if (attentionHeadingClear) attentionHeadingClear.hidden = true;
      syncAllClearLine(false);
      if (attentionQuietNightLine) animateSystemSignals(attentionQuietNightLine);
      return;
    }

    if (attentionQuietNightLine) attentionQuietNightLine.hidden = true;
  }

  function updateAttentionHeading(count, options) {
    options = options || {};
    if (!attentionHeadingCount || !attentionHeadingLabel || !attentionHeadingClear) return;

    if (isQuietNightWorkspace()) {
      syncQuietNightState();
      return;
    }

    if (attentionHeadingQuiet) attentionHeadingQuiet.hidden = true;
    if (attentionQuietNightLine) attentionQuietNightLine.hidden = true;

    if (count === 0) {
      attentionHeadingCount.hidden = true;
      attentionHeadingLabel.hidden = true;
      attentionHeadingClear.hidden = false;
      syncAllClearLine(true);
      return;
    }

    attentionHeadingCount.hidden = false;
    attentionHeadingLabel.hidden = false;
    attentionHeadingClear.hidden = true;
    syncAllClearLine(false);

    if (options.animate) {
      attentionHeadingCount.classList.remove("is-ticking");
      void attentionHeadingCount.offsetWidth;
      attentionHeadingCount.textContent = String(count);
      attentionHeadingCount.classList.add("is-ticking");
      return;
    }

    attentionHeadingCount.textContent = String(count);
  }

  function hideAttentionSection() {
    if (!attentionQueue) return;

    attentionQueue.hidden = false;
    attentionQueue.classList.remove(
      "attention-queue--clearing",
      "attention-queue--all-clear-hold",
      "attention-queue--collapsed"
    );
    attentionQueue.style.maxHeight = "";
    attentionQueue.style.opacity = "";
    attentionQueue.style.overflow = "";
    attentionQueue.style.marginBottom = "";

    if (attentionQueueBody) {
      attentionQueueBody.style.maxHeight = "";
      attentionQueueBody.style.opacity = "";
      attentionQueueBody.style.marginTop = "";
    }

    if (attentionStage) attentionStage.innerHTML = "";
    updateAttentionHeading(0);
  }

  function collapseAttentionSection() {
    if (!attentionQueue) return;

    attentionQueue.classList.remove("attention-queue--all-clear-hold");
    attentionQueue.classList.add("attention-queue--clearing");
    attentionQueue.style.overflow = "hidden";
    attentionQueue.style.maxHeight = attentionQueue.scrollHeight + "px";
    attentionQueue.style.opacity = "1";

    window.requestAnimationFrame(function () {
      attentionQueue.style.maxHeight = "0";
      attentionQueue.style.opacity = "0";
      attentionQueue.style.marginBottom = "0";
    });

    window.setTimeout(hideAttentionSection, motionMs("collapse"));
  }

  function prependAccepted(item, options) {
    options = options || {};
    accepted.unshift(item);
    var li = renderAcceptedItem(item, false);
    acceptedList.insertBefore(li, acceptedList.firstChild);

    if (options.animateDetect) {
      flashAcceptedStackIn(li);
      animateSystemSignals(li);
      peekAcceptedSection();
    }

    if (options.confirmed) {
      li.classList.add("card--confirmed-in");
      li.addEventListener(
        "animationend",
        function () {
          li.classList.remove("card--confirmed-in");
        },
        { once: true }
      );
    }

    updateAcceptedGroupState({ tickCount: options.animateDetect });

    if (!options.deferSync) {
      syncReviewPanel();
      document.dispatchEvent(new CustomEvent("shiftreview:changed"));
    }

    return li;
  }

  function addLiveDetection(item, options) {
    options = options || {};
    var payload = {
      id: item.id || "live-" + Date.now(),
      type: item.type,
      time: item.time || "",
      title: item.title || "New incident",
      logged: item.logged || item.desc || item.title,
      desc: item.desc || item.logged || "Detected from shift notes.",
      source: item.source,
      fields: item.fields || [{ label: "Time", value: item.time || null }],
      provenance: "live",
      detectionKey: item.detectionKey,
      detectionLinked: item.detectionLinked !== false,
      confidence: item.confidence,
      doubt: item.doubt,
      doubtField: item.doubtField,
      timeDoubt: item.timeDoubt,
      timeShiftCandidate: item.timeShiftCandidate,
      timeDayCandidate: item.timeDayCandidate,
      missingField: item.missingField,
      missingPrompt: item.missingPrompt,
      captured: item.captured,
      _presubmit: item._presubmit,
      _presubmitSentenceId: item._presubmitSentenceId,
    };

    if (isCompleteHighConfidence(payload)) {
      payload.confirmedByUser = true;
      prependAccepted(payload, { animateDetect: true });
      document.dispatchEvent(
        new CustomEvent("capture:logged", {
          detail: { title: payload.title },
        })
      );
      return { destination: "accepted", title: payload.title, id: payload.id };
    }

    var attentionPayload = Object.assign({}, payload, {
      type: payload.type || "missing",
    });

    ensureRowFields(attentionPayload);
    if (attentionPayload.type === "missing") syncMissingFieldState(attentionPayload);

    prependAttention(attentionPayload, { animateDetect: true });
    return { destination: "attention", title: attentionPayload.title, id: attentionPayload.id };
  }

  function replaceAttentionCard(item) {
    var card = findAttentionCardForItem(item);
    if (!card) return;

    var wrapper = document.createElement("div");
    wrapper.innerHTML = attentionCardHtml(item);
    var replacement = wrapper.firstElementChild;
    card.replaceWith(replacement);
    bindAttentionCard(replacement, item);
    if (!item._presubmit) {
      focusAttentionCard(replacement, item);
    }
  }

  function attentionCardHtml(item) {
    if (item.status === "removed") {
      return (
        '<article class="card card--removed card--attention-removed" data-id="' +
        item.id +
        '">' +
        removedIncidentRowHtml(item) +
        "</article>"
      );
    }

    if (isManualDraftCard(item)) {
      return manualDraftCardHtml(item);
    }

    var cardTypeClass = item.type === "missing" ? " card--missing" : " card--low";
    var footerHtml;

    if (isOutsideShiftTimeCard(item)) {
      footerHtml = attentionFooterHtml(
        item.doubt,
        '<button type="button" class="btn btn--primary" data-action="accept-shift-time">Yes, ' +
          escapeHtml(item.timeShiftCandidate) +
          "</button>" +
          '<button type="button" class="btn btn--ghost" data-action="accept-day-time">No, it was ' +
          escapeHtml(item.timeDayCandidate) +
          "</button>" +
          '<button type="button" class="btn btn--ghost" data-action="set-exact-time">Set a different time</button>',
        item
      );
    } else if (isApproximateTimeCard(item)) {
      footerHtml = attentionFooterHtml(
        item.doubt,
        '<button type="button" class="btn btn--primary" data-action="accept-approx-time">Yes, around ' +
          escapeHtml(item.time) +
          "</button>" +
          '<button type="button" class="btn btn--ghost" data-action="set-exact-time">Set exact time</button>',
        item
      );
    } else if (item._editingDoubtTime) {
      footerHtml = attentionFooterHtml(null, footerDoubtTimeControlsHtml(item), item);
    } else if (item.type === "missing" && item._showMissingTimeInput) {
      footerHtml = attentionFooterHtml("When did this happen?", footerMissingTimeControlsHtml(item), item);
    } else if (isMissingLoggedTime(item)) {
      footerHtml = attentionFooterHtml(
        "You logged this at " + item.captured + ". Did it happen around then?",
        '<button type="button" class="btn btn--primary" data-action="accept-logged-time">Yes, around ' +
          escapeHtml(item.captured) +
          "</button>" +
          '<button type="button" class="btn btn--ghost" data-action="set-different-time">Set a different time</button>' +
          '<button type="button" class="btn btn--ghost" data-action="skip">I don\'t know</button>',
        item
      );
    } else if (item.type === "missing") {
      footerHtml = missingFieldFooterHtml(item);
    } else if (needsConfirmFooter(item)) {
      footerHtml = attentionFooterHtml(
        null,
        '<button type="button" class="btn btn--primary" data-action="accept">Yes, that\'s right</button>',
        item
      );
    } else {
      footerHtml = attentionFooterHtml(
        item.doubt || "Is this right?",
        '<button type="button" class="btn btn--primary" data-action="accept">Yes, that\'s right</button>',
        item
      );
    }

    return (
      '<article class="card card--attention' + cardTypeClass + '" data-id="' + item.id + '" tabindex="-1">' +
      questionZoneHtml(item) +
      '<div class="card__zone card__zone--transcript">' +
      aiTransformHtml(item) +
      evidenceBlockHtml(item) +
      "</div>" +
      answerZoneHtml(item, footerHtml) +
      "</article>"
    );
  }

  function attentionItemById(id) {
    return attention.find(function (entry) {
      return entry.id === id;
    });
  }

  function cloneItemFields(item) {
    if (!item.fields) return undefined;

    return item.fields.map(function (field) {
      return { label: field.label, value: field.value };
    });
  }

  function buildAcceptedItem(item, card, mode) {
    var acceptedItem = {
      id: "a-" + item.id,
      time: item.time,
      title: item.title,
      logged: loggedText(item),
      source: item.source,
      fields: cloneItemFields(item),
      evidenceFiles: getEvidenceList(item),
      provenance: item.provenance,
      captured: item.captured,
      addedAt: item.addedAt,
      confirmedByUser: true,
      _presubmitSentenceId: item._presubmitSentenceId,
    };

    if (acceptedItem.fields) {
      acceptedItem.fields.forEach(function (field) {
        if (isUnknownFieldValue(item, field.label) || field.value === "unknown") {
          field.value = "unknown";
        }
      });
    }

    if (isEmptyFieldValue(acceptedItem.time) || acceptedItem.time === "unknown") {
      acceptedItem.time = acceptedItem.time === "unknown" ? "unknown" : "";
    }

    return acceptedItem;
  }

  function commitMissingField(card, item) {
    if (item.type !== "missing") return null;

    var label = missingFieldLabel(item);
    if (!label) return null;

    var input = card.querySelector('[data-missing-field="' + label + '"]');
    if (!input) return null;

    var value = input.value.trim();
    if (!value) return null;

    return { label: label, value: value };
  }

  function beginAttentionExit(card, item, mode, nextCount) {
    var isConfirm = mode === "accept" || mode === "save" || mode === "accept-logged-time";

    card.classList.add("card--resolving");
    card.classList.add(isConfirm ? "card--exit-rise" : "card--exit-sink");

    if (nextCount > 0) {
      updateAttentionHeading(nextCount, { animate: true });
    }
  }

  function countUnknownFieldsInItem(item) {
    var count = 0;

    MISSING_FIELD_ORDER.forEach(function (label) {
      if (isUnknownFieldValue(item, label)) {
        count += 1;
        return;
      }

      if (isFieldUnresolved(item, label)) count += 1;
    });

    return count;
  }

  function finishAttentionResolve(item, card, mode) {
    freezeDetectionLink(item);

    var addAccepted = mode === "accept" || mode === "save" || mode === "accept-logged-time";
    var presubmit = !!item._presubmit;
    var acceptedItem = null;

    if (addAccepted) {
      acceptedItem = buildAcceptedItem(item, card, mode);
      prependAccepted(acceptedItem, { confirmed: true, deferSync: true });
    }

    attention = attention.filter(function (entry) {
      return entry.id !== item.id;
    });
    var wasLast = attention.length === 0;

    if (presubmit) {
      syncReviewPanel();
      document.dispatchEvent(new CustomEvent("shiftreview:changed"));
      if (addAccepted && acceptedItem) {
        document.dispatchEvent(
          new CustomEvent("presubmit:incident-confirmed", {
            detail: {
              incidentId: item.id,
              sentenceId: item._presubmitSentenceId,
              acceptedItem: acceptedItem,
            },
          })
        );
      }
      attentionResolving = false;
      return;
    }

    if (wasLast) {
      if (attentionStage) attentionStage.innerHTML = "";
      updateAttentionHeading(0);

      if (attentionQueue) {
        attentionQueue.hidden = false;
        attentionQueue.classList.add("attention-queue--all-clear-hold");
        attentionQueue.classList.remove("attention-queue--clearing", "attention-queue--collapsed");
      }

      syncReviewPanel();
      document.dispatchEvent(new CustomEvent("shiftreview:changed"));
      attentionResolving = false;

      window.setTimeout(hideAttentionSection, motionMs("accepted"));
      return;
    }

    renderAttention();
    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
    attentionResolving = false;
  }

  function resolveAttention(mode, item) {
    if (attentionResolving) return;
    if (!item) return;

    if (mode === "remove") {
      markIncidentRemoved(item);
      renderAttention();
      syncReviewPanel();
      document.dispatchEvent(new CustomEvent("shiftreview:changed"));
      return;
    }

    var card = findAttentionCardForItem(item);
    if (!card) return;

    if (item._presubmit) {
      attentionResolving = true;
      finishAttentionResolve(item, card, mode);
      return;
    }

    attentionResolving = true;
    var nextCount = attention.length - 1;
    var flashMs = motionMs("flash");
    var exitMs = motionMs("exit");
    var isConfirm = mode === "accept" || mode === "save" || mode === "accept-logged-time";

    function runExit() {
      beginAttentionExit(card, item, mode, nextCount);
      window.setTimeout(function () {
        finishAttentionResolve(item, card, mode);
      }, exitMs);
    }

    if (isConfirm && flashMs > 0) {
      card.classList.add("card--confirm-flash");
      window.setTimeout(function () {
        card.classList.remove("card--confirm-flash");
        runExit();
      }, flashMs);
      return;
    }

    runExit();
  }

  function createDoubtFieldButton(label, value) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "ai-transform__field-value ai-transform__field-value--doubt";
    button.dataset.fieldLabel = label;
    button.textContent = value;
    return button;
  }

  function bindDoubtFieldButton(button, item) {
    button.addEventListener("click", function () {
      openDoubtFieldEditor(button.closest(".card"), item, button);
    });
  }

  function openDoubtFieldEditor(card, item, target) {
    if (!card || !item.doubtField) return;

    if (item.doubtField === "Time") {
      var timeField = (item.fields || []).find(function (field) {
        return field.label === "Time";
      });
      var timeValue = timeField ? timeField.value : item.time;

      if (isDoubtApproximateTime(item, { label: "Time", value: timeValue })) {
        item._editingDoubtTime = true;
        replaceAttentionCard(item);
        return;
      }

      var timeInput = card.querySelector("[data-doubt-field]");
      if (timeInput) {
        timeInput.focus();
        if (typeof timeInput.showPicker === "function") {
          try {
            timeInput.showPicker();
          } catch (error) {
            /* showPicker may throw if not user-gesture */
          }
        }
      }
      return;
    }

    var button = target;
    if (!button || !button.classList.contains("ai-transform__field-value--doubt")) {
      button = card.querySelector('.ai-transform__field-value--doubt[data-field-label="' + item.doubtField + '"]');
    }

    if (!button) return;

    if (button.tagName === "INPUT") {
      button.focus();
      button.select();
      return;
    }

    var label = button.dataset.fieldLabel;
    var original = button.textContent;
    var input = document.createElement("input");
    input.type = "text";
    input.className = "input ai-transform__field-input";
    input.value = original;
    input.dataset.fieldLabel = label;
    input.setAttribute("aria-describedby", "doubt-hint-" + item.id);

    button.replaceWith(input);
    input.defaultValue = original;
    input.focus();
    input.select();

    function revert() {
      if (!input.isConnected) return;
      var restored = createDoubtFieldButton(label, original);
      input.replaceWith(restored);
      bindDoubtFieldButton(restored, item);
    }

    function save() {
      if (!input.isConnected) return;
      var nextValue = input.value.trim() || original;
      updateItemField(item, label, nextValue);
      var saved = createDoubtFieldButton(label, nextValue);
      input.replaceWith(saved);
      bindDoubtFieldButton(saved, item);
    }

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        save();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        revert();
      }
    });

    input.addEventListener("blur", function () {
      save();
    });
  }

  function commitDoubtFieldEditor(card, item) {
    if (!item.doubtField) return;

    var timeInput = card.querySelector("[data-doubt-field]");
    if (timeInput) {
      if (timeInput.value) updateItemField(item, item.doubtField, timeInput.value.trim());
      return;
    }

    var input = card.querySelector(".ai-transform__field-input");
    if (!input || input.type === "time") return;

    var label = input.dataset.fieldLabel;
    var nextValue = input.value.trim() || input.defaultValue;
    updateItemField(item, label, nextValue);
    var saved = createDoubtFieldButton(label, nextValue);
    input.replaceWith(saved);
    bindDoubtFieldButton(saved, item);
  }

  function bindDoubtFieldEditors(card, item) {
    if (!item.doubtField) return;

    var timeInput = card.querySelector("[data-doubt-field]");
    if (timeInput) {
      timeInput.addEventListener("change", function () {
        if (timeInput.value) updateItemField(item, item.doubtField, timeInput.value.trim());
      });
    } else {
      card.querySelectorAll(".ai-transform__field-value--doubt").forEach(function (button) {
        bindDoubtFieldButton(button, item);
      });
    }

    card.querySelectorAll('[data-action="edit-doubt-field"]').forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        openDoubtFieldEditor(card, item, trigger);
      });
    });
  }

  function createEditableFieldButton(label) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "ai-transform__unstated-btn";
    button.dataset.action = "edit-missing-field";
    button.dataset.fieldLabel = label;
    button.textContent = "not stated";
    return button;
  }

  function bindSecondaryMissingFieldButton(button, card, item) {
    button.addEventListener("click", function () {
      openSecondaryMissingFieldEditor(card, item, button);
    });
  }

  function openSecondaryMissingFieldEditor(card, item, target) {
    if (!card || !target) return;

    var label = target.dataset.fieldLabel;
    if (!label) return;

    var input = document.createElement("input");
    input.type = "text";
    input.className = "input ai-transform__field-input";
    input.value = "";
    input.dataset.fieldLabel = label;
    input.placeholder = (requiredFieldConfig(label) || {}).placeholder || "";

    target.replaceWith(input);
    input.focus();

    function revert() {
      if (!input.isConnected) return;
      var restored = createEditableFieldButton(label);
      input.replaceWith(restored);
      bindSecondaryMissingFieldButton(restored, card, item);
    }

    function save() {
      if (!input.isConnected) return;
      var nextValue = input.value.trim();
      if (!nextValue) {
        revert();
        return;
      }

      updateItemField(item, label, nextValue);
      var saved = document.createElement("span");
      saved.className = "ai-transform__field-value";
      saved.textContent = nextValue;
      input.replaceWith(saved);
    }

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        save();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        revert();
      }
    });

    input.addEventListener("blur", function () {
      save();
    });
  }

  function bindSecondaryMissingFieldEditors(card, item) {
    card.querySelectorAll('[data-action="edit-missing-field"]').forEach(function (button) {
      bindSecondaryMissingFieldButton(button, card, item);
    });
  }

  function bindRemoveButton(card, item) {
    var revertBtn = card.querySelector('[data-action="revert-incident"]');
    if (revertBtn) {
      revertBtn.addEventListener("click", function () {
        document.dispatchEvent(
          new CustomEvent("presubmit:revert-incident", {
            detail: {
              incidentId: item.id,
              sentenceId: item._presubmitSentenceId,
            },
          })
        );
      });
      return;
    }

    var removeBtn = card.querySelector('[data-action="remove"]');
    if (!removeBtn) return;

    removeBtn.addEventListener("click", function () {
      if (isManualDraftCard(item)) {
        discardAttentionItem(item);
        return;
      }

      resolveAttention("remove", item);
    });
  }

  function bindManualDraftCard(card, item) {
    var input = card.querySelector("[data-manual-draft-input]");
    var saveBtn = card.querySelector('[data-action="save-manual-draft"]');
    var typingTimer = null;

    function syncSaveButton() {
      if (!saveBtn || !input) return;
      saveBtn.disabled = !sentenceFromManualDraft(input.value);
    }

    function commitDraft() {
      if (!input) return;
      var text = sentenceFromManualDraft(input.value);
      if (!text) {
        discardAttentionItem(item);
        return;
      }

      item.draftText = text;
      applyManualDetection(item, text);
    }

    function scheduleDetection() {
      window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(function () {
        if (!sentenceFromManualDraft(input.value)) return;
        commitDraft();
      }, MANUAL_DETECTION_DELAY_MS);
    }

    if (input) {
      growManualDraftInput(input);
      input.addEventListener("input", function () {
        item.draftText = input.value;
        growManualDraftInput(input);
        syncSaveButton();
        scheduleDetection();
      });

      input.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        window.clearTimeout(typingTimer);
        commitDraft();
      });

      input.addEventListener("blur", function () {
        window.clearTimeout(typingTimer);
        window.setTimeout(function () {
          if (!card.isConnected) return;
          if (card.contains(document.activeElement)) return;
          if (!sentenceFromManualDraft(input.value)) {
            discardAttentionItem(item);
          }
        }, 0);
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        if (saveBtn.disabled) return;
        window.clearTimeout(typingTimer);
        commitDraft();
      });
    }

    bindRemoveButton(card, item);
    syncSaveButton();
  }

  function bindSaveTimeButton(card, item, inputSelector) {
    var saveBtn = card.querySelector('[data-action="save-field"]');
    var input = card.querySelector(inputSelector);
    if (!saveBtn || !input) return;

    function syncSaveButton() {
      saveBtn.disabled = !input.value.trim();
    }

    input.addEventListener("input", syncSaveButton);
    input.addEventListener("change", syncSaveButton);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && input.value.trim()) {
        event.preventDefault();
        if (inputSelector === "[data-doubt-field]") {
          updateItemField(item, item.doubtField, input.value.trim());
          item.doubt = null;
          item.doubtField = null;
          item.timeDoubt = null;
          item._editingDoubtTime = false;
        } else {
          commitMissingField(card, item);
        }
        resolveAttention("accept", item);
      }
    });
    syncSaveButton();

    saveBtn.addEventListener("click", function () {
      if (saveBtn.disabled) return;
      if (inputSelector === "[data-doubt-field]") {
        updateItemField(item, item.doubtField, input.value.trim());
        item.doubt = null;
        item.doubtField = null;
        item.timeDoubt = null;
        item._editingDoubtTime = false;
      } else {
        commitMissingField(card, item);
      }
      resolveAttention("accept", item);
    });
  }

  function bindOutsideShiftTimeCard(card, item) {
    var acceptShiftBtn = card.querySelector('[data-action="accept-shift-time"]');
    var acceptDayBtn = card.querySelector('[data-action="accept-day-time"]');
    var setExactBtn = card.querySelector('[data-action="set-exact-time"]');

    if (acceptShiftBtn) {
      acceptShiftBtn.addEventListener("click", function () {
        updateItemField(item, "Time", item.timeShiftCandidate);
        resolveAttention("accept", item);
      });
    }

    if (acceptDayBtn) {
      acceptDayBtn.addEventListener("click", function () {
        updateItemField(item, "Time", item.timeDayCandidate);
        resolveAttention("accept", item);
      });
    }

    if (setExactBtn) {
      setExactBtn.addEventListener("click", function () {
        item._editingDoubtTime = true;
        replaceAttentionCard(item);
      });
    }
  }

  function bindApproximateTimeCard(card, item) {
    var acceptBtn = card.querySelector('[data-action="accept-approx-time"]');
    var setExactBtn = card.querySelector('[data-action="set-exact-time"]');

    if (acceptBtn) {
      acceptBtn.addEventListener("click", function () {
        resolveAttention("accept", item);
      });
    }

    if (setExactBtn) {
      setExactBtn.addEventListener("click", function () {
        item._editingDoubtTime = true;
        replaceAttentionCard(item);
      });
    }
  }

  function bindMissingLoggedTimeCard(card, item) {
    var acceptLoggedBtn = card.querySelector('[data-action="accept-logged-time"]');
    var setTimeBtn = card.querySelector('[data-action="set-different-time"]');
    var saveBtn = card.querySelector('[data-action="save-field"]');
    var skipBtn = card.querySelector('[data-action="skip"]');
    var missingInput = card.querySelector("[data-missing-field]");

    function syncSaveButton() {
      if (!saveBtn || !missingInput) return;
      saveBtn.disabled = !missingInput.value.trim();
    }

    if (acceptLoggedBtn) {
      acceptLoggedBtn.addEventListener("click", function () {
        advanceMissingField(item, "Time", item.captured);
      });
    }

    if (setTimeBtn) {
      setTimeBtn.addEventListener("click", function () {
        item._showMissingTimeInput = true;
        replaceAttentionCard(item);
      });
    }

    if (missingInput) {
      missingInput.addEventListener("input", syncSaveButton);
      missingInput.addEventListener("change", syncSaveButton);
      missingInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && missingInput.value.trim()) {
          event.preventDefault();
          var committed = commitMissingField(card, item);
          if (committed) advanceMissingField(item, committed.label, committed.value);
        }
      });
      syncSaveButton();
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        if (saveBtn.disabled) return;
        var committed = commitMissingField(card, item);
        if (committed) advanceMissingField(item, committed.label, committed.value);
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener("click", function () {
        advanceMissingField(item, "Time", "unknown");
      });
    }

    card.addEventListener("keydown", function (event) {
      if (event.target.tagName === "INPUT") return;

      if (event.key === "Backspace") {
        event.preventDefault();
        resolveAttention("skip", item);
      }
    });
  }

  function bindMissingCard(card, item) {
    var label = missingFieldLabel(item);

    card.querySelectorAll('[data-action="pick-type"]').forEach(function (button) {
      button.addEventListener("click", function () {
        advanceMissingField(item, "Type", button.dataset.typeValue);
      });
    });

    var saveBtn = card.querySelector('[data-action="save-field"]');
    var skipBtn = card.querySelector('[data-action="skip"]');
    var missingInput = label
      ? card.querySelector('[data-missing-field="' + label + '"]')
      : null;

    function syncSaveButton() {
      if (!saveBtn || !missingInput) return;
      saveBtn.disabled = !missingInput.value.trim();
    }

    if (missingInput) {
      missingInput.addEventListener("input", syncSaveButton);
      missingInput.addEventListener("change", syncSaveButton);
      missingInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && missingInput.value.trim()) {
          event.preventDefault();
          var committed = commitMissingField(card, item);
          if (committed) advanceMissingField(item, committed.label, committed.value);
        }
      });
      syncSaveButton();
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        if (saveBtn.disabled) return;
        var committed = commitMissingField(card, item);
        if (committed) advanceMissingField(item, committed.label, committed.value);
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener("click", function () {
        if (!label) return;
        advanceMissingField(item, label, "unknown");
      });
    }

    var acceptBtn = card.querySelector('[data-action="accept"]');
    if (acceptBtn) {
      acceptBtn.addEventListener("click", function () {
        resolveAttention("accept", item);
      });
    }
  }

  function focusAttentionCard(card, item) {
    if (!card || !item) return;

    if (isManualDraftCard(item)) {
      var draftInput = card.querySelector("[data-manual-draft-input]");
      if (draftInput) draftInput.focus();
      return;
    }

    if (isOutsideShiftTimeCard(item)) {
      var shiftBtn = card.querySelector('[data-action="accept-shift-time"]');
      if (shiftBtn) shiftBtn.focus();
      return;
    }

    if (isApproximateTimeCard(item)) {
      var approxBtn = card.querySelector('[data-action="accept-approx-time"]');
      if (approxBtn) approxBtn.focus();
      return;
    }

    if (item.type === "missing") {
      var missingLabel = missingFieldLabel(item);

      if (missingLabel === "Type") {
        var typeBtn = card.querySelector('[data-action="pick-type"]');
        if (typeBtn) typeBtn.focus();
        return;
      }

      var missingInput = missingLabel
        ? card.querySelector('[data-missing-field="' + missingLabel + '"]')
        : null;
      if (missingInput) missingInput.focus();
      return;
    }

    if (item._editingDoubtTime) {
      var doubtInput = card.querySelector("[data-doubt-field]");
      if (doubtInput) doubtInput.focus();
      return;
    }

    var primary = card.querySelector('[data-action="accept"]');
    if (primary) primary.focus();
  }

  function bindAttentionCard(card, item) {
    if (isManualDraftCard(item)) {
      bindManualDraftCard(card, item);
      return;
    }

    bindRemoveButton(card, item);

    if (item.type === "missing") {
      if (isMissingLoggedTime(item) || item._showMissingTimeInput) {
        bindMissingLoggedTimeCard(card, item);
      } else {
        bindMissingCard(card, item);
      }
      bindCardEvidence(card, item);
      return;
    }

    if (isOutsideShiftTimeCard(item)) {
      bindOutsideShiftTimeCard(card, item);
      bindCardEvidence(card, item);
      return;
    }

    if (isApproximateTimeCard(item)) {
      bindApproximateTimeCard(card, item);
      bindCardEvidence(card, item);
      return;
    }

    if (item._editingDoubtTime) {
      bindSaveTimeButton(card, item, "[data-doubt-field]");
      bindCardEvidence(card, item);
      return;
    }

    var primary = card.querySelector('[data-action="accept"]');

    if (primary) {
      primary.addEventListener("click", function () {
        commitDoubtFieldEditor(card, item);
        resolveAttention("accept", item);
      });
    }

    bindDoubtFieldEditors(card, item);

    card.addEventListener("keydown", function (event) {
      if (event.target.tagName === "INPUT") return;

      if (event.key === "Enter") {
        event.preventDefault();
        commitDoubtFieldEditor(card, item);
        resolveAttention("accept", item);
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        resolveAttention("remove", item);
      }
    });

    bindCardEvidence(card, item);
  }

  function renderAttention(options) {
    options = options || {};
    var count = attention.length;
    var activeCount = activeIncidents(attention).length;

    if (count === 0) {
      if (attentionStage) attentionStage.innerHTML = "";
      return;
    }

    if (attentionQueue) {
      attentionQueue.hidden = false;
      attentionQueue.classList.remove(
        "attention-queue--collapsed",
        "attention-queue--clearing",
        "attention-queue--all-clear-hold"
      );
      attentionQueue.style.maxHeight = "";
      attentionQueue.style.opacity = "";
      attentionQueue.style.overflow = "";
      attentionQueue.style.marginBottom = "";
    }

    if (attentionQueueBody) {
      attentionQueueBody.style.maxHeight = "";
    }

    updateAttentionHeading(activeCount);

    var html = '<div class="attention-queue__list">';
    attention.forEach(function (item) {
      html += attentionCardHtml(item);
    });
    html += "</div>";

    attentionStage.innerHTML = html;

    attentionStage.querySelectorAll(".card[data-id]").forEach(function (card, index) {
      var item = attentionItemById(card.dataset.id);
      if (!item) return;

      if (item.status === "removed") {
        bindUndoRemove(card, item);
        return;
      }

      bindAttentionCard(card, item);
      animateSystemSignals(card);

      if (options.focusFirst && index === 0) {
        window.requestAnimationFrame(function () {
          focusAttentionCard(card, item);
        });
      }
    });
  }

  function reviewNoticeHtml(pending) {
    var count = '<span class="review-panel__notice-count">' + pending + "</span>";
    if (pending === 1) {
      return count + " incident still needs your confirmation";
    }
    return count + " incidents still need your confirmation";
  }

  function isQuietNight() {
    return activeIncidents(accepted).length === 0 && activeIncidents(attention).length === 0;
  }

  function hasShiftNotes() {
    return shiftNotesField ? shiftNotesField.value.trim().length > 0 : false;
  }

  function isQuietNightWorkspace() {
    return !hasShiftNotes() && isQuietNight();
  }

  function syncCaptureFieldState() {
    var opening = activeIncidents(accepted).length === 0 && activeIncidents(attention).length === 0;

    if (captureField) {
      captureField.classList.toggle("capture-field--opening", opening);
    }

    if (captureLabel) {
      captureLabel.classList.toggle("capture-field__label--section", opening);
    }
  }

  function syncQuietNightInline() {
    syncQuietNightState();
  }

  function prependAttention(item, options) {
    options = options || {};

    var attentionItem;

    if (item.manualDraft) {
      attentionItem = {
        id: item.id || "manual-" + Date.now(),
        type: "manual-draft",
        manualDraft: true,
        title: "New incident",
        provenance: "manual",
        addedAt: item.addedAt || formatEditTime(),
        draftText: item.draftText || "",
        source: "",
        logged: "",
        fields: [],
        evidenceFiles: getEvidenceList(item),
      };
    } else {
      attentionItem = {
        id: item.id || (item.provenance === "live" ? "live-" : "manual-") + Date.now(),
        type: item.type || "missing",
        time: item.time || "",
        title: item.title || "New incident",
        question: item.question || "What happened here?",
        missingPrompt: item.missingPrompt,
        logged: item.logged || item.source || "",
        source: item.source || item.logged || "",
        provenance: item.provenance || "manual",
        addedAt: item.addedAt,
        captured: item.provenance === "manual" ? item.captured : item.captured || formatEditTime(),
        placeholder: item.placeholder || "e.g. 03:05",
        missingField: item.missingField,
        doubt: item.doubt,
        doubtField: item.doubtField,
        desc: item.desc,
        fields:
          item.fields || [
            { label: "Time", value: null },
            { label: "Location", value: null },
            { label: "Type", value: null },
            { label: "Description", value: null },
          ],
        evidenceFiles: getEvidenceList(item),
      };

      if (attentionItem.provenance === "manual" && !attentionItem.addedAt) {
        attentionItem.addedAt = formatEditTime();
      }

      ensureRowFields(attentionItem);
      if (attentionItem.type === "missing") syncMissingFieldState(attentionItem);
    }

    attention.unshift(attentionItem);

    if (attentionQueue) {
      attentionQueue.hidden = false;
      attentionQueue.classList.remove(
        "attention-queue--collapsed",
        "attention-queue--clearing",
        "attention-queue--all-clear-hold"
      );
      attentionQueue.style.maxHeight = "";
      attentionQueue.style.opacity = "";
      attentionQueue.style.overflow = "";
      attentionQueue.style.marginBottom = "";
    }

    renderAttention({ focusFirst: options.focusFirst });

    if (options.animateDetect && attentionStage) {
      var card = attentionStage.querySelector('.card--attention[data-id="' + attentionItem.id + '"]');
      if (card) {
        flashDetectedCard(card);
        animateSystemSignals(card);
      }
    }

    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
    return attentionItem;
  }

  function loadQuietNight() {
    accepted = [];
    attention = [];
    submissionStats.removed = 0;

    REPORT_SECTIONS.forEach(function (section) {
      reportSectionNotes[section.id] = [];
    });

    if (window.CaptureDetect && window.CaptureDetect.clearCaptureField) {
      window.CaptureDetect.clearCaptureField();
    } else if (shiftNotesField) {
      shiftNotesField.value = "";
      shiftNotesField.dispatchEvent(new Event("input", { bubbles: true }));
    }

    if (acceptedGroup) {
      delete acceptedGroup.dataset.userToggled;
      delete acceptedGroup.dataset.peeking;
      acceptedGroup.classList.add("accepted-group--collapsed");
      if (acceptedToggle) acceptedToggle.setAttribute("aria-expanded", "false");
    }

    if (attentionQueue) {
      attentionQueue.hidden = false;
      attentionQueue.classList.remove(
        "attention-queue--clearing",
        "attention-queue--all-clear-hold",
        "attention-queue--collapsed"
      );
      attentionQueue.style.maxHeight = "";
      attentionQueue.style.opacity = "";
      attentionQueue.style.overflow = "";
      attentionQueue.style.marginBottom = "";
    }

    if (attentionQueueBody) {
      attentionQueueBody.style.maxHeight = "";
      attentionQueueBody.style.opacity = "";
      attentionQueueBody.style.marginTop = "";
    }

    if (attentionStage) attentionStage.innerHTML = "";
    updateAttentionHeading(0);
    syncAllClearLine(false);

    renderAccepted();
    renderAttention();
    renderRestOfReport();
    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
  }

  function loadTwentyIncidents() {
    attention = [
      makeIncident({
        id: "bulk-q1",
        cardType: "missing",
        time: null,
        captured: "01:08",
        location: "Dancefloor",
        type: "Guest injury",
        description: "Guest twisted ankle on the dancefloor. Ice pack given. Refused further help.",
        source: "girl twisted her ankle on the dancefloor, gave her ice, she said she was fine",
        logged: "Guest injury on the dancefloor. Ice pack given, no further help wanted.",
        missingField: "Time",
      }),
      makeIncident({
        id: "bulk-q2",
        cardType: "low",
        time: "00:40",
        captured: "00:55",
        location: "VIP area",
        type: "Refused entry",
        description: "Guest refused entry to VIP around 00:40. Already intoxicated.",
        source: "refused a guy into VIP around 12:40, already drunk",
        logged: "Refused entry to VIP area around 00:40. Guest already intoxicated.",
        doubt: "You wrote 'around 12:40'. Confirm or correct.",
        doubtField: "Time",
      }),
      makeIncident({
        id: "bulk-q3",
        cardType: "missing",
        time: null,
        captured: "02:48",
        location: "Main bar",
        type: "Fight",
        description: "Scuffle at the main bar. Broken up by door staff. No injuries reported.",
        source: "scuffle at the bar, door staff split them up, no injuries",
        logged: "Fight at the main bar. Door staff intervened, no injuries.",
        missingField: "Time",
      }),
    ];

    accepted = [
      makeIncident({
        id: "bulk-a1",
        time: "22:05",
        captured: "22:08",
        location: "Main door",
        type: "Refused entry",
        description: "Underage guest turned away at the main door. No ID produced.",
        source: "turned away an underage lad at the door, no ID",
        logged: "Refused entry at the main door at 22:05. No ID produced.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a2",
        time: "22:30",
        captured: "22:33",
        location: "Main bar",
        type: "Ejection",
        description: "Guest ejected from the main bar for aggressive behaviour. Left quietly.",
        source: "ejected a guy from the bar for getting aggressive, he left quietly",
        logged: "Ejection from the main bar at 22:30. Guest left quietly.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a3",
        time: "23:00",
        captured: "23:03",
        location: "Whole venue",
        type: "Capacity check",
        description: "Headcount 380 at 23:00. Limit 450.",
        source: "headcount 380 at 11, limit 450",
        logged: "Capacity check at 23:00. Headcount 380, limit 450.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a4",
        time: "23:25",
        captured: "23:28",
        location: "Smoking area",
        type: "Fire safety",
        description: "Smoking area fire door wedged open. Closed and signed in the log.",
        source: "smoking area fire door wedged open, closed it and logged it",
        logged: "Fire door wedged open in the smoking area at 23:25. Closed and logged.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a5",
        time: "23:50",
        captured: "23:54",
        location: "Cloakroom",
        type: "Theft reported",
        description: "Coat reported missing from the cloakroom. Guest details taken.",
        source: "coat missing from cloakroom, took guest details",
        logged: "Theft reported from the cloakroom at 23:50. Guest details taken.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a6",
        time: "00:15",
        captured: "00:18",
        location: "Gents toilets",
        type: "Suspected drugs found",
        description: "Packet found in the gents. Secured in the drugs safe.",
        source: "found a packet in the gents, bagged it for the safe",
        logged: "Suspected drugs found in the gents toilets at 00:15. Secured in drugs safe.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a7",
        time: "00:35",
        captured: "00:38",
        location: "Main bar",
        type: "Fight",
        description: "Fight at the main bar. Bouncers separated parties. No injuries.",
        source: "fight at the bar around 12:35, bouncers split them, no one hurt",
        logged: "Fight at the main bar at 00:35. Bouncers intervened, no injuries.",
        confirmedByUser: true,
        extras: [{ label: "Action taken", value: "Bouncers separated parties" }],
      }),
      makeIncident({
        id: "bulk-a8",
        time: "01:00",
        captured: "01:04",
        location: "Mezzanine stairs",
        type: "Guest injury",
        description: "Guest fell on the mezzanine stairs. First aider attended. Stayed on site.",
        source: "guy fell on mezzanine stairs, first aider saw him, he stayed",
        logged: "Guest injury on the mezzanine stairs at 01:00. First aider attended.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a9",
        time: "01:25",
        captured: "01:28",
        location: "Back corridor",
        type: "Police attendance",
        description: "Police attended regarding an earlier ejection. Statement taken.",
        source: "police came about the earlier ejection, took a statement",
        logged: "Police attendance in the back corridor at 01:25. Statement taken.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a10",
        time: "01:50",
        captured: "01:53",
        location: "Bar floor",
        type: "Staff injury",
        description: "Bar staff cut hand on broken glass. Plaster applied. Finished shift.",
        source: "bar staff cut hand on glass, plastered it, she carried on",
        logged: "Staff injury on the bar floor at 01:50. Plaster applied, shift continued.",
        confirmedByUser: true,
        extras: [{ label: "Injuries", value: "Cut hand, plaster applied" }],
      }),
      makeIncident({
        id: "bulk-a11",
        time: "02:00",
        captured: "02:03",
        location: "Whole venue",
        type: "Capacity check",
        description: "Headcount 428 at 02:00. Limit 450.",
        source: "headcount 428 at 2am, limit still 450",
        logged: "Capacity check at 02:00. Headcount 428, limit 450.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a12",
        time: "02:20",
        captured: "02:23",
        location: "DJ booth",
        type: "Run of show",
        description: "DJ set ran ten minutes over scheduled finish.",
        source: "dj ran over by ten minutes at the end",
        logged: "DJ set ran over by ten minutes at 02:20.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a13",
        time: "02:35",
        captured: "02:38",
        location: "Back door",
        type: "Fire safety",
        description: "Rear fire door found unlocked during walkthrough. Secured.",
        source: "back door was unlocked on walkthrough, locked it",
        logged: "Fire safety issue at the back door at 02:35. Door secured.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a14",
        time: "02:45",
        captured: "02:48",
        location: "CCTV room",
        type: "Maintenance / equipment",
        description: "CCTV camera 4 by the back door offline all night. Logged with maintenance.",
        source: "cctv camera 4 by the back door was down all night",
        logged: "CCTV camera 4 by the back door offline all night. Logged with maintenance.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a15",
        time: "02:55",
        captured: "02:58",
        location: "Main door",
        type: "Refused entry",
        description: "Guest refused entry for intoxication. Escorted away from queue.",
        source: "refused entry for being too drunk, walked him away from the queue",
        logged: "Refused entry at the main door at 02:55. Guest escorted from queue.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a16",
        time: "03:00",
        captured: "03:03",
        location: "Bar floor",
        type: "Ejection",
        description: "Final ejection before close. Guest removed after refusing to leave.",
        source: "last ejection before close, guy would not leave till we walked him out",
        logged: "Ejection from the bar floor at 03:00. Guest escorted out.",
        confirmedByUser: true,
      }),
      makeIncident({
        id: "bulk-a17",
        time: "03:05",
        captured: "03:08",
        location: "Whole venue",
        type: "Capacity check",
        description: "Final headcount 96 at close. All guests accounted for.",
        source: "final headcount 96 at close, everyone out",
        logged: "Capacity check at 03:05. Final headcount 96 at close.",
        confirmedByUser: true,
      }),
    ];

    acceptedGroup.dataset.userToggled = "";
    renderAccepted();
    renderAttention();
    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
  }

  function syncReviewPanel() {
    if (!panel) return;

    var total = activeIncidents(accepted).length + activeIncidents(attention).length;
    var confirmed = activeIncidents(accepted).length;
    var pending = activeIncidents(attention).length;
    var quietWorkspace = isQuietNightWorkspace();

    panel.dataset.total = String(total);
    panel.dataset.confirmed = String(confirmed);

    var progressLabel = document.getElementById("review-progress-label");
    var totalEl = document.getElementById("review-total");
    var noticeBlocked = document.getElementById("review-notice");
    var noticeText = document.getElementById("review-notice-text");
    var noticeQuiet = document.getElementById("review-notice-quiet");
    var noticeQuietText = noticeQuiet ? noticeQuiet.querySelector(".review-panel__notice-text") : null;
    var noticeQuietLabel = noticeQuiet ? noticeQuiet.querySelector(".review-panel__notice-label") : null;

    if (attentionQueue) {
      attentionQueue.hidden = false;
    }

    syncQuietNightInline();
    syncCaptureFieldState();

    if (acceptedGroup) {
      acceptedGroup.hidden = confirmed === 0;
    }

    if (reviewIncidentsBlock) reviewIncidentsBlock.hidden = quietWorkspace;
    if (reviewProgressBlock) reviewProgressBlock.hidden = quietWorkspace;

    if (progressLabel && !quietWorkspace) {
      progressLabel.innerHTML =
        '<span class="review-panel__progress-mono">' +
        confirmed +
        "</span> of <span class=\"review-panel__progress-mono\">" +
        total +
        "</span> confirmed";
    }
    if (totalEl && !quietWorkspace) totalEl.textContent = String(total);

    panel.classList.remove("review-panel--pending", "review-panel--ready", "review-panel--quiet", "review-panel--almost");

    var presubmitView = document.getElementById("presubmit-view");
    var inPresubmit = presubmitView && !presubmitView.hidden;
    var presubmitUnresolved =
      inPresubmit && window.PreSubmitReview && window.PreSubmitReview.getUnresolvedCount
        ? window.PreSubmitReview.getUnresolvedCount()
        : 0;
    var noticeLabel = noticeBlocked ? noticeBlocked.querySelector(".review-panel__notice-label") : null;

    if (inPresubmit && presubmitUnresolved > 0) {
      panel.classList.add("review-panel--almost");
      if (noticeBlocked) noticeBlocked.hidden = false;
      if (noticeQuiet) noticeQuiet.hidden = true;
      if (noticeLabel) noticeLabel.textContent = "Almost ready";
      if (noticeText) {
        noticeText.textContent =
          presubmitUnresolved === 1
            ? "1 left to check before you submit"
            : presubmitUnresolved + " left to check before you submit";
      }
      syncAllClearLine(false);
    } else if (pending > 0) {
      panel.classList.add("review-panel--pending");
      if (noticeBlocked) noticeBlocked.hidden = false;
      if (noticeQuiet) noticeQuiet.hidden = true;
      if (noticeLabel) noticeLabel.textContent = "Not ready";
      if (noticeText) noticeText.innerHTML = reviewNoticeHtml(pending);
      syncAllClearLine(false);
    } else if (quietWorkspace) {
      panel.classList.add("review-panel--quiet");
      if (noticeBlocked) noticeBlocked.hidden = true;
      if (noticeQuiet) noticeQuiet.hidden = false;
      if (noticeQuietText) noticeQuietText.textContent = "Quiet night. Nothing to confirm.";
      syncAllClearLine(false);
    } else if (
      inPresubmit &&
      presubmitUnresolved === 0 &&
      window.PreSubmitReview &&
      window.PreSubmitReview.isComplete &&
      window.PreSubmitReview.isComplete()
    ) {
      panel.classList.add("review-panel--ready");
      if (noticeBlocked) noticeBlocked.hidden = true;
      if (noticeQuiet) noticeQuiet.hidden = false;
      if (noticeQuietLabel) noticeQuietLabel.textContent = "Ready";
      if (noticeQuietText) noticeQuietText.textContent = "All incidents confirmed.";
      syncAllClearLine(false);
    } else {
      panel.classList.add("review-panel--ready");
      if (noticeBlocked) noticeBlocked.hidden = true;
      if (noticeQuiet) noticeQuiet.hidden = false;
      if (noticeQuietText) noticeQuietText.textContent = "All incidents confirmed.";
      syncAllClearLine(true);
    }
  }

  acceptedToggle.addEventListener("click", function () {
    acceptedGroup.dataset.userToggled = "true";
    delete acceptedGroup.dataset.peeking;
    window.clearTimeout(acceptedPeekTimer);
    var collapsed = acceptedGroup.classList.toggle("accepted-group--collapsed");
    acceptedToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });

  if (restOfReportToggle && restOfReportGroup) {
    restOfReportToggle.addEventListener("click", function () {
      var collapsed = restOfReportGroup.classList.toggle("accepted-group--collapsed");
      restOfReportToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  }

  function getReportSection(sectionId) {
    return REPORT_SECTIONS.find(function (section) {
      return section.id === sectionId;
    });
  }

  var RUN_OF_SHOW_STEMS = ["dj ran over"];

  var EQUIPMENT_STEMS = [
    "machine",
    "broken",
    "down",
    "not working",
    "faulty",
    "camera",
    "cctv",
    "till",
    "fridge",
    "speaker",
    "lights",
    "toilet",
    "door lock",
  ];

  var EQUIPMENT_STEM_EXCLUSIONS = [/broken glass/, /broke it up/, /broken up/];

  function sentenceContainsStem(norm, stem) {
    if (stem.indexOf(" ") !== -1) return norm.indexOf(stem) !== -1;
    return new RegExp("\\b" + stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b").test(norm);
  }

  function matchesEquipmentStem(norm) {
    if (EQUIPMENT_STEM_EXCLUSIONS.some(function (pattern) {
      return pattern.test(norm);
    })) {
      return false;
    }

    return EQUIPMENT_STEMS.some(function (stem) {
      return sentenceContainsStem(norm, stem);
    });
  }

  function suggestSectionForSentence(sentence) {
    if (window.CaptureDetect && window.CaptureDetect.suggestSectionForScriptSentence) {
      var scriptedSection = window.CaptureDetect.suggestSectionForScriptSentence(sentence);
      if (scriptedSection) return scriptedSection;
    }

    var norm = String(sentence || "").toLowerCase();

    if (RUN_OF_SHOW_STEMS.some(function (stem) {
      return norm.indexOf(stem) !== -1;
    })) {
      return "run-of-show";
    }

    if (matchesEquipmentStem(norm)) {
      return "maintenance";
    }

    return "general";
  }

  function noteCountLabel(count) {
    if (count === 1) return "1 note";
    return count + " notes";
  }

  function totalNotesKept() {
    return REPORT_SECTIONS.reduce(function (total, section) {
      return total + (reportSectionNotes[section.id] || []).length;
    }, 0);
  }

  function keepNoteInSection(sectionId, noteText) {
    if (!reportSectionNotes.hasOwnProperty(sectionId)) return;

    var text = String(noteText || "").trim();
    if (!text) return;

    reportSectionNotes[sectionId].push({
      id: "note-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      text: text,
      keptAt: formatEditTime(),
    });

    renderRestOfReport();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
  }

  function removeNoteFromSection(sectionId, noteId) {
    if (!reportSectionNotes.hasOwnProperty(sectionId)) return false;

    var notes = reportSectionNotes[sectionId];
    var index = notes.findIndex(function (note) {
      return note.id === noteId;
    });
    if (index === -1) return false;

    notes.splice(index, 1);
    return true;
  }

  function undoNoteInSection(sectionId, noteText) {
    if (!reportSectionNotes.hasOwnProperty(sectionId)) return;

    var notes = reportSectionNotes[sectionId];
    if (!notes.length) return;

    if (noteText) {
      var index = notes.findIndex(function (note) {
        return note.text === noteText;
      });
      if (index !== -1) notes.splice(index, 1);
    } else {
      notes.pop();
    }

    renderRestOfReport();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
  }

  function promoteNoteToIncident(sectionId, noteId) {
    if (!reportSectionNotes.hasOwnProperty(sectionId)) return null;

    var note = reportSectionNotes[sectionId].find(function (entry) {
      return entry.id === noteId;
    });
    if (!note) return null;

    var result = addIncidentFromSentence(note.text, { focusFirst: true });
    removeNoteFromSection(sectionId, noteId);
    renderRestOfReport();
    renderAttention({ focusFirst: true });
    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
    return result;
  }

  function focusAttentionIncident(id) {
    if (!id || !attentionStage) return false;

    var item = attentionItemById(id);
    if (!item) return false;

    if (attentionQueue) {
      attentionQueue.hidden = false;
      attentionQueue.classList.remove(
        "attention-queue--collapsed",
        "attention-queue--clearing",
        "attention-queue--all-clear-hold"
      );
    }

    renderAttention({ focusFirst: false });

    var card = attentionStage.querySelector('.card--attention[data-id="' + id + '"]');
    if (!card) return false;

    window.requestAnimationFrame(function () {
      focusAttentionCard(card, item);
      card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    return true;
  }

  function getNotesKeptCount() {
    return totalNotesKept();
  }

  function updateOtherSectionsHeader() {
    var mutedEl = document.getElementById("other-sections-header-muted");
    var notesWrapEl = document.getElementById("other-sections-header-notes");
    var countEl = document.getElementById("other-sections-header-count");
    var totalNotes = totalNotesKept();
    var sectionCount = REPORT_SECTIONS.length;
    var optionalLabel = sectionCount === 1 ? "1 optional" : sectionCount + " optional";

    if (mutedEl) {
      mutedEl.textContent = "Other sections · " + optionalLabel;
    }

    if (notesWrapEl && countEl) {
      if (totalNotes > 0) {
        notesWrapEl.hidden = false;
        countEl.textContent = noteCountLabel(totalNotes);
      } else {
        notesWrapEl.hidden = true;
        countEl.textContent = "";
      }
    }
  }

  function bindOtherSectionsActions() {
    if (!restOfReportList) return;

    restOfReportList.querySelectorAll(".other-sections__row--has-notes").forEach(function (button) {
      button.addEventListener("click", function () {
        var item = button.closest(".other-sections__item");
        var notesList = item ? item.querySelector(".other-sections__notes") : null;
        if (!notesList) return;

        var expanded = button.getAttribute("aria-expanded") !== "true";
        button.setAttribute("aria-expanded", expanded ? "true" : "false");
        notesList.hidden = !expanded;
      });
    });

    restOfReportList.querySelectorAll('[data-action="promote-note"]').forEach(function (button) {
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        promoteNoteToIncident(button.dataset.sectionId, button.dataset.noteId);
      });
    });
  }

  function renderRestOfReport() {
    if (!restOfReportList) return;

    updateOtherSectionsHeader();

    restOfReportList.innerHTML = REPORT_SECTIONS.map(function (section) {
      var notes = reportSectionNotes[section.id] || [];

      if (!notes.length) {
        return (
          '<li class="other-sections__item">' +
          '<div class="other-sections__row other-sections__row--empty">' +
          '<span class="other-sections__title">' +
          escapeHtml(section.title) +
          "</span>" +
          '<span class="other-sections__optional">Optional</span>' +
          "</div></li>"
        );
      }

      var notesHtml = notes
        .map(function (note) {
          return (
            '<li class="other-sections__note">' +
            '<span class="other-sections__note-icon" aria-hidden="true">' +
            NOTE_ICON_SVG +
            "</span>" +
            '<span class="other-sections__note-content">' +
            '<em class="other-sections__note-text ai-transform__value--input">' +
            escapeHtml(note.text) +
            "</em>" +
            '<span class="other-sections__note-meta t-mono-meta">from notes ' +
            escapeHtml(note.keptAt) +
            "</span>" +
            "</span>" +
            '<button type="button" class="btn btn--quiet other-sections__note-promote" data-action="promote-note" data-section-id="' +
            escapeHtml(section.id) +
            '" data-note-id="' +
            escapeHtml(note.id) +
            '">Make this an incident</button>' +
            "</li>"
          );
        })
        .join("");

      return (
        '<li class="other-sections__item other-sections__item--has-notes">' +
        '<button type="button" class="other-sections__row other-sections__row--has-notes" aria-expanded="true">' +
        '<span class="other-sections__title other-sections__title--active">' +
        escapeHtml(section.title) +
        "</span>" +
        '<span class="badge">' +
        escapeHtml(noteCountLabel(notes.length)) +
        "</span>" +
        "</button>" +
        '<ul class="other-sections__notes">' +
        notesHtml +
        "</ul></li>"
      );
    }).join("");

    bindOtherSectionsActions();
  }

  function parseSentenceToIncident(sentence) {
    if (window.CaptureDetect && window.CaptureDetect.buildIncidentFromSentence) {
      return window.CaptureDetect.buildIncidentFromSentence(sentence);
    }

    return null;
  }

  function addManualIncident() {
    return prependAttention(
      {
        id: "manual-" + Date.now(),
        manualDraft: true,
        title: "New incident",
        provenance: "manual",
        addedAt: formatEditTime(),
        draftText: "",
      },
      { focusFirst: true }
    );
  }

  function applyPresubmitIncidentFlags(item, options) {
    options = options || {};
    if (!options.presubmit) return item;

    item._presubmit = true;
    item._presubmitSentenceId = options.sentenceId || null;
    item.detectionLinked = false;
    return item;
  }

  function discardPresubmitIncident(incidentId) {
    if (!incidentId) return false;

    attention = attention.filter(function (entry) {
      return entry.id !== incidentId;
    });

    if (attentionStage) {
      renderAttention();
    }

    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
    return true;
  }

  function acceptedItemToAttentionItem(acceptedItem, incidentId) {
    var attentionItem = {
      id: incidentId,
      time: acceptedItem.time,
      title: acceptedItem.title,
      logged: acceptedItem.logged,
      source: acceptedItem.source,
      desc: acceptedItem.logged,
      fields: cloneItemFields(acceptedItem),
      evidenceFiles: acceptedItem.evidenceFiles ? acceptedItem.evidenceFiles.slice() : [],
      provenance: acceptedItem.provenance || "live",
      captured: acceptedItem.captured,
      addedAt: acceptedItem.addedAt,
      _presubmit: true,
      _presubmitSentenceId: acceptedItem._presubmitSentenceId,
      unknownFields: acceptedItem.unknownFields ? Object.assign({}, acceptedItem.unknownFields) : undefined,
    };

    attentionItem.type = "missing";
    ensureRowFields(attentionItem);
    syncMissingFieldState(attentionItem);
    return attentionItem;
  }

  function removeAcceptedPresubmitIncident(incidentId) {
    if (!incidentId) return false;

    var acceptedId = "a-" + incidentId;
    var hadAccepted = accepted.some(function (entry) {
      return entry.id === acceptedId;
    });

    accepted = accepted.filter(function (entry) {
      return entry.id !== acceptedId;
    });

    attention = attention.filter(function (entry) {
      return entry.id !== incidentId;
    });

    if (hadAccepted) {
      renderAccepted();
    }

    if (attentionStage) {
      renderAttention();
    }

    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
    return true;
  }

  function reopenPresubmitIncident(incidentId, sentenceId) {
    var acceptedId = "a-" + incidentId;
    var index = accepted.findIndex(function (entry) {
      return entry.id === acceptedId;
    });
    if (index === -1) return null;

    var acceptedItem = accepted.splice(index, 1)[0];
    var attentionItem = acceptedItemToAttentionItem(acceptedItem, incidentId);
    attentionItem._presubmitSentenceId = sentenceId;
    attentionItem._presubmit = true;

    attention.unshift(attentionItem);
    renderAccepted();
    syncReviewPanel();
    document.dispatchEvent(new CustomEvent("shiftreview:changed"));
    return attentionItem;
  }

  function getAcceptedIncidentSummary(incidentId) {
    var acceptedId = "a-" + incidentId;
    var item = accepted.find(function (entry) {
      return entry.id === acceptedId;
    });
    if (!item) return null;

    var typeField = item.fields
      ? item.fields.find(function (field) {
          return field.label === "Type";
        })
      : null;
    var typeValue = typeField && typeField.value ? typeField.value : item.title;

    return {
      type: typeValue,
      time: item.time && item.time !== "unknown" ? item.time : "",
    };
  }

  function addIncidentFromSentence(sentence, options) {
    options = options || {};
    var incidentId = "presubmit-" + Date.now();
    var parsed = parseSentenceToIncident(sentence);

    if (parsed) {
      parsed.id = incidentId;
      parsed.provenance = "live";
      parsed.detectionLinked = false;
      applyPresubmitIncidentFlags(parsed, options);
      var detected = addLiveDetection(parsed, { animateDetect: !options.presubmit });
      return Object.assign({ id: incidentId }, detected);
    }

    var logged = sentence.trim();
    if (logged && logged.charAt(0).toLowerCase() === logged.charAt(0)) {
      logged = logged.charAt(0).toUpperCase() + logged.slice(1);
    }
    if (logged && !/[.!?]$/.test(logged)) logged += ".";

    var payload = applyPresubmitIncidentFlags(
      {
        id: incidentId,
        type: "missing",
        title: "New incident",
        missingField: "Type",
        missingPrompt: "What type of incident was this?",
        time: "",
        source: sentence,
        logged: logged,
        desc: logged,
        provenance: "live",
        detectionLinked: false,
        fields: [
          { label: "Time", value: null },
          { label: "Location", value: "not stated" },
          { label: "Type", value: null },
          { label: "Description", value: logged },
        ],
      },
      options
    );

    prependAttention(payload, { animateDetect: !options.presubmit, focusFirst: !options.presubmit });

    return { destination: "attention", id: incidentId, title: payload.title };
  }

  function generateReportNumber(date) {
    date = date || DEMO_CLOCK;
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    var sequence = String(reportSequence).padStart(3, "0");
    reportSequence += 1;
    return "SR-" + year + "-" + month + day + "-" + sequence;
  }

  function getSubmissionSummary() {
    var fieldsLeftUnknown = 0;

    activeIncidents(accepted).forEach(function (item) {
      fieldsLeftUnknown += countUnknownFieldsInItem(item);
    });

    return {
      incidentsLogged: activeIncidents(accepted).length + activeIncidents(attention).length,
      confirmedByYou: activeIncidents(accepted).filter(function (item) {
        return item.confirmedByUser;
      }).length,
      removed: countRemovedIncidents(),
      addedInReview: accepted.filter(function (item) {
        return item.provenance === "live";
      }).length,
      fieldsLeftUnknown: fieldsLeftUnknown,
      notesKeptOutsideIncidents: getNotesKeptCount(),
    };
  }

  if (addIncidentBtn) {
    addIncidentBtn.addEventListener("click", addManualIncident);
  }

  window.ShiftReview = {
    getShiftMeta: function () {
      return {
        managerName: SHIFT_MANAGER_NAME,
        shiftNightLabel: SHIFT_NIGHT_LABEL,
        demoNow: DEMO_CLOCK,
      };
    },
    generateReportNumber: generateReportNumber,
    getSubmissionSummary: getSubmissionSummary,
    getLiveIncidentCount: function () {
      return accepted
        .concat(attention)
        .filter(function (item) {
          return item.provenance === "live";
        }).length;
    },
    getTotalIncidentCount: function () {
      return activeIncidents(accepted).length + activeIncidents(attention).length;
    },
    getAllIncidents: function () {
      return activeIncidents(accepted).concat(activeIncidents(attention));
    },
    isAttentionClear: function () {
      return activeIncidents(attention).length === 0;
    },
    isQuietNightWorkspace: isQuietNightWorkspace,
    addAttentionItem: function (item, options) {
      return prependAttention(item, options);
    },
    addIncidentFromSentence: addIncidentFromSentence,
    getAttentionItemById: attentionItemById,
    renderAttentionCardHtml: attentionCardHtml,
    bindAttentionCard: bindAttentionCard,
    discardPresubmitIncident: discardPresubmitIncident,
    removeAcceptedPresubmitIncident: removeAcceptedPresubmitIncident,
    reopenPresubmitIncident: reopenPresubmitIncident,
    getAcceptedIncidentSummary: getAcceptedIncidentSummary,
    addManualIncident: addManualIncident,
    keepNoteInSection: keepNoteInSection,
    undoNoteInSection: undoNoteInSection,
    focusAttentionIncident: focusAttentionIncident,
    suggestSectionForSentence: suggestSectionForSentence,
    getReportSection: getReportSection,
    getNotesKeptCount: getNotesKeptCount,
    loadTwentyIncidents: loadTwentyIncidents,
    loadQuietNight: loadQuietNight,
    syncPanelState: syncReviewPanel,
    addLiveDetection: addLiveDetection,
    upsertLiveDetection: upsertLiveDetection,
    addDetectedIncident: function (item) {
      return upsertLiveDetection(item);
    },
  };

  if (shiftNotesField) {
    shiftNotesField.addEventListener("input", syncReviewPanel);
  }

  attention.forEach(function (item) {
    ensureRowFields(item);
    if (item.type === "missing") syncMissingFieldState(item);
  });

  renderRestOfReport();
  renderAccepted();
  renderAttention();
  syncReviewPanel();
})();
