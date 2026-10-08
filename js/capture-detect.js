/** Owns live incident detection from the shift notes textarea and capture status feedback. */
(function () {
  var textarea = document.getElementById("shift-notes");
  var statusEl = document.getElementById("capture-status");
  var statusLogged = document.getElementById("capture-status-logged");
  var coverageEl = document.getElementById("capture-coverage");
  var DETECTION_DELAY_MS = 1500;
  var DETECTION_READ_MS = 1200;
  var LOGGED_STATUS_MS = 3000;
  var NO_INCIDENT_STATUS_MS = 4000;
  var READING_PULSE_MAX_MS = 5000;
  var SETTLE_PULSE_MS = 300;

  if (!textarea || !statusEl) return;

  var typingTimer = null;
  var detectionTimer = null;
  var loggedTimer = null;
  var pulseCapTimer = null;
  var settleTimer = null;
  var reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  var SCRIPTED_LIVE_TYPING = [
    "around 2 a guest fell on the dance floor",
    "card machine was down for an hour",
  ];
  var TYPING_CHAR_MS = 32;
  var scriptedTypingActive = false;

  var SCRIPT_FIXTURES = {
    "around 2 a guest fell on the dance floor": buildGuestFellFixture,
    "card machine was down for an hour": function () {
      return null;
    },
  };

  var SCRIPT_SENTENCE_SECTIONS = {
    "card machine was down for an hour": "maintenance",
    "dj ran over by ten minutes": "run-of-show",
    "cctv camera 4 by the back door was down all night": "maintenance",
  };

  var INJURY_STEMS = [
    "injur",
    "hurt",
    "bleed",
    "cut her",
    "cut his",
    "fell",
    "slipped",
    "collapsed",
    "first aid",
    "ambulance",
  ];

  var INCIDENT_TYPE_STEMS = [
    {
      type: "Police attendance",
      stems: ["police", "officer", "statement"],
    },
    {
      type: "Fight",
      stems: ["fight", "fought", "punch", "brawl", "assault", "threw a", "thrown", "attacked"],
    },
    {
      type: "Ejection",
      stems: ["eject", "threw out", "thrown out", "kicked out", "removed from"],
    },
    {
      type: "Refused entry",
      stems: ["refused entry", "turned away", "fake id"],
    },
    {
      type: "Theft reported",
      stems: ["theft", "stole", "stolen", "robbed", "pickpocket"],
    },
    {
      type: "Suspected drugs found",
      stems: ["drug", "bag found", "pills", "powder", "dealing"],
    },
    {
      type: "Property damage",
      stems: ["broke", "broken", "smash", "damag", "vandal"],
    },
    {
      type: "Fire safety",
      stems: ["fire exit", "fire alarm", "fire panel", "extinguisher"],
    },
  ];

  var STAFF_ROLE_PATTERN =
    /\b(bar staff|door staff|staff member|one of the bar staff|bouncer|security|manager|dj|host|hostess)\b/i;

  window.CaptureDetect = {
    THREE_AM_NOTES:
      "Police came by around 2 about the phone theft and took a statement. One of the bar staff cut her hand on broken glass, we plastered it and she finished the shift. DJ ran over by ten minutes. CCTV camera 4 by the back door was down all night.",
    SCRIPTED_LIVE_TYPING: SCRIPTED_LIVE_TYPING,
    loadThreeAmNotes: loadThreeAmNotes,
    clearCaptureField: clearCaptureField,
    playScriptedLiveTyping: playScriptedLiveTyping,
    runDetection: function (excludeCaretSegment) {
      return runDetection(!!excludeCaretSegment);
    },
    buildIncidentFromSentence: buildIncidentFromSentence,
    normalizeScriptSentence: normalizeScriptSentence,
    suggestSectionForScriptSentence: suggestSectionForScriptSentence,
  };

  function normalizeScriptSentence(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function suggestSectionForScriptSentence(sentence) {
    var key = normalizeScriptSentence(sentence);
    return SCRIPT_SENTENCE_SECTIONS[key] || null;
  }

  function buildGuestFellFixture(source) {
    return {
      source: source,
      logged: "A guest fell on the dance floor.",
      title: "Guest injury, dance floor",
      desc: "A guest fell on the dance floor.",
      provenance: "live",
      fields: [
        { label: "Time", value: "02:00" },
        { label: "Location", value: "On the dance floor" },
        { label: "Type", value: "Guest injury" },
        { label: "Description", value: "A guest fell on the dance floor." },
      ],
      time: "02:00",
      type: "low",
      doubtField: "Time",
      timeDoubt: "approximate",
      doubt: "You wrote 'around 2'. Keep it approximate?",
    };
  }

  function matchScriptFixture(sentence) {
    var key = normalizeScriptSentence(sentence);
    if (!SCRIPT_FIXTURES.hasOwnProperty(key)) return null;
    return SCRIPT_FIXTURES[key];
  }

  function capitalizeFirst(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function padTimePart(value) {
    return String(value).padStart(2, "0");
  }

  function formatTimeValue(hours, minutes) {
    return padTimePart(hours) + ":" + padTimePart(minutes);
  }

  function timeToMinutes(value) {
    var match = String(value).match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  function isWithinShiftHours(value) {
    var minutes = timeToMinutes(value);
    if (minutes === null) return false;
    return minutes >= 18 * 60 || minutes <= 6 * 60;
  }

  function includesStem(text, stem) {
    return text.toLowerCase().indexOf(stem.toLowerCase()) !== -1;
  }

  function hasInjuryStem(text) {
    for (var i = 0; i < INJURY_STEMS.length; i++) {
      if (includesStem(text, INJURY_STEMS[i])) return true;
    }
    return false;
  }

  function hasStaffRole(text) {
    if (STAFF_ROLE_PATTERN.test(text)) return true;
    return /\bstaff\b/i.test(text) && !/\bguest\b/i.test(text);
  }

  function matchIncidentTypeByStems(text) {
    var best = null;

    INCIDENT_TYPE_STEMS.forEach(function (group, groupIndex) {
      group.stems.forEach(function (stem) {
        if (!includesStem(text, stem)) return;

        if (
          !best ||
          stem.length > best.stem.length ||
          (stem.length === best.stem.length && groupIndex < best.groupIndex)
        ) {
          best = { type: group.type, stem: stem, groupIndex: groupIndex };
        }
      });
    });

    return best ? best.type : null;
  }

  function describeInjurySummary() {
    return "someone injured";
  }

  function classifySentence(text) {
    var injury = hasInjuryStem(text);
    var incidentType = matchIncidentTypeByStems(text);

    if (injury && incidentType === "Property damage") {
      incidentType = null;
    }

    if (injury && incidentType) {
      return {
        type: incidentType,
        hasInjury: true,
        injuries: describeInjurySummary(),
      };
    }

    if (injury) {
      return {
        type: hasStaffRole(text) ? "Staff injury" : "Guest injury",
        hasInjury: true,
        injuries: null,
      };
    }

    if (incidentType) {
      return { type: incidentType, hasInjury: false, injuries: null };
    }

    return null;
  }

  function applyCardRouting(item, hasInjury) {
    if (hasInjury) {
      if (!item.missingField && !item.doubt) {
        item.type = "low";
      }
      return item;
    }

    if (!item.missingField && !item.doubt && item.type !== "missing" && item.type !== "low") {
      item.confidence = "high";
    }

    return item;
  }

  function extractTime(text) {
    var match;

    match = text.match(/\b(around|about)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (match) {
      var hours = parseInt(match[2], 10);
      var minutes = match[3] ? parseInt(match[3], 10) : 0;
      var ampm = match[4] ? match[4].toLowerCase() : null;
      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      return {
        value: formatTimeValue(hours, minutes),
        approximate: true,
        writtenLabel: match[0].trim(),
        displayWritten: match[0].trim(),
      };
    }

    match = text.match(/\b(\d{1,2}):(\d{2})\b/);
    if (match) {
      return {
        value: formatTimeValue(parseInt(match[1], 10), parseInt(match[2], 10)),
        approximate: false,
        writtenLabel: match[0],
        displayWritten: match[0],
      };
    }

    match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (match) {
      var h = parseInt(match[1], 10);
      var m = match[2] ? parseInt(match[2], 10) : 0;
      var meridiem = match[3].toLowerCase();
      if (meridiem === "pm" && h < 12) h += 12;
      if (meridiem === "am" && h === 12) h = 0;
      return {
        value: formatTimeValue(h, m),
        approximate: false,
        writtenLabel: match[0],
        displayWritten: match[0],
      };
    }

    match = text.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (match) {
      var atHours = parseInt(match[1], 10);
      var atMinutes = match[2] ? parseInt(match[2], 10) : 0;
      var atMeridiem = match[3] ? match[3].toLowerCase() : null;
      if (atMeridiem === "pm" && atHours < 12) atHours += 12;
      if (atMeridiem === "am" && atHours === 12) atHours = 0;
      return {
        value: formatTimeValue(atHours, atMinutes),
        approximate: /\bish\b/i.test(match[0]),
        writtenLabel: match[0],
        displayWritten: match[0],
      };
    }

    return null;
  }

  function extractLocation(text) {
    var pattern =
      /\b(at|by|in|near|outside)\s+(?!(?:around|about)\b)([^.,;!?]+?)(?=\s+(?:and|but|then|who|which|that|with|for|about)\b|[.,;!?]|$)/i;
    var match = text.match(pattern);
    if (!match) return "not stated";

    var phrase = match[2].trim();
    if (!phrase) return "not stated";

    return capitalizeFirst(match[1]) + " " + phrase;
  }

  function stripTimePhrases(text) {
    return text
      .replace(/\b(around|about)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "")
      .replace(/\b\d{1,2}:\d{2}\b/g, "")
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, "")
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([,.;!?])/g, "$1")
      .trim();
  }

  function buildLoggedSentence(source) {
    var text = stripTimePhrases(source.trim());
    if (!text) return capitalizeFirst(source.trim());
    text = capitalizeFirst(text);
    if (!/[.!?]$/.test(text)) text += ".";
    return text;
  }

  function extractKeyObject(type, text) {
    var theftPhrase = null;
    var theftPattern = /\b(\w+(?:\s+\w+)?)\s+theft\b/gi;
    var theftMatch;

    while ((theftMatch = theftPattern.exec(text)) !== null) {
      theftPhrase = theftMatch[1].trim();
    }

    if (theftPhrase) {
      return theftPhrase + " theft";
    }

    if (/\bwindow\b/i.test(text)) return "window";

    var fightMatch = text.match(/\bfight\b[^.!?]*?\b(?:at|by|in|near)\s+(?:the\s+)?([^.,;!?]+)/i);
    if (fightMatch) return fightMatch[1].trim();

    if (/\bcut her hand\b/i.test(text)) return "hand";
    if (/\bbar staff\b/i.test(text)) return "bar staff";
    if (/\bfire exit\b/i.test(text)) return "fire exit";

    return null;
  }

  function buildTitle(type, text) {
    var object = extractKeyObject(type, text);
    return object ? type + ", " + object : type;
  }

  function shiftNightCandidate(value) {
    var minutes = timeToMinutes(value);
    if (minutes === null) return value;
    var hours = Math.floor(minutes / 60);
    var mins = minutes % 60;
    if (hours >= 12) {
      hours -= 12;
    }
    return formatTimeValue(hours, mins);
  }

  function buildIncidentFromSentence(sentence) {
    var source = sentence.trim();
    if (!source) return null;

    var fixtureBuilder = matchScriptFixture(source);
    if (fixtureBuilder) {
      return fixtureBuilder(source);
    }

    var classification = classifySentence(source);
    if (!classification) return null;

    var type = classification.type;
    var hasInjury = classification.hasInjury;
    var timeInfo = extractTime(source);
    var location = extractLocation(source);
    var logged = buildLoggedSentence(source);
    var title = buildTitle(type, source);
    var description = logged;
    var fields = [
      { label: "Time", value: timeInfo ? timeInfo.value : null },
      { label: "Location", value: location },
      { label: "Type", value: type },
      { label: "Description", value: description },
    ];

    if (classification.injuries) {
      fields.push({ label: "Injuries", value: classification.injuries });
    }

    var item = {
      source: source,
      logged: logged,
      title: title,
      desc: description,
      provenance: "live",
      fields: fields,
      time: timeInfo ? timeInfo.value : "",
    };

    if (!timeInfo) {
      item.type = "missing";
      item.missingField = "Time";
      item.missingPrompt = "When did this happen?";
      return applyCardRouting(item, hasInjury);
    }

    if (timeInfo.approximate) {
      item.type = "low";
      item.doubtField = "Time";
      item.timeDoubt = "approximate";
      item.doubt = "You wrote '" + timeInfo.writtenLabel + "'. Keep it approximate?";
      return applyCardRouting(item, hasInjury);
    }

    if (!isWithinShiftHours(timeInfo.value)) {
      item.type = "low";
      item.doubtField = "Time";
      item.timeDoubt = "outside-shift";
      item.timeShiftCandidate = shiftNightCandidate(timeInfo.value);
      item.timeDayCandidate = timeInfo.value;
      item.doubt =
        "You wrote '" + timeInfo.displayWritten + "'. Did you mean " + item.timeShiftCandidate + "?";
      return applyCardRouting(item, hasInjury);
    }

    return applyCardRouting(item, hasInjury);
  }

  function detectionKeyForSentence(text) {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
  }

  function splitSentences(text) {
    return splitSentencesWithRanges(text).map(function (segment) {
      return segment.text;
    });
  }

  function splitSentencesWithRanges(text) {
    var segments = [];
    if (!text.trim()) return segments;

    var regex = /[^.!?]+[.!?]+|[^.!?]+$/g;
    var match;

    while ((match = regex.exec(text)) !== null) {
      var segmentText = match[0].trim();
      if (!segmentText) continue;

      segments.push({
        text: segmentText,
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return segments;
  }

  function getCaretSegmentIndex(segments, caretPos) {
    for (var i = 0; i < segments.length; i++) {
      if (caretPos >= segments[i].start && caretPos <= segments[i].end) return i;
    }

    if (segments.length && caretPos >= segments[segments.length - 1].start) {
      return segments.length - 1;
    }

    return -1;
  }

  function countSentences(text) {
    return splitSentences(text).length;
  }

  function prefersReducedMotion() {
    return reducedMotionQuery.matches;
  }

  function clearPulseCap() {
    window.clearTimeout(pulseCapTimer);
    pulseCapTimer = null;
    statusEl.classList.remove("capture-status--pulse-capped");
  }

  function clearSettle() {
    window.clearTimeout(settleTimer);
    settleTimer = null;
    statusEl.classList.remove("capture-status--settle");
  }

  function startReadingPulse() {
    clearPulseCap();
    if (prefersReducedMotion()) return;

    pulseCapTimer = window.setTimeout(function () {
      statusEl.classList.add("capture-status--pulse-capped");
    }, READING_PULSE_MAX_MS);
  }

  function triggerSettlePulse() {
    clearPulseCap();
    if (prefersReducedMotion()) return;

    clearSettle();
    statusEl.classList.add("capture-status--settle");
    settleTimer = window.setTimeout(function () {
      statusEl.classList.remove("capture-status--settle");
      settleTimer = null;
    }, SETTLE_PULSE_MS);
  }

  function setStatus(state, options) {
    options = options || {};

    statusEl.classList.remove("capture-status--reading", "capture-status--logged");
    clearPulseCap();
    if (!options.keepSettle) {
      clearSettle();
    }

    if (state === "reading") {
      statusEl.classList.add("capture-status--reading");
      startReadingPulse();
      return;
    }

    if (state === "logged") {
      statusEl.classList.add("capture-status--logged");
      if (options.settle) {
        triggerSettlePulse();
      }
    }
  }

  function showDetectionStatus(result) {
    if (!statusLogged) return;

    var loggedCount = result.loggedCount || 0;
    var uncardedCount = result.uncardedCount || 0;
    var message = "";
    var duration = LOGGED_STATUS_MS;

    if (loggedCount > 0 && uncardedCount > 0) {
      message =
        "Logged " +
        loggedCount +
        " incident" +
        (loggedCount === 1 ? "" : "s") +
        ". " +
        uncardedCount +
        " sentence" +
        (uncardedCount === 1 ? "" : "s") +
        " left for the end.";
      duration = NO_INCIDENT_STATUS_MS;
    } else if (loggedCount > 0) {
      message = loggedCount === 1 ? "Logged 1 incident" : "Logged " + loggedCount + " incidents";
    } else if (uncardedCount > 0) {
      message = "Read it. No incident in that. I'll check with you before you submit.";
      duration = NO_INCIDENT_STATUS_MS;
    }

    if (!message) {
      setStatus("idle");
      return;
    }

    statusLogged.textContent = message;
    setStatus("logged", { settle: true });

    window.clearTimeout(loggedTimer);
    loggedTimer = window.setTimeout(function () {
      setStatus("idle");
    }, duration);
  }

  function formatCoverageLabel(count, singular, plural) {
    return count + " " + (count === 1 ? singular : plural);
  }

  function updateCoverage() {
    var sentences = countSentences(textarea.value);
    var incidents =
      window.ShiftReview && window.ShiftReview.getLiveIncidentCount
        ? window.ShiftReview.getLiveIncidentCount()
        : 0;

    if (coverageEl) {
      if (sentences === 0) {
        coverageEl.hidden = true;
        return;
      }

      coverageEl.hidden = false;
      coverageEl.textContent =
        formatCoverageLabel(sentences, "sentence", "sentences") +
        " · " +
        formatCoverageLabel(incidents, "incident", "incidents");
    }
  }

  function runDetection(excludeCaretSegment) {
    var text = textarea.value;
    var caretPos = textarea.selectionStart || 0;
    var segments = splitSentencesWithRanges(text);
    var caretIndex = excludeCaretSegment ? getCaretSegmentIndex(segments, caretPos) : -1;
    var loggedCount = 0;
    var uncardedCount = 0;

    segments.forEach(function (segment, index) {
      if (index === caretIndex) return;

      var item = buildIncidentFromSentence(segment.text);
      if (!item) {
        uncardedCount += 1;
        return;
      }

      item.detectionKey = detectionKeyForSentence(segment.text);

      if (window.ShiftReview && window.ShiftReview.upsertLiveDetection) {
        var result = window.ShiftReview.upsertLiveDetection(item);
        if (result && (result.action === "created" || result.action === "updated")) {
          loggedCount += 1;
        }
      }
    });

    return {
      loggedCount: loggedCount,
      uncardedCount: uncardedCount,
    };
  }

  function finishDetection(excludeCaretSegment) {
    window.requestAnimationFrame(function () {
      var result = runDetection(excludeCaretSegment);
      updateCoverage();
      showDetectionStatus(result);
    });
  }

  function beginReadingThenDetect(excludeCaretSegment) {
    window.clearTimeout(detectionTimer);
    setStatus("reading");
    detectionTimer = window.setTimeout(function () {
      finishDetection(excludeCaretSegment);
    }, DETECTION_READ_MS);
  }

  function executeDetection(excludeCaretSegment) {
    window.clearTimeout(typingTimer);
    beginReadingThenDetect(excludeCaretSegment);
  }

  function schedulePauseDetection() {
    window.clearTimeout(typingTimer);
    window.clearTimeout(detectionTimer);
    typingTimer = window.setTimeout(function () {
      beginReadingThenDetect(false);
    }, DETECTION_DELAY_MS);
  }

  function loadThreeAmNotes() {
    var notes = window.CaptureDetect.THREE_AM_NOTES;
    textarea.value = textarea.value.trim() ? textarea.value.trim() + " " + notes : notes;
    window.clearTimeout(typingTimer);
    window.clearTimeout(detectionTimer);
    window.clearTimeout(loggedTimer);
    executeDetection(false);
  }

  function clearCaptureField() {
    textarea.value = "";
    window.clearTimeout(typingTimer);
    window.clearTimeout(detectionTimer);
    window.clearTimeout(loggedTimer);
    clearPulseCap();
    clearSettle();
    setStatus("idle");
    if (statusLogged) statusLogged.textContent = "";
    updateCoverage();
  }

  function dispatchNotesInput() {
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
  }

  function appendTypedChunk(chunk, done) {
    var index = 0;

    function typeNextChar() {
      if (index >= chunk.length) {
        if (done) done();
        return;
      }

      textarea.value += chunk.charAt(index);
      index += 1;
      dispatchNotesInput();
      window.setTimeout(typeNextChar, TYPING_CHAR_MS);
    }

    typeNextChar();
  }

  function pauseForDetection(done) {
    window.setTimeout(done, DETECTION_DELAY_MS + DETECTION_READ_MS + 200);
  }

  function playScriptedLiveTyping() {
    if (scriptedTypingActive) return;
    scriptedTypingActive = true;

    var sentenceIndex = 0;

    function typeSentence() {
      if (sentenceIndex >= SCRIPTED_LIVE_TYPING.length) {
        scriptedTypingActive = false;
        return;
      }

      var sentence = SCRIPTED_LIVE_TYPING[sentenceIndex];
      var prefix = "";

      if (sentenceIndex === 0) {
        if (textarea.value.trim() && !textarea.value.endsWith("\n")) {
          prefix = "\n";
        }
      } else {
        prefix = ". ";
      }

      appendTypedChunk(prefix + sentence, function () {
        pauseForDetection(function () {
          sentenceIndex += 1;
          typeSentence();
        });
      });
    }

    typeSentence();
  }

  textarea.addEventListener("input", function () {
    window.clearTimeout(typingTimer);
    window.clearTimeout(detectionTimer);
    window.clearTimeout(loggedTimer);
    clearPulseCap();
    clearSettle();
    setStatus("idle");
    schedulePauseDetection();
  });

  textarea.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") return;

    window.clearTimeout(typingTimer);
    window.clearTimeout(detectionTimer);
    window.clearTimeout(loggedTimer);
    window.setTimeout(function () {
      executeDetection(true);
    }, 0);
  });
})();
