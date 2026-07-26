/*
 * Pure validation logic shared by the browser form (loaded as a classic
 * script, exposed on window.ARCValidation) and the Node test suite
 * (loaded via require). Keep this file free of DOM access.
 */
(function () {
  'use strict';

  var MAX_FILE_BYTES = 10 * 1024 * 1024;  // 10 MB per file
  var MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 20 MB per submission (Apps Script POST limit headroom)

  var ALLOWED_EXTENSIONS = [
    'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',      // images
    'csv', 'tsv', 'txt', 'json', 'xlsx', 'xls',      // data
    'pdf',                                           // figures/derivations
  ];

  /** Strip URL prefixes/whitespace and re-hyphenate a bare 16-char ORCID. */
  function normalizeOrcid(input) {
    if (!input) return '';
    var s = String(input).trim();
    s = s.replace(/^https?:\/\/(www\.)?orcid\.org\//i, '');
    s = s.replace(/\s+/g, '').toUpperCase();
    if (/^[0-9]{15}[0-9X]$/.test(s)) {
      s = s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16);
    }
    return s;
  }

  /** ISO 7064 mod 11-2 checksum used by ORCID iDs. */
  function isValidOrcid(input) {
    var s = normalizeOrcid(input);
    if (!/^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$/.test(s)) return false;
    var digits = s.replace(/-/g, '');
    var total = 0;
    for (var i = 0; i < 15; i++) {
      total = (total + Number(digits[i])) * 2;
    }
    var remainder = total % 11;
    var result = (12 - remainder) % 11;
    var expected = result === 10 ? 'X' : String(result);
    return digits[15] === expected;
  }

  function isValidEmail(input) {
    if (!input) return false;
    var s = String(input).trim();
    // Pragmatic check: one @, non-empty local part, dotted domain with a TLD.
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  }

  /**
   * files: array of {name, size}. Returns {ok, error?}.
   */
  function checkFiles(files) {
    var total = 0;
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var ext = (f.name.lastIndexOf('.') >= 0)
        ? f.name.slice(f.name.lastIndexOf('.') + 1).toLowerCase()
        : '';
      if (ALLOWED_EXTENSIONS.indexOf(ext) === -1) {
        return { ok: false, error: 'File type ".' + ext + '" is not allowed (' + f.name + '). Allowed: ' + ALLOWED_EXTENSIONS.join(', ') };
      }
      if (f.size > MAX_FILE_BYTES) {
        return { ok: false, error: f.name + ' exceeds the 10 MB per-file limit. Host large datasets externally and use the dataset link field.' };
      }
      total += f.size;
    }
    if (total > MAX_TOTAL_BYTES) {
      return { ok: false, error: 'Attachments exceed the 20 MB total limit. Host large datasets externally and use the dataset link field.' };
    }
    return { ok: true };
  }

  var api = {
    normalizeOrcid: normalizeOrcid,
    isValidOrcid: isValidOrcid,
    isValidEmail: isValidEmail,
    checkFiles: checkFiles,
    MAX_FILE_BYTES: MAX_FILE_BYTES,
    MAX_TOTAL_BYTES: MAX_TOTAL_BYTES,
    ALLOWED_EXTENSIONS: ALLOWED_EXTENSIONS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof window !== 'undefined') {
    window.ARCValidation = api;
  }
})();
