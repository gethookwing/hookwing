/* Replace static dates in code examples with recent dynamic dates */
(function() {
  var now = Date.now();
  var day = 86400000;
  document.querySelectorAll('.tok-string, code').forEach(function(el) {
    el.innerHTML = el.innerHTML.replace(/2026-03-03T\d{2}:\d{2}:\d{2}Z/g, function() {
      var d = new Date(now - Math.floor(Math.random() * 14 + 2) * day);
      return d.toISOString().replace(/\.\d{3}Z/, 'Z');
    });
  });
  document.querySelectorAll('.meta span').forEach(function(el) {
    if (/Updated \d{4}-\d{2}-\d{2}/.test(el.textContent)) {
      var d = new Date(now - Math.floor(Math.random() * 7 + 1) * day);
      el.textContent = 'Updated ' + d.toISOString().slice(0, 10);
    }
  });
})();
