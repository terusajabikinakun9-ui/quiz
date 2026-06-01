/**
 * ==========================================================================
 * OptiWatch - Optimization Algorithms (HC, SA, GA, & Restart Wrapper)
 * ==========================================================================
 */

/**
 * Helper to deep clone solutions
 */
function cloneSolution(sol) {
    return [...sol];
}

// ==========================================================================
// 1. HILL CLIMBING OPTIMIZER
// ==========================================================================
class HillClimber {
    constructor(numParams, generateRandomFunc) {
        this.generateRandom = generateRandomFunc;
        this.numParams = numParams;
        
        this.currentSolution = null;
        this.currentFitness = -Infinity;
        
        this.globalBestSolution = null;
        this.globalBestFitness = -Infinity;
        
        this.iteration = 0;
        this.restartsCount = 0;
        this.stuckCounter = 0;
        this.maxStuck = 40; // threshold to trigger restart or mark stuck
        this.history = []; // records fitness convergence
    }

    init() {
        this.currentSolution = this.generateRandom();
        this.currentFitness = -Infinity; // will be evaluated on first step
        
        this.globalBestSolution = cloneSolution(this.currentSolution);
        this.globalBestFitness = -Infinity;
        
        this.iteration = 0;
        this.restartsCount = 0;
        this.stuckCounter = 0;
        this.history = [];
    }

    /**
     * Performs a single Hill Climbing step
     * @param {Object} problem - The problem model (CCTV or Benchmark)
     * @param {Function} evalFunc - Evaluator function, returns { fitness, ... } or number
     * @param {number} stepSize - Exploration magnitude
     * @param {string} variant - "simple" | "steepest" | "stochastic"
     * @param {boolean} enableRestart - Whether to trigger random restart when stuck
     */
    step(problem, evalFunc, stepSize, variant = "steepest", enableRestart = false) {
        this.iteration++;
        
        // Lazy evaluation of initial solution
        if (this.currentFitness === -Infinity) {
            const evalResult = evalFunc(this.currentSolution);
            this.currentFitness = typeof evalResult === 'object' ? evalResult.fitness : evalResult;
            this.globalBestFitness = this.currentFitness;
            this.globalBestSolution = cloneSolution(this.currentSolution);
            this.history.push(this.currentFitness);
        }

        let accepted = false;
        let newSolution = null;
        let newFitness = -Infinity;
        
        if (variant === "simple") {
            // SIMPLE HILL CLIMBING: Take first random neighbor that is better
            newSolution = problem.generateNeighbor(this.currentSolution, stepSize);
            const evalResult = evalFunc(newSolution);
            newFitness = typeof evalResult === 'object' ? evalResult.fitness : evalResult;

            if (newFitness > this.currentFitness) {
                this.currentSolution = newSolution;
                this.currentFitness = newFitness;
                accepted = true;
                this.stuckCounter = 0;
            } else {
                this.stuckCounter++;
            }
        } 
        else if (variant === "steepest") {
            // STEEPEST ASCENT: Evaluate K neighbors, take the absolute best
            const numNeighbors = 15;
            let bestNeighbor = null;
            let bestNeighborFitness = -Infinity;

            for (let i = 0; i < numNeighbors; i++) {
                const neighbor = problem.generateNeighbor(this.currentSolution, stepSize);
                const evalResult = evalFunc(neighbor);
                const fit = typeof evalResult === 'object' ? evalResult.fitness : evalResult;

                if (fit > bestNeighborFitness) {
                    bestNeighborFitness = fit;
                    bestNeighbor = neighbor;
                }
            }

            if (bestNeighborFitness > this.currentFitness) {
                this.currentSolution = bestNeighbor;
                this.currentFitness = bestNeighborFitness;
                accepted = true;
                this.stuckCounter = 0;
            } else {
                this.stuckCounter++;
            }
        } 
        else if (variant === "stochastic") {
            // STOCHASTIC: Evaluate K neighbors, choose among better ones with probability proportional to improvement
            const numNeighbors = 8;
            const improvements = [];

            for (let i = 0; i < numNeighbors; i++) {
                const neighbor = problem.generateNeighbor(this.currentSolution, stepSize);
                const evalResult = evalFunc(neighbor);
                const fit = typeof evalResult === 'object' ? evalResult.fitness : evalResult;
                const imp = fit - this.currentFitness;

                if (imp > 0) {
                    improvements.push({ sol: neighbor, fit: fit, imp: imp });
                }
            }

            if (improvements.length > 0) {
                // Roulette-like selection on improvements
                const totalImp = improvements.reduce((sum, item) => sum + item.imp, 0);
                let rand = Math.random() * totalImp;
                let selected = improvements[improvements.length - 1]; // fallback
                
                for (const item of improvements) {
                    rand -= item.imp;
                    if (rand <= 0) {
                        selected = item;
                        break;
                    }
                }

                this.currentSolution = selected.sol;
                this.currentFitness = selected.fit;
                accepted = true;
                this.stuckCounter = 0;
            } else {
                this.stuckCounter++;
            }
        }

        // Track global best solution across restarts
        if (this.currentFitness > this.globalBestFitness) {
            this.globalBestFitness = this.currentFitness;
            this.globalBestSolution = cloneSolution(this.currentSolution);
        }

        // Check if stuck and apply restart
        let restarted = false;
        if (this.stuckCounter >= this.maxStuck) {
            if (enableRestart) {
                this.restartsCount++;
                this.stuckCounter = 0;
                // Generate a fresh random solution to restart
                this.currentSolution = this.generateRandom();
                const evalResult = evalFunc(this.currentSolution);
                this.currentFitness = typeof evalResult === 'object' ? evalResult.fitness : evalResult;
                restarted = true;
                accepted = true;
            }
        }

        this.history.push(this.globalBestFitness);

        return {
            currentSolution: this.currentSolution,
            currentFitness: this.currentFitness,
            bestSolution: this.globalBestSolution,
            bestFitness: this.globalBestFitness,
            accepted: accepted,
            restarted: restarted,
            restartsCount: this.restartsCount,
            isStuck: this.stuckCounter >= this.maxStuck && !enableRestart
        };
    }
}


// ==========================================================================
// 2. SIMULATED ANNEALING OPTIMIZER
// ==========================================================================
class SimulatedAnnealing {
    constructor(numParams, generateRandomFunc) {
        this.generateRandom = generateRandomFunc;
        
        this.currentSolution = null;
        this.currentFitness = -Infinity;
        
        this.bestSolution = null;
        this.bestFitness = -Infinity;
        
        this.temperature = 1000;
        this.iteration = 0;
        
        this.history = []; // convergence history
        this.tempHistory = []; // cooling schedule history
        this.boltzmannAcceptances = 0; // count of worse moves accepted
        this.stats = {
            totalWorseProposals: 0,
            acceptedWorseProposals: 0
        };
    }

    init(initialTemp) {
        this.currentSolution = this.generateRandom();
        this.currentFitness = -Infinity;
        
        this.bestSolution = cloneSolution(this.currentSolution);
        this.bestFitness = -Infinity;
        
        this.temperature = initialTemp;
        this.iteration = 0;
        this.boltzmannAcceptances = 0;
        
        this.history = [];
        this.tempHistory = [];
        this.stats = {
            totalWorseProposals: 0,
            acceptedWorseProposals: 0
        };
    }

    /**
     * Performs a single Simulated Annealing step
     * @param {Object} problem - The problem model
     * @param {Function} evalFunc - Evaluator function returning fitness or object
     * @param {number} stepSize - Mutation step size
     * @param {number} alpha - Cooling rate
     * @param {number} tMin - Minimum temperature
     */
    step(problem, evalFunc, stepSize, alpha, tMin) {
        this.iteration++;
        
        // Lazy initialization
        if (this.currentFitness === -Infinity) {
            const evalResult = evalFunc(this.currentSolution);
            this.currentFitness = typeof evalResult === 'object' ? evalResult.fitness : evalResult;
            this.bestFitness = this.currentFitness;
            this.bestSolution = cloneSolution(this.currentSolution);
            this.history.push(this.currentFitness);
            this.tempHistory.push(this.temperature);
        }

        // 1. Generate neighbor
        const neighbor = problem.generateNeighbor(this.currentSolution, stepSize);
        const evalResult = evalFunc(neighbor);
        const neighborFitness = typeof evalResult === 'object' ? evalResult.fitness : evalResult;

        // 2. Transition decision
        const deltaE = neighborFitness - this.currentFitness; // maximization: positive = improvement
        let accepted = false;
        let acceptReason = "rejected";
        let boltzmannProb = 0;

        if (deltaE > 0) {
            // Better solution: accept immediately
            this.currentSolution = neighbor;
            this.currentFitness = neighborFitness;
            accepted = true;
            acceptReason = "improvement";
        } else {
            // Worse solution: accept based on Boltzmann probability
            this.stats.totalWorseProposals++;
            
            // Probability formula: P = e^(deltaE / T)
            // deltaE is negative, T is positive, so P is in range [0, 1]
            boltzmannProb = Math.exp(deltaE / this.temperature);
            const roll = Math.random();

            if (roll < boltzmannProb) {
                this.currentSolution = neighbor;
                this.currentFitness = neighborFitness;
                accepted = true;
                acceptReason = "boltzmann";
                this.boltzmannAcceptances++;
                this.stats.acceptedWorseProposals++;
            }
        }

        // 3. Track global best solution
        if (this.currentFitness > this.bestFitness) {
            this.bestFitness = this.currentFitness;
            this.bestSolution = cloneSolution(this.currentSolution);
        }

        // 4. Cool down
        const currentTemp = this.temperature;
        this.temperature = Math.max(tMin, this.temperature * alpha);
        
        this.history.push(this.bestFitness);
        this.tempHistory.push(currentTemp);

        return {
            currentSolution: this.currentSolution,
            currentFitness: this.currentFitness,
            bestSolution: this.bestSolution,
            bestFitness: this.bestFitness,
            temperature: currentTemp,
            accepted: accepted,
            acceptReason: acceptReason,
            deltaE: deltaE,
            boltzmannProb: boltzmannProb,
            isCooled: this.temperature <= tMin
        };
    }
}


// ==========================================================================
// 3. GENETIC ALGORITHM OPTIMIZER
// ==========================================================================
class GeneticAlgorithm {
    constructor(chromLength, generateRandomFunc) {
        this.generateRandom = generateRandomFunc;
        this.chromLength = chromLength;
        
        this.population = [];
        this.generation = 0;
        
        this.bestSolution = null;
        this.bestFitness = -Infinity;
        
        this.history = []; // best fitness history
        this.avgHistory = []; // average fitness history
    }

    /**
     * Initializes the population with random chromosomes
     */
    init(popSize) {
        this.population = [];
        this.generation = 0;
        this.bestSolution = null;
        this.bestFitness = -Infinity;
        this.history = [];
        this.avgHistory = [];

        for (let i = 0; i < popSize; i++) {
            this.population.push({
                chromosome: this.generateRandom(),
                fitness: -Infinity,
                evalDetails: null // holds problem specific detail metrics (coverage, overlap)
            });
        }
    }

    /**
     * Performs a single GA generation step
     * @param {Function} evalFunc - Evaluator function, returns { fitness, ... } or number
     * @param {number} pc - Crossover probability [0, 1]
     * @param {number} pm - Mutation probability [0, 1]
     * @param {string} selectionMethod - "tournament" | "roulette"
     * @param {string} crossoverMethod - "single" | "multi"
     * @param {number} elitismCount - Number of top chromosomes directly copied
     * @param {number} stepSizePx - Gaussian perturbation magnitude for mutation
     * @param {Object} problem - Problem object (used to apply correct bounds on mutation)
     */
    step(evalFunc, pc, pm, selectionMethod = "tournament", crossoverMethod = "single", elitismCount = 2, stepSizePx = 10, problem = null) {
        this.generation++;
        
        const popSize = this.population.length;

        // 1. Evaluate population fitness
        let totalFitness = 0;
        let minFitness = Infinity;
        let maxFitness = -Infinity;

        for (let i = 0; i < popSize; i++) {
            const ind = this.population[i];
            const evalResult = evalFunc(ind.chromosome);
            
            if (typeof evalResult === 'object') {
                ind.fitness = evalResult.fitness;
                ind.evalDetails = evalResult;
            } else {
                ind.fitness = evalResult;
            }
            
            totalFitness += ind.fitness;
            if (ind.fitness < minFitness) minFitness = ind.fitness;
            if (ind.fitness > maxFitness) {
                maxFitness = ind.fitness;
                this.bestSolution = cloneSolution(ind.chromosome);
                this.bestFitness = ind.fitness;
            }
        }

        // Sort population descending by fitness
        this.population.sort((a, b) => b.fitness - a.fitness);

        // Record stats
        const avgFitness = totalFitness / popSize;
        this.history.push(maxFitness);
        this.avgHistory.push(avgFitness);

        // 2. Perform Elitism
        const nextPopulation = [];
        const actualElites = Math.min(elitismCount, popSize);
        for (let i = 0; i < actualElites; i++) {
            nextPopulation.push({
                chromosome: cloneSolution(this.population[i].chromosome),
                fitness: this.population[i].fitness,
                evalDetails: this.population[i].evalDetails
            });
        }

        // 3. Helper for Selection
        // Tournament Selection
        const tournamentSelect = (k = 3) => {
            let best = this.population[Math.floor(Math.random() * popSize)];
            for (let i = 1; i < k; i++) {
                const contender = this.population[Math.floor(Math.random() * popSize)];
                if (contender.fitness > best.fitness) {
                    best = contender;
                }
            }
            return best;
        };

        // Roulette Wheel Selection (safely handles negative fitnesses by applying a shift offset)
        // Offset: Fitness_shifted = Fitness - MinFitness + 0.1
        const fitnessOffset = -minFitness;
        let cumulativeFitnesses = [];
        let runningSum = 0;
        
        for (let i = 0; i < popSize; i++) {
            // Apply scale shift
            const score = this.population[i].fitness + fitnessOffset + 0.1;
            runningSum += score;
            cumulativeFitnesses.push(runningSum);
        }

        const rouletteSelect = () => {
            const roll = Math.random() * runningSum;
            for (let i = 0; i < popSize; i++) {
                if (roll <= cumulativeFitnesses[i]) {
                    return this.population[i];
                }
            }
            return this.population[0];
        };

        const selectParent = () => {
            if (selectionMethod === "roulette" && runningSum > 0) {
                return rouletteSelect();
            }
            return tournamentSelect(3); // default tournament size 3
        };

        // 4. Crossover & Mutation reproduction loop
        while (nextPopulation.length < popSize) {
            const parent1 = selectParent();
            const parent2 = selectParent();

            let child1Chrom = cloneSolution(parent1.chromosome);
            let child2Chrom = cloneSolution(parent2.chromosome);

            // Crossover
            if (Math.random() < pc) {
                // We perform crossover at parameter block boundaries (3 genes for x,y,theta per camera)
                // to maintain camera-unit integrity during chromosome recombinations.
                // However, parameter granularity can also be linear. Let's do camera block crossover.
                const genesPerBlock = 3;
                const numBlocks = this.chromLength / genesPerBlock;

                if (numBlocks > 1) {
                    if (crossoverMethod === "single") {
                        const crossBlockIdx = 1 + Math.floor(Math.random() * (numBlocks - 1));
                        const crossGeneIdx = crossBlockIdx * genesPerBlock;
                        
                        // Swap parts
                        for (let j = crossGeneIdx; j < this.chromLength; j++) {
                            const tmp = child1Chrom[j];
                            child1Chrom[j] = child2Chrom[j];
                            child2Chrom[j] = tmp;
                        }
                    } else {
                        // Multi-point Crossover (pick two swap boundaries)
                        let pt1 = 1 + Math.floor(Math.random() * (numBlocks - 1));
                        let pt2 = 1 + Math.floor(Math.random() * (numBlocks - 1));
                        if (pt1 > pt2) { const t = pt1; pt1 = pt2; pt2 = t; }
                        
                        if (pt1 !== pt2) {
                            const idx1 = pt1 * genesPerBlock;
                            const idx2 = pt2 * genesPerBlock;
                            
                            // Swap middle section
                            for (let j = idx1; j < idx2; j++) {
                                const tmp = child1Chrom[j];
                                child1Chrom[j] = child2Chrom[j];
                                child2Chrom[j] = tmp;
                            }
                        }
                    }
                } else {
                    // Fallback to gene-level single point if only 1 block exists (e.g. 1 camera or benchmark)
                    const crossPoint = 1 + Math.floor(Math.random() * (this.chromLength - 1));
                    for (let j = crossPoint; j < this.chromLength; j++) {
                        const tmp = child1Chrom[j];
                        child1Chrom[j] = child2Chrom[j];
                        child2Chrom[j] = tmp;
                    }
                }
            }

            // Mutation
            // Gaussian mutation: add a small Gaussian offset to parameters
            const mutate = (chrom) => {
                const mutated = cloneSolution(chrom);
                for (let j = 0; j < this.chromLength; j++) {
                    if (Math.random() < pm) {
                        // check what parameter index this gene represents
                        // j % 3 === 0 (x), j % 3 === 1 (y), j % 3 === 2 (angle)
                        let offset = 0;
                        if (problem && problem.width) {
                            // CCTV Problem
                            if (j % 3 === 0) {
                                // mutate x (perturb by stepSizePx)
                                offset = (Math.random() * 2 - 1) * (stepSizePx / problem.width);
                                mutated[j] = Math.max(0.02, Math.min(0.98, mutated[j] + offset));
                            } else if (j % 3 === 1) {
                                // mutate y (perturb by stepSizePx)
                                offset = (Math.random() * 2 - 1) * (stepSizePx / problem.height);
                                mutated[j] = Math.max(0.02, Math.min(0.98, mutated[j] + offset));
                            } else {
                                // mutate angle (perturb by 15 degrees)
                                offset = (Math.random() * 2 - 1) * (15 / 360);
                                mutated[j] = (mutated[j] + offset + 1) % 1; // wrap [0,1]
                            }
                        } else {
                            // Math Benchmark (Rastrigin)
                            // mutate coordinate (perturb by 5% of range)
                            offset = (Math.random() * 2 - 1) * 0.05;
                            mutated[j] = Math.max(0, Math.min(1, mutated[j] + offset));
                        }
                    }
                }
                return mutated;
            };

            child1Chrom = mutate(child1Chrom);
            child2Chrom = mutate(child2Chrom);

            nextPopulation.push({
                chromosome: child1Chrom,
                fitness: -Infinity,
                evalDetails: null
            });

            if (nextPopulation.length < popSize) {
                nextPopulation.push({
                    chromosome: child2Chrom,
                    fitness: -Infinity,
                    evalDetails: null
                });
            }
        }

        // 5. Replace population
        this.population = nextPopulation;

        return {
            generation: this.generation,
            bestSolution: this.bestSolution,
            bestFitness: this.bestFitness,
            avgFitness: avgFitness,
            bestDetails: this.population[0].evalDetails // since elite is at index 0, it holds the best evaluated statistics
        };
    }
}
