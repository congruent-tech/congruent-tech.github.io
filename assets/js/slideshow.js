let currentIndex = 0;
const slides = document.getElementById("slides");
const totalSlides = slides.children.length;
const dotsContainer = document.getElementById("navigation-dots");

// Generate dots dynamically
function createDots() {
    for (let i = 0; i < totalSlides; i++) {
        const dot = document.createElement("button");
        dot.classList.add("dot", "w-3", "h-3", "rounded-full", "bg-gray-400", "focus:outline-none");
        dot.addEventListener("click", () => goToSlide(i));
        dotsContainer.appendChild(dot);
    }
}

// Function to update active dot
function updateDots() {
    const dots = document.querySelectorAll(".dot");
    dots.forEach((dot, index) => {
        dot.classList.toggle("bg-gray-800", index === currentIndex);
        dot.classList.toggle("bg-gray-400", index !== currentIndex);
    });
}

// Function to go to a specific slide
function goToSlide(index) {
    if (index < 0) index = totalSlides - 1;
    if (index >= totalSlides) index = 0;
    currentIndex = index;
    slides.style.transform = `translateX(-${currentIndex * 100}%)`;
    updateDots();
}

// Function to go to the previous slide
function prevSlide() {
    goToSlide(currentIndex - 1);
}

// Function to go to the next slide
function nextSlide() {
    goToSlide(currentIndex + 1);
}

// Auto-slide every 5 seconds
setInterval(() => {
    nextSlide();
}, 5000);

// Initialize the dots and update them
createDots();
updateDots();