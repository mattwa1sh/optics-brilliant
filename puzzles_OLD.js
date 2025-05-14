/**
 * Light Detective - Puzzles Module
 *
 * This file contains all the puzzle-related functionality for the Light Detective game.
 */

// Puzzle variables
let currentPuzzle = null;
let currentPuzzleFilename = null; // Store the filename for easier reference
let isPuzzleMode = false;
let puzzleStartTime = null;
let isPuzzleSolved = false;
let isPuzzleFailed = false;
let timeLimitInterval = null; // For tracking the timer interval

// Path identification puzzle variables
let targetReflection = null;             // The reflection we're asking the user to identify
let userPath = [];                       // Array to store the reflections/points the user clicked
let expectedPath = [];                   // The correct path from target reflection to ball
let isPathIdentificationMode = false;    // Whether we're in path identification mode
let pathHighlightTimeout = null;         // For temporary highlighting of clicked reflections
let userRayPath = null;                  // The user's constructed ray path for visualization

// Detective puzzle variables
let isDetectiveMode = false;             // Whether we're in detective mode
let badReflections = [];                 // Array of indices of reflections that were manipulated 
let originalPositions = [];              // Original positions of manipulated reflections
let markedAsBad = [];                    // Array of reflections that the user marked as bad
let currentUserPath = [];                // Current path the user is drawing for testing
let originalReflectionPositions = null; // Store original positions before manipulation

// Function to load a puzzle from the puzzles folder
function loadPuzzle(puzzleFilename) {
  console.log(`Starting to load puzzle: ${puzzleFilename}`);
  
  try {
    isPuzzleMode = true;
    isPuzzleSolved = false;
    isPuzzleFailed = false;
    currentPuzzleFilename = puzzleFilename; // Store the filename
    
    // Reset path identification variables
    userPath = [];
    expectedPath = [];
    isPathIdentificationMode = false;
    if (pathHighlightTimeout) {
      clearTimeout(pathHighlightTimeout);
      pathHighlightTimeout = null;
    }
    
    // Reset detective mode variables
    isDetectiveMode = false;
    badReflections = [];
    originalPositions = [];
    markedAsBad = []; // Clear all red X marks
    currentUserPath = [];
    originalReflectionPositions = null; // Reset original positions
    
    // Clear any existing timer
    if (timeLimitInterval) {
      clearInterval(timeLimitInterval);
      timeLimitInterval = null;
    }
    
    // Reset puzzle start time
    puzzleStartTime = new Date().getTime();
    
    console.log(`Loading puzzle file: ${puzzleFilename}`);
    
    // Load the puzzle JSON file
    fetch(`puzzles/${puzzleFilename}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch puzzle: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(puzzleData => {
        // Validate puzzle has a valid type
        if (!puzzleData.type) {
          throw new Error(`Puzzle ${puzzleFilename} is missing required 'type' property`);
        }
        
        // Check for valid type values
        const validTypes = ["presentation", "path_identification", "detective", "generation"];
        if (!validTypes.includes(puzzleData.type)) {
          throw new Error(`Puzzle ${puzzleFilename} has invalid type: ${puzzleData.type}. Valid types are: ${validTypes.join(", ")}`);
        }
        
        currentPuzzle = puzzleData;
        console.log(`Loaded puzzle: ${currentPuzzle.name}, type: ${currentPuzzle.type}, arrangement: ${currentPuzzle.arrangement}`);
        
        // Load the associated arrangement
        return fetch(`arrangements/${currentPuzzle.arrangement}`)
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to fetch arrangement: ${response.status} ${response.statusText}`);
            }
            return response.json();
          });
      })
      .then(arrangementData => {
        console.log(`Loaded arrangement for ${currentPuzzle.name}`);
        
        // If the puzzle has randomization settings, apply them
        if (currentPuzzle.randomize) {
          applyRandomization(arrangementData);
        }

        try {
          // Import the arrangement
          console.log("Importing arrangement...");
          const success = importArrangement(arrangementData);
          if (!success) {
            throw new Error("Failed to import arrangement");
          }
          
          // Set initial ray visibility based on puzzle config (for all puzzle types)
          // This MUST happen before any puzzle-specific setup
          if (currentPuzzle.showRaysStart !== undefined) {
            console.log("Setting showRayPaths to", currentPuzzle.showRaysStart, "from puzzle config");
            showRayPaths = Boolean(currentPuzzle.showRaysStart);
            
            // If rays should be shown and there are reflections, set currentRayIndex to display the first one
            if (showRayPaths && reflections.length > 0) {
              console.log("Setting currentRayIndex to 0 because showRaysStart is true");
              currentRayIndex = 0;
            }
            
            // Update the Show/Hide Rays button text
            const togglePathsBtn = document.getElementById('togglePaths');
            if (togglePathsBtn) {
              togglePathsBtn.textContent = showRayPaths ? 'Hide Rays' : 'Show Rays';
            }
          }
          
          try {
            // Display puzzle information first to ensure UI elements exist
            console.log("Displaying puzzle info...");
            displayPuzzleInfo();
            
            // Setup puzzle type-specific functionality
            if (currentPuzzle.type === "path_identification") {
              console.log("Setting up path identification puzzle...");
              setupPathIdentificationPuzzle();
              
              // Disable buttons that shouldn't be used in path identification mode
              disableButtonsForPathIdentification();
            }
            // For detective mode, just set the flag
            else if (currentPuzzle.type === "detective") {
              console.log("Setting up detective puzzle...");
              // Call the minimal setup function
              setupDetectivePuzzle();
            }
            // For presentation mode, keep all buttons enabled
            else if (currentPuzzle.type === "presentation") {
              console.log("Setting up presentation mode...");
              setupPresentationMode();
            }
            // For generation mode, ensure free movement
            else if (currentPuzzle.type === "generation") {
              console.log("Setting up generation mode...");
              setupGenerationMode();
            }
            
            // Start timer if there's a time limit
            if (currentPuzzle.timeLimit) {
              startPuzzleTimer();
            }
            
            // Log the final state of showRayPaths
            console.log("Final showRayPaths value:", showRayPaths);
          } catch (setupError) {
            console.error("Error in puzzle type setup:", setupError);
            throw setupError;
          }
        } catch (importError) {
          console.error("Error importing arrangement:", importError);
          throw importError;
        }
      })
      .catch(error => {
        console.error(`Error loading puzzle: ${error.message}`);
        console.error(error.stack);
        
        // Show error message to user
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        errorMsg.textContent = `Error loading puzzle: ${error.message}`;
        errorMsg.style.position = 'fixed';
        errorMsg.style.top = '10px';
        errorMsg.style.left = '50%';
        errorMsg.style.transform = 'translateX(-50%)';
        errorMsg.style.backgroundColor = '#ffebee';
        errorMsg.style.color = '#f44336';
        errorMsg.style.padding = '10px';
        errorMsg.style.borderRadius = '4px';
        errorMsg.style.zIndex = '1000';
        document.body.appendChild(errorMsg);
        
        // Remove the error message after 5 seconds
        setTimeout(() => {
          errorMsg.remove();
        }, 5000);
        
        // Exit puzzle mode on error
        exitPuzzleMode();
      });
  } catch (globalError) {
    console.error("Global error in loadPuzzle:", globalError);
  }
}

// Function to apply randomization to an arrangement based on puzzle settings
function applyRandomization(arrangementData) {
  const randomize = currentPuzzle.randomize;
  console.log("Applying randomization with settings:", randomize);
  
  // Randomize ball position if specified
  if (randomize.ball) {
    const ballSettings = randomize.ball;
    console.log("Randomizing ball with settings:", ballSettings);
    
    // If specific region is provided, use it
    if (ballSettings.region) {
      const region = ballSettings.region;
      const oldX = arrangementData.ball.x;
      const oldY = arrangementData.ball.y;
      arrangementData.ball.x = random(region.x || 0, (region.x || 0) + (region.width || width));
      arrangementData.ball.y = random(region.y || 0, (region.y || 0) + (region.height || height * 0.7));
      console.log(`Ball position changed from (${oldX}, ${oldY}) to (${arrangementData.ball.x}, ${arrangementData.ball.y})`);
    } 
    // Otherwise randomize within safe bounds
    else {
      const ballRadius = arrangementData.ball.radius || BALL_RADIUS;
      const oldX = arrangementData.ball.x;
      const oldY = arrangementData.ball.y;
      arrangementData.ball.x = random(ballRadius, width - ballRadius);
      arrangementData.ball.y = random(ballRadius, height * 0.7); // Keep ball in upper 70% of screen
      console.log(`Ball position changed from (${oldX}, ${oldY}) to (${arrangementData.ball.x}, ${arrangementData.ball.y})`);
    }
  }
  
  // Randomize eye position if specified
  if (randomize.eye) {
    const eyeSettings = randomize.eye;
    console.log("Randomizing eye with settings:", eyeSettings);
    
    // If specific region is provided, use it
    if (eyeSettings.region) {
      const region = eyeSettings.region;
      const oldX = arrangementData.eye.x;
      const oldY = arrangementData.eye.y;
      arrangementData.eye.x = random(region.x || 0, (region.x || 0) + (region.width || width));
      arrangementData.eye.y = random(region.y || (height * 0.5), (region.y || (height * 0.5)) + (region.height || (height * 0.5)));
      console.log(`Eye position changed from (${oldX}, ${oldY}) to (${arrangementData.eye.x}, ${arrangementData.eye.y})`);
    } 
    // Otherwise randomize within safe bounds
    else {
      const oldX = arrangementData.eye.x;
      const oldY = arrangementData.eye.y;
      arrangementData.eye.x = random(EYE_SIZE, width - EYE_SIZE);
      arrangementData.eye.y = random(height * 0.5, height - EYE_SIZE); // Keep eye in lower half of screen
      console.log(`Eye position changed from (${oldX}, ${oldY}) to (${arrangementData.eye.x}, ${arrangementData.eye.y})`);
    }
  }
  
  // Randomize mirrors if specified
  if (randomize.mirrors) {
    // Check if mirrors is an array (per-mirror settings) or an object (all mirrors settings)
    if (Array.isArray(randomize.mirrors)) {
      console.log("Using array-style mirror randomization for", randomize.mirrors.length, "mirrors");
      // Array style: each element contains settings for a specific mirror
      // Make sure we have enough mirrors in the arrangement
      while (arrangementData.mirrors.length < randomize.mirrors.length) {
        // Add a dummy mirror that will be replaced
        arrangementData.mirrors.push({
          x1: width/2 - 100, y1: height/2,
          x2: width/2 + 100, y2: height/2,
          normal: { x: 0, y: 1 },
          width: MIRROR_WIDTH
        });
        console.log("Added placeholder mirror to match array length");
      }
      
      // Apply settings to each mirror
      for (let i = 0; i < randomize.mirrors.length; i++) {
        if (i >= arrangementData.mirrors.length) break;
        
        const mirrorSettings = randomize.mirrors[i];
        const mirror = arrangementData.mirrors[i];
        console.log(`Randomizing mirror ${i} with settings:`, mirrorSettings);
        
        // Randomize position and rotation for this specific mirror
        randomizeMirror(mirror, mirrorSettings);
      }
    } else {
      console.log("Using object-style mirror randomization for all", arrangementData.mirrors.length, "mirrors");
      // Object style: same settings apply to all mirrors
      const mirrorSettings = randomize.mirrors;
      
      // For each mirror in the arrangement
      for (let i = 0; i < arrangementData.mirrors.length; i++) {
        const mirror = arrangementData.mirrors[i];
        console.log(`Randomizing mirror ${i} with common settings`);
        
        // Randomize position and rotation using the common settings
        randomizeMirror(mirror, mirrorSettings);
      }
    }
  }
  
  // If specified, randomize the number of mirrors
  if (randomize.mirrors && randomize.mirrors.count) {
    const countSettings = randomize.mirrors.count;
    let targetCount;
    
    if (typeof countSettings === 'object') {
      targetCount = Math.floor(random(countSettings.min || 1, (countSettings.max || 5) + 1));
    } else {
      targetCount = Math.max(1, Math.floor(random(1, 6))); // 1-5 mirrors
    }
    
    // Current count
    const currentCount = arrangementData.mirrors.length;
    
    // If we need more mirrors, add them
    if (targetCount > currentCount) {
      for (let i = currentCount; i < targetCount; i++) {
        addRandomMirror(arrangementData, randomize.mirrors);
      }
    }
    // If we need fewer mirrors, remove some
    else if (targetCount < currentCount) {
      // Remove random mirrors until we reach target count
      while (arrangementData.mirrors.length > targetCount) {
        const indexToRemove = Math.floor(random(arrangementData.mirrors.length));
        arrangementData.mirrors.splice(indexToRemove, 1);
      }
    }
  }
}

// Helper function to randomize a single mirror based on settings
function randomizeMirror(mirror, mirrorSettings) {
  // Save old values for logging
  const oldMirror = {
    x1: mirror.x1,
    y1: mirror.y1,
    x2: mirror.x2,
    y2: mirror.y2,
    normal: {...mirror.normal},
    width: mirror.width
  };
  
  // Randomize position if specified
  if (mirrorSettings.position) {
    let region = mirrorSettings.region || {
      x: 0, 
      y: 0, 
      width: width, 
      height: height * 0.8 // Keep mirrors in upper 80% of screen
    };
    console.log("Mirror randomization region:", region);
    
    // Calculate center point for the mirror
    const centerX = random(region.x + MIRROR_LENGTH/2, region.x + region.width - MIRROR_LENGTH/2);
    const centerY = random(region.y + MIRROR_LENGTH/2, region.y + region.height - MIRROR_LENGTH/2);
    console.log(`Selected mirror center: (${centerX}, ${centerY})`);
    
    // Randomize rotation angle if specified
    let angle = 0;
    if (mirrorSettings.rotation) {
      if (typeof mirrorSettings.rotation === 'object') {
        angle = random(mirrorSettings.rotation.min || 0, mirrorSettings.rotation.max || TWO_PI);
      } else {
        angle = random(TWO_PI);
      }
      console.log(`Randomized angle: ${angle} radians (${degrees(angle)} degrees)`);
    } else if (mirrorSettings.angle !== undefined) {
      // Use fixed angle (in degrees)
      angle = radians(mirrorSettings.angle);
      console.log(`Using fixed angle: ${mirrorSettings.angle} degrees (${angle} radians)`);
    }
    
    // Calculate mirror length
    let mirrorLength = MIRROR_LENGTH;
    if (mirrorSettings.size) {
      if (typeof mirrorSettings.size === 'object') {
        mirrorLength = random(mirrorSettings.size.min || MIRROR_LENGTH/2, 
                            mirrorSettings.size.max || MIRROR_LENGTH*2);
      } else {
        // Random variation of +/- 25% from standard length
        mirrorLength = random(MIRROR_LENGTH * 0.75, MIRROR_LENGTH * 1.25);
      }
      console.log(`Mirror length set to: ${mirrorLength}`);
    }
    
    // Calculate new endpoint positions based on center, angle, and length
    const halfLength = mirrorLength / 2;
    mirror.x1 = centerX - cos(angle) * halfLength;
    mirror.y1 = centerY - sin(angle) * halfLength;
    mirror.x2 = centerX + cos(angle) * halfLength;
    mirror.y2 = centerY + sin(angle) * halfLength;
    
    // Calculate the mirror's normal vector
    const mirrorVector = { 
      x: mirror.x2 - mirror.x1, 
      y: mirror.y2 - mirror.y1 
    };
    const mirrorActualLength = Math.sqrt(mirrorVector.x * mirrorVector.x + mirrorVector.y * mirrorVector.y);
    
    // Get normalized normal vector
    mirror.normal = {
      x: -mirrorVector.y / mirrorActualLength,
      y: mirrorVector.x / mirrorActualLength
    };
  }
  
  // Randomize mirror width if specified
  if (mirrorSettings.width) {
    if (typeof mirrorSettings.width === 'object') {
      mirror.width = random(mirrorSettings.width.min || 2, 
                          mirrorSettings.width.max || 8);
    } else {
      // Random variation of +/- 50% from standard width
      mirror.width = random(MIRROR_WIDTH * 0.5, MIRROR_WIDTH * 1.5);
    }
    console.log(`Mirror width set to: ${mirror.width}`);
  }
  
  // Log the changes
  console.log("Mirror updated from:", oldMirror);
  console.log("Mirror updated to:", {...mirror});
}

// Helper function to add a random mirror to an arrangement
function addRandomMirror(arrangementData, mirrorSettings) {
  // Create a new empty mirror
  const newMirror = {
    x1: 0, y1: 0, x2: 0, y2: 0,
    normal: { x: 0, y: 1 },
    width: MIRROR_WIDTH
  };
  
  // Add to the arrangement
  arrangementData.mirrors.push(newMirror);
  
  // Apply randomization to the mirror
  randomizeMirror(newMirror, mirrorSettings);
}

// Function to display puzzle information
function displayPuzzleInfo() {
  if (!currentPuzzle) return;
  
  // Create or update the puzzle info panel
  let puzzleInfoPanel = document.getElementById('puzzleInfoPanel');
  if (!puzzleInfoPanel) {
    puzzleInfoPanel = document.createElement('div');
    puzzleInfoPanel.id = 'puzzleInfoPanel';
    puzzleInfoPanel.className = 'puzzle-panel';
    document.body.appendChild(puzzleInfoPanel);
  }
  
  // Check if this puzzle has a time limit
  const hasTimeLimit = hasTimeLimitCondition();
  const timerElement = hasTimeLimit ? '<div id="puzzleTimer"></div>' : '';
  
  // Different content based on puzzle type
  let typeSpecificContent = '';
  
  if (currentPuzzle.type === "path_identification") {
    typeSpecificContent = `
      <p class="puzzle-instructions">
        Identify the correct chain of reflections that creates the highlighted TARGET image.
        Click reflections in order from parent images back to the blue ball.
      </p>
    `;
  } else if (currentPuzzle.type === "presentation") {
    typeSpecificContent = ``;
  } else if (currentPuzzle.type === "detective") {
    typeSpecificContent = `
      <p class="puzzle-instructions">
        Find the incorrect reflection(s)! Double-click suspect reflections to mark them.
        When finished, click "Submit Solution" to check your answer.
      </p>
      <div class="detective-controls-placeholder"></div>
    `;
  } else {
    // For other puzzle types (like reflection generation)
    typeSpecificContent = `<p class="movable-objects">Movable: ${getMovableObjectsText()}</p>`;
  }
  
  // Check if there's a next puzzle available
  let nextPuzzleBtn = '';
  if (typeof getNextPuzzleFilename === 'function') {
    const nextPuzzleFilename = getNextPuzzleFilename(currentPuzzleFilename);
    if (nextPuzzleFilename) {
      nextPuzzleBtn = '<button id="nextPuzzleBtn">Next Puzzle</button>';
    }
  }
  
  // Set the content
  puzzleInfoPanel.innerHTML = `
    <h3>${currentPuzzle.name}</h3>
    <p>${currentPuzzle.description}</p>
    ${typeSpecificContent}
    ${timerElement}
    <div id="puzzleStatus"></div>
    <button id="showHintBtn">Show Hint</button>
    <button id="resetPuzzleBtn">Reset Puzzle</button>
    ${nextPuzzleBtn}
    <button id="exitPuzzleBtn">Exit Puzzle</button>
  `;
  
  // Set up button event listeners
  document.getElementById('showHintBtn').onclick = showPuzzleHint;
  document.getElementById('resetPuzzleBtn').onclick = resetPuzzle;
  document.getElementById('exitPuzzleBtn').onclick = exitPuzzleMode;
  
  // Set up the Next Puzzle button if it exists
  const nextBtn = document.getElementById('nextPuzzleBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', loadNextPuzzle);
  }
  
  // Start timer if needed
  if (hasTimeLimit) {
    startPuzzleTimer();
  }
  
  // Update path progress for path identification puzzles
  if (currentPuzzle.type === "path_identification") {
    updatePathProgress();
  }
  
  // If it's a detective puzzle, add controls after a short delay to ensure the DOM is ready
  if (currentPuzzle.type === "detective") {
    setTimeout(() => {
      addDetectiveControls();
    }, 100);
  }
}

// Helper function to get text description of movable objects
function getMovableObjectsText() {
  if (!currentPuzzle) return "";
  
  // Get the movable objects
  const movableObjects = currentPuzzle.movableObjects;
  
  // If undefined or null, nothing is movable
  if (!movableObjects) return "None";
  
  // Handle array format (new format)
  if (Array.isArray(movableObjects)) {
    return movableObjects.length > 0 ? movableObjects.join(", ") : "None";
  }
  
  // Handle object format (old format)
  const parts = [];
  if (movableObjects.mirrors) parts.push("Mirrors");
  if (movableObjects.ball) parts.push("Ball");
  if (movableObjects.eye) parts.push("Eye");
  
  return parts.length > 0 ? parts.join(", ") : "None";
}

// Function to show a random hint from the puzzle
function showPuzzleHint() {
  if (!currentPuzzle || !currentPuzzle.hints || currentPuzzle.hints.length === 0) return;
  
  // Pick a random hint
  const randomIndex = Math.floor(Math.random() * currentPuzzle.hints.length);
  const hint = currentPuzzle.hints[randomIndex];
  
  // Create or update the hint element
  let hintElement = document.getElementById('puzzleHint');
  if (!hintElement) {
    hintElement = document.createElement('div');
    hintElement.id = 'puzzleHint';
    hintElement.className = 'puzzle-hint';
    document.getElementById('puzzleInfoPanel').appendChild(hintElement);
  }
  
  hintElement.textContent = `Hint: ${hint}`;
  hintElement.style.display = 'block';
  
  // Hide the hint after 10 seconds
  setTimeout(() => {
    hintElement.style.display = 'none';
  }, 10000);
}

// Function to reset the current puzzle
function resetPuzzle() {
  if (!currentPuzzle) return;
  
  console.log("Resetting puzzle:", currentPuzzle.name);
  console.log("Current movableObjects:", JSON.stringify(currentPuzzle.movableObjects));
  console.log("Current puzzle state - Solved:", isPuzzleSolved, "Failed:", isPuzzleFailed);
  
  // Store current movableObjects configuration to preserve it through the reset
  const savedMovableObjects = currentPuzzle.movableObjects;
  
  // IMPORTANT: Reset puzzle state FIRST
  isPuzzleSolved = false;
  isPuzzleFailed = false;
  console.log("Puzzle state reset - Solved:", isPuzzleSolved, "Failed:", isPuzzleFailed);
  
  // Reset path identification variables if needed
  if (currentPuzzle.type === "path_identification") {
    userPath = [];
    userRayPath = null;
    targetReflection = null;
    expectedPath = [];
    if (pathHighlightTimeout) {
      clearTimeout(pathHighlightTimeout);
      pathHighlightTimeout = null;
    }
  }
  // Reset detective variables if needed
  else if (currentPuzzle.type === "detective") {
    markedAsBad = [];
    badReflections = [];
    originalPositions = [];
    currentUserPath = [];
    originalReflectionPositions = null;
  }
  
  // Clear any status messages
  const statusElement = document.getElementById('puzzleStatus');
  if (statusElement) {
    statusElement.innerHTML = '';
  }
  
  // Clear any existing timer
  if (timeLimitInterval) {
    clearInterval(timeLimitInterval);
    timeLimitInterval = null;
  }
  
  // Reset puzzle start time
  puzzleStartTime = new Date().getTime();
  
  // Reset ray visibility based on puzzle settings
  if (currentPuzzle.showRaysStart !== undefined) {
    showRayPaths = Boolean(currentPuzzle.showRaysStart);
  } else {
    // Default behavior
    showRayPaths = false;
  }
  
  // Reset currentRayIndex
  currentRayIndex = -1;
  
  // Load the associated arrangement
  fetch(`arrangements/${currentPuzzle.arrangement}`)
    .then(response => response.json())
    .then(arrangementData => {
      // Double-check that puzzle state is reset
      if (isPuzzleSolved || isPuzzleFailed) {
        console.warn("Puzzle state was not properly reset! Fixing...");
        isPuzzleSolved = false;
        isPuzzleFailed = false;
      }
      
      // If the puzzle has randomization settings, apply them
      if (currentPuzzle.randomize) {
        applyRandomization(arrangementData);
      }
      
      // Import the arrangement
      importArrangement(arrangementData);
      
      // Restore the saved movableObjects to ensure it's preserved
      currentPuzzle.movableObjects = savedMovableObjects;
      console.log("Restored movableObjects after reset:", JSON.stringify(currentPuzzle.movableObjects));
      
      // Re-setup path identification if needed
      if (currentPuzzle.type === "path_identification") {
        setupPathIdentificationPuzzle();
        
        // Update progress display
        updatePathProgress();
      }
      // Re-setup detective mode if needed
      else if (currentPuzzle.type === "detective") {
        setupDetectivePuzzle();
      }
      // Re-setup presentation mode if needed
      else if (currentPuzzle.type === "presentation") {
        setupPresentationMode();
      }
      // Re-setup generation mode if needed
      else if (currentPuzzle.type === "generation") {
        setupGenerationMode();
      }
      
      // If this puzzle has a time limit, restart the timer
      if (hasTimeLimitCondition()) {
        startPuzzleTimer();
      }
      
      console.log("Puzzle reset complete");
      console.log("Final movableObjects after reset:", JSON.stringify(currentPuzzle.movableObjects));
      console.log("Final puzzle state - Solved:", isPuzzleSolved, "Failed:", isPuzzleFailed);
    })
    .catch(error => {
      console.error(`Error reloading arrangement: ${error}`);
    });
}

// Function to exit puzzle mode
function exitPuzzleMode() {
  console.log("Exiting puzzle mode...");
  
  // Reset all puzzle flags
  isPuzzleMode = false;
  currentPuzzle = null;
  currentPuzzleFilename = null;
  isPuzzleSolved = false;
  isPuzzleFailed = false;
  isPathIdentificationMode = false;
  isDetectiveMode = false;
  
  // Reset all puzzle variables
  resetPuzzleVariables();
  
  // Clear reflections
  if (typeof reflections !== 'undefined') {
    reflections = [];
  }
  
  // Reset ray visibility
  if (typeof showRayPaths !== 'undefined') {
    showRayPaths = false;
  }
  
  // Reset ray index
  if (typeof currentRayIndex !== 'undefined') {
    currentRayIndex = -1;
  }
  
  // Re-enable any disabled buttons
  enableAllButtons();
  
  // Clear any existing timer
  if (timeLimitInterval) {
    clearInterval(timeLimitInterval);
    timeLimitInterval = null;
  }
  
  // Remove the puzzle info panel
  const puzzleInfoPanel = document.getElementById('puzzleInfoPanel');
  if (puzzleInfoPanel) {
    puzzleInfoPanel.remove();
  }
  
  // Reset to default game state
  initializeGame();
  
  console.log("Successfully exited puzzle mode");
}

// Check if puzzle win/lose conditions are met
function checkPuzzleConditions() {
  if (!isPuzzleMode || !currentPuzzle) return;
  
  // Skip if puzzle is already solved or failed
  if (isPuzzleSolved || isPuzzleFailed) return;
  
  // Count reflections by order
  const reflectionCounts = countReflectionsByOrder();
  
  // Check win conditions
  let winConditionsMet = false;
  
  if (currentPuzzle.winConditions) {
    // Multiple win conditions (all must be met)
    winConditionsMet = currentPuzzle.winConditions.every(condition => 
      checkSingleCondition(condition, reflectionCounts));
  } else if (currentPuzzle.winCondition) {
    // Single win condition
    winConditionsMet = checkSingleCondition(currentPuzzle.winCondition, reflectionCounts);
  }
  
  // Check lose conditions
  let loseConditionsMet = false;
  
  if (currentPuzzle.loseConditions) {
    // Multiple lose conditions (any one can trigger failure)
    loseConditionsMet = currentPuzzle.loseConditions.some(condition => 
      checkSingleCondition(condition, reflectionCounts));
  } else if (currentPuzzle.loseCondition) {
    // Single lose condition
    loseConditionsMet = checkSingleCondition(currentPuzzle.loseCondition, reflectionCounts);
  }
  
  // Handle puzzle solved
  if (winConditionsMet) {
    puzzleSolved();
  }
  
  // Handle puzzle failed
  if (loseConditionsMet) {
    puzzleFailed();
  }
}

// Helper function to check a single condition
function checkSingleCondition(condition, reflectionCounts) {
  switch (condition.type) {
    case 'exactReflections':
      // Check if there are exactly N reflections of order X
      return reflectionCounts[condition.order] === condition.count;
      
    case 'minReflections':
      // Check if there are at least N reflections of order X
      return reflectionCounts[condition.order] >= condition.count;
      
    case 'maxReflections':
      // Check if there are at most N reflections of order X
      return reflectionCounts[condition.order] <= condition.count;
      
    case 'totalReflections':
      // Check total reflections against operator and count
      const total = Object.values(reflectionCounts).reduce((sum, count) => sum + count, 0);
      
      switch (condition.operator) {
        case '=': return total === condition.count;
        case '>': return total > condition.count;
        case '<': return total < condition.count;
        case '>=': return total >= condition.count;
        case '<=': return total <= condition.count;
        default: return false;
      }
      
    case 'timeLimit':
      // Check if time limit is exceeded
      const currentTime = new Date().getTime();
      const elapsedSeconds = (currentTime - puzzleStartTime) / 1000;
      return elapsedSeconds > condition.seconds;
      
    default:
      console.error(`Unknown condition type: ${condition.type}`);
      return false;
  }
}

// Count reflections grouped by their order/depth
function countReflectionsByOrder() {
  const counts = {};
  
  // Initialize counts for all possible orders
  for (let i = 1; i <= MAX_REFLECTIONS; i++) {
    counts[i] = 0;
  }
  
  // Count visible reflections by their depth
  for (let reflection of reflections) {
    if (isReflectionVisible(reflection)) {
      counts[reflection.depth] = (counts[reflection.depth] || 0) + 1;
    }
  }
  
  return counts;
}

// Function to load the next puzzle in sequence
function loadNextPuzzle() {
  if (!currentPuzzleFilename) return false;
  
  // Check if we have a getNextPuzzleFilename function available
  if (typeof getNextPuzzleFilename !== 'function') {
    console.error("getNextPuzzleFilename function not found");
    return false;
  }
  
  // Get the next puzzle filename
  const nextPuzzleFilename = getNextPuzzleFilename(currentPuzzleFilename);
  
  // If there's no next puzzle, just exit the current one
  if (!nextPuzzleFilename) {
    console.log("No next puzzle available, exiting to menu");
    exitPuzzleMode();
    return false;
  }
  
  // First exit the current puzzle
  exitPuzzleMode();
  
  // Make sure the puzzle controls are visible (not sandbox mode)
  const arrangementControls = document.getElementById('arrangementControls');
  const puzzleControls = document.getElementById('puzzleControls');
  if (arrangementControls && puzzleControls) {
    arrangementControls.style.display = 'none';
    puzzleControls.style.display = 'flex';
    
    // Update the Puzzles/Sandbox button text
    const puzzleBtn = document.getElementById('puzzleBtn');
    if (puzzleBtn) {
      puzzleBtn.textContent = 'Sandbox';
    }
  }
  
  // Update the puzzle select dropdown
  const puzzleSelect = document.getElementById('puzzleSelect');
  if (puzzleSelect) {
    for (let i = 0; i < puzzleSelect.options.length; i++) {
      if (puzzleSelect.options[i].value === nextPuzzleFilename) {
        puzzleSelect.selectedIndex = i;
        console.log(`Updated puzzle selection to ${nextPuzzleFilename}`);
        break;
      }
    }
  }
  
  // Then load the next puzzle after a short delay to ensure proper reset
  setTimeout(() => {
    console.log(`Loading next puzzle: ${nextPuzzleFilename}`);
    loadPuzzle(nextPuzzleFilename);
  }, 100);
  
  return true;
}

// Handle puzzle solved
function puzzleSolved() {
  console.log("Puzzle solved! Setting isPuzzleSolved = true");
  isPuzzleSolved = true;
  
  // Stop the timer if it's running
  if (timeLimitInterval) {
    clearInterval(timeLimitInterval);
    timeLimitInterval = null;
  }
  
  // In path identification mode, keep the current view
  // This retains the user's path for viewing
  
  // Update status in the puzzle panel
  const statusElement = document.getElementById('puzzleStatus');
  if (statusElement) {
    statusElement.innerHTML = `
      <div class="status-success">PUZZLE SOLVED!</div>
      <button id="retryPuzzleBtn">Try Again</button>
    `;
    
    // Set up retry button
    document.getElementById('retryPuzzleBtn').onclick = function() {
      console.log("Retry button clicked, resetting puzzle");
      resetPuzzle();
    };
  }
}

// Handle puzzle failed
function puzzleFailed() {
  console.log("Puzzle failed! Setting isPuzzleFailed = true");
  isPuzzleFailed = true;
  
  // Stop the timer if it's running
  if (timeLimitInterval) {
    clearInterval(timeLimitInterval);
    timeLimitInterval = null;
  }
  
  // In path identification mode, show the correct solution
  if (isPathIdentificationMode) {
    // Set currentRayIndex to highlight the target reflection's ray path
    currentRayIndex = reflections.indexOf(targetReflection);
    
    // Make sure ray paths are shown
    showRayPaths = true;
  }
  
  // Update status in the puzzle panel
  const statusElement = document.getElementById('puzzleStatus');
  if (statusElement) {
    statusElement.innerHTML = `
      <div class="status-failure">PUZZLE FAILED</div>
      <button id="retryPuzzleBtn">Try Again</button>
    `;
    
    // Set up retry button
    document.getElementById('retryPuzzleBtn').onclick = function() {
      console.log("Retry button clicked, resetting puzzle");
      resetPuzzle();
    };
  }
}

// Check if the puzzle has a time limit condition
function hasTimeLimitCondition() {
  if (!currentPuzzle) return false;
  
  // Check single lose condition
  if (currentPuzzle.loseCondition && currentPuzzle.loseCondition.type === 'timeLimit') {
    return true;
  }
  
  // Check multiple lose conditions
  if (currentPuzzle.loseConditions) {
    return currentPuzzle.loseConditions.some(condition => condition.type === 'timeLimit');
  }
  
  return false;
}

// Get the time limit in seconds from puzzle conditions
function getPuzzleTimeLimit() {
  if (!currentPuzzle) return 0;
  
  // Check single lose condition
  if (currentPuzzle.loseCondition && currentPuzzle.loseCondition.type === 'timeLimit') {
    return currentPuzzle.loseCondition.seconds;
  }
  
  // Check multiple lose conditions
  if (currentPuzzle.loseConditions) {
    const timeCondition = currentPuzzle.loseConditions.find(condition => condition.type === 'timeLimit');
    if (timeCondition) {
      return timeCondition.seconds;
    }
  }
  
  return 0;
}

// Start the puzzle timer
function startPuzzleTimer() {
  // Clear any existing interval
  if (timeLimitInterval) {
    clearInterval(timeLimitInterval);
  }
  
  // Get the time limit
  const timeLimit = getPuzzleTimeLimit();
  if (!timeLimit) return;
  
  // Update timer every second
  timeLimitInterval = setInterval(() => {
    // Calculate remaining time
    const currentTime = new Date().getTime();
    const elapsedSeconds = Math.floor((currentTime - puzzleStartTime) / 1000);
    const remainingSeconds = Math.max(0, timeLimit - elapsedSeconds);
    
    // Format the time as MM:SS
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Update the timer display
    const timerElement = document.getElementById('puzzleTimer');
    if (timerElement) {
      timerElement.innerHTML = `Time: ${timeDisplay}`;
      
      // Highlight timer when time is running low (less than 10 seconds)
      if (remainingSeconds < 10) {
        timerElement.classList.add('time-low');
      } else {
        timerElement.classList.remove('time-low');
      }
    }
    
    // Check if time has run out
    if (remainingSeconds === 0) {
      clearInterval(timeLimitInterval);
      
      // If the puzzle isn't already solved or failed, mark it as failed
      if (!isPuzzleSolved && !isPuzzleFailed) {
        puzzleFailed();
      }
    }
  }, 1000);
}

// Make sure we prevent object movement in certain modes
window.canMoveObjects = function() {
  console.log("Checking if objects can be moved...");
  console.log("Current puzzle state: isPuzzleMode =", isPuzzleMode, 
              "isDetectiveMode =", isDetectiveMode, 
              "isPathIdentificationMode =", isPathIdentificationMode,
              "isPuzzleSolved =", isPuzzleSolved, 
              "isPuzzleFailed =", isPuzzleFailed);

  // In detective or path identification mode, never allow movement
  if (isDetectiveMode) {
    console.log("Detective mode - cannot move objects");
    return false;
  }
  
  if (isPathIdentificationMode) {
    console.log("Path identification mode - cannot move objects");
    return false;
  }
  
  // In standard puzzle mode, check movable settings
  if (isPuzzleMode) {
    // For presentation mode or generation puzzles, allow movement
    if (currentPuzzle && (currentPuzzle.type === "presentation" || currentPuzzle.type === "generation")) {
      // But only if the puzzle isn't solved or failed
      if (isPuzzleSolved || isPuzzleFailed) {
        console.log("Puzzle solved/failed - cannot move objects");
        return false;
      }
      console.log("Presentation/generation mode - objects are movable");
      return true;
    }
    
    // Check if the puzzle has been solved or failed
    if (isPuzzleSolved || isPuzzleFailed) {
      console.log("Puzzle solved/failed - cannot move objects");
      return false;
    }
    
    // Check which objects can be moved
    if (currentPuzzle) {
      // Handle both the old format and the new array format
      const movableObjects = currentPuzzle.movableObjects;
      
      // If undefined or null, nothing is movable
      if (!movableObjects) {
        console.log("No movable objects specified in puzzle");
        return false;
      }
      
      // If it's an array (new format), check if the object is in the array
      if (Array.isArray(movableObjects)) {
        // Return true only if there are movable objects
        const hasMovableObjects = movableObjects.length > 0;
        console.log("Array format movable objects:", hasMovableObjects ? movableObjects.join(", ") : "none");
        return hasMovableObjects;
      }
      
      // Otherwise it's the old object format with properties
      console.log("Object format movable objects:", 
                 (movableObjects.mirrors ? "mirrors " : "") +
                 (movableObjects.ball ? "ball " : "") +
                 (movableObjects.eye ? "eye" : ""));
      return movableObjects.mirrors || movableObjects.ball || movableObjects.eye;
    }
    
    console.log("No puzzle or movable objects configuration");
    return false;
  }
  
  // In sandbox mode (default), everything is movable
  console.log("Sandbox mode - objects are movable");
  return true;
};

// Helper function to check if a specific object is movable
window.isObjectMovable = function(objectType) {
  if (!isPuzzleMode || !currentPuzzle) {
    // In sandbox mode, everything is movable
    console.log(`${objectType} is movable - sandbox mode`);
    return true;
  }
  
  // In detective or path identification mode, never allow movement
  if (isDetectiveMode || isPathIdentificationMode) {
    console.log(`${objectType} is not movable - in detective or path identification mode`);
    return false;
  }
  
  // If puzzle is solved or failed, nothing is movable
  if (isPuzzleSolved || isPuzzleFailed) {
    console.log(`${objectType} is not movable - puzzle solved/failed`);
    return false;
  }
  
  // Check if the puzzle has movable objects defined
  const movableObjects = currentPuzzle.movableObjects;
  console.log(`Checking if ${objectType} is movable. Current movableObjects:`, JSON.stringify(movableObjects));
  
  // If undefined or null, nothing is movable
  if (!movableObjects) {
    console.log(`${objectType} is not movable - no movableObjects defined`);
    return false;
  }
  
  // If it's an array (new format), check if the object is in the array
  if (Array.isArray(movableObjects)) {
    // Convert objectType for checking in the array
    let checkType = objectType;
    
    // Convert from singular to plural for mirrors
    if (objectType === 'mirror') {
      checkType = 'mirrors';
    }
    
    const isMovable = movableObjects.includes(checkType);
    console.log(`Checking if ${objectType} (as "${checkType}") is movable in array:`, movableObjects, " Result:", isMovable);
    return isMovable;
  }
  
  // Otherwise it's the old object format
  let isMovable = false;
  switch (objectType) {
    case 'ball':
      isMovable = Boolean(movableObjects.ball);
      console.log(`Ball movable check (object format):", ${isMovable}`);
      return isMovable;
    case 'eye':
      isMovable = Boolean(movableObjects.eye);
      console.log(`Eye movable check (object format):", ${isMovable}`);
      return isMovable;
    case 'mirror':
      isMovable = Boolean(movableObjects.mirrors);
      console.log(`Mirror movable check (object format):", ${isMovable}`);
      return isMovable;
    default:
      console.log(`Unknown object type: ${objectType}`);
      return false;
  }
};

// Setup for path identification puzzle
function setupPathIdentificationPuzzle() {
  console.log("Setting up path identification puzzle");
  
  isPathIdentificationMode = true;
  userPath = [];
  userRayPath = null;
  
  // Calculate reflections first to ensure they're available
  calculateReflections();
  
  // Check if there are any reflections available
  if (!reflections || reflections.length === 0) {
    console.error("No reflections available for path identification puzzle");
    const statusElement = document.getElementById('puzzleStatus');
    if (statusElement) {
      statusElement.innerHTML = `
        <div class="status-error">ERROR: No reflections available</div>
        <div>Try adding mirrors or moving objects to create reflections.</div>
      `;
    }
    return;
  }
  
  // Get the target reflection
  let targetIndex;
  
  // Check if we should use a random target
  if (currentPuzzle.randomTarget === true) {
    // Filter out reflections that would make good targets
    // We prefer reflections that have a properly formed parent chain
    const validCandidates = [];
    
    for (let i = 0; i < reflections.length; i++) {
      // Skip first-order reflections if possible (they're too easy)
      if (reflections.length > 2 && reflections[i].depth === 1) {
        continue;
      }
      
      // Check if this reflection has a complete parent chain
      let current = reflections[i];
      let valid = true;
      let safety = 0;
      
      // For higher-order reflections, verify parent chain is complete
      if (current.depth > 1) {
        while (current.parentReflection && current.depth > 1 && safety < 10) {
          current = current.parentReflection;
          safety++;
          
          if (!current || !current.depth) {
            valid = false;
            break;
          }
        }
      }
      
      if (valid) {
        validCandidates.push(i);
      }
    }
    
    // If we have valid candidates, select from them
    if (validCandidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * validCandidates.length);
      targetIndex = validCandidates[randomIndex];
      console.log("Selected random target index", targetIndex, "from", validCandidates.length, "valid candidates");
    } else {
      // Fallback: just pick any reflection
      targetIndex = Math.floor(Math.random() * reflections.length);
      console.log("No ideal candidates, using fallback random reflection index:", targetIndex);
    }
  } else {
    // Use the specifically defined target index
    targetIndex = currentPuzzle.targetReflectionIndex;
    console.log("Using specified target index:", targetIndex);
  }
  
  // Validate and set the target reflection
  if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < reflections.length) {
    targetReflection = reflections[targetIndex];
    
    // Build the expected path
    expectedPath = buildPathFromReflection(targetReflection);
    
    console.log("Path identification puzzle setup with target reflection:", targetIndex);
    console.log("Expected path has", expectedPath.length, "steps");
    
    // Only set default ray visibility if not explicitly set in the puzzle config
    if (currentPuzzle.showRaysStart === undefined) {
      console.log("No showRaysStart specified, defaulting to showing rays for path identification");
      showRayPaths = true;
      
      // Update the button text
      const toggleBtn = document.getElementById('togglePaths');
      if (toggleBtn) {
        toggleBtn.textContent = showRayPaths ? "Hide Rays" : "Show Rays";
      }
    }
    
    // Set to -1 (not showing any reflection's full path, just our custom drawing)
    currentRayIndex = -1;
    
    // Update instructions to show specific info for first-order reflections
    if (targetReflection.depth === 1) {
      console.log("First-order reflection target, user should click directly on the ball");
      
      const statusElement = document.getElementById('puzzleStatus');
      if (statusElement) {
        statusElement.innerHTML = `
          <div>This is a first-order reflection.</div>
          <div>Click directly on the blue ball to solve.</div>
        `;
      }
    }
  } else {
    console.error("Invalid target reflection index:", targetIndex);
    console.log("Available reflections:", reflections.length);
    
    // Show error message in the puzzle status
    const statusElement = document.getElementById('puzzleStatus');
    if (statusElement) {
      statusElement.innerHTML = `
        <div class="status-error">ERROR: Invalid reflection target</div>
        <div>The target reflection index (${targetIndex}) is invalid.</div>
        <div>Try resetting the puzzle or selecting a different puzzle.</div>
      `;
    }
  }
}

// Build the path from a reflection back to the ball
function buildPathFromReflection(reflection) {
  console.log("===== BUILDING PATH FROM REFLECTION =====");
  console.log("Target reflection:", {
    depth: reflection.depth,
    position: `(${reflection.x.toFixed(0)}, ${reflection.y.toFixed(0)})`,
    hasParent: !!reflection.parentReflection
  });
  
  // Start with the target reflection
  const path = [reflection];
  console.log("Path initialized with target reflection");
  
  // Add all reflections in the chain from the target to the ball
  let current = reflection;
  
  // For first-order reflections, add only the ball
  if (reflection.depth === 1) {
    path.push({x: ball.x, y: ball.y, type: 'ball'});
    console.log("First-order reflection path: Added ball directly");
    console.log("Final path:", path.map((obj, i) => {
      if (obj.type === 'ball') return `${i}: ball`;
      return `${i}: reflection depth ${obj.depth || 'unknown'} at (${obj.x.toFixed(0)}, ${obj.y.toFixed(0)})`;
    }));
    return path;
  }
  
  // For higher-order reflections, add all parent reflections
  // This MUST work even if parentReflection property isn't explicitly set
  let pathComplete = false;
  let safety = 0; // Safety counter to prevent infinite loops
  
  console.log("Attempting to build path using parentReflection chain...");
  
  while (current.parentReflection && safety < 10) {
    console.log(`Adding parent reflection at depth: ${current.parentReflection.depth} - position: (${current.parentReflection.x.toFixed(0)}, ${current.parentReflection.y.toFixed(0)})`);
    path.push(current.parentReflection);
    current = current.parentReflection;
    safety++;
    
    // If we've reached the ball or a first-order reflection, the path is complete
    if (current.depth === 1) {
      pathComplete = true;
      console.log("Reached depth 1 reflection - parent chain complete");
      break;
    }
  }
  
  if (safety >= 10) {
    console.log("WARNING: Safety limit reached when following parent chain");
  }
  
  // If we couldn't build a complete chain using parentReflection,
  // try to find the path by checking reflections based on depth
  if (!pathComplete && reflection.depth > 1) {
    console.log("Parent chain broken - attempting to rebuild based on depth");
    
    // Clear existing path except for the target
    path.length = 1;
    console.log("Reset path to just target reflection");
    
    // Look for reflections with decreasing depth
    for (let depth = reflection.depth - 1; depth >= 1; depth--) {
      console.log(`Searching for reflection with depth ${depth}`);
      // Find a reflection with this depth
      let foundReflection = null;
      
      for (let i = 0; i < reflections.length; i++) {
        if (reflections[i].depth === depth) {
          foundReflection = reflections[i];
          console.log(`Found reflection at depth ${depth} - position: (${foundReflection.x.toFixed(0)}, ${foundReflection.y.toFixed(0)})`);
          break;
        }
      }
      
      if (foundReflection) {
        path.push(foundReflection);
        console.log(`Added reflection with depth ${depth} to path`);
      } else {
        console.log(`WARNING: Missing reflection at depth ${depth}`);
      }
    }
  }
  
  // Add the ball as the last step
  path.push({x: ball.x, y: ball.y, type: 'ball'});
  console.log("Added ball to complete the path");
  
  console.log("Final path constructed with", path.length, "steps:");
  console.log(path.map((obj, i) => {
    if (obj.type === 'ball') return `${i}: ball`;
    return `${i}: reflection depth ${obj.depth || 'unknown'} at (${obj.x.toFixed(0)}, ${obj.y.toFixed(0)})`;
  }));
  
  return path;
}

// Function to add point to user path (in path identification puzzles)
function addPointToUserPath(x, y) {
  console.log("===== CLICK IN PATH IDENTIFICATION =====");
  console.log("Click at position:", x, y);
  console.log("isPathIdentificationMode:", isPathIdentificationMode);
  console.log("isPuzzleSolved:", isPuzzleSolved);
  console.log("isPuzzleFailed:", isPuzzleFailed);
  
  if (!isPathIdentificationMode || isPuzzleSolved || isPuzzleFailed) {
    console.log("Early return - not in path ID mode or puzzle already solved/failed");
    return;
  }
  
  // Find what the user clicked on
  let clickedObject = null;
  
  // First check if they clicked the ball
  if (dist(x, y, ball.x, ball.y) <= ball.radius) {
    console.log("Ball clicked in addPointToUserPath");
    clickedObject = {x: ball.x, y: ball.y, type: 'ball'};
    
    // If they clicked the ball, always process it (regardless of path state)
    // Add ball to path
    userPath.push(clickedObject);
    
    // Update the ray path visualization
    addLineToUserPath(clickedObject);
    
    // Check if the entire path is correct
    if (isPathCorrect()) {
      puzzleSolved();
    } else {
      puzzleFailed();
    }
    
    return;
  } 
  
  console.log("Total reflections:", reflections.length);
  
  // Check if they clicked on a reflection - IMPORTANT: Allow clicking ANY virtual image in path identification
  for (let i = 0; i < reflections.length; i++) {
    // Skip the target reflection - can't click on that again
    if (reflections[i] === targetReflection) {
      console.log("Skipping target reflection at index:", i);
      continue;
    }
    
    const reflection = reflections[i];
    const distance = dist(x, y, reflection.x, reflection.y);
    const isWithinRadius = distance <= reflection.radius;
    
    console.log("Reflection", i, ":", {
      x: reflection.x, 
      y: reflection.y,
      depth: reflection.depth,
      distance: distance,
      isWithinRadius: isWithinRadius,
      hasParent: !!reflection.parentReflection
    });
    
    // In path identification mode, ANY reflection should be clickable regardless of visibility
    if (isWithinRadius) {
      console.log("CLICKED on reflection", i);
      clickedObject = reflection;
      break;
    }
  }
  
  // Only proceed if they clicked something valid
  if (clickedObject && clickedObject !== targetReflection) {
    console.log("Processing valid click on:", clickedObject.type || "reflection", "at", clickedObject.x, clickedObject.y);
    
    // Add to user path
    userPath.push(clickedObject);
    console.log("User path updated, now contains", userPath.length, "objects");
    
    // Update the ray path visualization with the new object
    addLineToUserPath(clickedObject);
    
    // Update UI to show progress
    updatePathProgress();
  } else {
    console.log("No valid object clicked at", x, y);
  }
}

// Add a line from the last hit point to the clicked object
function addLineToUserPath(clickedObject) {
  console.log("===== ADD LINE TO USER PATH =====");
  console.log("Adding object to path:", clickedObject);
  console.log("Object type:", clickedObject.type || "reflection");
  console.log("Object position:", clickedObject.x, clickedObject.y);
  if (clickedObject.depth) console.log("Object depth:", clickedObject.depth);
  
  // Make sure we have a userRayPath object
  if (!userRayPath) {
    console.log("Creating new userRayPath with target reflection:", targetReflection);
    
    // Initialize with the target reflection and its hit points
    userRayPath = {
      reflections: [targetReflection],
      hitPoints: []
    };
    
    // Copy the existing hit points from target reflection
    if (targetReflection && targetReflection.hitPoints) {
      userRayPath.hitPoints = [...targetReflection.hitPoints];
      console.log("Copied hit points from target reflection:", userRayPath.hitPoints.length);
    } else {
      console.log("Target reflection has no hit points");
    }
  } else {
    console.log("Existing userRayPath found with", userRayPath.reflections.length, "reflections");
  }
  
  // Add the clicked object to reflections if it's not already there
  if (!userRayPath.reflections.includes(clickedObject)) {
    userRayPath.reflections.push(clickedObject);
    console.log("Added clicked object to userRayPath reflections - now contains", 
                userRayPath.reflections.length, "reflections");
  } else {
    console.log("Object already in userRayPath reflections");
  }
  
  console.log("Current userRayPath:", {
    reflectionsCount: userRayPath.reflections.length,
    hitPointsCount: userRayPath.hitPoints ? userRayPath.hitPoints.length : 0
  });
}

// Check if the entire user path is correct
function isPathCorrect() {
  console.log("===== CHECKING PATH CORRECTNESS =====");
  console.log("User path length:", userPath.length);
  console.log("Expected path length:", expectedPath.length);
  
  // Log both paths for comparison
  console.log("USER PATH:", userPath.map((obj, i) => {
    if (obj.type === 'ball') return `${i}: ball`;
    return `${i}: reflection depth ${obj.depth || 'unknown'} at (${obj.x.toFixed(0)}, ${obj.y.toFixed(0)})`;
  }));
  
  console.log("EXPECTED PATH:", expectedPath.map((obj, i) => {
    if (obj.type === 'ball') return `${i}: ball`;
    return `${i}: reflection depth ${obj.depth || 'unknown'} at (${obj.x.toFixed(0)}, ${obj.y.toFixed(0)})`;
  }));
  
  // Need at least the ball for first-order reflections
  if (userPath.length < 1) {
    console.log("FAIL: Path is empty");
    return false;
  }
  
  // Last element must be the ball
  if (userPath[userPath.length - 1].type !== 'ball') {
    console.log("FAIL: Last element is not the ball");
    return false;
  }
  
  // Special case for first-order reflections: if they clicked directly on the ball, it's correct
  if (targetReflection.depth === 1 && userPath.length === 1 && userPath[0].type === 'ball') {
    console.log("SUCCESS: First-order reflection with direct ball click");
    return true;
  }
  
  // If the ball is clicked too early (before collecting all expected reflections)
  // then the path is incorrect
  if (userPath.length < expectedPath.length - 1) {
    console.log("FAIL: Path is too short - expected", expectedPath.length - 1, "but got", userPath.length);
    return false;
  }
  
  // Check if the user's collected reflections match the expected path
  // Skip checking the ball which we already verified above
  const userReflections = userPath.slice(0, -1); // Remove the ball
  const expectedReflections = expectedPath.slice(1, -1); // Remove target and ball
  
  console.log("Comparing user reflections:", userReflections.length, "with expected reflections:", expectedReflections.length);
  
  if (userReflections.length !== expectedReflections.length) {
    console.log("FAIL: Reflection count mismatch");
    return false;
  }
  
  // Compare each reflection in the path (except the target)
  for (let i = 0; i < userReflections.length; i++) {
    const userObj = userReflections[i];
    const expectedObj = expectedReflections[i];
    
    console.log(`Comparing reflection at position ${i}:`);
    console.log(`  User: ${userObj.depth || 'unknown'} at (${userObj.x.toFixed(0)}, ${userObj.y.toFixed(0)})`);
    console.log(`  Expected: ${expectedObj.depth || 'unknown'} at (${expectedObj.x.toFixed(0)}, ${expectedObj.y.toFixed(0)})`);
    console.log(`  Match: ${userObj === expectedObj ? 'YES' : 'NO'}`);
    
    if (userObj !== expectedObj) {
      console.log("FAIL: Reflection mismatch at position", i);
      return false;
    }
  }
  
  console.log("SUCCESS: Path is correct!");
  return true;
}

// Update the path progress display
function updatePathProgress() {
  const statusElement = document.getElementById('puzzleStatus');
  if (statusElement && isPathIdentificationMode) {
    // For first-order reflections, show simpler instructions
    if (targetReflection && targetReflection.depth === 1) {
      statusElement.innerHTML = `
        <div>This is a first-order reflection.</div>
        <div>Click directly on the blue ball to solve.</div>
      `;
      return;
    }
    
    // Regular progress for higher-order reflections
    const stepsComplete = userPath.length;
    const stepsTotal = expectedPath ? expectedPath.length - 1 : 3; // -1 because we don't count the target
    
    statusElement.innerHTML = `
      <div>Progress: ${stepsComplete} / ${stepsTotal} steps</div>
      <div>Click the reflections in order, or click the ball at any time to finish.</div>
      <div><em>The correct path connects all parent reflections back to the ball.</em></div>
    `;
  }
}

// Draw additional elements for path identification
function drawPathIdentification() {
  if (!isPathIdentificationMode || !targetReflection) return;
  
  // Get color based on reflection depth
  const colorIndex = Math.min(targetReflection.depth, REFLECTION_COLORS.length - 1);
  let strokeColor = REFLECTION_COLORS[colorIndex];
  
  // STEP 1: Always draw the initial line from eye to first hit point and dashed to target
  if (targetReflection.hitPoints && targetReflection.hitPoints.length > 0) {
    // Get the hit point closest to the eye (last in the array)
    const hitPoint = targetReflection.hitPoints[targetReflection.hitPoints.length - 1];
    
    // Solid line from eye to hit point
    stroke(strokeColor);
    strokeWeight(3);
    line(eyePosition.x, eyePosition.y, hitPoint.x, hitPoint.y);
    
    // Dashed line from hit point to target reflection
    drawDashedLine(
      hitPoint.x, hitPoint.y,
      targetReflection.x, targetReflection.y,
      strokeColor, 5, 5
    );
    
    // White dot at hit point
    fill(255);
    noStroke();
    ellipse(hitPoint.x, hitPoint.y, 8, 8);
  }
  
  // STEP 2: Only draw user's additional paths if they exist
  if (userPath.length === 0) return;
  
  // Start from the target reflection's hit point (if available)
  let lastHitPoint;
  let lastMirror;
  
  if (targetReflection.hitPoints && targetReflection.hitPoints.length > 0) {
    lastHitPoint = targetReflection.hitPoints[targetReflection.hitPoints.length - 1];
    // Get the mirror that created this hit point
    lastMirror = targetReflection.sourceMirror;
  } else {
    // Fallback if we don't have hit points
    lastHitPoint = targetReflection;
    lastMirror = null;
  }
  
  // For each reflection in the user's path
  for (let i = 0; i < userPath.length; i++) {
    const currentReflection = userPath[i];
    
    // Find if there's a mirror in between lastHitPoint and currentReflection
    let closestMirror = null;
    let closestHitPoint = null;
    let closestDistance = Infinity;
    
    for (const mirror of mirrors) {
      // Skip the mirror that created the last hit point
      if (mirror === lastMirror) continue;
      
      const intersection = lineIntersection(
        lastHitPoint.x, lastHitPoint.y,
        currentReflection.x, currentReflection.y,
        mirror.x1, mirror.y1,
        mirror.x2, mirror.y2
      );
      
      if (intersection) {
        // Found an intersection - calculate distance to determine closest
        const distance = dist(lastHitPoint.x, lastHitPoint.y, intersection.x, intersection.y);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestMirror = mirror;
          closestHitPoint = intersection;
        }
      }
    }
    
    if (closestHitPoint) {
      // We found a mirror intersection - draw solid line to hit point
      stroke(strokeColor);
      strokeWeight(3);
      line(lastHitPoint.x, lastHitPoint.y, closestHitPoint.x, closestHitPoint.y);
      
      // Draw dashed line from hit point to the reflection
      drawDashedLine(
        closestHitPoint.x, closestHitPoint.y,
        currentReflection.x, currentReflection.y,
        strokeColor, 5, 5
      );
      
      // Draw white dot at hit point
      fill(255);
      noStroke();
      ellipse(closestHitPoint.x, closestHitPoint.y, 8, 8);
      
      // Update lastHitPoint and lastMirror for next iteration
      lastHitPoint = closestHitPoint;
      lastMirror = closestMirror;
    } else {
      // No mirror in between - draw solid line directly
      stroke(strokeColor);
      strokeWeight(3);
      line(lastHitPoint.x, lastHitPoint.y, currentReflection.x, currentReflection.y);
      
      // Update last point
      lastHitPoint = currentReflection;
      lastMirror = null;
    }
  }
}

// Draw the user's path for the puzzle
function drawPuzzleUserPath() {
  if (!userRayPath || !userRayPath.reflections || userRayPath.reflections.length === 0) return;
  
  const currentReflection = userRayPath.reflections[0]; // Target reflection
  
  // Get color based on reflection depth
  const colorIndex = Math.min(currentReflection.depth, REFLECTION_COLORS.length - 1);
  let strokeColor = REFLECTION_COLORS[colorIndex];
  
  // Prepare stroke settings
  stroke(strokeColor);
  strokeWeight(3);
  noFill();
  
  // Draw connection from target to eye using existing hit points
  drawUserTargetToEye(userRayPath, strokeColor);
  
  // Draw the user's selected path (if any)
  if (userRayPath.reflections.length > 1) {
    drawUserSelectionsPath(userRayPath, strokeColor);
  }
  
  // Display information
  fill(0);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(16);
  text("Path Identification Mode", 20, 20);
}

// Draw the target reflection's path to the eye
function drawUserTargetToEye(userRayPath, strokeColor) {
  const targetReflection = userRayPath.reflections[0];
  
  // If the target reflection has hit points, use them
  if (targetReflection.hitPoints && targetReflection.hitPoints.length > 0) {
    // Draw line from last hit point (closest to eye) to eye
    const lastHitPoint = targetReflection.hitPoints[targetReflection.hitPoints.length - 1];
    line(lastHitPoint.x, lastHitPoint.y, eye.x, eye.y);
    
    // Draw dashed line from last hit point to target reflection
    drawDashedLine(
      lastHitPoint.x, lastHitPoint.y,
      targetReflection.x, targetReflection.y,
      strokeColor, 5, 5
    );
    
    // Connect all hit points with solid lines
    for (let i = 0; i < targetReflection.hitPoints.length - 1; i++) {
      const current = targetReflection.hitPoints[i];
      const next = targetReflection.hitPoints[i + 1];
      line(current.x, current.y, next.x, next.y);
    }
    
    // Draw line from first hit point (closest to ball) to ball
    const firstHitPoint = targetReflection.hitPoints[0];
    line(ball.x, ball.y, firstHitPoint.x, firstHitPoint.y);
    
    // Draw white dots at all hit points
    fill(255);
    noStroke();
    for (const hitPoint of targetReflection.hitPoints) {
      ellipse(hitPoint.x, hitPoint.y, 8, 8);
    }
  }
}

// Draw the user's selected path of reflections
function drawUserSelectionsPath(userRayPath, strokeColor) {
  const reflections = userRayPath.reflections;
  
  // Draw lines connecting the reflections the user has selected
  for (let i = 1; i < reflections.length; i++) {
    const current = reflections[i-1];
    const next = reflections[i];
    
    // Draw solid line between reflections
    stroke(strokeColor);
    strokeWeight(3);
    line(current.x, current.y, next.x, next.y);
  }
}

// Draw the solution path for the current reflection
function drawPuzzleSolutionPath() {
  if (currentRayIndex < 0 || currentRayIndex >= reflections.length) return;
  
  const reflection = reflections[currentRayIndex];
  if (!reflection || !reflection.hitPoints || reflection.hitPoints.length === 0) return;
  
  // Get color based on reflection depth
  const colorIndex = Math.min(reflection.depth, REFLECTION_COLORS.length - 1);
  let strokeColor = REFLECTION_COLORS[colorIndex];
  
  // Prepare stroke settings
  stroke(strokeColor);
  strokeWeight(3);
  noFill();
  
  // Draw line from ball to first hit point
  line(ball.x, ball.y, reflection.hitPoints[0].x, reflection.hitPoints[0].y);
  
  // Connect all hit points with solid lines
  for (let i = 0; i < reflection.hitPoints.length - 1; i++) {
    const current = reflection.hitPoints[i];
    const next = reflection.hitPoints[i + 1];
    line(current.x, current.y, next.x, next.y);
  }
  
  // Draw line from last hit point to eye
  const lastHitPoint = reflection.hitPoints[reflection.hitPoints.length - 1];
  line(lastHitPoint.x, lastHitPoint.y, eye.x, eye.y);
  
  // Draw dashed lines from hit points to virtual images
  for (let i = 0; i < reflection.hitPoints.length; i++) {
    const hitPoint = reflection.hitPoints[i];
    
    // Use the stored virtual image if available
    if (hitPoint.virtualImage) {
      drawDashedLine(
        hitPoint.x, hitPoint.y,
        hitPoint.virtualImage.x, hitPoint.virtualImage.y,
        strokeColor, 5, 5
      );
    }
    // Fallback for first-order reflections
    else if (reflection.depth === 1 && i === 0) {
      drawDashedLine(
        hitPoint.x, hitPoint.y,
        reflection.x, reflection.y,
        strokeColor, 5, 5
      );
    }
  }
  
  // Draw white dots at all hit points
  fill(255);
  noStroke();
  for (const hitPoint of reflection.hitPoints) {
    ellipse(hitPoint.x, hitPoint.y, 8, 8);
  }
}

// Dashed line utility function (copy from light-detective.js to avoid dependency)
function drawDashedLine(x1, y1, x2, y2, strokeColor, dashLength, gapLength) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const dashCount = Math.floor(distance / (dashLength + gapLength));
  const unitX = dx / distance;
  const unitY = dy / distance;
  
  stroke(strokeColor);
  
  let currX = x1;
  let currY = y1;
  
  for (let i = 0; i < dashCount; i++) {
    const nextX = currX + unitX * dashLength;
    const nextY = currY + unitY * dashLength;
    
    line(currX, currY, nextX, nextY);
    
    currX = nextX + unitX * gapLength;
    currY = nextY + unitY * gapLength;
  }
  
  // Draw the remaining dash if any
  if (currX < x2) {
    line(currX, currY, x2, y2);
  }
}

// Draw detective mode overlay to ensure markings are on top
window.drawDetectiveOverlay = function() {
  // Skip if not in detective mode
  if (!isDetectiveMode) return;
  
  // Basic p5.js drawing for the red X
  for (let i = 0; i < markedAsBad.length; i++) {
    let index = markedAsBad[i];
    if (index >= 0 && index < reflections.length) {
      // Get the reflection
      const refl = reflections[index];
      
      // Draw a properly sized red X
      push();
      stroke(255, 0, 0);
      strokeWeight(6); // still thick enough to be visible
      
      // Use a more reasonable size - just a bit larger than the reflection
      const size = refl.radius * 2;
      
      // Draw X
      line(refl.x - size/2, refl.y - size/2, refl.x + size/2, refl.y + size/2);
      line(refl.x + size/2, refl.y - size/2, refl.x - size/2, refl.y + size/2);
      pop();
    }
  }
};

// This function should be called at the END of the draw function in light-detective.js
function drawPuzzleOverlay() {
  // Only draw puzzle overlay if we're in puzzle mode
  if (isPuzzleMode) {
    // Check puzzle conditions
    checkPuzzleConditions();
    
    // Draw path identification elements if in that mode
    if (isPathIdentificationMode) {
      // Always draw our custom lines, no matter what
      drawPathIdentification();
      
      // Tell the main game to skip drawing ray paths - we're doing it ourselves
      return { skipRayPaths: true };
    }
    // For detective mode, don't skip ray paths
    else if (isDetectiveMode) {
      // Don't draw detective overlay here - we'll do it separately
      // at the very end of the draw cycle
      return { skipRayPaths: false };
    }
  }
  
  // No special handling needed
  return { skipRayPaths: false };
}

// Modified mousePressed handler that should be called from light-detective.js
function handlePuzzleMousePressed() {
  console.log("===== HANDLE PUZZLE MOUSE PRESSED =====");
  console.log("Mouse position:", mouseX, mouseY);
  console.log("isPuzzleMode:", isPuzzleMode);
  console.log("isPathIdentificationMode:", isPathIdentificationMode);
  console.log("isDetectiveMode:", isDetectiveMode);
  console.log("isPuzzleSolved:", isPuzzleSolved);
  console.log("isPuzzleFailed:", isPuzzleFailed);
  
  if (isPuzzleMode) {
    // Handle path identification clicks
    if (isPathIdentificationMode && !isPuzzleSolved && !isPuzzleFailed) {
      console.log("Passing click to addPointToUserPath");
      addPointToUserPath(mouseX, mouseY);
      return true;
    }
    
    // Handle detective mode clicks
    if (isDetectiveMode && !isPuzzleSolved && !isPuzzleFailed) {
      console.log("In detective mode - deferring to double-click handler");
      // For now, just return false - we'll use double-clicks for detective mode
      return false;
    }
  }
  
  console.log("Click not handled by puzzle system");
  return false; // Not handled by puzzle system
}

// Handle double click events for detective mode
window.handlePuzzleDoubleClick = function() {
  if (isPuzzleMode && isDetectiveMode && !isPuzzleSolved && !isPuzzleFailed) {
    // Check if we clicked on a reflection
    for (let i = 0; i < reflections.length; i++) {
      const refl = reflections[i];
      const dist = Math.sqrt(
        (mouseX - refl.x) * (mouseX - refl.x) + 
        (mouseY - refl.y) * (mouseY - refl.y)
      );
      
      if (dist <= refl.radius) {
        console.log("Double-clicked on reflection " + i);
        
        // Toggle marking
        const idx = markedAsBad.indexOf(i);
        if (idx === -1) {
          // Mark it
          markedAsBad.push(i);
          console.log("Marked reflection " + i + " as bad");
        } else {
          // Unmark it
          markedAsBad.splice(idx, 1);
          console.log("Unmarked reflection " + i);
        }
        
        // Force redraw
        redraw();
        return true;
      }
    }
  }
  return false;
};

// Helper functions for path identification puzzles

// Find the intersection point of two line segments
function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
  // Calculate determinants
  const det = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  
  // Lines are parallel or coincident
  if (Math.abs(det) < 0.0001) return null;
  
  // Calculate intersection point
  const x = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / det;
  const y = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / det;
  
  // Check if the intersection point is on both line segments
  if (x < Math.min(x1, x2) - 0.0001 || x > Math.max(x1, x2) + 0.0001 ||
      x < Math.min(x3, x4) - 0.0001 || x > Math.max(x3, x4) + 0.0001 ||
      y < Math.min(y1, y2) - 0.0001 || y > Math.max(y1, y2) + 0.0001 ||
      y < Math.min(y3, y4) - 0.0001 || y > Math.max(y3, y4) + 0.0001) {
    return null;
  }
  
  return { x, y };
}

// Setup for presentation mode
function setupPresentationMode() {
  console.log("Setting up presentation mode");
  
  // Presentation mode functions like sandbox but with puzzle UI
  // Enable free movement of objects
  enableFreeMovement();
  
  // If rays should be shown at start, make sure to set currentRayIndex to display the first reflection
  if (showRayPaths && reflections.length > 0) {
    console.log("Setting currentRayIndex to 0 because showRaysStart is true");
    currentRayIndex = 0;
  }
  
  // Add event listener for the Next Puzzle button
  setTimeout(() => {
    const nextBtn = document.getElementById('nextPuzzleBtn');
    if (nextBtn) {
      console.log("Setting up Next Puzzle button");
      nextBtn.addEventListener('click', loadNextPuzzle);
    }
  }, 100); // Small delay to ensure element exists
}

// Function to enable free movement of all objects
function enableFreeMovement() {
  // Set appropriate flags to allow objects to be moved freely
  if (currentPuzzle) {
    console.log("In enableFreeMovement - Initial movableObjects:", JSON.stringify(currentPuzzle.movableObjects));
    
    // For generation puzzles with array-style movable objects, respect the existing settings
    if (currentPuzzle.type === "generation" && Array.isArray(currentPuzzle.movableObjects)) {
      console.log("Generation puzzle with specific movable objects - preserving:", currentPuzzle.movableObjects);
      // Preserve the array-style configuration, don't override
      return;
    }
    
    // Create movableObjects if it doesn't exist
    if (!currentPuzzle.movableObjects) {
      currentPuzzle.movableObjects = {};
    }
    
    // Only for non-generation puzzles or those without array-style movable objects
    // Override with all objects movable (old-style object format)
    const oldMovableObjects = currentPuzzle.movableObjects;
    currentPuzzle.movableObjects = {
      mirrors: true,
      ball: true,
      eye: true
    };
    
    console.log("Updated movableObjects from", JSON.stringify(oldMovableObjects), "to", JSON.stringify(currentPuzzle.movableObjects));
  }
}

// Function to disable buttons for path identification mode
function disableButtonsForPathIdentification() {
  // Disable the Show Rays button
  const togglePathsBtn = document.getElementById('togglePaths');
  if (togglePathsBtn) {
    togglePathsBtn.disabled = true;
    togglePathsBtn.classList.add('disabled-button');
  }
  
  // Disable the Add Mirror button
  const addMirrorBtn = document.getElementById('addMirror');
  if (addMirrorBtn) {
    addMirrorBtn.disabled = true;
    addMirrorBtn.classList.add('disabled-button');
  }
  
  // Disable the Export button
  const exportBtn = document.getElementById('exportArrangement');
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.classList.add('disabled-button');
  }
}

// Function to re-enable all buttons
function enableAllButtons() {
  // Re-enable the Show Rays button
  const togglePathsBtn = document.getElementById('togglePaths');
  if (togglePathsBtn) {
    togglePathsBtn.disabled = false;
    togglePathsBtn.classList.remove('disabled-button');
  }
  
  // Re-enable the Add Mirror button
  const addMirrorBtn = document.getElementById('addMirror');
  if (addMirrorBtn) {
    addMirrorBtn.disabled = false;
    addMirrorBtn.classList.remove('disabled-button');
  }
  
  // Re-enable the Export button
  const exportBtn = document.getElementById('exportArrangement');
  if (exportBtn) {
    exportBtn.disabled = false;
    exportBtn.classList.remove('disabled-button');
  }
}

// Function to update the Show/Hide Rays button text based on current state
function updateRayButtonText() {
  const togglePathsBtn = document.getElementById('togglePaths');
  if (togglePathsBtn) {
    togglePathsBtn.textContent = showRayPaths ? 'Hide Rays' : 'Show Rays';
  }
}

// Reset puzzle-specific variables
function resetPuzzleVariables() {
  targetReflection = null;
  userPath = [];
  expectedPath = [];
  isPathIdentificationMode = false;
  if (pathHighlightTimeout) {
    clearTimeout(pathHighlightTimeout);
    pathHighlightTimeout = null;
  }
  userRayPath = null;
  
  // Reset detective mode variables
  isDetectiveMode = false;
  badReflections = [];
  originalPositions = [];
  markedAsBad = [];
  currentUserPath = [];
}

// Helper function for safely calling redraw
function safeRedraw() {
  // Check if p5.js redraw function exists and use it
  if (typeof redraw === 'function') {
    redraw();
  } else {
    console.warn("redraw function not available - this may be normal during initialization");
  }
}

// Setup detective puzzle
function setupDetectivePuzzle() {
  console.log("Setting up detective puzzle...");
  
  try {
    // Reset some puzzle state
    markedAsBad = [];
    rayPaths = [];
    
    // Make sure we're in detective mode
    isDetectiveMode = true;
    
    // Note: We don't need to call calculateReflections explicitly here
    // as importArrangement already calls it during puzzle load
    console.log("Reflections already calculated during import: ", reflections ? reflections.length : 0);
    
    // Verify the manipulatedReflections array exists
    if (!currentPuzzle.manipulatedReflections) {
      console.error("No manipulatedReflections array found in the detective puzzle");
      currentPuzzle.manipulatedReflections = []; // Create empty array to prevent errors
    }
    
    console.log("Applying manipulations...");
    // Apply any manipulations defined in the puzzle
    applyManipulationsToReflections();
    
    console.log("Setting rays to visible...");
    // Show rays by default for detective puzzles
    showRayPaths = true;
    
    console.log("Adding detective controls...");
    // Only apply manipulations once when puzzle is first set up
    addDetectiveControls();
    
    console.log("Updating puzzle status...");
    // Initialize UI elements
    try {
      updatePuzzleStatus("Examine the reflections and mark any that look suspicious by double-clicking them.");
    } catch (statusError) {
      console.error("Error updating puzzle status:", statusError);
    }
    
    console.log("Detective puzzle setup complete");
    
    // Force a redraw to show the manipulated reflections
    safeRedraw();
  } catch (error) {
    console.error("Error in setupDetectivePuzzle:", error);
  }
}

// Function to apply manipulations to reflections
function applyManipulationsToReflections() {
  if (!currentPuzzle || !currentPuzzle.manipulatedReflections) {
    console.log("No manipulations to apply");
    return;
  }
  
  if (!reflections) {
    console.error("Reflections array is not initialized");
    return;
  }
  
  console.log("Applying manipulations to reflections:", currentPuzzle.manipulatedReflections);
  
  // Store original positions (if not already stored)
  if (!originalReflectionPositions) {
    originalReflectionPositions = [];
    for (let i = 0; i < reflections.length; i++) {
      originalReflectionPositions.push({
        x: reflections[i].x,
        y: reflections[i].y
      });
    }
    console.log("Original reflection positions stored:", originalReflectionPositions);
  }
  
  // Apply manipulations
  currentPuzzle.manipulatedReflections.forEach(manipulation => {
    const index = manipulation.index;
    
    if (index >= 0 && index < reflections.length) {
      // Check which format is used for translations
      if (Array.isArray(manipulation.translation)) {
        // Handle array format [x, y]
        reflections[index].x += manipulation.translation[0];
        reflections[index].y += manipulation.translation[1];
        console.log(`Applied translation [${manipulation.translation[0]}, ${manipulation.translation[1]}] to reflection ${index}`);
      } else if (manipulation.translateX !== undefined || manipulation.translateY !== undefined) {
        // Handle individual properties
        if (manipulation.translateX !== undefined) {
          reflections[index].x += manipulation.translateX;
        }
        if (manipulation.translateY !== undefined) {
          reflections[index].y += manipulation.translateY;
        }
        console.log(`Applied translation (${manipulation.translateX || 0}, ${manipulation.translateY || 0}) to reflection ${index}`);
      } else {
        console.warn(`Manipulation for index ${index} has invalid translation format`);
      }
    } else {
      console.warn(`Manipulation refers to invalid reflection index: ${index}`);
    }
  });
  
  // Force a redraw to show the manipulated reflections
  safeRedraw();
}

// Add detective controls to the UI
function addDetectiveControls() {
  console.log("Adding detective controls to UI");
  
  // Remove any existing controls to prevent duplicates
  const existingControls = document.querySelector('.detective-controls');
  if (existingControls) {
    existingControls.remove();
  }
  
  // Create the controls container
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'detective-controls';
  
  // Add the submit button
  const submitBtn = document.createElement('button');
  submitBtn.id = 'submitPuzzleBtn';
  submitBtn.className = 'detective-button';
  submitBtn.textContent = 'Submit Solution';
  controlsDiv.appendChild(submitBtn);
  
  // Find the detective controls placeholder
  const placeholder = document.querySelector('.detective-controls-placeholder');
  if (placeholder) {
    // Insert controls into the placeholder
    placeholder.appendChild(controlsDiv);
    console.log("Detective controls added to placeholder");
  } else {
    // Fallback - add to puzzleInfoPanel
    const puzzleInfoPanel = document.getElementById('puzzleInfoPanel');
    if (puzzleInfoPanel) {
      puzzleInfoPanel.appendChild(controlsDiv);
      console.log("Detective controls added to puzzle info panel");
    } else {
      console.warn("Could not find puzzle info panel. Detective controls not added.");
      document.body.appendChild(controlsDiv);
    }
  }
  
  // Add event listener
  const submitButton = document.getElementById('submitPuzzleBtn');
  if (submitButton) {
    submitButton.addEventListener('click', submitDetectiveSolution);
    console.log("Submit button event listener added");
  } else {
    console.error("Submit button not found");
  }
}

// Submit the solution for detective mode
function submitDetectiveSolution() {
  console.log("submitDetectiveSolution called");
  
  if (!isDetectiveMode) {
    console.error("Not in detective mode");
    return;
  }
  
  console.log("Submitting solution for detective puzzle");
  console.log("Marked reflections:", markedAsBad);
  
  // Check if there are manipulated reflections in the current puzzle
  if (currentPuzzle && currentPuzzle.manipulatedReflections) {
    const manipulatedIndices = currentPuzzle.manipulatedReflections.map(m => m.index);
    console.log("Manipulated reflections:", manipulatedIndices);
    
    // Compare the user's marked reflections with the actually manipulated ones
    let allCorrect = true;
    let allFound = true;
    
    // Check if all marked reflections are actually manipulated
    for (let i = 0; i < markedAsBad.length; i++) {
      if (!manipulatedIndices.includes(markedAsBad[i])) {
        allCorrect = false;
        console.log(`Incorrectly marked reflection: ${markedAsBad[i]}`);
        break;
      }
    }
    
    // Check if all manipulated reflections were found
    for (let i = 0; i < manipulatedIndices.length; i++) {
      if (!markedAsBad.includes(manipulatedIndices[i])) {
        allFound = false;
        console.log(`Missed manipulated reflection: ${manipulatedIndices[i]}`);
        break;
      }
    }
    
    // Update the puzzle status
    let statusElement = document.getElementById('puzzleStatus');
    console.log("Status element found:", !!statusElement);
    
    if (allCorrect && allFound) {
      console.log("All manipulated reflections were correctly identified!");
      
      // Mark as solved and show success message
      isPuzzleSolved = true;
      
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="status-success">PUZZLE SOLVED!</div>
          <p>You correctly identified all manipulated reflections.</p>
        `;
      }
      
      // Maybe show the correct ray paths?
      showRayPaths = true;
      
      // Show any manipulated reflections we might have missed
      highlightManipulatedReflections();
    } else if (allCorrect && markedAsBad.length > 0) {
      console.log("All marked reflections are manipulated, but some manipulated reflections were not found");
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="status-partial">PARTIALLY CORRECT</div>
          <p>Your marked reflections are correct, but you missed ${manipulatedIndices.length - markedAsBad.length} 
          manipulated reflection${manipulatedIndices.length - markedAsBad.length > 1 ? 's' : ''}.</p>
          <p>Keep searching!</p>
        `;
      }
    } else if (markedAsBad.length === 0) {
      // No reflections marked yet
      console.log("No reflections marked");
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="status-warning">NO REFLECTIONS MARKED</div>
          <p>You haven't marked any reflections as incorrect yet.</p>
          <p>Double-click a reflection to mark it with a red X.</p>
        `;
      }
    } else {
      console.log("Some marked reflections are not manipulated");
      if (statusElement) {
        statusElement.innerHTML = `
          <div class="status-failure">INCORRECT</div>
          <p>At least one of your marked reflections is not actually manipulated.</p>
          <p>Try again!</p>
        `;
      }
    }
  } else {
    console.log("No manipulated reflections found in the puzzle");
    let statusElement = document.getElementById('puzzleStatus');
    if (statusElement) {
      statusElement.innerHTML = `
        <div class="status-neutral">NO MANIPULATED REFLECTIONS</div>
        <p>This puzzle doesn't have any manipulated reflections.</p>
      `;
    }
  }
  
  // Force a redraw to refresh the visuals
  safeRedraw();
}

// Function to highlight manipulated reflections (used after solving)
function highlightManipulatedReflections() {
  if (!currentPuzzle || !currentPuzzle.manipulatedReflections) return;
  
  // For each manipulated reflection, store its index if not already marked
  const manipulatedIndices = currentPuzzle.manipulatedReflections.map(m => m.index);
  
  // Only show these if the puzzle is solved
  if (isPuzzleSolved) {
    // Turn on ray paths to help see the reflections
    showRayPaths = true;
    
    // Make sure all manipulated reflections are in markedAsBad
    for (let i = 0; i < manipulatedIndices.length; i++) {
      if (!markedAsBad.includes(manipulatedIndices[i])) {
        markedAsBad.push(manipulatedIndices[i]);
      }
    }
    
    // Force redraw
    redraw();
  }
}

// Update the puzzle status message
function updatePuzzleStatus(message) {
  // Check if we're in puzzle mode first
  if (!isPuzzleMode) {
    console.log("Not updating status because not in puzzle mode:", message);
    return;
  }

  const statusElement = document.getElementById('puzzleStatus');
  if (statusElement) {
    statusElement.innerHTML = `<p>${message}</p>`;
    console.log("Updated puzzle status:", message);
  } else {
    // This might happen if we update status before displayPuzzleInfo is called
    console.warn("Could not find puzzle status element - will retry");
    
    // Try once more after a short delay to make sure the element has time to be created
    setTimeout(() => {
      const retryElement = document.getElementById('puzzleStatus');
      if (retryElement) {
        retryElement.innerHTML = `<p>${message}</p>`;
        console.log("Updated puzzle status on retry:", message);
      } else {
        console.warn("Still could not find puzzle status element");
      }
    }, 100);
  }
}

// Setup for generation mode
function setupGenerationMode() {
  console.log("Setting up generation mode");
  console.log("Current movableObjects before setup:", JSON.stringify(currentPuzzle.movableObjects));
  
  // Explicitly ensure puzzle state is reset
  if (isPuzzleSolved || isPuzzleFailed) {
    console.log("WARNING: Puzzle was still marked as solved/failed in setupGenerationMode! Resetting flags.");
    isPuzzleSolved = false;
    isPuzzleFailed = false;
  }
  
  // Generation mode should allow moving the objects specified in movableObjects
  if (Array.isArray(currentPuzzle.movableObjects)) {
    console.log("Using array-style movable objects in generation mode:", currentPuzzle.movableObjects);
    // Keep the existing configuration as is - it specifies exactly what can be moved
  } else {
    // For old-style or missing movableObjects, ensure we enable movement
    enableFreeMovement();
  }
  
  // If rays should be shown at start, make sure to set currentRayIndex to display the first reflection
  if (showRayPaths && reflections.length > 0) {
    console.log("Setting currentRayIndex to 0 because showRaysStart is true");
    currentRayIndex = 0;
  }
  
  console.log("Generation mode setup complete. movableObjects:", JSON.stringify(currentPuzzle.movableObjects));
  console.log("Final puzzle state in setup: isPuzzleSolved =", isPuzzleSolved, "isPuzzleFailed =", isPuzzleFailed);
} 