const canvas = document.getElementById("canvas");
const colorPicker = document.getElementById("colorPicker");
const ctx = canvas.getContext("2d");

let mouseX = 0;
let mouseY = 0;

// ============================================================
// CANVAS SETTINGS
// ============================================================

canvas.width = 500;
canvas.height = 500;

let pixelSize = 10;

const gridWidth = 1000;
const gridHeight = 1000;

const zoomOutButton = document.getElementById("ZoomOut");
const zoomInButton = document.getElementById("ZoomIn");

// ============================================================
// CAMERA
// ============================================================

let cameraX = 0;
let cameraY = 0;

const panSpeed = 8;

const keys = {};

let isPanning = false;

let lastMouseX = 0;
let lastMouseY = 0;

// ============================================================
// TOUCH
// ============================================================

let lastTouchX = 0;
let lastTouchY = 0;

// ============================================================
// PAINTING
// ============================================================

let isPainting = false;
let lastPainted = "";

// ============================================================
// PIXEL DATA
// ============================================================

let pixels = {};

// ============================================================
// COLORS
// ============================================================

const colors = [
    "rgb(0, 0, 0)",
    "rgb(85, 85, 85)",
    "rgb(170, 170, 170)",
    "rgb(255, 255, 255)",

    "rgb(128, 0, 0)",
    "rgb(255, 0, 0)",
    "rgb(255, 128, 0)",
    "rgb(255, 192, 0)",

    "rgb(255, 255, 0)",
    "rgb(192, 255, 0)",
    "rgb(128, 255, 0)",
    "rgb(64, 255, 0)",

    "rgb(0, 255, 0)",
    "rgb(0, 192, 64)",
    "rgb(0, 255, 128)",
    "rgb(0, 255, 192)",

    "rgb(0, 255, 255)",
    "rgb(0, 192, 255)",
    "rgb(0, 128, 255)",
    "rgb(0, 64, 255)",

    "rgb(0, 0, 255)",
    "rgb(64, 0, 255)",
    "rgb(128, 0, 255)",
    "rgb(192, 0, 255)",

    "rgb(255, 0, 255)",
    "rgb(255, 0, 192)",
    "rgb(255, 64, 128)",
    "rgb(255, 128, 192)",

    "rgb(128, 64, 0)",
    "rgb(160, 96, 32)",
    "rgb(224, 192, 160)",
    "rgb(255, 224, 192)"
];

let currentColor = "rgb(0, 0, 0)";

// ============================================================
// GRID
// ============================================================

function drawGrid() {
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;

    const startX = Math.floor(-cameraX / pixelSize);
    const startY = Math.floor(-cameraY / pixelSize);

    const endX =
        startX +
        Math.ceil(canvas.width / pixelSize) +
        1;

    const endY =
        startY +
        Math.ceil(canvas.height / pixelSize) +
        1;

    for (let x = startX; x <= endX; x++) {
        const screenX = x * pixelSize + cameraX;

        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, canvas.height);
        ctx.stroke();
    }

    for (let y = startY; y <= endY; y++) {
        const screenY = y * pixelSize + cameraY;

        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(canvas.width, screenY);
        ctx.stroke();
    }
}

// ============================================================
// DRAW ONE PIXEL
// ============================================================

function drawPixel(x, y, color) {
    ctx.fillStyle = color;

    ctx.fillRect(
        x * pixelSize + cameraX,
        y * pixelSize + cameraY,
        pixelSize,
        pixelSize
    );
}

// ============================================================
// DRAW ALL PIXELS
// ============================================================

function drawPixels() {
    for (const pixel in pixels) {
        const coords = pixel.split(",");

        const x = Number(coords[0]);
        const y = Number(coords[1]);

        drawPixel(x, y, pixels[pixel]);
    }

    drawGrid();
}

// ============================================================
// REDRAW
// ============================================================

function redrawCanvas() {
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawPixels();
}

// ============================================================
// LOAD PIXELS FROM SERVER
// ============================================================

fetch("/pixels")
    .then(response => {
        if (!response.ok) {
            throw new Error("Failed to load pixels.");
        }

        return response.json();
    })
    .then(data => {
        pixels = data;
        redrawCanvas();
    })
    .catch(error => {
        console.error("Failed to load pixels:", error);
    });

// ============================================================
// SET PIXEL
// ============================================================

function setPixel(gridX, gridY, color) {
    const key = `${gridX},${gridY}`;

    pixels[key] = color;

    drawPixel(
        gridX,
        gridY,
        color
    );

    fetch("/pixel", {
        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            x: gridX,
            y: gridY,
            color: color
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Server rejected pixel.");
        }
    })
    .catch(error => {
        console.error("Failed to save pixel:", error);
    });
}

// ============================================================
// BRESENHAM LINE
// ============================================================

function drawLine(x0, y0, x1, y1, color) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);

    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;

    let err = dx - dy;

    while (true) {
        setPixel(x0, y0, color);

        if (x0 === x1 && y0 === y1) {
            break;
        }

        const e2 = 2 * err;

        if (e2 > -dy) {
            err -= dy;
            x0 += sx;
        }

        if (e2 < dx) {
            err += dx;
            y0 += sy;
        }
    }
}

// ============================================================
// COLOR PICKER
// ============================================================

colorPicker.style.display = "grid";
colorPicker.style.gridTemplateColumns = "repeat(16, 30px)";
colorPicker.style.gap = "2px";

colors.forEach(function(color) {
    const button = document.createElement("button");

    button.style.backgroundColor = color;
    button.style.width = "30px";
    button.style.height = "30px";

    button.title = color;

    button.addEventListener("click", function() {
        currentColor = color;

        console.log("Selected:", currentColor);
    });

    colorPicker.appendChild(button);
});

// ============================================================
// GET GRID POSITION
// ============================================================

function getGridPosition(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();

    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    return {
        x: Math.floor(
            (canvasX - cameraX) / pixelSize
        ),

        y: Math.floor(
            (canvasY - cameraY) / pixelSize
        )
    };
}

// ============================================================
// PAINT PIXEL
// ============================================================

function paintPixel(event) {
    const position = getGridPosition(
        event.clientX,
        event.clientY
    );

    const gridX = position.x;
    const gridY = position.y;

    const key = `${gridX},${gridY}`;

    if (key === lastPainted) {
        return;
    }

    lastPainted = key;

    setPixel(
        gridX,
        gridY,
        currentColor
    );
}

// ============================================================
// MOUSE DOWN
// ============================================================

canvas.addEventListener("mousedown", function(event) {
    // Middle mouse = pan
    if (event.button === 1) {
        isPanning = true;

        lastMouseX = event.clientX;
        lastMouseY = event.clientY;

        event.preventDefault();
        return;
    }

    // Left mouse = paint
    if (event.button === 0) {
        isPainting = true;
        lastPainted = "";

        paintPixel(event);
    }
});

// ============================================================
// MOUSE MOVE
// ============================================================

canvas.addEventListener("mousemove", function(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;

    // Panning
    if (isPanning) {
        const deltaX =
            event.clientX - lastMouseX;

        const deltaY =
            event.clientY - lastMouseY;

        cameraX += deltaX;
        cameraY += deltaY;

        lastMouseX = event.clientX;
        lastMouseY = event.clientY;

        redrawCanvas();

        return;
    }

    // Painting
    if (isPainting) {
        paintPixel(event);
    }
});

// ============================================================
// MOUSE UP
// ============================================================

document.addEventListener("mouseup", function(event) {
    if (event.button === 0) {
        isPainting = false;
        lastPainted = "";
    }

    if (event.button === 1) {
        isPanning = false;
    }
});

// ============================================================
// DISABLE MIDDLE CLICK MENU
// ============================================================

canvas.addEventListener("auxclick", function(event) {
    if (event.button === 1) {
        event.preventDefault();
    }
});

// ============================================================
// KEYBOARD CONTROLS
// ============================================================

document.addEventListener("keydown", function(event) {
    if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
    ) {
        event.preventDefault();
        keys[event.key] = true;
    }

    // S = hold to pan
    if (event.key.toLowerCase() === "s") {
        event.preventDefault();

        if (!isPanning) {
            isPanning = true;

            lastMouseX = mouseX;
            lastMouseY = mouseY;
        }
    }
});

document.addEventListener("keyup", function(event) {
    keys[event.key] = false;

    if (event.key.toLowerCase() === "s") {
        isPanning = false;
    }
});

// ============================================================
// MOBILE DETECTION
// ============================================================

const isMobileDevice =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    ("ontouchstart" in window);

// ============================================================
// MOBILE CONTROLS
// ============================================================

function showMobileControls() {
    const popup =
        document.getElementById("mobileControlsPopup");

    if (popup) {
        popup.style.display = "flex";
    }
}

function closeMobileControls() {
    const popup =
        document.getElementById("mobileControlsPopup");

    if (popup) {
        popup.style.display = "none";
    }
}

if (isMobileDevice) {
    window.addEventListener("load", function() {
        showMobileControls();
    });
}

// ============================================================
// MOBILE TOUCH START
// ============================================================

canvas.addEventListener(
    "touchstart",
    function(event) {
        // Two fingers = pan
        if (event.touches.length === 2) {
            isPanning = true;
            isPainting = false;

            lastTouchX =
                (
                    event.touches[0].clientX +
                    event.touches[1].clientX
                ) / 2;

            lastTouchY =
                (
                    event.touches[0].clientY +
                    event.touches[1].clientY
                ) / 2;

            event.preventDefault();
            return;
        }

        // One finger
        if (event.touches.length === 1) {
            isPanning = false;
            lastPainted = "";
        }
    },
    {
        passive: false
    }
);

// ============================================================
// MOBILE TOUCH MOVE
// ============================================================

canvas.addEventListener(
    "touchmove",
    function(event) {
        if (
            isPanning &&
            event.touches.length === 2
        ) {
            const centerX =
                (
                    event.touches[0].clientX +
                    event.touches[1].clientX
                ) / 2;

            const centerY =
                (
                    event.touches[0].clientY +
                    event.touches[1].clientY
                ) / 2;

            const deltaX =
                centerX - lastTouchX;

            const deltaY =
                centerY - lastTouchY;

            cameraX += deltaX;
            cameraY += deltaY;

            lastTouchX = centerX;
            lastTouchY = centerY;

            redrawCanvas();

            event.preventDefault();
        }
    },
    {
        passive: false
    }
);

// ============================================================
// MOBILE TOUCH END
// ============================================================

canvas.addEventListener(
    "touchend",
    function(event) {
        if (event.changedTouches.length !== 1) {
            if (event.touches.length < 2) {
                isPanning = false;
            }

            return;
        }

        if (isPanning) {
            isPanning = false;
            return;
        }

        const touch =
            event.changedTouches[0];

        const position =
            getGridPosition(
                touch.clientX,
                touch.clientY
            );

        const gridX = position.x;
        const gridY = position.y;

        setPixel(
            gridX,
            gridY,
            currentColor
        );

        lastPainted = "";
    },
    {
        passive: false
    }
);

// ============================================================
// SERVER UPDATE POLLING
// ============================================================

let serverVersion = -1;

setInterval(function() {
    fetch("/updates")
        .then(response => {
            if (!response.ok) {
                throw new Error(
                    "Server update request failed."
                );
            }

            return response.json();
        })
        .then(data => {
            if (data.version !== serverVersion) {
                serverVersion = data.version;

                pixels = data.pixels;

                redrawCanvas();
            }
        })
        .catch(error => {
            console.error(
                "Update check failed:",
                error
            );
        });
}, 1000);

// ============================================================
// ARROW KEY CAMERA MOVEMENT
// ============================================================

function update() {
    let moved = false;

    if (keys["ArrowLeft"]) {
        cameraX += panSpeed;
        moved = true;
    }

    if (keys["ArrowRight"]) {
        cameraX -= panSpeed;
        moved = true;
    }

    if (keys["ArrowUp"]) {
        cameraY += panSpeed;
        moved = true;
    }

    if (keys["ArrowDown"]) {
        cameraY -= panSpeed;
        moved = true;
    }

    if (moved) {
        redrawCanvas();
    }

    requestAnimationFrame(update);
}

// ============================================================
// BUTTON PRESSING :)
// ============================================================

zoomOutButton.addEventListener("click", function() {
    
    if (pixelSize != 5){
        pixelSize = pixelSize - 1;
        console.log(pixelSize);
        redrawCanvas();
    };
});

zoomInButton.addEventListener("click", function() {
    if (pixelSize != 50){
        pixelSize = pixelSize + 1;
        console.log(pixelSize);
        redrawCanvas();
    }
    
});

// ============================================================
// START
// ============================================================

redrawCanvas();
update();