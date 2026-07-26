/* ARC-Combustion — single-page submission form logic. */
(function () {
  'use strict';

  var V = window.ARCValidation;
  var CONFIG = window.ARC_CONFIG || { BACKEND_URL: '' };
  var $ = function (id) { return document.getElementById(id); };

  var CONCEPTS = [
    'Thermochemistry & equilibrium',
    'Chemical kinetics',
    'Ignition & extinction',
    'Laminar premixed flames',
    'Laminar diffusion flames',
    'Turbulent combustion',
    'Detonations & explosions',
    'Spray & droplet combustion',
    'Solid fuel combustion',
    'Pollutant formation & emissions',
    'Combustion instabilities',
    'Fire dynamics',
    'Numerical combustion / CFD',
  ];

  var state = {
    files: [],          // {name, mimeType, size, b64}
    orcidName: '',
  };

  /* ---------- helpers ---------- */

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function setNote(el, msg, cls) {
    el.textContent = msg || '';
    el.className = 'field-note' + (cls ? ' ' + cls : '');
  }

  function formError(msg, sectionId) {
    var box = $('form-error');
    if (msg) {
      box.textContent = msg;
      show(box);
      if (sectionId) {
        document.getElementById(sectionId).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      box.textContent = '';
      hide(box);
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function prettySize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }

  /* ---------- concepts ---------- */

  function renderConcepts() {
    var grid = $('concepts');
    CONCEPTS.forEach(function (c, i) {
      var label = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = c;
      cb.id = 'concept-' + i;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + c));
      grid.appendChild(label);
    });
  }

  function selectedConcepts() {
    var out = [];
    $('concepts').querySelectorAll('input[type="checkbox"]').forEach(function (b) {
      if (b.checked) out.push(b.value);
    });
    return out;
  }

  /* ---------- MCQ options ---------- */

  function addMcqOption(text) {
    var container = $('mcq-options');
    var row = document.createElement('div');
    row.className = 'dyn-row';
    row.innerHTML =
      '<input type="radio" name="mcq-correct" title="Mark as the correct option">' +
      '<span class="marker"></span>' +
      '<input type="text" class="mcq-text" placeholder="Option text">' +
      '<button type="button" class="secondary small remove" title="Remove option">&times;</button>';
    row.querySelector('.mcq-text').value = text || '';
    row.querySelector('.remove').addEventListener('click', function () {
      if (container.children.length > 2) { row.remove(); renumberMcq(); }
    });
    container.appendChild(row);
    renumberMcq();
  }

  function renumberMcq() {
    var rows = $('mcq-options').children;
    for (var i = 0; i < rows.length; i++) {
      rows[i].querySelector('.marker').textContent = String.fromCharCode(65 + i) + '.';
    }
  }

  function mcqData() {
    var rows = $('mcq-options').children;
    var options = [];
    var correct = -1;
    for (var i = 0; i < rows.length; i++) {
      options.push(rows[i].querySelector('.mcq-text').value.trim());
      if (rows[i].querySelector('input[type="radio"]').checked) correct = i;
    }
    return { options: options, correctIndex: correct };
  }

  /* ---------- solution steps ---------- */

  function addStep(text) {
    var list = $('steps-list');
    var row = document.createElement('div');
    row.className = 'dyn-row';
    row.innerHTML =
      '<span class="marker"></span>' +
      '<textarea rows="2" class="step-text" placeholder="Assumption made, equation applied, or logical move — one per step"></textarea>' +
      '<button type="button" class="secondary small remove" title="Remove step">&times;</button>';
    row.querySelector('.step-text').value = text || '';
    row.querySelector('.remove').addEventListener('click', function () {
      if (list.children.length > 1) { row.remove(); renumberSteps(); }
    });
    list.appendChild(row);
    renumberSteps();
  }

  function renumberSteps() {
    var rows = $('steps-list').children;
    for (var i = 0; i < rows.length; i++) {
      rows[i].querySelector('.marker').textContent = (i + 1) + '.';
    }
  }

  function stepsData() {
    var out = [];
    $('steps-list').querySelectorAll('.step-text').forEach(function (t) {
      var v = t.value.trim();
      if (v) out.push(v);
    });
    return out;
  }

  /* ---------- ORCID ---------- */

  function verifyOrcid() {
    var statusEl = $('orcid-status');
    var id = V.normalizeOrcid($('orcid').value);
    state.orcidName = '';
    if (!V.isValidOrcid(id)) {
      setNote(statusEl, 'Not a valid ORCID iD (checksum failed). Format: 0000-0002-1825-0097.', 'err');
      return;
    }
    $('orcid').value = id;
    setNote(statusEl, 'Checking the ORCID registry…');

    var request;
    if (CONFIG.BACKEND_URL) {
      request = fetch(CONFIG.BACKEND_URL + '?action=orcid&id=' + encodeURIComponent(id))
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) throw new Error(d.error || 'lookup failed');
          return d.name || '';
        });
    } else {
      request = fetch('https://pub.orcid.org/v3.0/' + id + '/person', { headers: { Accept: 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error('ORCID not found (HTTP ' + r.status + ')');
          return r.json();
        })
        .then(function (j) {
          var name = j && j.name;
          var given = name && name['given-names'] && name['given-names'].value;
          var family = name && name['family-name'] && name['family-name'].value;
          return [given, family].filter(Boolean).join(' ');
        });
    }

    request.then(function (name) {
      state.orcidName = name;
      if (name) {
        setNote(statusEl, '✓ Verified: ' + name, 'ok');
        if (!$('name').value.trim()) $('name').value = name;
      } else {
        setNote(statusEl, '✓ ORCID iD exists (name not public on the registry).', 'ok');
      }
    }).catch(function () {
      setNote(statusEl,
        'Checksum is valid, but the ORCID registry could not be reached right now. ' +
        'Existence will be re-checked when you submit.', 'warn');
    });
  }

  /* ---------- files ---------- */

  function refreshFileList() {
    var ul = $('file-list');
    ul.innerHTML = '';
    state.files.forEach(function (f, i) {
      var li = document.createElement('li');
      li.innerHTML = '<span>' + escapeHtml(f.name) + '</span>' +
        '<span class="size">' + prettySize(f.size) + '</span>' +
        '<button type="button" class="secondary small" title="Remove">&times;</button>';
      li.querySelector('button').addEventListener('click', function () {
        state.files.splice(i, 1);
        refreshFileList();
        setNote($('file-status'), '');
      });
      ul.appendChild(li);
    });
  }

  function handleFileSelection(fileList) {
    var statusEl = $('file-status');
    var incoming = Array.prototype.slice.call(fileList).filter(function (f) {
      return !state.files.some(function (g) { return g.name === f.name && g.size === f.size; });
    });
    var combined = state.files.concat(incoming.map(function (f) { return { name: f.name, size: f.size }; }));
    var check = V.checkFiles(combined);
    if (!check.ok) { setNote(statusEl, check.error, 'err'); return; }

    setNote(statusEl, 'Reading file(s)…');
    var reads = incoming.map(function (f) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var b64 = String(reader.result).split(',')[1] || '';
          resolve({ name: f.name, mimeType: f.type || 'application/octet-stream', size: f.size, b64: b64 });
        };
        reader.onerror = function () { reject(new Error('Could not read ' + f.name)); };
        reader.readAsDataURL(f);
      });
    });
    Promise.all(reads).then(function (loaded) {
      state.files = state.files.concat(loaded);
      refreshFileList();
      setNote(statusEl, state.files.length + ' file(s) attached.', 'ok');
    }).catch(function (e) {
      setNote(statusEl, e.message, 'err');
    });
  }

  /* ---------- validation (whole page, first error wins) ---------- */

  function validateAll() {
    if (!V.isValidOrcid($('orcid').value)) return { error: 'Please enter a valid ORCID iD.', section: 'sec-you' };
    if (!V.isValidEmail($('email').value)) return { error: 'Please enter a valid email address — your reference number is sent there.', section: 'sec-you' };
    if (!$('name').value.trim()) return { error: 'Please enter your full name.', section: 'sec-you' };

    if (!$('qtype').value) return { error: 'Please select a question type.', section: 'sec-question' };
    if (!$('difficulty').value) return { error: 'Please select a difficulty level.', section: 'sec-question' };
    if (!$('title').value.trim()) return { error: 'Please give the question a short title.', section: 'sec-question' };
    if (!$('qtext').value.trim()) return { error: 'Please enter the question text.', section: 'sec-question' };
    if (selectedConcepts().length === 0 && !$('concept-other').value.trim()) {
      return { error: 'Please select at least one combustion concept (or name one under "Other").', section: 'sec-question' };
    }

    var fmt = $('aformat').value;
    if (!fmt) return { error: 'Please choose an answer format.', section: 'sec-answer' };
    if (fmt === 'mcq') {
      var m = mcqData();
      if (m.options.filter(Boolean).length < 2) return { error: 'Provide at least two answer options.', section: 'sec-answer' };
      if (m.correctIndex < 0 || !m.options[m.correctIndex]) return { error: 'Mark which option is correct (radio button on the left).', section: 'sec-answer' };
    } else if (fmt === 'numeric') {
      if (!$('num-value').value.trim()) return { error: 'Enter the correct numeric value.', section: 'sec-answer' };
      if (!$('num-units').value.trim()) return { error: 'Enter the units of the answer.', section: 'sec-answer' };
      if (!$('num-tol').value.trim()) return { error: 'Enter the acceptable tolerance (e.g. ±5 %).', section: 'sec-answer' };
    } else if (fmt === 'short') {
      if (!$('short-answer').value.trim()) return { error: 'Enter the correct answer.', section: 'sec-answer' };
    } else if (fmt === 'derivation') {
      if (!$('deriv-answer').value.trim()) return { error: 'Enter the final result the derivation must reach.', section: 'sec-answer' };
    }
    if (stepsData().length < 2) return { error: 'Please provide at least two solution steps — the reasoning path is what makes the answer verifiable.', section: 'sec-answer' };
    if (!$('rubric').value.trim()) return { error: 'Please provide a grading rubric / justification for the answer.', section: 'sec-answer' };

    var link = $('dataset-link').value.trim();
    if (link && !/^https?:\/\/.+\..+/.test(link)) return { error: 'The dataset link must be a full URL (https://…).', section: 'sec-files' };
    var qt = $('qtype').value;
    if (qt === 'image-based' && !state.files.some(function (f) { return /image|png|jpe?g|gif|svg|webp/i.test(f.mimeType + f.name); })) {
      return { error: 'This is an image-based question — please attach the image it depends on.', section: 'sec-files' };
    }
    if (qt === 'dataset-based' && state.files.length === 0 && !link) {
      return { error: 'This is a dataset-based question — attach the dataset or provide a link to it.', section: 'sec-files' };
    }

    if (!$('consent').checked) return { error: 'Please confirm the statement before submitting.', section: 'sec-submit' };
    return null;
  }

  /* ---------- payload & submit ---------- */

  function syncAnswerFormat() {
    var fmt = $('aformat').value;
    document.querySelectorAll('.afmt').forEach(function (el) {
      el.classList.toggle('hidden', el.dataset.afmt !== fmt);
    });
  }

  function buildPayload() {
    var fmt = $('aformat').value;
    var answer = { format: fmt };
    if (fmt === 'mcq') {
      var m = mcqData();
      answer.options = m.options;
      answer.correctIndex = m.correctIndex;
      answer.correctLetter = m.correctIndex >= 0 ? String.fromCharCode(65 + m.correctIndex) : '';
    } else if (fmt === 'numeric') {
      answer.value = $('num-value').value.trim();
      answer.units = $('num-units').value.trim();
      answer.tolerance = $('num-tol').value.trim();
    } else if (fmt === 'short') {
      answer.text = $('short-answer').value.trim();
    } else if (fmt === 'derivation') {
      answer.text = $('deriv-answer').value.trim();
    }
    return {
      kind: 'combustion-benchmark-question',
      clientVersion: 2,
      website: $('website').value, // honeypot — must be empty
      submitter: {
        orcid: V.normalizeOrcid($('orcid').value),
        orcidNameSeen: state.orcidName,
        email: $('email').value.trim(),
        name: $('name').value.trim(),
        affiliation: $('affiliation').value.trim(),
      },
      question: {
        type: $('qtype').value,
        title: $('title').value.trim(),
        text: $('qtext').value.trim(),
        concepts: selectedConcepts(),
        conceptOther: $('concept-other').value.trim(),
        difficulty: $('difficulty').value,
      },
      answer: answer,
      solutionSteps: stepsData(),
      rubric: $('rubric').value.trim(),
      references: $('references').value.trim(),
      datasetLink: $('dataset-link').value.trim(),
      files: state.files.map(function (f) {
        return { name: f.name, mimeType: f.mimeType, size: f.size, b64: f.b64 };
      }),
    };
  }

  function submit() {
    var bad = validateAll();
    if (bad) { formError(bad.error, bad.section); return; }
    if (!CONFIG.BACKEND_URL) {
      formError('The submission backend is not configured yet, so this form cannot submit. Please contact the site owner.', 'sec-submit');
      return;
    }
    var btn = $('btn-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    formError(null);

    fetch(CONFIG.BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // simple request: no CORS preflight
      body: JSON.stringify(buildPayload()),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) throw new Error(d.error || 'The server rejected the submission.');
        $('ref-number').textContent = d.ref;
        $('success-email').textContent = $('email').value.trim();
        hide($('submission-form'));
        show($('success'));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
      .catch(function (e) {
        formError('Submission failed: ' + e.message + ' — your entries are still here; please try again.', 'sec-submit');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Submit question';
      });
  }

  /* ---------- init ---------- */

  function init() {
    renderConcepts();
    addMcqOption(); addMcqOption(); addMcqOption(); addMcqOption();
    addStep(); addStep(); addStep();

    if (!CONFIG.BACKEND_URL) show($('backend-banner'));

    $('orcid').addEventListener('blur', function () {
      if ($('orcid').value.trim()) verifyOrcid();
    });
    $('aformat').addEventListener('change', syncAnswerFormat);
    $('mcq-add').addEventListener('click', function () { addMcqOption(); });
    $('step-add').addEventListener('click', function () { addStep(); });
    $('files').addEventListener('change', function (e) {
      handleFileSelection(e.target.files);
      e.target.value = '';
    });

    $('submission-form').addEventListener('submit', function (e) {
      e.preventDefault();
      submit();
    });
    $('btn-another').addEventListener('click', function () { window.location.reload(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
