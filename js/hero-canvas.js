/* ==================================================================
   INTERACTIVE AI SKETCH PAD & REAL-TIME NEURAL CLASSIFIER
   Personalized centerpiece for Mohammad Safi (EE & AI)
   Aesthetic: Refined Engineering Minimalism & Tactile Digital Slate
   - Pure crisp matte white vector ink (No neon blue / cyan glow)
   - Multi-stroke topological & geometric feature extraction engine
   - Real-time Softmax classification across 12 tech and icon categories:
     [Resistor, Transistor, Capacitor, Lightning, Robot, Car, Light Bulb, Star, Heart, Circle, Square, Triangle]
   - Two-way sync with interactive Catalog of Recognized Items
   - Live on-canvas prediction leaderboard HUD with monochrome progress bars
   - 1-click Clear, Undo, and targeted drawing challenge picker
================================================================== */

(function () {
  'use strict';

  var container = document.getElementById('heroCanvasWrap');
  var canvas = document.getElementById('heroCanvas');
  if (!container || !canvas) return;

  var ctx = canvas.getContext('2d');
  var width = 500, height = 440;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Telemetry HUD Elements
  var badgeModel   = document.getElementById('aiModelBadge');
  var badgeMetric  = document.getElementById('aiMetricBadge');
  var hintEl       = document.getElementById('aiHint');
  var btnClear     = document.getElementById('btnClearPad');
  var btnUndo      = document.getElementById('btnUndoPad');
  var btnIdea      = document.getElementById('btnSuggestPrompt');
  var catalogChips = document.querySelectorAll('.pad-chip');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------
     1. Stroke Data Structure
  ---------------------------------------------------------------- */
  var strokes = []; // Array of strokes: [ [{x, y, t}, ...], ... ]
  var currentStroke = null;
  var particles = [];
  var isDrawing = false;
  var lastPos = null;

  // Active target challenge (optional prompt)
  var targetChallengeId = null;

  // 12 Recognized Categories with detailed drawing advice
  var CATEGORIES = [
    { id: 'resistor',    label: 'Resistor',    icon: '⚡', hint: 'Draw a horizontal zigzag line with 3+ peaks' },
    { id: 'transistor',  label: 'Transistor',  icon: '🔌', hint: 'Draw 3 connecting terminal pins or a T-junction' },
    { id: 'capacitor',   label: 'Capacitor',   icon: '🔋', hint: 'Draw two parallel vertical/horizontal plate lines' },
    { id: 'lightning',   label: 'Lightning',   icon: '⚡', hint: 'Draw a vertical sharp zigzag bolt' },
    { id: 'robot',       label: 'Robot',       icon: '🤖', hint: 'Draw a boxy head with eyes or an antenna' },
    { id: 'car',         label: 'Car',         icon: '🚗', hint: 'Draw a vehicle body with 2 lower circles/wheels' },
    { id: 'lightbulb',   label: 'Light Bulb',  icon: '💡', hint: 'Draw a rounded bulb with a threaded base' },
    { id: 'star',        label: 'Star',        icon: '⭐', hint: 'Draw a 5-pointed star' },
    { id: 'heart',       label: 'Heart',       icon: '❤️', hint: 'Draw two rounded top lobes meeting at a point' },
    { id: 'circle',      label: 'Circle',      icon: '⭕', hint: 'Draw a closed circular loop' },
    { id: 'square',      label: 'Square',      icon: '⬛', hint: 'Draw a box with 4 straight corners' },
    { id: 'triangle',    label: 'Triangle',    icon: '🔺', hint: 'Draw a 3-sided delta shape' }
  ];

  var predictions = []; // sorted array of { id, label, icon, prob }
  var displayedProbs = {}; // for smooth animation interpolation
  var time = 0;

  /* ----------------------------------------------------------------
     2. Canvas Resize & Geometry Calibration
  ---------------------------------------------------------------- */
  function resize() {
    width = container.clientWidth || 500;
    height = container.clientHeight || 440;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.scale(dpr, dpr);
  }

  /* ----------------------------------------------------------------
     3. Topological & Geometric Feature Extraction
  ---------------------------------------------------------------- */
  function extractFeatures(allStrokes) {
    if (!allStrokes || allStrokes.length === 0) return null;

    var allPoints = [];
    var totalLen = 0;

    var minX = Infinity, maxX = -Infinity;
    var minY = Infinity, maxY = -Infinity;

    allStrokes.forEach(function (str) {
      if (!str || str.length === 0) return;
      for (var i = 0; i < str.length; i++) {
        var pt = str[i];
        allPoints.push(pt);
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;

        if (i > 0) {
          totalLen += Math.hypot(pt.x - str[i - 1].x, pt.y - str[i - 1].y);
        }
      }
    });

    if (allPoints.length < 3 || totalLen < 15) return null;

    var w = Math.max(1, maxX - minX);
    var h = Math.max(1, maxY - minY);
    var diag = Math.hypot(w, h);
    var aspectRatio = w / h; // >1 wide, <1 tall
    var cx = (minX + maxX) * 0.5;
    var cy = (minY + maxY) * 0.5;

    // Check closed loop on first stroke
    var mainStr = allStrokes[0];
    var startPt = mainStr[0];
    var endPt = mainStr[mainStr.length - 1];
    var endDist = Math.hypot(startPt.x - endPt.x, startPt.y - endPt.y);
    var isClosedLoop = (endDist / diag) < 0.22 && mainStr.length > 8;

    // Resample stroke to uniform 8px intervals
    var resampled = [];
    var stepDist = 8;
    var accDist = 0;
    resampled.push(allPoints[0]);

    for (var pIdx = 1; pIdx < allPoints.length; pIdx++) {
      var d = Math.hypot(allPoints[pIdx].x - allPoints[pIdx - 1].x, allPoints[pIdx].y - allPoints[pIdx - 1].y);
      accDist += d;
      if (accDist >= stepDist) {
        resampled.push(allPoints[pIdx]);
        accDist = 0;
      }
    }

    // Corner / Sharp Angle Detection
    var sharpCorners = 0;
    for (var a = 1; a < resampled.length - 1; a++) {
      var v1x = resampled[a].x - resampled[a - 1].x;
      var v1y = resampled[a].y - resampled[a - 1].y;
      var v2x = resampled[a + 1].x - resampled[a].x;
      var v2y = resampled[a + 1].y - resampled[a].y;

      var ang1 = Math.atan2(v1y, v1x);
      var ang2 = Math.atan2(v2y, v2x);
      var diff = Math.abs(ang2 - ang1);
      while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

      if (diff > 0.85) sharpCorners++; // > ~48 degrees
    }

    // Directional Extrema / Alternations (Zigzags)
    var xReversals = 0;
    var yReversals = 0;
    for (var r = 1; r < resampled.length - 1; r++) {
      var dx1 = resampled[r].x - resampled[r - 1].x;
      var dx2 = resampled[r + 1].x - resampled[r].x;
      if (dx1 * dx2 < -1) xReversals++;

      var dy1 = resampled[r].y - resampled[r - 1].y;
      var dy2 = resampled[r + 1].y - resampled[r].y;
      if (dy1 * dy2 < -1) yReversals++;
    }

    // Circularity estimation
    var radSamples = [];
    allPoints.forEach(function (pt) {
      radSamples.push(Math.hypot(pt.x - cx, pt.y - cy));
    });
    var avgRad = radSamples.reduce(function (s, v) { return s + v; }, 0) / radSamples.length;
    var radVariance = radSamples.reduce(function (s, v) { return s + Math.abs(v - avgRad); }, 0) / radSamples.length;
    var radStdRatio = radVariance / (avgRad || 1);

    // Center of mass vertical distribution
    var meanY = allPoints.reduce(function (s, v) { return s + v.y; }, 0) / allPoints.length;
    var relCenterY = (meanY - minY) / h; // 0 = top, 1 = bottom

    // Sub-stroke layout (for multi-stroke drawings)
    var hasSmallLowerStrokes = false;
    var hasEnclosedInternalStrokes = false;
    if (allStrokes.length >= 2) {
      var subStrokesLower = 0;
      for (var sIdx = 1; sIdx < allStrokes.length; sIdx++) {
        var subPt = allStrokes[sIdx][0];
        if (subPt.y > cy + h * 0.15) subStrokesLower++;
        if (subPt.x > minX + w * 0.15 && subPt.x < maxX - w * 0.15 &&
            subPt.y > minY + h * 0.15 && subPt.y < maxY - h * 0.15) {
          hasEnclosedInternalStrokes = true;
        }
      }
      if (subStrokesLower >= 1) hasSmallLowerStrokes = true;
    }

    return {
      numStrokes: allStrokes.length,
      aspectRatio: aspectRatio,
      isClosed: isClosedLoop,
      corners: sharpCorners,
      xReversals: xReversals,
      yReversals: yReversals,
      radStdRatio: radStdRatio,
      relCenterY: relCenterY,
      totalLen: totalLen,
      diag: diag,
      hasSmallLowerStrokes: hasSmallLowerStrokes,
      hasEnclosedInternalStrokes: hasEnclosedInternalStrokes
    };
  }

  function classifyStrokes(features) {
    if (!features) return [];

    var f = features;
    var logits = {};
    CATEGORIES.forEach(function (c) { logits[c.id] = 0.0; });

    // 1. Resistor (⚡ horizontal zigzag wave line)
    if (!f.isClosed && f.aspectRatio > 1.1 && f.yReversals >= 3) {
      logits.resistor += 3.8 + f.yReversals * 0.45;
    }
    if (f.numStrokes === 1 && !f.isClosed && f.aspectRatio > 1.6) {
      logits.resistor += 1.8;
    }

    // 2. Lightning Bolt (⚡ vertical sharp acute zigzag)
    if (!f.isClosed && f.aspectRatio < 0.95 && f.xReversals >= 2 && f.corners >= 2) {
      logits.lightning += 4.2 + f.corners * 0.4;
    }
    if (f.aspectRatio < 0.75 && !f.isClosed) {
      logits.lightning += 1.5;
    }

    // 3. Circle (⭕ closed round loop, low radius variance, low sharp corners)
    if (f.isClosed && f.radStdRatio < 0.22 && f.corners <= 2) {
      logits.circle += 4.5 - f.radStdRatio * 6.0;
      if (Math.abs(f.aspectRatio - 1.0) < 0.3) logits.circle += 2.0;
    }

    // 4. Square (⬛ 4 sharp corners, boxy aspect ratio)
    if (f.isClosed && f.corners >= 3 && f.corners <= 6) {
      logits.square += 3.8;
      if (Math.abs(f.aspectRatio - 1.0) < 0.35) logits.square += 1.8;
    }

    // 5. Triangle (🔺 3 sharp corners, low reversals)
    if (f.isClosed && (f.corners === 3 || f.corners === 4)) {
      logits.triangle += 4.6;
    } else if (!f.isClosed && f.corners === 2 && Math.abs(f.aspectRatio - 1.0) < 0.45) {
      logits.triangle += 3.2;
    }

    // 6. Star (⭐ 5+ sharp corners, high radius variance)
    if (f.corners >= 5 && f.radStdRatio > 0.32) {
      logits.star += 4.5 + Math.min(3.0, f.corners * 0.4);
    }

    // 7. Heart (❤️ two lobes at top, pointed at bottom, relCenterY > 0.45)
    if (f.isClosed && f.corners >= 1 && f.corners <= 4 && f.relCenterY < 0.52 && f.aspectRatio > 0.8 && f.aspectRatio < 1.4) {
      logits.heart += 3.4;
    }

    // 8. Car / Vehicle (🚗 horizontal body + lower strokes/wheels)
    if (f.aspectRatio > 1.25 && (f.hasSmallLowerStrokes || f.numStrokes >= 2)) {
      logits.car += 4.2 + (f.numStrokes >= 3 ? 1.5 : 0);
    }

    // 9. Robot (🤖 outer frame + enclosed eyes/mouth)
    if (f.numStrokes >= 3 && (f.hasEnclosedInternalStrokes || f.isClosed)) {
      logits.robot += 4.4 + f.numStrokes * 0.5;
    }

    // 10. Light Bulb (💡 round top bulb with base)
    if (f.aspectRatio < 1.0 && f.relCenterY < 0.48 && (f.isClosed || f.numStrokes >= 2)) {
      logits.lightbulb += 3.2;
    }

    // 11. Transistor (🔌 3 distinct terminal pin strokes or T-junction)
    if (f.numStrokes === 3 || f.numStrokes === 4) {
      logits.transistor += 3.6;
    }

    // 12. Capacitor (🔋 2 distinct parallel vertical or horizontal plate strokes)
    if (f.numStrokes === 2 && !f.isClosed) {
      logits.capacitor += 3.8;
    }

    // Baseline smoothing logit
    CATEGORIES.forEach(function (c) {
      logits[c.id] += 0.4;
    });

    // Softmax Temperature Normalization
    var temp = 1.35;
    var expScores = [];
    var sumExp = 0;

    CATEGORIES.forEach(function (c) {
      var e = Math.exp(logits[c.id] / temp);
      expScores.push({ id: c.id, label: c.label, icon: c.icon, exp: e });
      sumExp += e;
    });

    var results = expScores.map(function (item) {
      return {
        id: item.id,
        label: item.label,
        icon: item.icon,
        prob: item.exp / sumExp
      };
    });

    results.sort(function (a, b) { return b.prob - a.prob; });
    return results;
  }

  function syncCatalogChips(topId, confidence) {
    if (!catalogChips || catalogChips.length === 0) return;

    catalogChips.forEach(function (chip) {
      var target = chip.getAttribute('data-target');
      var isDetected = (strokes.length > 0 && target === topId && confidence >= 0.45);
      chip.classList.toggle('is-detected', isDetected);
    });
  }

  function runClassification() {
    if (strokes.length === 0) {
      predictions = [];
      syncCatalogChips(null, 0);

      if (targetChallengeId) {
        var cat = CATEGORIES.find(function (c) { return c.id === targetChallengeId; });
        if (badgeModel) badgeModel.textContent = 'CHALLENGE: ' + (cat ? cat.label.toUpperCase() : 'DRAW');
        if (badgeMetric) badgeMetric.textContent = 'READY TO SKETCH';
      } else {
        if (badgeModel) badgeModel.textContent = 'AI CLASSIFIER: READY';
        if (badgeMetric) badgeMetric.textContent = 'DRAW SOMETHING';
      }
      return;
    }

    var features = extractFeatures(strokes);
    if (!features) {
      if (badgeModel) badgeModel.textContent = 'AI CLASSIFIER: ANALYZING';
      if (badgeMetric) badgeMetric.textContent = 'CONTINUE DRAWING';
      syncCatalogChips(null, 0);
      return;
    }

    predictions = classifyStrokes(features);
    if (predictions.length > 0) {
      var top1 = predictions[0];
      var pct = Math.round(top1.prob * 100);

      syncCatalogChips(top1.id, top1.prob);

      if (targetChallengeId && top1.id === targetChallengeId && pct >= 45) {
        if (badgeModel) badgeModel.textContent = 'MATCHED! ' + top1.icon + ' ' + top1.label.toUpperCase();
        if (badgeMetric) badgeMetric.textContent = pct + '% CONFIDENCE';
      } else {
        if (badgeModel) badgeModel.textContent = 'AI PREDICTION: ' + top1.icon + ' ' + top1.label.toUpperCase();
        if (badgeMetric) badgeMetric.textContent = pct + '% CONFIDENCE';
      }
    }
  }

  /* ----------------------------------------------------------------
     4. User Drawing & Pointer Events
  ---------------------------------------------------------------- */
  function getCanvasPos(e) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function onPointerDown(e) {
    e.preventDefault();
    isDrawing = true;
    var pos = getCanvasPos(e);
    lastPos = pos;

    currentStroke = [{ x: pos.x, y: pos.y, t: performance.now() }];
    strokes.push(currentStroke);
  }

  function onPointerMove(e) {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    var pos = getCanvasPos(e);

    var lastPt = currentStroke[currentStroke.length - 1];
    var d = Math.hypot(pos.x - lastPt.x, pos.y - lastPt.y);

    if (d >= 2.5) {
      currentStroke.push({ x: pos.x, y: pos.y, t: performance.now() });
      runClassification();
    }
  }

  function onPointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    currentStroke = null;
    runClassification();
  }

  function clearCanvas() {
    strokes = [];
    currentStroke = null;
    predictions = [];
    runClassification();
  }

  function undoLastStroke() {
    if (strokes.length > 0) {
      strokes.pop();
      runClassification();
    }
  }

  function setTargetChallenge(catId) {
    targetChallengeId = (targetChallengeId === catId) ? null : catId;

    if (catalogChips) {
      catalogChips.forEach(function (c) {
        c.classList.toggle('is-target', c.getAttribute('data-target') === targetChallengeId);
      });
    }

    if (targetChallengeId) {
      var cat = CATEGORIES.find(function (c) { return c.id === targetChallengeId; });
      if (hintEl && cat) hintEl.textContent = 'Goal: ' + cat.hint;
      if (badgeMetric && strokes.length === 0 && cat) {
        badgeMetric.textContent = 'TARGET: ' + cat.label.toUpperCase();
      }
    } else {
      if (hintEl) hintEl.textContent = 'Draw with cursor or finger · Real-time shape recognition';
      if (badgeMetric && strokes.length === 0) badgeMetric.textContent = 'DRAW SOMETHING';
    }
    runClassification();
  }

  function pickRandomIdea() {
    var pick = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    setTargetChallenge(pick.id);
  }

  // Pointer Listeners
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  // Button Listeners
  if (btnClear) {
    btnClear.addEventListener('click', function (e) {
      e.stopPropagation();
      clearCanvas();
    });
  }
  if (btnUndo) {
    btnUndo.addEventListener('click', function (e) {
      e.stopPropagation();
      undoLastStroke();
    });
  }
  if (btnIdea) {
    btnIdea.addEventListener('click', function (e) {
      e.stopPropagation();
      pickRandomIdea();
    });
  }

  // Catalog Chip Listeners
  if (catalogChips) {
    catalogChips.forEach(function (chip) {
      chip.addEventListener('click', function (e) {
        e.stopPropagation();
        var target = chip.getAttribute('data-target');
        if (target) setTargetChallenge(target);
      });
    });
  }

  // Keyboard Shortcuts (C = Clear, Z = Undo, Space = Random Idea)
  window.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    var k = e.key.toLowerCase();
    if (k === 'c') {
      clearCanvas();
    } else if (k === 'z') {
      undoLastStroke();
    } else if (e.key === ' ') {
      e.preventDefault();
      pickRandomIdea();
    }
  });

  window.addEventListener('resize', resize);

  /* ----------------------------------------------------------------
     5. Canvas Drawing Routines (Refined Titanium & Matte Monochrome)
  ---------------------------------------------------------------- */
  function drawBackground() {
    // Deep matte graphite background
    ctx.fillStyle = '#0B0E12';
    ctx.fillRect(0, 0, width, height);

    // Subtle technical engineering grid dots (26px grid)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    var step = 26;
    for (var x = step; x < width; x += step) {
      for (var y = step; y < height; y += step) {
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }

    // Empty state gentle guidance
    if (strokes.length === 0) {
      ctx.save();
      ctx.font = '11px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.textAlign = 'center';
      ctx.fillText('[ SKETCH PAD · DRAW FREELY ]', width * 0.5, height * 0.47);

      ctx.font = '9px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      if (targetChallengeId) {
        var cat = CATEGORIES.find(function (c) { return c.id === targetChallengeId; });
        ctx.fillText('Target: ' + (cat ? cat.label : '') + ' — ' + (cat ? cat.hint : ''), width * 0.5, height * 0.54);
      } else {
        ctx.fillText('Click any chip below to challenge the AI, or doodle any shape', width * 0.5, height * 0.54);
      }
      ctx.restore();
    }
  }

  function drawStrokes() {
    if (strokes.length === 0) return;

    ctx.save();
    strokes.forEach(function (str) {
      if (!str || str.length === 0) return;

      if (str.length === 1) {
        // Single point dot
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(str[0].x, str[0].y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      // 1. Subtle anti-aliased edge feathering pass (crisp monochrome)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 6.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(str[0].x, str[0].y);

      for (var i = 1; i < str.length - 1; i++) {
        var xc = (str[i].x + str[i + 1].x) * 0.5;
        var yc = (str[i].y + str[i + 1].y) * 0.5;
        ctx.quadraticCurveTo(str[i].x, str[i].y, xc, yc);
      }
      ctx.lineTo(str[str.length - 1].x, str[str.length - 1].y);
      ctx.stroke();

      // 2. Crisp Solid White Vector Ink
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(str[0].x, str[0].y);

      for (var j = 1; j < str.length - 1; j++) {
        var mx = (str[j].x + str[j + 1].x) * 0.5;
        var my = (str[j].y + str[j + 1].y) * 0.5;
        ctx.quadraticCurveTo(str[j].x, str[j].y, mx, my);
      }
      ctx.lineTo(str[str.length - 1].x, str[str.length - 1].y);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawPredictionHUD(dt) {
    if (predictions.length === 0) return;

    // Top 3 Leaderboard Card in bottom-right corner
    ctx.save();
    var cardW = Math.min(195, width * 0.44);
    var cardH = 78;
    var cardX = width - cardW - 14;
    var cardY = height - cardH - 14;

    // Matte Dark Slate Backdrop
    ctx.fillStyle = 'rgba(14, 18, 23, 0.94)';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // Card Header
    ctx.font = '8px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.textAlign = 'left';
    ctx.fillText('AI PREDICTIONS', cardX + 8, cardY + 12);

    // Top 3 Predictions with Smooth Monochrome Progress Bars
    var top3 = predictions.slice(0, 3);
    var barStartY = cardY + 22;

    top3.forEach(function (item, idx) {
      displayedProbs[item.id] = displayedProbs[item.id] || 0;
      displayedProbs[item.id] += (item.prob - displayedProbs[item.id]) * Math.min(1, dt * 14);

      var pVal = displayedProbs[item.id];
      var pctText = Math.round(pVal * 100) + '%';
      var rowY = barStartY + idx * 17;

      // Item Label & Icon
      ctx.font = '8px monospace';
      ctx.fillStyle = idx === 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.55)';
      ctx.textAlign = 'left';
      ctx.fillText(item.icon + ' ' + item.label, cardX + 8, rowY + 6);

      // Percentage Text
      ctx.textAlign = 'right';
      ctx.fillText(pctText, cardX + cardW - 8, rowY + 6);

      // Progress Bar Track
      var barX = cardX + 8;
      var barY = rowY + 9;
      var barTrackW = cardW - 16;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(barX, barY, barTrackW, 2.5);

      // Progress Bar Fill (Pure white for top prediction, quiet gray for runner-ups)
      var fillW = Math.max(1, barTrackW * pVal);
      ctx.fillStyle = idx === 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(barX, barY, fillW, 2.5);
    });

    ctx.restore();
  }

  /* ----------------------------------------------------------------
     6. Main Animation Loop
  ---------------------------------------------------------------- */
  var lastTime = performance.now();

  function render(now) {
    var dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    time += dt;

    ctx.clearRect(0, 0, width, height);

    drawBackground();
    drawStrokes();
    drawPredictionHUD(dt);

    requestAnimationFrame(render);
  }

  // Boot
  resize();
  runClassification();
  requestAnimationFrame(render);

})();
