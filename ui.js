import { gameState } from './state.js';

export function setupUI(canvas) {
    // We only care about touch events on the left half of the screen
    // for the virtual joystick for now.

    const handleTouchStart = (e) => {
        // Prevent default browser behaviors like scrolling/zooming
        e.preventDefault();

        // Loop through all new touches to find one on the left half
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            // Check if touch is on the left half of the screen
            if (touch.clientX < canvas.width / 2) {
                const joystick = gameState.ui.joystick;

                // Set the joystick origin where the user first touched
                joystick.active = true;
                joystick.originX = touch.clientX;
                joystick.originY = touch.clientY;
                joystick.currentX = touch.clientX;
                joystick.currentY = touch.clientY;
                joystick.distance = 0;
                joystick.angle = 0;

                // We assume only one joystick touch at a time, break after finding one
                break;
            }
        }
    };

    const handleTouchMove = (e) => {
        e.preventDefault();
        const joystick = gameState.ui.joystick;

        if (!joystick.active) return;

        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];

            // If the touch originated on the left side, we treat it as the joystick drag
            // A more robust approach would track the exact touch identifier (e.g. touch.identifier)
            // but for simplicity, we'll assume any touch moving on the left side is our stick.
            if (touch.clientX < canvas.width / 2) {
                joystick.currentX = touch.clientX;
                joystick.currentY = touch.clientY;

                // Calculate the distance and angle relative to the origin
                const dx = joystick.currentX - joystick.originX;
                const dy = joystick.currentY - joystick.originY;

                joystick.distance = Math.sqrt(dx * dx + dy * dy);
                joystick.angle = Math.atan2(dy, dx);
            }
        }
    };

    const handleTouchEnd = (e) => {
        e.preventDefault();
        const joystick = gameState.ui.joystick;

        // If all touches on the left half are gone, disable the joystick
        let stillTouchingLeft = false;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].clientX < canvas.width / 2) {
                stillTouchingLeft = true;
                break;
            }
        }

        if (!stillTouchingLeft) {
            joystick.active = false;
            joystick.distance = 0;
        }
    };

    // Attach event listeners to the canvas
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });
}

export function drawUI(ctx) {
    // 1. Draw HUD
    drawHUD(ctx);

    // 2. Draw Joystick (if active)
    const { joystick } = gameState.ui;
    if (!joystick.active) return;

    // Draw joystick base
    ctx.beginPath();
    ctx.arc(joystick.originX, joystick.originY, joystick.maxDistance, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw joystick knob (cap the visual distance to maxDistance)
    const drawDistance = Math.min(joystick.distance, joystick.maxDistance);
    const drawX = joystick.originX + Math.cos(joystick.angle) * drawDistance;
    const drawY = joystick.originY + Math.sin(joystick.angle) * drawDistance;

    ctx.beginPath();
    ctx.arc(drawX, drawY, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

}

function drawHUD(ctx) {
    const { inventory } = gameState.player;
    const { canvas } = gameState;

    const text = `Wood: ${inventory.wood} | Stone: ${inventory.stone}`;

    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';

    // Draw background for HUD
    const padding = 10;
    const textWidth = ctx.measureText(text).width;
    const bgWidth = textWidth + padding * 2;
    const bgHeight = 40;
    const startX = canvas.width - bgWidth - 20;
    const startY = 20;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(startX, startY, bgWidth, bgHeight);

    // Draw Text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, canvas.width - 20 - padding, startY + 28);

    ctx.textAlign = 'left'; // Reset for debug info
}
