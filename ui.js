import { gameState } from './state.js';

export function setupUI(canvas) {
    // Handle global click/touch events for UI buttons (like Crafting and internal Menu)
    const handleInputDown = (clientX, clientY) => {
        const { craftMenu } = gameState.ui;

        // 1. Check if clicking inside an OPEN Crafting Menu buttons
        if (craftMenu.open) {
            for (let btn of craftMenu.buttons) {
                if (clientX >= btn.x && clientX <= btn.x + btn.w &&
                    clientY >= btn.y && clientY <= btn.y + btn.h) {
                    if (btn.action) btn.action();
                    return true; // Input handled by menu
                }
            }
            // Optional: Close menu if clicking outside of it, but for now just ignore
        }

        // 2. Check the persistent Mobile "Craft" button (bottom right)
        let btnRadius = 30;
        let btnX = canvas.width - 50;
        let btnY = canvas.height - 50;

        // Simple circle collision
        let dx = clientX - btnX;
        let dy = clientY - btnY;
        if (dx * dx + dy * dy <= btnRadius * btnRadius) {
            craftMenu.open = !craftMenu.open;
            return true; // Input handled
        }

        // 3. Check "Eat" Button (bottom left)
        btnX = 50;
        btnY = canvas.height - 50;
        dx = clientX - btnX;
        dy = clientY - btnY;
        if (dx * dx + dy * dy <= btnRadius * btnRadius) {
            gameState.keys.f = true; // Simulate 'f' key press
            return true;
        }

        // 4. Check "Respawn" button if Game Over
        if (gameState.ui.gameOver) {
            // Rough bounding box for the Respawn button in center
            const rx = canvas.width / 2 - 75;
            const ry = canvas.height / 2 + 20;
            const rw = 150;
            const rh = 40;
            if (clientX >= rx && clientX <= rx + rw && clientY >= ry && clientY <= ry + rh) {
                // Perform Respawn
                gameState.player.x = 0;
                gameState.player.y = 0;
                gameState.player.stats.health = 100;
                gameState.player.stats.hunger = 100;
                gameState.player.inventory.wood = 0;
                gameState.player.inventory.stone = 0;
                gameState.player.inventory.berries = 0;
                gameState.player.tools.axe = false;
                gameState.player.tools.pickaxe = false;
                gameState.player.timers.hunger = 0;
                gameState.player.timers.starvation = 0;
                gameState.player.timers.water = 0;
                gameState.ui.gameOver = false;
                return true;
            }
        }

        return false;
    };

    // Desktop Click listener for UI buttons
    canvas.addEventListener('mousedown', (e) => {
        handleInputDown(e.clientX, e.clientY);
    });

    const handleTouchStart = (e) => {
        // Prevent default browser behaviors like scrolling/zooming
        e.preventDefault();

        // Loop through all new touches
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];

            // First, see if this touch hit a UI element
            if (handleInputDown(touch.clientX, touch.clientY)) {
                continue; // Skip joystick logic for this touch
            }

            // Otherwise, check if it's on the left half for the joystick
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

// Crafting Logic
export function craftItem(itemName) {
    const { inventory, tools } = gameState.player;

    if (itemName === 'axe') {
        if (!tools.axe && inventory.wood >= 5) {
            inventory.wood -= 5;
            tools.axe = true;
            console.log("Crafted Wooden Axe!");
        }
    } else if (itemName === 'pickaxe') {
        if (!tools.pickaxe && inventory.wood >= 3 && inventory.stone >= 2) {
            inventory.wood -= 3;
            inventory.stone -= 2;
            tools.pickaxe = true;
            console.log("Crafted Stone Pickaxe!");
        }
    }
}

export function drawUI(ctx) {
    // 1. Draw HUD
    drawHUD(ctx);

    // 2. Draw Stats
    drawStats(ctx);

    // 3. Draw Mobile Buttons
    drawCraftButton(ctx);
    drawEatButton(ctx);

    // 4. Draw Game Over or Crafting Menu
    if (gameState.ui.gameOver) {
        drawGameOver(ctx);
    } else {
        drawCraftMenu(ctx);
    }

    // 5. Draw Joystick (if active and game is playing)
    const { joystick } = gameState.ui;
    if (!joystick.active || gameState.ui.gameOver) return;

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
    const { inventory, tools } = gameState.player;
    const { canvas } = gameState;

    const resourceText = `Wood: ${inventory.wood} | Stone: ${inventory.stone}`;

    // Build Active Tools string
    let activeTools = [];
    if (tools.axe) activeTools.push('Wooden Axe');
    if (tools.pickaxe) activeTools.push('Stone Pickaxe');
    const toolText = activeTools.length > 0 ? `Active: ${activeTools.join(', ')}` : '';

    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';

    const padding = 10;
    const textWidth = Math.max(ctx.measureText(resourceText).width, toolText ? ctx.measureText(toolText).width : 0);
    const bgWidth = textWidth + padding * 2;
    const bgHeight = toolText ? 70 : 40;
    const startX = canvas.width - bgWidth - 20;
    const startY = 20;

    // Draw background for HUD
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(startX, startY, bgWidth, bgHeight);

    // Draw Text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(resourceText, canvas.width - 20 - padding, startY + 28);

    if (toolText) {
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#DDDDDD';
        ctx.fillText(toolText, canvas.width - 20 - padding, startY + 55);
    }

    ctx.textAlign = 'left'; // Reset for debug info
}

function drawStats(ctx) {
    const { stats } = gameState.player;
    const startX = 20;
    const startY = 20;
    const barWidth = 200;
    const barHeight = 20;

    // Health Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(startX, startY, barWidth, barHeight);
    ctx.fillStyle = '#FF0000'; // Red
    ctx.fillRect(startX, startY, barWidth * (stats.health / 100), barHeight);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY, barWidth, barHeight);

    // Hunger Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(startX, startY + 30, barWidth, barHeight);
    ctx.fillStyle = '#FFA500'; // Orange
    ctx.fillRect(startX, startY + 30, barWidth * (stats.hunger / 100), barHeight);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX, startY + 30, barWidth, barHeight);
}

function drawEatButton(ctx) {
    const { canvas } = gameState;
    const { inventory } = gameState.player;
    const btnRadius = 30;
    const btnX = 50;
    const btnY = canvas.height - 50;

    ctx.beginPath();
    ctx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
    ctx.fillStyle = inventory.berries > 0 ? 'rgba(50, 150, 50, 0.7)' : 'rgba(100, 100, 100, 0.5)';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EAT', btnX, btnY - 5);
    ctx.font = '12px sans-serif';
    ctx.fillText(`(${inventory.berries})`, btnX, btnY + 12);

    ctx.textBaseline = 'alphabetic'; // Reset
    ctx.textAlign = 'left';
}

function drawGameOver(ctx) {
    const { canvas } = gameState;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FF0000';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU DIED', canvas.width / 2, canvas.height / 2 - 40);

    // Respawn button
    const btnW = 150;
    const btnH = 40;
    const btnX = canvas.width / 2 - btnW / 2;
    const btnY = canvas.height / 2 + 20;

    ctx.fillStyle = '#4A4A4A';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(btnX, btnY, btnW, btnH);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '24px sans-serif';
    ctx.fillText('Respawn', canvas.width / 2, btnY + 28);

    ctx.textAlign = 'left';
}

function drawCraftButton(ctx) {
    const { canvas } = gameState;
    const btnRadius = 30;
    const btnX = canvas.width - 50;
    const btnY = canvas.height - 50;

    ctx.beginPath();
    ctx.arc(btnX, btnY, btnRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 100, 100, 0.7)';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CRAFT', btnX, btnY);

    ctx.textBaseline = 'alphabetic'; // Reset
}

function drawCraftMenu(ctx) {
    const { craftMenu } = gameState.ui;
    if (!craftMenu.open) return;

    const { canvas } = gameState;
    const { inventory, tools } = gameState.player;

    const width = canvas.width * 0.7;
    const height = 300;
    const startX = (canvas.width - width) / 2;
    const startY = (canvas.height - height) / 2;

    // Menu Background
    ctx.fillStyle = 'rgba(30, 30, 30, 0.9)';
    ctx.fillRect(startX, startY, width, height);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.strokeRect(startX, startY, width, height);

    // Title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Crafting Menu', canvas.width / 2, startY + 40);

    // Clear dynamic buttons for this frame
    craftMenu.buttons = [];

    // --- Recipe: Wooden Axe ---
    const axeY = startY + 100;
    const canCraftAxe = inventory.wood >= 5;

    ctx.textAlign = 'left';
    ctx.font = '20px sans-serif';

    if (tools.axe) {
        ctx.fillStyle = '#00FF00';
        ctx.fillText('Wooden Axe (Owned)', startX + 40, axeY);
    } else {
        ctx.fillStyle = canCraftAxe ? '#FFFFFF' : '#888888';
        ctx.fillText('Wooden Axe - Cost: 5 Wood', startX + 40, axeY);

        // Render Craft Button for Axe
        const btnW = 100;
        const btnH = 30;
        const btnX = startX + width - btnW - 40;
        const btnY = axeY - 20;

        ctx.fillStyle = canCraftAxe ? '#4CAF50' : '#555555';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.font = '16px sans-serif';
        ctx.fillText('Craft', btnX + btnW / 2, btnY + 20);

        if (canCraftAxe) {
            craftMenu.buttons.push({
                x: btnX, y: btnY, w: btnW, h: btnH,
                action: () => craftItem('axe')
            });
        }
    }

    // --- Recipe: Stone Pickaxe ---
    const pickaxeY = startY + 160;
    const canCraftPickaxe = inventory.wood >= 3 && inventory.stone >= 2;

    ctx.textAlign = 'left';
    ctx.font = '20px sans-serif';

    if (tools.pickaxe) {
        ctx.fillStyle = '#00FF00';
        ctx.fillText('Stone Pickaxe (Owned)', startX + 40, pickaxeY);
    } else {
        ctx.fillStyle = canCraftPickaxe ? '#FFFFFF' : '#888888';
        ctx.fillText('Stone Pickaxe - Cost: 3 Wood, 2 Stone', startX + 40, pickaxeY);

        // Render Craft Button for Pickaxe
        const btnW = 100;
        const btnH = 30;
        const btnX = startX + width - btnW - 40;
        const btnY = pickaxeY - 20;

        ctx.fillStyle = canCraftPickaxe ? '#4CAF50' : '#555555';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.font = '16px sans-serif';
        ctx.fillText('Craft', btnX + btnW / 2, btnY + 20);

        if (canCraftPickaxe) {
            craftMenu.buttons.push({
                x: btnX, y: btnY, w: btnW, h: btnH,
                action: () => craftItem('pickaxe')
            });
        }
    }

    // Instructions
    ctx.textAlign = 'center';
    ctx.fillStyle = '#AAAAAA';
    ctx.font = '14px sans-serif';
    ctx.fillText('Press C or tap Craft to close', canvas.width / 2, startY + height - 20);

    ctx.textAlign = 'left'; // Reset globally
}
