export function createHUD() {
  const healthFill = document.querySelector('#health .fill');
  const houseFill = document.querySelector('#house .fill');
  const waveBanner = document.getElementById('waveBanner');

  function update(playerHealth, houseHealth, day, remaining) {
    healthFill.style.width = `${Math.max(0, Math.min(100, playerHealth))}%`;
    houseFill.style.width = `${Math.max(0, Math.min(100, houseHealth))}%`;
    waveBanner.textContent = `Day ${day}${remaining > 0 ? ` — Enemies left: ${remaining}` : ''}`;
  }

  return { update };
}


