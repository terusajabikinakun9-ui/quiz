/**
 * ==========================================================================
 * OptiWatch - CCTV Placement Problem Definition & Raycasting Engine
 * ==========================================================================
 */

class CCTVProblem {
    constructor() {
        this.width = 600;
        this.height = 400;
        this.gridSize = 12; // 12x12 px grid cells
        this.cols = Math.ceil(this.width / this.gridSize);
        this.rows = Math.ceil(this.height / this.gridSize);
        
        // Walls grid: 0 = empty space, 1 = wall/obstacle
        this.grid = new Uint8Array(this.cols * this.rows);
        
        // Predefined floor plans
        this.layouts = [
            {
                name: "Kantor Tersekat (Rooms)",
                desc: "Layout dengan sekat-sekat ruangan, pintu sempit, dan koridor panjang.",
                generate: () => this.generateOfficeLayout()
            },
            {
                name: "Museum & Galeri Seni (Open Gallery)",
                desc: "Lantai terbuka luas dengan pilar-pilar besar dan sekat tengah estetis.",
                generate: () => this.generateGalleryLayout()
            },
            {
                name: "Labirin Koridor (Maze Security)",
                desc: "Layout keamanan tinggi dengan persimpangan jalan berkelok.",
                generate: () => this.generateMazeLayout()
            }
        ];
        
        this.currentLayoutIndex = 0;
        this.initLayout(0);
    }

    initLayout(index) {
        this.currentLayoutIndex = index;
        this.grid.fill(0);
        this.layouts[index].generate();
    }

    setWallRect(x, y, w, h) {
        const colStart = Math.max(0, Math.floor(x / this.gridSize));
        const colEnd = Math.min(this.cols - 1, Math.floor((x + w) / this.gridSize));
        const rowStart = Math.max(0, Math.floor(y / this.gridSize));
        const rowEnd = Math.min(this.rows - 1, Math.floor((y + h) / this.gridSize));

        for (let r = rowStart; r <= rowEnd; r++) {
            for (let c = colStart; c <= colEnd; c++) {
                this.grid[r * this.cols + c] = 1;
            }
        }
    }

    isWall(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return true;
        return this.grid[row * this.cols + col] === 1;
    }

    isWallPx(x, y) {
        const c = Math.floor(x / this.gridSize);
        const r = Math.floor(y / this.gridSize);
        return this.isWall(c, r);
    }

    // Layout generators
    generateOfficeLayout() {
        // Border walls
        this.setWallRect(0, 0, this.width, 10);
        this.setWallRect(0, 0, 10, this.height);
        this.setWallRect(0, this.height - 10, this.width, 10);
        this.setWallRect(this.width - 10, 0, 10, this.height);

        // Horizontal dividers
        this.setWallRect(0, 130, 240, 10); // Room 1 bottom
        this.setWallRect(320, 130, 280, 10); // Room 2 bottom
        this.setWallRect(0, 260, 180, 10); // Room 3 top
        this.setWallRect(260, 260, 340, 10); // Room 4 top

        // Vertical dividers
        this.setWallRect(180, 10, 10, 120); // Divider left-top
        this.setWallRect(380, 10, 10, 120); // Divider right-top
        
        this.setWallRect(260, 260, 10, 140); // Divider right-bottom
        this.setWallRect(120, 260, 10, 140); // Divider left-bottom
        
        // Add some interior pillars / obstacles
        this.setWallRect(280, 180, 40, 40); // Center pillar
    }

    generateGalleryLayout() {
        // Border walls
        this.setWallRect(0, 0, this.width, 10);
        this.setWallRect(0, 0, 10, this.height);
        this.setWallRect(0, this.height - 10, this.width, 10);
        this.setWallRect(this.width - 10, 0, 10, this.height);

        // Open layout style with aesthetic barriers
        // Four large pillars
        this.setWallRect(140, 90, 30, 30);
        this.setWallRect(430, 90, 30, 30);
        this.setWallRect(140, 280, 30, 30);
        this.setWallRect(430, 280, 30, 30);

        // Center cross panels (Art display panels)
        this.setWallRect(220, 195, 160, 10); // Center horiz
        this.setWallRect(295, 120, 10, 160); // Center vert
    }

    generateMazeLayout() {
        // Border walls
        this.setWallRect(0, 0, this.width, 10);
        this.setWallRect(0, 0, 10, this.height);
        this.setWallRect(0, this.height - 10, this.width, 10);
        this.setWallRect(this.width - 10, 0, 10, this.height);

        // Grid-based maze blocks
        for (let i = 80; i < this.width - 80; i += 120) {
            this.setWallRect(i, 10, 15, 120);
            this.setWallRect(i + 60, 100, 15, 140);
            this.setWallRect(i, 270, 15, 120);
        }

        // Horizontal maze parts
        this.setWallRect(80, 180, 120, 15);
        this.setWallRect(320, 180, 180, 15);
        this.setWallRect(200, 290, 120, 15);
    }

    /**
     * Raycasting Engine for 2D Grid
     * Checks which grid cells are visible from a camera (cx, cy)
     * with rotation (angle in radians), field of view (fov in radians), and range.
     */
    computeVisibility(cx, cy, angle, fov, range) {
        // Initialize an array marking visible cells
        const visibleCells = new Uint8Array(this.cols * this.rows);
        
        // Quick bounds check
        if (cx < 0 || cx >= this.width || cy < 0 || cy >= this.height) {
            return visibleCells;
        }

        const halfFov = fov / 2;
        const rangeSq = range * range;
        
        // Scan each walkable cell in the map
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const index = r * this.cols + c;
                
                // Walls are not walkable/coverable
                if (this.grid[index] === 1) continue;

                // Center of cell
                const cellX = (c + 0.5) * this.gridSize;
                const cellY = (r + 0.5) * this.gridSize;

                // 1. Distance check
                const dx = cellX - cx;
                const dy = cellY - cy;
                const distSq = dx * dx + dy * dy;
                
                if (distSq > rangeSq) continue;
                if (distSq < 1) { // Very close is visible
                    visibleCells[index] = 1;
                    continue;
                }

                // 2. Angle/FOV check
                const dist = Math.sqrt(distSq);
                let cellAngle = Math.atan2(dy, dx);
                
                // Calculate angle difference normalized to [-PI, PI]
                let angleDiff = cellAngle - angle;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

                if (Math.abs(angleDiff) > halfFov) continue;

                // 3. Line of sight check (Raycasting block)
                // Step along the ray from camera to cell center
                const steps = Math.ceil(dist / (this.gridSize * 0.5));
                const stepX = dx / steps;
                const stepY = dy / steps;
                
                let isBlocked = false;
                // Start from step 1 to avoid checking camera's own grid cell (which could be border of a wall)
                for (let i = 1; i < steps; i++) {
                    const checkX = cx + stepX * i;
                    const checkY = cy + stepY * i;
                    
                    const gridC = Math.floor(checkX / this.gridSize);
                    const gridR = Math.floor(checkY / this.gridSize);
                    
                    if (this.isWall(gridC, gridR)) {
                        isBlocked = true;
                        break;
                    }
                }

                if (!isBlocked) {
                    visibleCells[index] = 1;
                }
            }
        }

        return visibleCells;
    }

    /**
     * Evaluates a solution: [x1, y1, theta1, x2, y2, theta2, ...]
     * Returns a detailed object with:
     * - fitness: overall score to MAXIMIZE
     * - coveragePct: unique floor cells covered / total empty cells
     * - overlapPct: percentage of total cells covered by >1 camera
     * - wallPenalty: penalty incurred for placing cameras inside walls
     * - uniqueCovered: Uint8Array of size cols * rows showing which cells are covered
     */
    evaluateSolution(solution, fovRad, rangePx) {
        const numCameras = solution.length / 3;
        
        // Multi-camera coverage matrix
        const coverageCount = new Uint8Array(this.cols * this.rows);
        let wallPenalty = 0;
        let wallCount = 0;
        let outOfBoundsPenalty = 0;

        for (let i = 0; i < numCameras; i++) {
            const x = solution[i * 3] * this.width;
            const y = solution[i * 3 + 1] * this.height;
            const angle = solution[i * 3 + 2] * Math.PI * 2; // scale [0,1] to [0, 2*PI]

            // 1. Penalty for placing cameras in walls or out of bounds
            if (x < 10 || x > this.width - 10 || y < 10 || y > this.height - 10) {
                outOfBoundsPenalty += 100;
                continue;
            }

            if (this.isWallPx(x, y)) {
                wallPenalty += 150; // Heavy penalty
                wallCount++;
                continue; // Camera inside wall has zero visibility
            }

            // 2. Compute visibility for this camera
            const cameraVisibility = this.computeVisibility(x, y, angle, fovRad, rangePx);
            
            // Accumulate coverage counts
            for (let j = 0; j < this.cols * this.rows; j++) {
                if (cameraVisibility[j] === 1) {
                    coverageCount[j]++;
                }
            }
        }

        // 3. Calculate statistics
        let totalEmptyCells = 0;
        let coveredCells = 0;
        let overlapCells = 0;

        for (let i = 0; i < this.cols * this.rows; i++) {
            if (this.grid[i] === 0) { // Walkable space
                totalEmptyCells++;
                if (coverageCount[i] > 0) {
                    coveredCells++;
                    if (coverageCount[i] > 1) {
                        overlapCells += (coverageCount[i] - 1); // add penalty for each extra camera viewing same spot
                    }
                }
            }
        }

        const coveragePct = (coveredCells / totalEmptyCells) * 100;
        const overlapPct = (overlapCells / totalEmptyCells) * 100;

        // Formulate Fitness Function
        // Goal: Maximize coverage, Minimize overlap, Minimize wall penalties
        // Max theoretical fitness: 100 (100% coverage, 0% overlap, 0% penalty)
        const coverageWeight = 100.0;
        const overlapWeight = 0.25; // mild penalty for overlaps
        
        let fitness = (coveragePct * coverageWeight) - (overlapPct * overlapWeight) - wallPenalty - outOfBoundsPenalty;
        
        // Ensure fitness is not extremely negative or NaN
        if (isNaN(fitness)) fitness = 0;
        
        // Create simple map of unique covered cells (1 = covered, 0 = empty)
        const uniqueCovered = new Uint8Array(this.cols * this.rows);
        for (let i = 0; i < this.cols * this.rows; i++) {
            if (coverageCount[i] > 0) {
                uniqueCovered[i] = 1;
            }
        }

        return {
            fitness: Math.max(-5000, fitness), // cap negative value for nice rendering
            coveragePct: coveragePct,
            overlapPct: overlapPct,
            wallPenalty: wallPenalty + outOfBoundsPenalty,
            wallCount: wallCount,
            uniqueCovered: uniqueCovered,
            coverageCount: coverageCount // for transparency rendering
        };
    }

    /**
     * Generates a random solution for N cameras.
     * Each camera has x [0,1], y [0,1], angle [0,1]
     */
    generateRandomSolution(numCameras) {
        const solution = [];
        for (let i = 0; i < numCameras; i++) {
            // Pick a non-wall starting position if possible, otherwise completely random
            let tries = 0;
            let px = Math.random();
            let py = Math.random();
            while (tries < 20 && this.isWallPx(px * this.width, py * this.height)) {
                px = 0.1 + Math.random() * 0.8;
                py = 0.1 + Math.random() * 0.8;
                tries++;
            }

            solution.push(
                px, // x
                py, // y
                Math.random() // theta
            );
        }
        return solution;
    }

    /**
     * Generates a neighbor of a solution by applying a small Gaussian-like step.
     * stepSize represents the max pixel change (normalized)
     */
    generateNeighbor(solution, stepSizePx) {
        const neighbor = [...solution];
        const numParams = solution.length;
        
        // Perturb camera parameters slightly
        // We can perturb either all cameras slightly, or just one camera (which helps local search converge)
        // Let's pick one camera randomly to mutate for local search (this is classic coordinate descent / single move)
        // as it is much more stable in high-dimensional non-linear spaces.
        const camIdx = Math.floor(Math.random() * (numParams / 3));
        
        const stepXNorm = stepSizePx / this.width;
        const stepYNorm = stepSizePx / this.height;
        const stepAngleNorm = 15 / 360; // 15 degrees in normalized scale

        // Mutate X
        neighbor[camIdx * 3] += (Math.random() * 2 - 1) * stepXNorm;
        neighbor[camIdx * 3] = Math.max(0.02, Math.min(0.98, neighbor[camIdx * 3]));
        
        // Mutate Y
        neighbor[camIdx * 3 + 1] += (Math.random() * 2 - 1) * stepYNorm;
        neighbor[camIdx * 3 + 1] = Math.max(0.02, Math.min(0.98, neighbor[camIdx * 3 + 1]));
        
        // Mutate Angle
        neighbor[camIdx * 3 + 2] += (Math.random() * 2 - 1) * stepAngleNorm;
        // Wrap angle around [0, 1]
        neighbor[camIdx * 3 + 2] = (neighbor[camIdx * 3 + 2] + 1) % 1;

        return neighbor;
    }
}
