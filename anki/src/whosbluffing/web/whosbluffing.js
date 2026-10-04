/* Who's Bluffing rating bar for the reviewer's question side.
   Buttons send pycmd("whosbluffing:jol:<n>"). Keys 1-5 are bound in Python (hooks.py):
   Anki's Qt shortcuts consume those key presses before this page could see them. */
(function () {
  "use strict";
  var bar = null;

  function button(n, hint) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = String(n);
    b.title = hint || "";
    b.setAttribute("data-jol", String(n));
    b.addEventListener("click", function () {
      b.blur();
      pycmd("whosbluffing:jol:" + n);
    });
    return b;
  }

  function label(text) {
    var s = document.createElement("span");
    s.className = "whosbluffing-end";
    s.textContent = text;
    return s;
  }

  window.whosbluffing = {
    show: function (opts) {
      if (bar) bar.remove();
      bar = document.createElement("div");
      bar.id = "whosbluffing-bar";
      bar.setAttribute("role", "group");
      bar.setAttribute("aria-label", opts.title);
      bar.appendChild(label(opts.low));
      for (var n = 1; n <= 5; n++) bar.appendChild(button(n, opts.hints[n - 1]));
      bar.appendChild(label(opts.high));
      bar.hidden = !opts.buttons;
      document.body.appendChild(bar);
    },
    mark: function (n) {
      if (!bar) return;
      bar.querySelectorAll("button").forEach(function (b) {
        b.classList.toggle("whosbluffing-on", b.getAttribute("data-jol") === String(n));
      });
    },
    hide: function () {
      if (bar) bar.hidden = true;
    }
  };
})();
