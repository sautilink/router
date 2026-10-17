(() => {
  let theme = "light";
  try {
    if (localStorage.getItem("sautilink-router-theme") === "dark") theme = "dark";
  } catch (_) { /* The page remains usable when storage is unavailable. */ }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0b0b0e" : "#ffffff");
})();
