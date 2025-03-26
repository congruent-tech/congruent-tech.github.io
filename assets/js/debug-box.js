function updateSizes() {
  const boxes = document.getElementsByClassName("debug-box");

  for (let box of boxes) {
    // Remove any existing size label to prevent duplicates
    box.querySelectorAll(".size-label").forEach((label) => label.remove());

    // Get current width and height
    let width = box.offsetWidth;
    let height = box.offsetHeight;

    // Create an overlay label for size
    let label = document.createElement("div");
    label.className = "size-label";
    label.textContent = `${width}px × ${height}px`;
    label.style.position = "absolute";
    label.style.bottom = "4px";
    label.style.right = "8px";
    label.style.background = "rgba(0, 0, 0, 0.7)";
    label.style.color = "white";
    label.style.fontSize = "12px";
    label.style.padding = "2px 6px";
    label.style.borderRadius = "4px";
    label.style.pointerEvents = "none"; // Prevent interaction issues

    // Add outline for visual debugging
    box.style.outline = "2px dashed red";

    // Append the label to the box
    box.appendChild(label);
  }
}

window.addEventListener("resize", updateSizes);
updateSizes();
