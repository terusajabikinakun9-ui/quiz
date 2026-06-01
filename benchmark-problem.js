/**
 * ==========================================================================
 * OptiWatch - Benchmark Functions & Landscape Classifier (Rastrigin)
 * ==========================================================================
 */

class BenchmarkProblem {
    constructor() {
        this.width = 600;
        this.height = 400;
        
        // Match 600x400 aspect ratio (1.5)
        // X goes from -5.12 to 5.12
        this.xMin = -5.12;
        this.xMax = 5.12;
        
        // Y is scaled proportionally to maintain shape of circular peaks
        const yHalfRange = 5.12 * (this.height / this.width); // approx 3.4133
        this.yMin = -yHalfRange;
        this.yMax = yHalfRange;
        
        this.offscreenCanvas = null;
        this.preRenderContour();
    }

    /**
     * Mathematical Rastrigin Function
     * Global minimum at (0,0) with value 0.
     * We work in MAXIMIZATION, so we return negative Rastrigin values.
     * Higher is better (Max = 0).
     */
    evaluate(x, y) {
        const A = 10;
        const termX = x * x - A * Math.cos(2 * Math.PI * x);
        const termY = y * y - A * Math.cos(2 * Math.PI * y);
        const rastriginValue = 20 + termX + termY;
        
        // We negate the value for maximization: fitness = -f(x, y)
        return -rastriginValue;
    }

    /**
     * Map pixel coordinates to mathematical domain
     */
    pxToMath(px, py) {
        const x = this.xMin + (px / this.width) * (this.xMax - this.xMin);
        // Canvas Y is top-to-bottom, we invert it so positive mathematical Y is upwards
        const y = this.yMax - (py / this.height) * (this.yMax - this.yMin);
        return { x, y };
    }

    /**
     * Map mathematical coordinates to pixel coordinates
     */
    mathToPx(x, y) {
        const px = ((x - this.xMin) / (this.xMax - this.xMin)) * this.width;
        const py = ((this.yMax - y) / (this.yMax - this.yMin)) * this.height;
        return { x: px, y: py };
    }

    /**
     * Pre-renders the contour map on an offscreen canvas to optimize performance.
     * This avoids costly math operations on 240,000 pixels every frame.
     */
    preRenderContour() {
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCanvas.width = this.width;
        this.offscreenCanvas.height = this.height;
        const ctx = this.offscreenCanvas.getContext('2d');
        
        // We draw in 3x3 blocks for a smooth watercolor appearance at higher FPS
        const blockSize = 3;
        
        for (let py = 0; py < this.height; py += blockSize) {
            for (let px = 0; px < this.width; px += blockSize) {
                const { x, y } = this.pxToMath(px + blockSize/2, py + blockSize/2);
                const fitness = this.evaluate(x, y); // range is approx [-80, 0]
                
                // Map fitness to colors:
                // Global optimum (0) -> High brightness, Warm colors (orange/gold/white)
                // Local peaks (-10 to -30) -> Cyan / Green
                // Deep valleys (-40 to -80) -> Deep purple / blue / dark slate
                
                let hue;
                let saturation = 75;
                let lightness;

                if (fitness > -4) {
                    // Global optimum zone
                    hue = 45; // Golden yellow
                    lightness = 45 + (fitness + 4) * 10; // brighter towards center
                    saturation = 95;
                } else if (fitness > -15) {
                    // Elevated ridge/peaks
                    hue = 160; // Turquoise
                    lightness = 35 + (fitness + 15) * 1.5;
                } else if (fitness > -35) {
                    // Medium elevation
                    hue = 260; // Purple
                    lightness = 20 + (fitness + 35) * 0.5;
                } else {
                    // Valleys
                    hue = 230; // Deep Ocean Blue
                    lightness = Math.max(8, 20 + (fitness + 50) * 0.2);
                    saturation = 50;
                }

                ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
                ctx.fillRect(px, py, blockSize, blockSize);
            }
        }
        
        // Add subtle grid overlay lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
        ctx.lineWidth = 0.5;
        for (let i = 50; i < this.width; i += 50) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, this.height); ctx.stroke();
        }
        for (let j = 50; j < this.height; j += 50) {
            ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(this.width, j); ctx.stroke();
        }
    }

    /**
     * Draws pre-rendered offscreen canvas onto the target context.
     */
    drawContour(ctx) {
        if (this.offscreenCanvas) {
            ctx.drawImage(this.offscreenCanvas, 0, 0);
        }
    }

    /**
     * Classifies a point (px, py) on the landscape based on neighborhood analysis.
     * Evaluates 8 directions in a small radius epsilon.
     * Returns: "Global Optima" | "Local Optima" | "Plateau" | "Ridge" | "Descending" | "Ascending"
     */
    classifyLandscape(px, py) {
        const { x, y } = this.pxToMath(px, py);
        const f0 = this.evaluate(x, y);
        
        // If extremely close to global minimum, it is the Global Optima
        if (f0 >= -0.05) {
            return {
                type: "Global Optima",
                desc: "Selamat! Solusi berada di puncak tertinggi global (Global Optimum). Nilai = " + f0.toFixed(4)
            };
        }

        // Neighborhood test at distance epsilon (in mathematical coordinate space)
        const epsilon = 0.08;
        const numNeighbors = 8;
        const neighbors = [];
        
        for (let i = 0; i < numNeighbors; i++) {
            const angle = (i * Math.PI * 2) / numNeighbors;
            const nx = x + Math.cos(angle) * epsilon;
            const ny = y + Math.sin(angle) * epsilon;
            neighbors.push(this.evaluate(nx, ny));
        }

        // Calculate statistics of the neighborhood
        let betterCount = 0;
        let worseCount = 0;
        let equalCount = 0;
        
        const deltaLocal = 0.005; // threshold for flat / plateau
        const deltaOptimum = 0.001; // tight threshold for peaks

        for (const fn of neighbors) {
            const diff = fn - f0;
            if (diff > deltaLocal) {
                betterCount++;
            } else if (diff < -deltaLocal) {
                worseCount++;
            } else {
                equalCount++;
            }
        }

        // 1. Check Local Optima (all neighbors are worse or equal)
        if (betterCount === 0) {
            return {
                type: "Local Optima",
                desc: "Terjebak! Semua tetangga di sekeliling bernilai lebih buruk. Ini adalah jebakan Puncak Lokal (Local Optimum)."
            };
        }

        // 2. Check Plateau (all neighbors have very close fitness)
        if (equalCount === numNeighbors || (betterCount === 0 && worseCount === 0)) {
            return {
                type: "Plateau",
                desc: "Mengalami Disorientasi! Lanskap sangat datar (Plateau). Algoritma tidak menemukan gradien kemiringan untuk mendaki."
            };
        }

        // 3. Check Ridge (Punggungan)
        // A ridge has sharp drops in some directions (left/right of ridge) but a slight rise in a narrow path
        // In our 8-neighbor test, if we see e.g. 2 better/equal neighbors in opposite directions
        // and 6 significantly worse neighbors in other directions, we are on a Ridge.
        const isRidge = (betterCount >= 1 && betterCount <= 3 && worseCount >= 4);
        if (isRidge) {
            return {
                type: "Ridge",
                desc: "Berjalan di Punggungan! Kanan-kiri merupakan tebing curam (worse), namun ada satu celah sempit naik (Ridge)."
            };
        }

        // 4. Standard ascending or descending
        if (betterCount > worseCount) {
            return {
                type: "Ascending",
                desc: "Sedang mendaki lereng bukit menuju solusi yang lebih baik."
            };
        } else {
            return {
                type: "Descending",
                desc: "Bergerak turun menuju lembah (solusi yang lebih buruk)."
            };
        }
    }

    /**
     * Generates a random solution inside the mathematical domain
     * scaled to [0, 1] for x, y
     */
    generateRandomSolution() {
        return [
            Math.random(), // x [0,1]
            Math.random()  // y [0,1]
        ];
    }

    /**
     * Generates a neighbor for Rastrigin search
     */
    generateNeighbor(solution, stepSizeFraction) {
        // stepSizeFraction is [0,1]. We scale it to mathematical domain
        const dxRange = (this.xMax - this.xMin) * (stepSizeFraction * 0.1);
        const dyRange = (this.yMax - this.yMin) * (stepSizeFraction * 0.1);

        const nx = solution[0] + (Math.random() * 2 - 1) * dxRange;
        const ny = solution[1] + (Math.random() * 2 - 1) * dyRange;

        return [
            Math.max(0, Math.min(1, nx)),
            Math.max(0, Math.min(1, ny))
        ];
    }
}
