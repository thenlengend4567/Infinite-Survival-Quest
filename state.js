// Singleton game state to prevent global variables
export const gameState = {
    camera: {
        x: 0,
        y: 0
    },
    canvas: {
        width: 0,
        height: 0
    },
    settings: {
        tileSize: 32,
        chunkSize: 16 // 16x16 tiles per chunk
    },
    world: {
        chunks: new Map(), // Caches generated chunk data
        destroyedEntities: new Set() // Set of string IDs (chunkX_chunkY_localX_localY)
    },
    player: {
        x: 0,
        y: 0,
        size: 24, // Slightly smaller than a 32x32 tile
        speed: 200, // Max pixels per second
        inventory: {
            wood: 0,
            stone: 0
        },
        tools: {
            axe: false,
            pickaxe: false
        },
        gathering: {
            targetId: null,
            timer: 0,
            requiredTime: 1000, // ms
            currentRequiredTime: 1000 // Dynamic based on tools
        }
    },
    ui: {
        craftMenu: {
            open: false,
            buttons: [] // Dynamically calculated bounding boxes for clicks
        },
        joystick: {
            active: false,
            originX: 0,
            originY: 0,
            currentX: 0,
            currentY: 0,
            distance: 0, // Current analog distance from origin
            maxDistance: 50, // Max distance for full speed
            angle: 0
        }
    },
    keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        c: false,
        ArrowUp: false,
        ArrowLeft: false,
        ArrowDown: false,
        ArrowRight: false
    }
};
