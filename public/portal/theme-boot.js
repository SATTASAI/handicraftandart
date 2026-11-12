// Runs before the page paints so night mode never flashes white between pages.
try {
  if (localStorage.getItem("arts-network-portal-dark") === "true") document.body.classList.add("dark-mode");
} catch {
  /* Saved settings may be blocked; the page then opens in day mode. */
}
