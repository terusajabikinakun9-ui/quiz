/**
 * ==========================================================================
 * OptiWatch - Main Application Controller & Visual Renderer
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------------------------
    // 1. STATE VARIABLES & INSTANCES
    // ----------------------------------------------------------------------
    const cctvProblem = new CCTVProblem();
    const benchProblem = new BenchmarkProblem();
    
    let cctvHC = null;
    let cctvSA = null;
    let cctvGA = null;

    let benchHC = null;
    let benchSA = null;
    let benchGA = null;

    // Simulation states
    let activeTab = "tab-cctv"; // tab-cctv | tab-benchmark | tab-comparison
    let isRunning = false;
    let animFrameId = null;
    let lastStepTime = 0;
    
    // Manual CCTV placement mode
    let isManualPlaceMode = false;
    let selectedCameraIdx = 0;
    let manualSolution = null; // copy of active solution for manual tweaks

    // Active solvers
    let activeSolverName = "hc"; // hc | sa | ga
    let activeSolution = null; // CCTV: [x1, y1, theta1...], Bench: [x, y]
    let activeFitness = -Infinity;
    let activeEvalDetails = null; // for CCTV statistics
    let searchHistory = []; // Bench path history

    // Charts references
    let convergenceChart = null;
    let diagnosticChart = null;

    // Predefined colors for HSL
    const HSL_THEMES = {
        emerald: "150, 84%, 48%",
        rose: "343, 85%, 60%",
        amber: "38, 92%, 52%",
        cyan: "188, 90%, 50%",
        muted: "215, 15%, 52%"
    };

    // ----------------------------------------------------------------------
    // 2. DOM ELEMENT SELECTORS
    // ----------------------------------------------------------------------
    // Sidebar & Global Controls
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabPanes = document.querySelectorAll(".tab-pane");
    const speedRange = document.getElementById("speed-range");
    const speedValue = document.getElementById("speed-value");
    const cctvCountSlider = document.getElementById("cctv-count");
    const cctvCountVal = document.getElementById("cctv-count-value");
    const cctvFovSlider = document.getElementById("cctv-fov");
    const cctvFovVal = document.getElementById("cctv-fov-value");
    const cctvRangeSlider = document.getElementById("cctv-range");
    const cctvRangeVal = document.getElementById("cctv-range-value");
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");
    const tabTitle = document.getElementById("current-tab-title");
    const tabDesc = document.getElementById("current-tab-desc");

    // CCTV Elements
    const cctvCanvas = document.getElementById("cctv-canvas");
    const cctvCtx = cctvCanvas.getContext("2d");
    const canvasOverlayMsg = document.getElementById("canvas-overlay-msg");
    const btnChangeLayout = document.getElementById("btn-change-layout");
    const btnManualPlace = document.getElementById("btn-manual-place");
    const btnCctvPlay = document.getElementById("btn-cctv-play");
    const btnCctvStep = document.getElementById("btn-cctv-step");
    const btnCctvPause = document.getElementById("btn-cctv-pause");
    const btnCctvReset = document.getElementById("btn-cctv-reset");
    const cctvRestartToggle = document.getElementById("cctv-restart-toggle");

    // CCTV Stats Elements
    const statCctvCoverage = document.getElementById("stat-cctv-coverage");
    const statCctvBlind = document.getElementById("stat-cctv-blind");
    const statCctvOverlap = document.getElementById("stat-cctv-overlap");
    const statCctvIteration = document.getElementById("stat-cctv-iteration");
    const statCctvTime = document.getElementById("stat-cctv-time");

    // CCTV Sidebar Config Tab selectors
    const cfgTabBtns = document.querySelectorAll(".cfg-tab-btn");
    const cfgPanes = document.querySelectorAll(".cfg-pane");

    // CCTV Parameter Fields
    const hcVariantCctv = document.getElementById("hc-variant-cctv");
    const hcStepCctv = document.getElementById("hc-step-cctv");
    const hcStepCctvVal = document.getElementById("hc-step-cctv-val");
    const saT0Cctv = document.getElementById("sa-t0-cctv");
    const saAlphaCctv = document.getElementById("sa-alpha-cctv");
    const saTminCctv = document.getElementById("sa-tmin-cctv");
    const gaPopCctv = document.getElementById("ga-pop-cctv");
    const gaEliteCctv = document.getElementById("ga-elite-cctv");
    const gaPcCctv = document.getElementById("ga-pc-cctv");
    const gaPmCctv = document.getElementById("ga-pm-cctv");
    const gaSelectCctv = document.getElementById("ga-select-cctv");
    const gaCrossCctv = document.getElementById("ga-cross-cctv");

    // Benchmark Elements
    const benchCanvas = document.getElementById("benchmark-canvas");
    const benchCtx = benchCanvas.getContext("2d");
    const btnBenchPlay = document.getElementById("btn-bench-play");
    const btnBenchStep = document.getElementById("btn-bench-step");
    const btnBenchPause = document.getElementById("btn-bench-pause");
    const btnBenchReset = document.getElementById("btn-bench-reset");
    const benchRestartToggle = document.getElementById("bench-restart-toggle");

    // Benchmark Stats Elements
    const statBenchValue = document.getElementById("stat-bench-value");
    const statBenchCoords = document.getElementById("stat-bench-coords");
    const statBenchStatus = document.getElementById("stat-bench-status");
    const statBenchIteration = document.getElementById("stat-bench-iteration");
    const statBenchDesc = document.getElementById("stat-bench-desc");

    // Benchmark Parameter Fields
    const hcVariantBench = document.getElementById("hc-variant-bench");
    const hcStepBench = document.getElementById("hc-step-bench");
    const hcStepBenchVal = document.getElementById("hc-step-bench-val");
    const saT0Bench = document.getElementById("sa-t0-bench");
    const saAlphaBench = document.getElementById("sa-alpha-bench");
    const saTminBench = document.getElementById("sa-tmin-bench");
    const gaPopBench = document.getElementById("ga-pop-bench");
    const gaEliteBench = document.getElementById("ga-elite-bench");
    const gaPcBench = document.getElementById("ga-pc-bench");
    const gaPmBench = document.getElementById("ga-pm-bench");

    // Comparative Tab Elements
    const compCctvCount = document.getElementById("comp-cctv-count");
    const compMaxIterations = document.getElementById("comp-max-iterations");
    const btnRunComparison = document.getElementById("btn-run-comparison");
    const btnResetComparison = document.getElementById("btn-reset-comparison");
    const compProgressContainer = document.getElementById("comp-progress-container");
    const compProgressFill = document.getElementById("comp-progress-fill");
    const compProgressLabel = document.getElementById("comp-progress-label");
    const diagnosticChartSelect = document.getElementById("diagnostic-chart-select");

    // ----------------------------------------------------------------------
    // 3. INITIALIZATION & LAYOUT CONFIG
    // ----------------------------------------------------------------------
    function setSystemStatus(state, msg = "") {
        statusDot.className = "status-indicator " + state;
        statusText.innerText = "Status: " + msg;
    }

    // Toggle main navigation tabs
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => b.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));
            
            btn.classList.add("active");
            const targetPane = document.getElementById(btn.dataset.tab);
            targetPane.classList.add("active");
            
            activeTab = btn.dataset.tab;
            pauseSimulation();
            
            // Adjust header titles & sidebar visibility
            if (activeTab === "tab-cctv") {
                tabTitle.innerText = "Optimasi Penempatan CCTV dalam Gedung";
                tabDesc.innerText = "Mencari konfigurasi posisi dan sudut kamera untuk memaksimalkan cakupan visual gedung.";
                document.getElementById("cctv-count-group").style.display = "block";
                document.getElementById("cctv-fov-group").style.display = "block";
                document.getElementById("cctv-range-group").style.display = "block";
                resetCCTV();
            } else if (activeTab === "tab-benchmark") {
                tabTitle.innerText = "Demo Penelusuran Lanskap & Local Optima";
                tabDesc.innerText = "Visualisasi pencarian solusi optimal pada fungsi Rastrigin dengan hambatan puncak lokal.";
                document.getElementById("cctv-count-group").style.display = "none";
                document.getElementById("cctv-fov-group").style.display = "none";
                document.getElementById("cctv-range-group").style.display = "none";
                resetBench();
            } else if (activeTab === "tab-comparison") {
                tabTitle.innerText = "Analisis Kinerja Komparatif Algoritma";
                tabDesc.innerText = "Membandingkan tingkat konvergensi dan efisiensi Hill Climbing, Simulated Annealing, dan GA.";
                document.getElementById("cctv-count-group").style.display = "none";
                document.getElementById("cctv-fov-group").style.display = "none";
                document.getElementById("cctv-range-group").style.display = "none";
                initComparisonLayout();
            }
        });
    });

    // Toggle sub-tabs for algorithm configs in sidebar
    cfgTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const parentSection = btn.closest(".config-card");
            const siblings = parentSection.querySelectorAll(".cfg-tab-btn");
            const targetPaneId = "cfg-" + btn.dataset.alg;
            const tabPanes = parentSection.querySelectorAll(".cfg-pane");

            siblings.forEach(s => s.classList.remove("active"));
            tabPanes.forEach(p => p.classList.remove("active"));

            btn.classList.add("active");
            document.getElementById(targetPaneId).classList.add("active");

            // Change active solver based on selected config tab
            const algName = btn.dataset.alg.split("-")[1]; // e.g. "cctv-hc" -> "hc"
            activeSolverName = algName;
            
            if (activeTab === "tab-cctv") {
                resetCCTV();
            } else if (activeTab === "tab-benchmark") {
                resetBench();
            }
        });
    });

    // Global speed range handler
    speedRange.addEventListener("input", () => {
        const val = parseInt(speedRange.value);
        if (val === 100) speedValue.innerText = "Maks (Turbo)";
        else if (val > 70) speedValue.innerText = "Cepat";
        else if (val > 30) speedValue.innerText = "Normal";
        else speedValue.innerText = "Lambat";
    });

    // Sync HTML Labels for parameters
    cctvCountSlider.addEventListener("input", () => { cctvCountVal.innerText = cctvCountSlider.value; resetCCTV(); });
    cctvFovSlider.addEventListener("input", () => { cctvFovVal.innerText = cctvFovSlider.value + "°"; resetCCTV(); });
    cctvRangeSlider.addEventListener("input", () => { cctvRangeVal.innerText = cctvRangeSlider.value + "px"; resetCCTV(); });
    
    hcStepCctv.addEventListener("input", () => { hcStepCctvVal.innerText = hcStepCctv.value; });
    hcStepBench.addEventListener("input", () => { hcStepBenchVal.innerText = (parseFloat(hcStepBench.value) / 100).toFixed(2); });

    // CCTV Change layout button
    btnChangeLayout.addEventListener("click", () => {
        const nextIdx = (cctvProblem.currentLayoutIndex + 1) % cctvProblem.layouts.length;
        cctvProblem.initLayout(nextIdx);
        resetCCTV();
        
        // Show temporary status msg on Canvas overlay
        canvasOverlayMsg.innerText = `Mengubah Denah: ${cctvProblem.layouts[nextIdx].name}`;
        canvasOverlayMsg.classList.add("visible");
        setTimeout(() => canvasOverlayMsg.classList.remove("visible"), 2000);
    });

    // ----------------------------------------------------------------------
    // 4. CCTV CANVAS RENDERING
    // ----------------------------------------------------------------------
    function drawCCTVPlan() {
        cctvCtx.clearRect(0, 0, cctvCanvas.width, cctvCanvas.height);
        
        const cols = cctvProblem.cols;
        const rows = cctvProblem.rows;
        const gSize = cctvProblem.gridSize;

        // 1. Draw Grid Cells: walkable space / blind spots / coverage overlaps
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                const cellX = c * gSize;
                const cellY = r * gSize;

                if (cctvProblem.grid[idx] === 1) {
                    // Wall block: dark technical slate texture
                    cctvCtx.fillStyle = "#1e293b";
                    cctvCtx.fillRect(cellX, cellY, gSize, gSize);
                    
                    cctvCtx.strokeStyle = "#0f172a";
                    cctvCtx.lineWidth = 0.5;
                    cctvCtx.strokeRect(cellX, cellY, gSize, gSize);
                } else {
                    // Walkable area base
                    cctvCtx.fillStyle = "#090d16";
                    cctvCtx.fillRect(cellX, cellY, gSize, gSize);

                    // If evaluated, show heatmap
                    if (activeEvalDetails) {
                        const coverageCount = activeEvalDetails.coverageCount[idx];
                        if (coverageCount > 0) {
                            if (coverageCount === 1) {
                                // Unique coverage: soft emerald green
                                cctvCtx.fillStyle = "rgba(16, 185, 129, 0.25)";
                            } else {
                                // Overlapping coverage: warning amber orange
                                cctvCtx.fillStyle = "rgba(245, 158, 11, 0.22)";
                            }
                            cctvCtx.fillRect(cellX, cellY, gSize, gSize);
                        } else {
                            // Blind Spot: subtle shaded red pattern
                            cctvCtx.fillStyle = "rgba(244, 63, 94, 0.05)";
                            cctvCtx.fillRect(cellX, cellY, gSize, gSize);
                        }
                    }
                }
            }
        }

        // 2. Draw Camera structures (Position, field boundary, directional light)
        if (activeSolution) {
            const numCameras = activeSolution.length / 3;
            const fovRad = (parseInt(cctvFovSlider.value) * Math.PI) / 180;
            const rangePx = parseInt(cctvRangeSlider.value);

            for (let i = 0; i < numCameras; i++) {
                const cx = activeSolution[i * 3] * cctvCanvas.width;
                const cy = activeSolution[i * 3 + 1] * cctvCanvas.height;
                const angle = activeSolution[i * 3 + 2] * Math.PI * 2;

                const isWall = cctvProblem.isWallPx(cx, cy);

                // Draw dashed jangkauan FOV wedge representation
                cctvCtx.beginPath();
                cctvCtx.moveTo(cx, cy);
                cctvCtx.arc(cx, cy, rangePx, angle - fovRad / 2, angle + fovRad / 2);
                cctvCtx.closePath();
                cctvCtx.strokeStyle = isWall ? "rgba(244, 63, 94, 0.2)" : "rgba(6, 182, 212, 0.25)";
                cctvCtx.lineWidth = 1;
                cctvCtx.setLineDash([4, 4]);
                cctvCtx.stroke();
                cctvCtx.setLineDash([]);

                // Pulsing glowing camera core
                cctvCtx.beginPath();
                cctvCtx.arc(cx, cy, 7, 0, Math.PI * 2);
                cctvCtx.fillStyle = isWall ? "#f43f5e" : "#06b6d4";
                cctvCtx.shadowColor = isWall ? "#f43f5e" : "#06b6d4";
                cctvCtx.shadowBlur = 10;
                cctvCtx.fill();
                cctvCtx.shadowBlur = 0; // reset glow

                // Camera bezel border
                cctvCtx.strokeStyle = "#ffffff";
                cctvCtx.lineWidth = 1.5;
                cctvCtx.stroke();

                // Directional lens line
                cctvCtx.beginPath();
                cctvCtx.moveTo(cx, cy);
                cctvCtx.lineTo(cx + Math.cos(angle) * 12, cy + Math.sin(angle) * 12);
                cctvCtx.strokeStyle = "#ffffff";
                cctvCtx.lineWidth = 2;
                cctvCtx.stroke();

                // Draw camera labels (1, 2, 3...)
                cctvCtx.fillStyle = "#ffffff";
                cctvCtx.font = "8px 'JetBrains Mono', monospace";
                cctvCtx.textAlign = "center";
                cctvCtx.textBaseline = "middle";
                cctvCtx.fillText(i + 1, cx, cy - 14);
            }
        }
    }

    // ----------------------------------------------------------------------
    // 5. BENCHMARK CANVAS RENDERING
    // ----------------------------------------------------------------------
    function drawBenchPlan() {
        // 1. Draw Pre-rendered heat map contour
        benchProblem.drawContour(benchCtx);

        // 2. Draw Mathematical Landmarks (Educational markers)
        // a. Global Minima center (0,0) -> mapped to pixels
        const gCenter = benchProblem.mathToPx(0, 0);
        
        benchCtx.beginPath();
        benchCtx.arc(gCenter.x, gCenter.y, 10, 0, Math.PI * 2);
        benchCtx.strokeStyle = "#10b981";
        benchCtx.lineWidth = 2;
        benchCtx.stroke();
        
        benchCtx.beginPath();
        benchCtx.arc(gCenter.x, gCenter.y, 3, 0, Math.PI * 2);
        benchCtx.fillStyle = "#10b981";
        benchCtx.fill();

        // Label Global Optimum
        benchCtx.fillStyle = "#ffffff";
        benchCtx.font = "bold 9px 'Plus Jakarta Sans'";
        benchCtx.textAlign = "center";
        benchCtx.fillText("GLOBAL OPTIMUM", gCenter.x, gCenter.y - 14);

        // b. Draw a few notable local optimum traps
        const localOptCoords = [
            { x: -1.0, y: 1.0 }, { x: 1.0, y: -1.0 },
            { x: -2.0, y: -2.0 }, { x: 2.0, y: 2.0 }
        ];
        
        localOptCoords.forEach(pt => {
            const pxPt = benchProblem.mathToPx(pt.x, pt.y);
            benchCtx.beginPath();
            benchCtx.arc(pxPt.x, pxPt.y, 4, 0, Math.PI * 2);
            benchCtx.fillStyle = "rgba(244, 63, 94, 0.4)";
            benchCtx.fill();
            benchCtx.strokeStyle = "rgba(244, 63, 94, 0.8)";
            benchCtx.stroke();
        });

        // 3. Draw Search point / swarm population
        if (activeSolution) {
            if (activeSolverName === "ga" && benchGA && benchGA.population.length > 0) {
                // RENDER SWARM (GENETIC ALGORITHM): Draw whole population
                benchGA.population.forEach((ind, idx) => {
                    const mathX = ind.chromosome[0] * (benchProblem.xMax - benchProblem.xMin) + benchProblem.xMin;
                    const mathY = ind.chromosome[1] * (benchProblem.yMax - benchProblem.yMin) + benchProblem.yMin;
                    const pxPt = benchProblem.mathToPx(mathX, mathY);

                    const isBest = (idx === 0);

                    benchCtx.beginPath();
                    benchCtx.arc(pxPt.x, pxPt.y, isBest ? 6 : 3, 0, Math.PI * 2);
                    benchCtx.fillStyle = isBest ? "#10b981" : "#f59e0b";
                    
                    if (isBest) {
                        benchCtx.shadowColor = "#10b981";
                        benchCtx.shadowBlur = 8;
                        benchCtx.fill();
                        benchCtx.shadowBlur = 0;
                        benchCtx.strokeStyle = "#ffffff";
                        benchCtx.lineWidth = 1.5;
                        benchCtx.stroke();
                    } else {
                        benchCtx.fill();
                        benchCtx.strokeStyle = "rgba(0,0,0,0.4)";
                        benchCtx.lineWidth = 0.5;
                        benchCtx.stroke();
                    }
                });
            } else {
                // RENDER SEARCH PATH (HILL CLIMBING / SA): Draw historic trace line
                if (searchHistory.length > 1) {
                    benchCtx.beginPath();
                    const startPx = benchProblem.mathToPx(searchHistory[0].x, searchHistory[0].y);
                    benchCtx.moveTo(startPx.x, startPx.y);

                    for (let i = 1; i < searchHistory.length; i++) {
                        const pxPt = benchProblem.mathToPx(searchHistory[i].x, searchHistory[i].y);
                        benchCtx.lineTo(pxPt.x, pxPt.y);
                    }

                    benchCtx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                    benchCtx.lineWidth = 1.5;
                    benchCtx.stroke();
                }

                // Pulse current coordinate
                const mathX = activeSolution[0] * (benchProblem.xMax - benchProblem.xMin) + benchProblem.xMin;
                const mathY = activeSolution[1] * (benchProblem.yMax - benchProblem.yMin) + benchProblem.yMin;
                const activePx = benchProblem.mathToPx(mathX, mathY);

                benchCtx.beginPath();
                benchCtx.arc(activePx.x, activePx.y, 7, 0, Math.PI * 2);
                benchCtx.fillStyle = "#06b6d4";
                benchCtx.shadowColor = "#06b6d4";
                benchCtx.shadowBlur = 10;
                benchCtx.fill();
                benchCtx.shadowBlur = 0;

                benchCtx.strokeStyle = "#ffffff";
                benchCtx.lineWidth = 1.5;
                benchCtx.stroke();
            }
        }
    }

    // ----------------------------------------------------------------------
    // 6. SIMULATION CONTROL LOGIC
    // ----------------------------------------------------------------------
    function resetCCTV() {
        pauseSimulation();
        
        const numCameras = parseInt(cctvCountSlider.value);
        activeEvalDetails = null;

        if (activeSolverName === "hc") {
            cctvHC = new HillClimber(numCameras * 3, () => cctvProblem.generateRandomSolution(numCameras));
            cctvHC.init();
            activeSolution = cctvHC.currentSolution;
        } else if (activeSolverName === "sa") {
            cctvSA = new SimulatedAnnealing(numCameras * 3, () => cctvProblem.generateRandomSolution(numCameras));
            const t0 = parseFloat(saT0Cctv.value);
            cctvSA.init(t0);
            activeSolution = cctvSA.currentSolution;
        } else if (activeSolverName === "ga") {
            cctvGA = new GeneticAlgorithm(numCameras * 3, () => cctvProblem.generateRandomSolution(numCameras));
            const popSize = parseInt(gaPopCctv.value);
            cctvGA.init(popSize);
            activeSolution = cctvGA.population[0].chromosome;
        }

        // Force first evaluation and render
        const fovRad = (parseInt(cctvFovSlider.value) * Math.PI) / 180;
        const rangePx = parseInt(cctvRangeSlider.value);
        activeEvalDetails = cctvProblem.evaluateSolution(activeSolution, fovRad, rangePx);
        activeFitness = activeEvalDetails.fitness;

        updateCCTVStats(0, 0);
        drawCCTVPlan();
        setSystemStatus("idle", "Siap");
    }

    function resetBench() {
        pauseSimulation();
        searchHistory = [];

        if (activeSolverName === "hc") {
            benchHC = new HillClimber(2, () => benchProblem.generateRandomSolution());
            benchHC.init();
            activeSolution = benchHC.currentSolution;
        } else if (activeSolverName === "sa") {
            benchSA = new SimulatedAnnealing(2, () => benchProblem.generateRandomSolution());
            const t0 = parseFloat(saT0Bench.value);
            benchSA.init(t0);
            activeSolution = benchSA.currentSolution;
        } else if (activeSolverName === "ga") {
            benchGA = new GeneticAlgorithm(2, () => benchProblem.generateRandomSolution());
            const popSize = parseInt(gaPopBench.value);
            benchGA.init(popSize);
            activeSolution = benchGA.population[0].chromosome;
        }

        // Record initial position in history
        const mathX = activeSolution[0] * (benchProblem.xMax - benchProblem.xMin) + benchProblem.xMin;
        const mathY = activeSolution[1] * (benchProblem.yMax - benchProblem.yMin) + benchProblem.yMin;
        searchHistory.push({ x: mathX, y: mathY });

        activeFitness = benchProblem.evaluate(mathX, mathY);

        updateBenchStats(0);
        drawBenchPlan();
        setSystemStatus("idle", "Siap");
    }

    function updateCCTVStats(iteration, elapsedMs) {
        if (!activeEvalDetails) return;

        statCctvCoverage.innerText = activeEvalDetails.coveragePct.toFixed(1) + "%";
        statCctvBlind.innerText = (100 - activeEvalDetails.coveragePct).toFixed(1) + "%";
        statCctvOverlap.innerText = activeEvalDetails.overlapPct.toFixed(1) + "%";
        statCctvIteration.innerText = iteration;
        statCctvTime.innerText = elapsedMs + " ms";

        // Style the coverage rating for premium feel
        if (activeEvalDetails.coveragePct > 85) {
            statCctvCoverage.className = "stat-value text-emerald";
        } else if (activeEvalDetails.coveragePct > 60) {
            statCctvCoverage.className = "stat-value text-amber";
        } else {
            statCctvCoverage.className = "stat-value text-rose";
        }
    }

    function updateBenchStats(iteration) {
        const mathX = activeSolution[0] * (benchProblem.xMax - benchProblem.xMin) + benchProblem.xMin;
        const mathY = activeSolution[1] * (benchProblem.yMax - benchProblem.yMin) + benchProblem.yMin;

        // Display positive Rastrigin value for general readability (f(x,y) = -fitness)
        const funcVal = -activeFitness;

        statBenchValue.innerText = funcVal.toFixed(4);
        statBenchCoords.innerText = `(${mathX.toFixed(2)}, ${mathY.toFixed(2)})`;
        statBenchIteration.innerText = iteration;

        // Classify landscape
        const px = ((activeSolution[0]));
        const py = ((activeSolution[1]));
        const activePx = benchProblem.mathToPx(mathX, mathY);

        const landscape = benchProblem.classifyLandscape(activePx.x, activePx.y);
        statBenchStatus.innerText = landscape.type;
        statBenchDesc.innerText = landscape.desc;

        // Highlight landscape state colors
        if (landscape.type === "Global Optima") {
            statBenchStatus.className = "stat-value text-emerald";
            setSystemStatus("converged", "Global Optimum Tercapai!");
        } else if (landscape.type === "Local Optima") {
            statBenchStatus.className = "stat-value text-rose";
        } else if (landscape.type === "Plateau") {
            statBenchStatus.className = "stat-value text-amber";
        } else if (landscape.type === "Ridge") {
            statBenchStatus.className = "stat-value text-cyan";
        } else {
            statBenchStatus.className = "stat-value";
        }
    }

    // ----------------------------------------------------------------------
    // 7. SIMULATION LOOP (STEP ACTION)
    // ----------------------------------------------------------------------
    function stepCCTV() {
        const fovRad = (parseInt(cctvFovSlider.value) * Math.PI) / 180;
        const rangePx = parseInt(cctvRangeSlider.value);
        
        const startTime = performance.now();
        let iteration = 0;

        if (activeSolverName === "hc" && cctvHC) {
            const stepVal = parseInt(hcStepCctv.value);
            const enableRestart = cctvRestartToggle.checked;
            
            const res = cctvHC.step(cctvProblem, (sol) => cctvProblem.evaluateSolution(sol, fovRad, rangePx), stepVal, hcVariantCctv.value, enableRestart);
            
            activeSolution = res.bestSolution;
            activeFitness = res.bestFitness;
            iteration = cctvHC.iteration;

            if (res.restarted) {
                canvasOverlayMsg.innerText = `HC Terjebak! Restart Acak Ke-${res.restartsCount}`;
                canvasOverlayMsg.classList.add("visible");
                setTimeout(() => canvasOverlayMsg.classList.remove("visible"), 1500);
            }
        } 
        else if (activeSolverName === "sa" && cctvSA) {
            const stepVal = 10; // steady perturbation
            const alpha = parseFloat(saAlphaCctv.value);
            const tMin = parseFloat(saTminCctv.value);
            
            const res = cctvSA.step(cctvProblem, (sol) => cctvProblem.evaluateSolution(sol, fovRad, rangePx), stepVal, alpha, tMin);
            
            activeSolution = res.bestSolution;
            activeFitness = res.bestFitness;
            iteration = cctvSA.iteration;

            if (res.isCooled && isRunning) {
                pauseSimulation();
                setSystemStatus("converged", "SA Mendingin Semurna!");
            }
        } 
        else if (activeSolverName === "ga" && cctvGA) {
            const popSize = parseInt(gaPopCctv.value);
            const pc = parseFloat(gaPcCctv.value);
            const pm = parseFloat(gaPmCctv.value);
            const selectMethod = gaSelectCctv.value;
            const crossMethod = gaCrossCctv.value;
            const eliteCount = parseInt(gaEliteCctv.value);
            const stepVal = 10;
            
            const res = cctvGA.step((sol) => cctvProblem.evaluateSolution(sol, fovRad, rangePx), pc, pm, selectMethod, crossMethod, eliteCount, stepVal, cctvProblem);
            
            activeSolution = res.bestSolution;
            activeFitness = res.bestFitness;
            iteration = cctvGA.generation;
        }

        const endTime = performance.now();
        const elapsedMs = Math.round(endTime - startTime);

        // Update statistics grid
        activeEvalDetails = cctvProblem.evaluateSolution(activeSolution, fovRad, rangePx);
        updateCCTVStats(iteration, elapsedMs);
        drawCCTVPlan();
    }

    function stepBench() {
        if (activeSolverName === "hc" && benchHC) {
            const stepFraction = parseFloat(hcStepBench.value) / 100;
            const enableRestart = benchRestartToggle.checked;
            
            const res = benchHC.step(benchProblem, (sol) => {
                const mathX = sol[0] * (benchProblem.xMax - benchProblem.xMin) + benchProblem.xMin;
                const mathY = sol[1] * (benchProblem.yMax - benchProblem.yMin) + benchProblem.yMin;
                return benchProblem.evaluate(mathX, mathY);
            }, stepFraction, hcVariantBench.value, enableRestart);

            activeSolution = res.bestSolution;
            activeFitness = res.bestFitness;

            // Log path history
            const mathX = activeSolution[0] * (benchProblem.xMax - benchProblem.xMin) + benchProblem.xMin;
            const mathY = activeSolution[1] * (benchProblem.yMax - benchProblem.yMin) + benchProblem.yMin;
            searchHistory.push({ x: mathX, y: mathY });
            
            if (res.restarted) {
                searchHistory = [{ x: mathX, y: mathY }]; // reset path
                canvasOverlayMsg.innerText = `HC Terjebak! Restart Acak Ke-${res.restartsCount}`;
                canvasOverlayMsg.classList.add("visible");
                setTimeout(() => canvasOverlayMsg.classList.remove("visible"), 1500);
            }

            updateBenchStats(benchHC.iteration);
        } 
        else if (activeSolverName === "sa" && benchSA) {
            const stepFraction = 0.05; // 5% range step
            const alpha = parseFloat(saAlphaBench.value);
            const tMin = parseFloat(saTminBench.value);

            const res = benchSA.step(benchProblem, (sol) => {
                const mathX = sol[0] * (benchProblem.xMax - benchProblem.xMin) + benchProblem.xMin;
                const mathY = sol[1] * (benchProblem.yMax - benchProblem.yMin) + benchProblem.yMin;
                return benchProblem.evaluate(mathX, mathY);
            }, stepFraction, alpha, tMin);

            activeSolution = res.bestSolution;
            activeFitness = res.bestFitness;

            const mathX = activeSolution[0] * (benchProblem.xMax - benchProblem.xMin) + benchProblem.xMin;
            const mathY = activeSolution[1] * (benchProblem.yMax - benchProblem.yMin) + benchProblem.yMin;
            searchHistory.push({ x: mathX, y: mathY });

            updateBenchStats(benchSA.iteration);

            if (res.isCooled && isRunning) {
                pauseSimulation();
                setSystemStatus("converged", "SA Mendingin!");
            }
        } 
        else if (activeSolverName === "ga" && benchGA) {
            const popSize = parseInt(gaPopBench.value);
            const pc = parseFloat(gaPcBench.value);
            const pm = parseFloat(gaPmBench.value);
            const eliteCount = parseInt(gaEliteBench.value);
            const stepFraction = 0.05;

            const res = benchGA.step((sol) => {
                const mathX = sol[0] * (benchProblem.xMax - benchProblem.xMin) + benchProblem.xMin;
                const mathY = sol[1] * (benchProblem.yMax - benchProblem.yMin) + benchProblem.yMin;
                return benchProblem.evaluate(mathX, mathY);
            }, pc, pm, "tournament", "single", eliteCount, stepFraction, null);

            activeSolution = res.bestSolution;
            activeFitness = res.bestFitness;

            updateBenchStats(benchGA.generation);
        }

        drawBenchPlan();
    }

    // Animation Loop
    function animationLoop(timestamp) {
        if (!isRunning) return;

        // Calculate throttling based on speed range
        const speedVal = parseInt(speedRange.value);
        let throttleMs = 0;
        
        if (speedVal < 100) {
            // Speed 1 -> 1000ms delay
            // Speed 50 -> 100ms delay
            // Speed 90 -> 10ms delay
            throttleMs = (100 - speedVal) * (100 - speedVal) * 0.1;
        }

        if (timestamp - lastStepTime >= throttleMs) {
            if (activeTab === "tab-cctv") {
                stepCCTV();
            } else if (activeTab === "tab-benchmark") {
                stepBench();
            }
            lastStepTime = timestamp;
        }

        animFrameId = requestAnimationFrame(animationLoop);
    }

    function playSimulation() {
        if (isRunning) return;
        
        isRunning = true;
        setSystemStatus("running", "Sedang Mengoptimasi...");
        
        // Disable parameter sliders to avoid runtime mutations
        cctvCountSlider.disabled = true;
        btnManualPlace.disabled = true;
        
        if (activeTab === "tab-cctv") {
            btnCctvPlay.disabled = true;
            btnCctvPause.disabled = false;
            btnCctvStep.disabled = true;
        } else {
            btnBenchPlay.disabled = true;
            btnBenchPause.disabled = false;
            btnBenchStep.disabled = true;
        }

        lastStepTime = performance.now();
        animFrameId = requestAnimationFrame(animationLoop);
    }

    function pauseSimulation() {
        if (!isRunning) return;
        
        isRunning = false;
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }

        setSystemStatus("paused", "Dijeda");

        cctvCountSlider.disabled = false;
        btnManualPlace.disabled = false;

        if (activeTab === "tab-cctv") {
            btnCctvPlay.disabled = false;
            btnCctvPause.disabled = true;
            btnCctvStep.disabled = false;
        } else {
            btnBenchPlay.disabled = false;
            btnBenchPause.disabled = true;
            btnBenchStep.disabled = false;
        }
    }

    // Play/Pause buttons listeners
    btnCctvPlay.addEventListener("click", playSimulation);
    btnCctvPause.addEventListener("click", pauseSimulation);
    btnCctvStep.addEventListener("click", () => {
        setSystemStatus("paused", "Satu Langkah Selesai");
        stepCCTV();
    });
    btnCctvReset.addEventListener("click", resetCCTV);

    btnBenchPlay.addEventListener("click", playSimulation);
    btnBenchPause.addEventListener("click", pauseSimulation);
    btnBenchStep.addEventListener("click", () => {
        setSystemStatus("paused", "Satu Langkah Selesai");
        stepBench();
    });
    btnBenchReset.addEventListener("click", resetBench);

    // ----------------------------------------------------------------------
    // 8. INTERACTIVE MANUAL PLACEMENT MODE
    // ----------------------------------------------------------------------
    btnManualPlace.addEventListener("click", () => {
        isManualPlaceMode = !isManualPlaceMode;
        pauseSimulation();

        if (isManualPlaceMode) {
            btnManualPlace.classList.add("active");
            btnManualPlace.innerHTML = `<i class="fa-solid fa-check"></i> Selesai Edit`;
            
            // Disable other controls
            btnCctvPlay.disabled = true;
            btnCctvStep.disabled = true;
            btnCctvReset.disabled = true;
            btnChangeLayout.disabled = true;

            // Clone active solution to allow manual drags
            manualSolution = cloneSolution(activeSolution);
            canvasOverlayMsg.innerText = "Klik kamera untuk memilih, lalu klik pada lantai untuk memindahkannya";
            canvasOverlayMsg.classList.add("visible");
            
            selectedCameraIdx = 0; // default pick first camera
        } else {
            btnManualPlace.classList.remove("active");
            btnManualPlace.innerHTML = `<i class="fa-solid fa-hand-pointer"></i> Edit Manual`;
            
            btnCctvPlay.disabled = false;
            btnCctvStep.disabled = false;
            btnCctvReset.disabled = false;
            btnChangeLayout.disabled = false;

            canvasOverlayMsg.classList.remove("visible");
            
            // Save manual solution back to current solver
            activeSolution = cloneSolution(manualSolution);
            
            if (activeSolverName === "hc" && cctvHC) {
                cctvHC.currentSolution = activeSolution;
                cctvHC.currentFitness = activeFitness;
                cctvHC.stuckCounter = 0;
            } else if (activeSolverName === "sa" && cctvSA) {
                cctvSA.currentSolution = activeSolution;
                cctvSA.currentFitness = activeFitness;
            } else if (activeSolverName === "ga" && cctvGA) {
                cctvGA.population[0].chromosome = activeSolution;
                cctvGA.population[0].fitness = activeFitness;
            }
        }
    });

    cctvCanvas.addEventListener("mousedown", (e) => {
        if (!isManualPlaceMode) return;

        const rect = cctvCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const numCameras = manualSolution.length / 3;
        
        // 1. Check if user clicked close to an existing camera (selection)
        let clickedCameraIdx = -1;
        let minDist = 20; // 20px radius selection

        for (let i = 0; i < numCameras; i++) {
            const camX = manualSolution[i * 3] * cctvCanvas.width;
            const camY = manualSolution[i * 3 + 1] * cctvCanvas.height;
            const dist = Math.sqrt((clickX - camX) ** 2 + (clickY - camY) ** 2);

            if (dist < minDist) {
                minDist = dist;
                clickedCameraIdx = i;
            }
        }

        if (clickedCameraIdx !== -1) {
            selectedCameraIdx = clickedCameraIdx;
            canvasOverlayMsg.innerText = `Kamera ${selectedCameraIdx + 1} Terpilih. Klik di mana saja untuk memindahkannya. Seret mouse untuk mengatur sudut.`;
            drawCCTVPlan();
            highlightSelectedCamera();
        } else {
            // 2. Clicked away: move selected camera to this coordinate
            const nx = clickX / cctvCanvas.width;
            const ny = clickY / cctvCanvas.height;
            
            manualSolution[selectedCameraIdx * 3] = nx;
            manualSolution[selectedCameraIdx * 3 + 1] = ny;

            // Trigger live evaluation of this manual state
            const fovRad = (parseInt(cctvFovSlider.value) * Math.PI) / 180;
            const rangePx = parseInt(cctvRangeSlider.value);
            
            activeEvalDetails = cctvProblem.evaluateSolution(manualSolution, fovRad, rangePx);
            activeFitness = activeEvalDetails.fitness;
            
            updateCCTVStats(0, 0);

            // Re-render
            activeSolution = manualSolution;
            drawCCTVPlan();
            highlightSelectedCamera();
            
            // Allow dragging rotation angle on mousemove
            const onMouseMove = (moveEvent) => {
                const moveRect = cctvCanvas.getBoundingClientRect();
                const mx = moveEvent.clientX - moveRect.left;
                const my = moveEvent.clientY - moveRect.top;
                
                const curCamX = manualSolution[selectedCameraIdx * 3] * cctvCanvas.width;
                const curCamY = manualSolution[selectedCameraIdx * 3 + 1] * cctvCanvas.height;

                // Calculate angle from camera center to mouse cursor
                const angleRad = Math.atan2(my - curCamY, mx - curCamX);
                // Map [-PI, PI] to [0, 2*PI] then normalize to [0, 1]
                let angleNorm = angleRad / (Math.PI * 2);
                if (angleNorm < 0) angleNorm += 1;

                manualSolution[selectedCameraIdx * 3 + 2] = angleNorm;

                activeEvalDetails = cctvProblem.evaluateSolution(manualSolution, fovRad, rangePx);
                activeFitness = activeEvalDetails.fitness;
                
                updateCCTVStats(0, 0);
                drawCCTVPlan();
                highlightSelectedCamera();
            };

            const onMouseUp = () => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
            };

            window.addEventListener("mousemove", onMouseMove);
            window.addEventListener("mouseup", onMouseUp);
        }
    });

    function highlightSelectedCamera() {
        if (!isManualPlaceMode || !manualSolution) return;
        
        const cx = manualSolution[selectedCameraIdx * 3] * cctvCanvas.width;
        const cy = manualSolution[selectedCameraIdx * 3 + 1] * cctvCanvas.height;

        cctvCtx.beginPath();
        cctvCtx.arc(cx, cy, 14, 0, Math.PI * 2);
        cctvCtx.strokeStyle = "rgba(245, 158, 11, 0.8)";
        cctvCtx.lineWidth = 2.5;
        cctvCtx.setLineDash([2, 2]);
        cctvCtx.stroke();
        cctvCtx.setLineDash([]);
    }

    // ----------------------------------------------------------------------
    // 9. COMPARATIVE TAB (BATCH RUN & CHARTS)
    // ----------------------------------------------------------------------
    function initComparisonLayout() {
        btnRunComparison.disabled = false;
        btnResetComparison.disabled = true;
        compProgressContainer.style.display = "none";

        // Reset Table rows
        ["hc", "sa", "ga"].forEach(alg => {
            document.getElementById(`cell-${alg}-fit`).innerText = "-";
            document.getElementById(`cell-${alg}-overlap`).innerText = "-";
            document.getElementById(`cell-${alg}-iter`).innerText = "-";
            document.getElementById(`cell-${alg}-time`).innerText = "-";
            
            const cellStatus = document.getElementById(`cell-${alg}-status`);
            cellStatus.innerHTML = `<span class="badge badge-secondary">Belum Dijalankan</span>`;
        });

        // Initialize empty charts with dark aesthetics
        renderConvergenceChart([], [], []);
        renderDiagnosticChart("sa-cooling", [], []);
    }

    btnRunComparison.addEventListener("click", async () => {
        btnRunComparison.disabled = true;
        btnResetComparison.disabled = true;
        
        compProgressContainer.style.display = "block";
        compProgressFill.style.width = "0%";
        
        const numCameras = parseInt(compCctvCount.value);
        const maxIter = parseInt(compMaxIterations.value);

        // Fixed parameters for all algorithms in comparison
        const fovRad = Math.PI / 2; // 90 degrees
        const rangePx = 120; // 120px

        // Generate equivalent starting points
        const startSolution = cctvProblem.generateRandomSolution(numCameras);

        // Data containers for charts
        let hcHistory = [];
        let saHistory = [];
        let gaHistory = [];

        let saTempHistory = [];
        let saProbHistory = [];

        let gaBestHistory = [];
        let gaAvgHistory = [];

        // 1. RUN HILL CLIMBING BATCH
        compProgressLabel.innerText = "Memproses Komparasi: Hill Climbing...";
        compProgressFill.style.width = "10%";
        
        // Yield thread slightly to allow progress bar rendering in browser
        await new Promise(r => setTimeout(r, 100));

        const batchHC = new HillClimber(numCameras * 3, () => cloneSolution(startSolution));
        batchHC.init();
        
        const hcStartMs = performance.now();
        let hcIteration = 0;
        let hcStuck = false;

        for (let i = 0; i < maxIter; i++) {
            const res = batchHC.step(cctvProblem, (sol) => cctvProblem.evaluateSolution(sol, fovRad, rangePx), 10, "steepest", false);
            hcHistory.push(res.bestFitness);
            hcIteration = res.iteration;
            if (res.isStuck) {
                hcStuck = true;
                break;
            }
        }
        const hcEndMs = performance.now();
        const hcElapsed = Math.round(hcEndMs - hcStartMs);
        const hcEval = cctvProblem.evaluateSolution(batchHC.globalBestSolution, fovRad, rangePx);

        // Update HC Table Row
        document.getElementById("cell-hc-fit").innerText = hcEval.coveragePct.toFixed(1) + "%";
        document.getElementById("cell-hc-overlap").innerText = hcEval.overlapPct.toFixed(1) + "%";
        document.getElementById("cell-hc-iter").innerText = hcIteration;
        document.getElementById("cell-hc-time").innerText = hcElapsed + " ms";
        document.getElementById("cell-hc-status").innerHTML = hcStuck ? `<span class="badge badge-success">Terjebak (Opt. Lokal)</span>` : `<span class="badge badge-success">Selesai (Batas Iter)</span>`;

        compProgressFill.style.width = "40%";
        
        // 2. RUN SIMULATED ANNEALING BATCH
        compProgressLabel.innerText = "Memproses Komparasi: Simulated Annealing...";
        await new Promise(r => setTimeout(r, 100));

        const batchSA = new SimulatedAnnealing(numCameras * 3, () => cloneSolution(startSolution));
        batchSA.init(1000); // T0 = 1000

        const saStartMs = performance.now();
        let saIteration = 0;
        let saCooled = false;

        for (let i = 0; i < maxIter; i++) {
            const res = batchSA.step(cctvProblem, (sol) => cctvProblem.evaluateSolution(sol, fovRad, rangePx), 10, 0.96, 0.01);
            saHistory.push(res.bestFitness);
            saTempHistory.push(res.temperature);
            saProbHistory.push(res.boltzmannProb);
            saIteration = res.iteration;

            if (res.isCooled) {
                saCooled = true;
                break;
            }
        }
        const saEndMs = performance.now();
        const saElapsed = Math.round(saEndMs - saStartMs);
        const saEval = cctvProblem.evaluateSolution(batchSA.bestSolution, fovRad, rangePx);

        // Update SA Table Row
        document.getElementById("cell-sa-fit").innerText = saEval.coveragePct.toFixed(1) + "%";
        document.getElementById("cell-sa-overlap").innerText = saEval.overlapPct.toFixed(1) + "%";
        document.getElementById("cell-sa-iter").innerText = saIteration;
        document.getElementById("cell-sa-time").innerText = saElapsed + " ms";
        document.getElementById("cell-sa-status").innerHTML = saCooled ? `<span class="badge badge-success">Mendingin</span>` : `<span class="badge badge-success">Selesai</span>`;

        compProgressFill.style.width = "70%";
        
        // 3. RUN GENETIC ALGORITHM BATCH
        compProgressLabel.innerText = "Memproses Komparasi: Genetic Algorithm...";
        await new Promise(r => setTimeout(r, 100));

        // Use population 40, Pc=0.8, Pm=0.15, Tournament selection, Elitism=2
        const batchGA = new GeneticAlgorithm(numCameras * 3, () => cctvProblem.generateRandomSolution(numCameras));
        batchGA.init(40);

        const gaStartMs = performance.now();
        let gaGeneration = 0;

        // Since GA processes a whole population per generation, we adjust iteration bounds
        // A population of 40 running for 50 generations performs equivalent fitness evaluations (2000 evals)
        // to a local search running for 200 iterations. This is a very fair scientific comparison!
        const gaMaxGens = Math.max(10, Math.round(maxIter / 4));

        for (let i = 0; i < gaMaxGens; i++) {
            const res = batchGA.step(
                (sol) => cctvProblem.evaluateSolution(sol, fovRad, rangePx),
                0.8, 0.15, "tournament", "single", 2, 10, cctvProblem
            );
            gaBestHistory.push(res.bestFitness);
            gaAvgHistory.push(res.avgFitness);
            gaGeneration = res.generation;
        }
        const gaEndMs = performance.now();
        const gaElapsed = Math.round(gaEndMs - gaStartMs);
        const gaEval = cctvProblem.evaluateSolution(batchGA.bestSolution, fovRad, rangePx);

        // Shift GA history to align visually on the line chart iterations
        // We stretch GA generation records across the maxIteration steps
        let gaScaledHistory = [];
        const scaleFactor = maxIter / gaMaxGens;
        for (let i = 0; i < maxIter; i++) {
            const gaIdx = Math.min(gaMaxGens - 1, Math.floor(i / scaleFactor));
            // Map mathematical fitness to coverage percent for chart readbility
            gaScaledHistory.push(gaBestHistory[gaIdx]);
        }

        // Update GA Table Row
        document.getElementById("cell-ga-fit").innerText = gaEval.coveragePct.toFixed(1) + "%";
        document.getElementById("cell-ga-overlap").innerText = gaEval.overlapPct.toFixed(1) + "%";
        document.getElementById("cell-ga-iter").innerText = gaGeneration + " (Generasi)";
        document.getElementById("cell-ga-time").innerText = gaElapsed + " ms";
        document.getElementById("cell-ga-status").innerHTML = `<span class="badge badge-success">Evolusi Selesai</span>`;

        // 4. GRAPH DATA PREPARATION
        compProgressFill.style.width = "90%";
        compProgressLabel.innerText = "Menggambar Grafik Komparatif...";
        await new Promise(r => setTimeout(r, 100));

        // Map raw fitness scores to percentage coverage for user friendly line graphs
        // f_score = coverage * 100 - overlaps * 0.25 - wall_penalty
        // Since starting solutions are valid, we can approximate the coverage % on curves
        const mapToPct = (fitVal) => {
            // Cap at [0, 100]
            return Math.max(0, Math.min(100, (fitVal + 0) / 100));
        };

        const hcCurve = hcHistory.map(mapToPct);
        const saCurve = saHistory.map(mapToPct);
        const gaCurve = gaScaledHistory.map(mapToPct);

        renderConvergenceChart(hcCurve, saCurve, gaCurve);

        // Initial Diagnostic Chart Rendering
        updateDiagnosticChart(diagnosticChartSelect.value, {
            saTemps: saTempHistory,
            saProbs: saProbHistory,
            gaBest: gaBestHistory.map(mapToPct),
            gaAvg: gaAvgHistory.map(mapToPct)
        });

        // Store diag datasets on select element for switching dynamically
        diagnosticChartSelect.datasets = {
            saTemps: saTempHistory,
            saProbs: saProbHistory,
            gaBest: gaBestHistory.map(mapToPct),
            gaAvg: gaAvgHistory.map(mapToPct)
        };

        compProgressFill.style.width = "100%";
        compProgressLabel.innerText = "Komparasi Kinerja Selesai!";
        
        btnResetComparison.disabled = false;
    });

    btnResetComparison.addEventListener("click", () => {
        initComparisonLayout();
    });

    diagnosticChartSelect.addEventListener("change", () => {
        if (diagnosticChartSelect.datasets) {
            updateDiagnosticChart(diagnosticChartSelect.value, diagnosticChartSelect.datasets);
        }
    });

    // Chart.js Integrators
    function renderConvergenceChart(hcData, saData, gaData) {
        const ctx = document.getElementById("chart-convergence").getContext("2d");
        
        if (convergenceChart) {
            convergenceChart.destroy();
        }

        const labels = Array.from({ length: Math.max(hcData.length, saData.length, gaData.length) }, (_, i) => i + 1);

        convergenceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Hill Climbing (Steepest)',
                        data: hcData,
                        borderColor: '#f43f5e', // coral rose
                        backgroundColor: 'rgba(244, 63, 94, 0.05)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    },
                    {
                        label: 'Simulated Annealing',
                        data: saData,
                        borderColor: '#f59e0b', // orange amber
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    },
                    {
                        label: 'Genetic Algorithm',
                        data: gaData,
                        borderColor: '#10b981', // emerald green
                        backgroundColor: 'rgba(16, 185, 129, 0.05)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', weight: 'bold' } }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#64748b' },
                        title: { display: true, text: 'Langkah Evaluasi / Iterasi', color: '#94a3b8' }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#64748b', callback: (value) => value + "%" },
                        title: { display: true, text: 'Persentase Cakupan CCTV', color: '#94a3b8' },
                        min: 0,
                        max: 100
                    }
                }
            }
        });
    }

    function renderDiagnosticChart(type, ds1, ds2, label1 = "", label2 = "") {
        const ctx = document.getElementById("chart-diagnostic").getContext("2d");
        
        if (diagnosticChart) {
            diagnosticChart.destroy();
        }

        const labels = Array.from({ length: ds1.length }, (_, i) => i + 1);

        diagnosticChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: label1,
                        data: ds1,
                        borderColor: '#06b6d4', // Cyan
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        pointRadius: 0,
                        yAxisID: 'y'
                    },
                    {
                        label: label2,
                        data: ds2,
                        borderColor: '#ec4899', // Pink rose
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        borderDash: [3, 3],
                        pointRadius: 0,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#64748b' }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#06b6d4' },
                        title: { display: true, text: label1, color: '#06b6d4' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: { drawOnChartArea: false }, // avoid grid overlaps
                        ticks: { color: '#ec4899' },
                        title: { display: true, text: label2, color: '#ec4899' }
                    }
                }
            }
        });
    }

    function updateDiagnosticChart(type, datasets) {
        if (type === "sa-cooling") {
            // Plot SA cooling temperature schedule and acceptance probability
            renderDiagnosticChart(
                "sa-cooling",
                datasets.saTemps,
                datasets.saProbs,
                "Suhu SA (Temperature Decay)",
                "Peluang Boltzmann Menerima Solusi Buruk"
            );
        } else {
            // Plot GA best vs average generation fitnesses
            renderDiagnosticChart(
                "ga-fitness",
                datasets.gaBest,
                datasets.gaAvg,
                "Cakupan Terbaik Generasi (%)",
                "Cakupan Rata-rata Populasi (%)"
            );
        }
    }

    // ----------------------------------------------------------------------
    // 10. SYSTEM LAUNCHER INITIALIZATIONS
    // ----------------------------------------------------------------------
    resetCCTV();
});
