/**
 * Matt W's Optics Game- Physics-based puzzle game about mirrors and reflections
 *
 * Core physics engine for calculating light ray paths and reflections.
 * Handles rendering, interaction, and mirror physics for the game.
 */

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const BALL_RADIUS = 25;
const MIRROR_COUNT = 1;
const MIRROR_LENGTH = BALL_RADIUS * 10; 
const MIRROR_THICKNESS = 4;
const REFLECTIVE_THICKNESS = 6;  
const NON_REFLECTIVE_THICKNESS = 3;  
const MIRROR_WIDTH = 4; 
const EYE_SIZE = 40;
const MAX_REFLECTIONS = 10; // Maximum number of reflections to prevent infinite loops
const MIN_REFLECTION_SIZE_RATIO = 0.05; // Minimum size ratio to original ball (10%)

let REFLECTION_COLORS = [];

let ball;                 
let mirrors = []; 
let eye;
let eyePosition = {x: 0, y: 0};
let reflections = [];

let showRayPaths = false; 
let currentRayIndex = -1;  // Currently displayed ray (-1 = none)

let isDragging = false; 
let draggedObject = null; 
let draggedMirrorPoint = null; 
let draggedMirrorIndex = null;


let debugMode = false;
let lastDebuggedReflectionIndex = -1;


window.onload = function() {
  console.log("Window loaded, starting initialization");

  const resetBtn = document.getElementById('resetGame');

  if (resetBtn) {
    console.log("Reset button found, setting up click handler");

    resetBtn.onclick = function() {
      console.log("Reset button clicked");
      reflections = [];
      showRayPaths = false;
      currentRayIndex = -1;
      const toggleBtn = document.getElementById('togglePaths');
      if (toggleBtn) toggleBtn.textContent = "Show Rays";
      initializeGame();
      calculateReflections();
      console.log("Reset complete with", reflections.length, "reflections");
    };

    console.log("Reset button handler setup complete");
  } else {
    console.error("Reset button not found in the DOM!");
  }
  
  const togglePathsBtn = document.getElementById('togglePaths');

  if (togglePathsBtn) {
    togglePathsBtn.onclick = function() {
      showRayPaths = !showRayPaths;
      this.textContent = showRayPaths ? "Hide Rays" : "Show Rays";
      
      // If we're showing rays and none are selected, show the first one
      if (showRayPaths && currentRayIndex === -1 && reflections.length > 0) {
        currentRayIndex = 0;
      }
    };
  }
  
  const addMirrorBtn = document.getElementById('addMirror');
  if (addMirrorBtn) {
    addMirrorBtn.onclick = function() {
      addNewMirror(); // Add a new mirror
    };
  }
  
  const exportBtn = document.getElementById('exportArrangement');
  if (exportBtn) {
    exportBtn.onclick = function() {
      exportArrangement(); // Export the current arrangement to JSON
    };
  }
  
  console.log("Window onload completed, all buttons initialized");
};

/**
 * Export the current game arrangement to a JSON file
 * Creates a downloadable file containing ball, eye, and mirror positions (ie, an arrangement)
 * For use in puzzles or because it looks cool. 
 */
function exportArrangement() {
  const arrangement = {
    ball: {
      x: ball.x,
      y: ball.y,
      radius: ball.radius
    },
    eye: {
      x: eyePosition.x,
      y: eyePosition.y
    },
    mirrors: mirrors.map(mirror => ({
      x1: mirror.x1,
      y1: mirror.y1,
      x2: mirror.x2,
      y2: mirror.y2,
      normal: mirror.normal,
      width: mirror.width
    }))
  };
  
  const jsonString = JSON.stringify(arrangement, null, 2);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `arrangement-${timestamp}.json`;
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  // Create a temporary anchor element to trigger the download
  const a = document.createElement('a');
  a.href = url;
  
  a.download = filename;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log(`Exported arrangement to ${filename}`);
}

// Import a saved game arrangement from a JSON object
function importArrangement(arrangement) {
  try {
    ball = {
      x: arrangement.ball.x,
      y: arrangement.ball.y,
      radius: arrangement.ball.radius || BALL_RADIUS
    };
    
    eyePosition = {
      x: arrangement.eye.x,
      y: arrangement.eye.y
    };
    
    mirrors = [];
    for (let mirrorData of arrangement.mirrors) {
      const { x1, y1, x2, y2, normal, width } = mirrorData;
      const mirrorWidth = width || MIRROR_WIDTH;
      
      // Calculate the sides of the mirror
      const halfWidth = mirrorWidth / 2;
      
      // Blue side coordinates -- remember blue side is the refelctive side
      const blueX1 = x1 + normal.x * halfWidth;
      const blueY1 = y1 + normal.y * halfWidth;
      const blueX2 = x2 + normal.x * halfWidth;
      const blueY2 = y2 + normal.y * halfWidth;
      
      // Black side coordinates -- black is opaque side
      const blackX1 = x1 - normal.x * halfWidth;
      const blackY1 = y1 - normal.y * halfWidth;
      const blackX2 = x2 - normal.x * halfWidth;
      const blackY2 = y2 - normal.y * halfWidth;
      
      mirrors.push({
        x1, y1, x2, y2,
        blueX1, blueY1, blueX2, blueY2,
        blackX1, blackY1, blackX2, blackY2,
        thickness: MIRROR_THICKNESS,
        normal: normal,
        width: mirrorWidth
      });
    }
    
    reflections = [];
    showRayPaths = false;
    currentRayIndex = -1;
    
    const toggleBtn = document.getElementById('togglePaths');
    if (toggleBtn) toggleBtn.textContent = "Show Rays";
    
    calculateReflections();
    
    console.log("Imported arrangement with", mirrors.length, "mirrors");
    return true;
  } catch (error) {
    console.error("Error importing arrangement:", error);
    return false;
  }
}

/**
 * p5.js setup function - runs once at startup
 * Creates canvas, initializes colors, and sets up initial game state
 */
function setup() {
  createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  
  REFLECTION_COLORS = [
    null, // 0-index (unused)
    color(50, 200, 100),    // 1st order - Green
    color(180, 100, 255),   // 2nd order - Purple
    color(255, 150, 50),    // 3rd order - Orange
    color(0, 200, 200),     // 4th order - Teal
    color(255, 100, 255),   // 5th order - Pink
    color(100, 150, 255),   // 6th order - Light Blue
    color(255, 200, 0),     // 7th order - Gold
    color(150, 75, 0),      // 8th order - Brown
    color(255, 0, 100),     // 9th order - Hot Pink
    color(0, 255, 150),     // 10th order - Mint
    color(150, 0, 255),     // 11th order - Deep Purple
    color(255, 100, 0),     // 12th order - Bright Orange
    color(0, 150, 100),     // 13th order - Sea Green
    color(255, 0, 255),     // 14th order - Magenta
    color(100, 200, 255)    // 15th order - Sky Blue
  ];
  
  eye = loadImage('eye.svg');
  
  eyePosition = {
    x: width / 2,
    y: height - 30
  };
  
  initializeGame();
  calculateReflections();
}

// DRAWING

/**
 * p5.js draw function - runs every frame
 * Handles rendering of all game elements
 */
function draw() {
  background(240);
  drawMirrors();
  
  // Check if we need to run puzzle-specific drawing logic (without direct puzzle imports)
  let skipRayPaths = false;

  if (window.drawPuzzleOverlay) {
    const result = window.drawPuzzleOverlay();
    // In detective mode, we always want to allow ray paths if the user enables them
    const inDetectiveMode = typeof isDetectiveMode !== 'undefined' && isDetectiveMode;
    skipRayPaths = result && result.skipRayPaths && !inDetectiveMode;
  }
  
  // Draw ray paths if enabled and not skipped by puzzle
  if (showRayPaths && !skipRayPaths) {
    drawRayPaths();
  }
  
  drawReflections();
  drawBall();
  drawEye();
  
  // Add this at the very end of the draw function, after ALL other drawing
  if (typeof window.drawDetectiveOverlay === 'function') {
    window.drawDetectiveOverlay();
  }
}

function initializeGame() {
  console.log("Initializing game with random positions");

  ball = {
    x: random(BALL_RADIUS, width - BALL_RADIUS),
    y: random(BALL_RADIUS, height * 0.7),  // Keep ball in upper 70% of screen
    radius: BALL_RADIUS
  };
  console.log("Ball created at:", ball.x, ball.y);
  
  mirrors = [];
  reflections = [];
  console.log("Game initialization complete");
}

// RENDERING 

/**
 * Draw all mirrors in the scene
 * Renders both reflective (blue) and non-reflective (black) sides
 */
function drawMirrors() {
  for (let mirror of mirrors) {
    // Draw black non-reflective side
    stroke(0);
    strokeWeight(NON_REFLECTIVE_THICKNESS);
    line(
      mirror.blackX1,
      mirror.blackY1,
      mirror.blackX2,
      mirror.blackY2
    );
    
    // Draw light blue reflective side
    stroke(100, 200, 255);
    strokeWeight(REFLECTIVE_THICKNESS);
    line(
      mirror.blueX1,
      mirror.blueY1,
      mirror.blueX2,
      mirror.blueY2
    );
  }
}

function drawBall() {
  fill(50, 100, 255);
  noStroke();
  ellipse(ball.x, ball.y, ball.radius * 2);
}

/**
 * Draw all visible reflections
 * Renders colored balls representing virtual reflections based on their order
 */
function drawReflections() {
  noStroke();
  
  for (let reflection of reflections) {
    // Special case: in path identification mode, all reflections should be visible
    const inPathIdMode = typeof isPathIdentificationMode !== 'undefined' && isPathIdentificationMode;
    
    // Check if this reflection is visible from current eye position or we're in path ID mode
    if (inPathIdMode || isReflectionVisible(reflection)) {
      // Get color based on reflection depth, default to the last color if beyond our defined colors
      const colorIndex = Math.min(reflection.depth, REFLECTION_COLORS.length - 1);
      fill(REFLECTION_COLORS[colorIndex]);
      
      ellipse(reflection.x, reflection.y, reflection.radius * 2);
    }
  }
}

function drawEye() {
  const eyeX = eyePosition.x - EYE_SIZE / 2;
  const eyeY = eyePosition.y - EYE_SIZE / 2;
  image(eye, eyeX, eyeY, EYE_SIZE, EYE_SIZE);
}

/**
 * Draw ray paths for the currently selected reflection
 * Visualizes light paths from ball to eye, including mirror bounces
 * Shows both actual ray paths (solid) and virtual image paths (dashed)
 */
function drawRayPaths() {
  // If no rays should be shown or there are no reflections, return early
  if (!showRayPaths || reflections.length === 0 || currentRayIndex === -1) return;
  
  // Check for special user ray path from path identification puzzle
  if (currentRayIndex === -2 && typeof userRayPath !== 'undefined' && userRayPath) {
    // Use the user ray path for visualization
    const currentReflection = userRayPath.reflections[0]; // Target reflection
    
    // Get color based on reflection depth
    const colorIndex = Math.min(currentReflection.depth, REFLECTION_COLORS.length - 1);
    let strokeColor = REFLECTION_COLORS[colorIndex];
    
    stroke(strokeColor);
    strokeWeight(3);
    noFill();
    
    // Skip if we don't have hit points
    if (!userRayPath.hitPoints || userRayPath.hitPoints.length === 0) {
      if (debugMode) console.log("No hit points in user ray path, skipping drawing");
      return;
    }
    
    // Draw the hit points (mirrors) to target reflection
    drawUserPathToTarget(userRayPath, strokeColor);
    
    // Draw the user's selected path (if any)
    if (userRayPath.reflections.length > 1) {
      drawUserSelectedPath(userRayPath, strokeColor);
    }
    
    fill(0);
    noStroke();
    textAlign(LEFT, TOP);
    textSize(16);
    let orderText = "1st";
    if (currentReflection.depth === 2) orderText = "2nd";
    if (currentReflection.depth === 3) orderText = "3rd";
    if (currentReflection.depth > 3) orderText = currentReflection.depth + "th";
    
    text(orderText + " order reflection - PATH IDENTIFICATION MODE", 20, 20);
    return;
  }
  
  // For normal ray paths (not user path identification)
  // Ensure the currentRayIndex is within bounds
  currentRayIndex = constrain(currentRayIndex, 0, reflections.length - 1);
  
  // Get the current reflection to display
  const currentReflection = reflections[currentRayIndex];
  
  // Only debug each reflection once to avoid console spam
  if (debugMode && lastDebuggedReflectionIndex !== currentRayIndex) {
    lastDebuggedReflectionIndex = currentRayIndex;
    
    console.log("%c===== REFLECTION DEBUG INFO =====", "font-weight: bold; font-size: 14px;");
    console.log(`Reflection Index: ${currentRayIndex}, Depth: ${currentReflection.depth}`);
    console.log(`Position: (${currentReflection.x.toFixed(2)}, ${currentReflection.y.toFixed(2)})`);
    
    window.displayDebugInfo = {
      reflectionIndex: currentRayIndex,
      depth: currentReflection.depth,
      position: `(${currentReflection.x.toFixed(2)}, ${currentReflection.y.toFixed(2)})`,
      hitPoints: currentReflection.hitPoints ? currentReflection.hitPoints.length : 0
    };
    
    console.log("Full reflection object:", currentReflection);
    
    if (currentReflection.hitPoints) {
      console.log("Hit points:", currentReflection.hitPoints.map((hp, i) => 
        `Point ${i}: (${hp.x.toFixed(2)}, ${hp.y.toFixed(2)})`
      ));
    }
    
    // Build reflection chain for analysis
    const reflectionChain = buildReflectionChain(currentReflection);
    console.log("Reflection chain depth:", reflectionChain.length);
  }
  
  if (!isReflectionVisible(currentReflection)) {
    let found = false;
    let startIndex = currentRayIndex;
    
    for (let i = 0; i < reflections.length; i++) {
      currentRayIndex = (startIndex + i) % reflections.length;
      if (isReflectionVisible(reflections[currentRayIndex])) {
        found = true;
        break;
      }
    }
    
    if (!found) return;
  }
  
  // Get color based on reflection depth
  const colorIndex = Math.min(currentReflection.depth, REFLECTION_COLORS.length - 1);
  let strokeColor = REFLECTION_COLORS[colorIndex];
  
  // Prepare stroke settings
  stroke(strokeColor);
  strokeWeight(3);
  noFill();
  
  // Skip if we don't have hit points
  if (!currentReflection.hitPoints || currentReflection.hitPoints.length === 0) {
    if (debugMode) console.log("No hit points, skipping drawing");
    return;
  }
  
  // THIS IS ACTUALLY THE RAY ALGO

  // STEP 1: Draw the actual ray path (solid lines)
  // Draw line from ball to first hit point on mirror
  line(ball.x, ball.y, currentReflection.hitPoints[0].x, currentReflection.hitPoints[0].y);
  
  // Connect all hit points -- "billiard balls"
  for (let i = 0; i < currentReflection.hitPoints.length - 1; i++) {
    const current = currentReflection.hitPoints[i];
    const next = currentReflection.hitPoints[i + 1];
    line(current.x, current.y, next.x, next.y);
  }
  
  // Draw line from last hit point to eye
  const lastHitPoint = currentReflection.hitPoints[currentReflection.hitPoints.length - 1];
  line(lastHitPoint.x, lastHitPoint.y, eyePosition.x, eyePosition.y);
  
  // STEP 2: Draw virtual image lines (dashed lines)
  // For each hit point, draw a dashed line to its associated virtual image
  for (let i = 0; i < currentReflection.hitPoints.length; i++) {
    const hitPoint = currentReflection.hitPoints[i];
    
    // Use the stored virtual image if available
    if (hitPoint.virtualImage) {
      drawDashedLine(
        hitPoint.x, hitPoint.y,
        hitPoint.virtualImage.x, hitPoint.virtualImage.y,
        strokeColor, 5, 5
      );
    }
    // Fallback for first-order reflections
    else if (currentReflection.depth === 1 && i === 0) {
      drawDashedLine(
        hitPoint.x, hitPoint.y,
        currentReflection.x, currentReflection.y,
        strokeColor, 5, 5
      );
    }
  }
  
  // Draw white dots at all hit points
  fill(255);
  noStroke();
  for (const hitPoint of currentReflection.hitPoints) {
    ellipse(hitPoint.x, hitPoint.y, 8, 8);
  }
  
  // Display reflection order information
  fill(0);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(16);
  let orderText = "1st";
  if (currentReflection.depth === 2) orderText = "2nd";
  if (currentReflection.depth === 3) orderText = "3rd";
  if (currentReflection.depth > 3) orderText = currentReflection.depth + "th";
  
  text(orderText + " order reflection (" + (currentRayIndex + 1) + " of " + reflections.length + ")", 20, 20);
  
  // If debug mode is on, draw additional debug info on screen
  if (debugMode && window.displayDebugInfo) {
    textAlign(LEFT, TOP);
    textSize(14);
    fill(0);
    text(`Debug - Reflection #${window.displayDebugInfo.reflectionIndex}`, 20, 60);
    text(`Depth: ${window.displayDebugInfo.depth}`, 20, 80);
    text(`Position: ${window.displayDebugInfo.position}`, 20, 100);
    text(`Hit Points: ${window.displayDebugInfo.hitPoints}`, 20, 120);
    text(`Press 'D' to toggle debug mode`, 20, 140);
    
    // Display the full reflection object properties
    if (currentReflection) {
      text("--- Full Reflection Object ---", 20, 180);
      let y = 200;
      
      // Display basic properties
      text(`x: ${currentReflection.x.toFixed(2)}`, 20, y); y += 20;
      text(`y: ${currentReflection.y.toFixed(2)}`, 20, y); y += 20;
      text(`radius: ${currentReflection.radius}`, 20, y); y += 20;
      text(`depth: ${currentReflection.depth}`, 20, y); y += 20;
      
      // Display source mirror info
      if (currentReflection.sourceMirror) {
        text("sourceMirror:", 20, y); y += 20;
        text(`- position: (${currentReflection.sourceMirror.x1.toFixed(0)},${currentReflection.sourceMirror.y1.toFixed(0)}) to (${currentReflection.sourceMirror.x2.toFixed(0)},${currentReflection.sourceMirror.y2.toFixed(0)})`, 30, y); y += 20;
      }
      
      // Display parent reflection if it exists
      if (currentReflection.parentReflection) {
        text("parentReflection:", 20, y); y += 20;
        text(`- depth: ${currentReflection.parentReflection.depth}`, 30, y); y += 20;
        text(`- position: (${currentReflection.parentReflection.x.toFixed(0)},${currentReflection.parentReflection.y.toFixed(0)})`, 30, y); y += 20;
      }
      
      // Display hit points
      if (currentReflection.hitPoints && currentReflection.hitPoints.length > 0) {
        text(`hitPoints (${currentReflection.hitPoints.length}):`, 20, y); y += 20;
        
        for (let i = 0; i < currentReflection.hitPoints.length; i++) {
          const hp = currentReflection.hitPoints[i];
          text(`- point ${i}: (${hp.x.toFixed(0)}, ${hp.y.toFixed(0)})`, 30, y); y += 20;
          
          // Show mirror info for this hit point if available
          if (hp.mirror) {
            text(`  mirror: (${hp.mirror.x1.toFixed(0)},${hp.mirror.y1.toFixed(0)}) to (${hp.mirror.x2.toFixed(0)},${hp.mirror.y2.toFixed(0)})`, 30, y); y += 20;
          }
          
          // Show virtual image for this hit point if available
          if (hp.virtualImage) {
            text(`  virtualImage: (${hp.virtualImage.x.toFixed(0)},${hp.virtualImage.y.toFixed(0)})`, 30, y); y += 20;
          }
        }
      }
      
      // Display mirror indices if they exist
      if (currentReflection.mirrorIndices && currentReflection.mirrorIndices.length > 0) {
        text(`mirrorIndices: [${currentReflection.mirrorIndices.join(', ')}]`, 20, y); y += 20;
      }
    }
  }
}

/**
 * Draw the path from eye to target reflection in user path identification mode
 * 
 * @param {Object} userRayPath - The user-selected ray path
 * @param {Color} strokeColor - Color to use for drawing the path
 */
function drawUserPathToTarget(userRayPath, strokeColor) {
  const targetReflection = userRayPath.reflections[0];
  const hitPoints = userRayPath.hitPoints;
  
  // Draw line from last hit point to eye (if we have hit points)
  if (hitPoints.length > 0) {
    const lastHitPoint = hitPoints[0]; // First hit point is closest to eye
    line(lastHitPoint.x, lastHitPoint.y, eyePosition.x, eyePosition.y);
    
    // Draw dashed line from hit point to target reflection
    drawDashedLine(
      lastHitPoint.x, lastHitPoint.y,
      targetReflection.x, targetReflection.y,
      strokeColor, 5, 5
    );
    
    // Draw white dot at the hit point
    fill(255);
    noStroke();
    ellipse(lastHitPoint.x, lastHitPoint.y, 8, 8);
  }
}

/**
 * Draw the user's selected path between reflections in path identification mode
 * 
 * @param {Object} userRayPath - The user-selected ray path
 * @param {Color} strokeColor - Color to use for drawing the path
 */
function drawUserSelectedPath(userRayPath, strokeColor) {
  // Draw lines between reflections in the user's ray path
  const reflections = userRayPath.reflections;
  const hitPoints = userRayPath.hitPoints;
  
  for (let i = 1; i < reflections.length; i++) {
    const current = reflections[i-1];
    const next = reflections[i];
    
    // Draw solid line between reflections
    stroke(strokeColor);
    strokeWeight(3);
    line(current.x, current.y, next.x, next.y);
    
    // If we have intermediate hit points, draw those too
    if (hitPoints.length > i) {
      const hitPoint = hitPoints[i];
      
      // Draw white dot at the hit point
      fill(255);
      noStroke();
      ellipse(hitPoint.x, hitPoint.y, 8, 8);
      
      // Draw dashed line from hit point to virtual image if available
      if (hitPoint.virtualImage) {
        drawDashedLine(
          hitPoint.x, hitPoint.y,
          hitPoint.virtualImage.x, hitPoint.virtualImage.y,
          strokeColor, 5, 5
        );
      }
    }
  }
}

// PHYSICS CALCULATION FUNCTIONS 

/**
 * Find a hit point on a mirror that obeys the law of reflection
 * Attempts multiple methods to find the correct intersection point
 * 
 * @param {Object} source - Source point (x,y)
 * @param {Object} destination - Destination point (x,y)
 * @param {Object} virtualImage - Virtual image point (x,y)
 * @param {Object} mirror - Mirror object to find intersection with
 * @returns {Object} Hit point where ray intersects mirror
 */
function findHitPoint(source, destination, virtualImage, mirror) {
  // First, try the intersection of source-virtualImage line with the mirror
  // This is the correct hit point for simple first-order reflections
  const hitPoint = lineIntersection(
    source.x, source.y,
    virtualImage.x, virtualImage.y,
    mirror.x1, mirror.y1,
    mirror.x2, mirror.y2
  );
  
  if (hitPoint) return hitPoint;
  
  // Second approach: try line from eye to virtual image
  const hitPoint2 = lineIntersection(
    eyePosition.x, eyePosition.y,
    virtualImage.x, virtualImage.y,
    mirror.x1, mirror.y1,
    mirror.x2, mirror.y2
  );
  
  if (hitPoint2) return hitPoint2;
  
  // Third approach: try source-destination midpoint to virtual image
  const midpoint = {
    x: (source.x + destination.x) / 2,
    y: (source.y + destination.y) / 2
  };
  
  const hitPoint3 = lineIntersection(
    midpoint.x, midpoint.y,
    virtualImage.x, virtualImage.y,
    mirror.x1, mirror.y1,
    mirror.x2, mirror.y2
  );
  
  if (hitPoint3) return hitPoint3;
  
  // Last resort: just return a point on the mirror
  return {
    x: (mirror.x1 + mirror.x2) / 2,
    y: (mirror.y1 + mirror.y2) / 2
  };
}

/**
 * Build the complete reflection chain from eye to ball
 * Traces backwards through parent reflections to construct full path
 * 
 * @param {Object} reflection - The reflection to trace back from
 * @returns {Array} Chain of reflections from ball to eye
 */
function buildReflectionChain(reflection) {
  const chain = [];
  let current = reflection;
  
  while (current) {
    chain.push(current);
    current = current.parentReflection;
  }
  
  // Return the chain in reverse order (ball to eye)
  return chain.reverse();
}

/**
 * Create a virtual image of a point reflected in a mirror
 * Calculates the reflection position using the law of reflection
 * 
 * @param {Object} point - The point to reflect (x,y)
 * @param {Object} mirror - The mirror to reflect across
 * @returns {Object} Virtual image position (x,y)
 */
function createVirtualImage(point, mirror) {
  // Get the mirror normal
  const mirrorNormal = mirror.normal;
  
  // Calculate the reflection of the point
  const pointToMirrorVec = {
    x: point.x - mirror.x1,
    y: point.y - mirror.y1
  };
  
  // Project the vector onto the normal to get the displacement from the mirror
  const normalDistance = dotProduct(pointToMirrorVec, mirrorNormal);
  
  // Reflect the point across the mirror by moving it twice the distance in the normal direction
  return {
    x: point.x - 2 * normalDistance * mirrorNormal.x,
    y: point.y - 2 * normalDistance * mirrorNormal.y
  };
}

/**
 * Draw a dashed line between two points
 * Used for virtual image paths
 * 
 * @param {number} x1 - Start x-coordinate
 * @param {number} y1 - Start y-coordinate
 * @param {number} x2 - End x-coordinate
 * @param {number} y2 - End y-coordinate
 * @param {Color} strokeColor - Line color
 * @param {number} dashLength - Length of each dash
 * @param {number} gapLength - Length of gaps between dashes
 */
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

/**
 * Trace a single ray path from the ball to the eye via reflections
 * Creates physical and virtual path segments for visualization
 * 
 * @param {Object} reflection - The reflection to trace
 * @returns {Object} Physical and virtual path segments
 */
function traceSingleRayPath(reflection) {
  let physicalPath = [];
  let virtualPaths = []; // Array to store multiple virtual paths for each reflection
  
  // If hit points aren't available, early return
  if (!reflection.hitPoints || reflection.hitPoints.length === 0) {
    return { physical: [], virtuals: [] };
  }
  
  // Start with the ball
  physicalPath.push({ x: ball.x, y: ball.y, type: 'solid' });
  
  // Add all hit points in order (ball to eye)
  for (const hitPoint of reflection.hitPoints) {
    physicalPath.push({ x: hitPoint.x, y: hitPoint.y, type: 'solid' });
  }
  
  // End with the eye
  physicalPath.push({ x: eyePosition.x, y: eyePosition.y, type: 'solid' });
  
  // For first-order reflections
  if (reflection.depth === 1) {
    // Create the virtual path: hitPoint → virtual reflection
    virtualPaths.push([
      { x: reflection.hitPoints[0].x, y: reflection.hitPoints[0].y, type: 'solid' },
      { x: reflection.x, y: reflection.y, type: 'dashed' }
    ]);
  } 
  // For higher-order reflections
  else {
    // Build the reflection chain
    const reflectionChain = buildReflectionChain(reflection);
    
    // For each hit point, create a virtual path to its virtual image
    for (let i = 0; i < reflection.hitPoints.length; i++) {
      const hitPoint = reflection.hitPoints[i];
      const mirror = reflectionChain[i].sourceMirror;
      
      // For the first hit point (nearest to ball)
      if (i === 0) {
        // Calculate virtual image of ball in this mirror
        const ballToMirrorVec = {
          x: ball.x - mirror.x1,
          y: ball.y - mirror.y1
        };
        const dotProduct = dotProduct(ballToMirrorVec, mirror.normal);
        
        const virtualImage = {
          x: ball.x - 2 * dotProduct * mirror.normal.x,
          y: ball.y - 2 * dotProduct * mirror.normal.y
        };
        
        virtualPaths.push([
          { x: hitPoint.x, y: hitPoint.y, type: 'solid' },
          { x: virtualImage.x, y: virtualImage.y, type: 'dashed' }
        ]);
      } 
      // For subsequent hit points
      else {
        // Calculate virtual image of previous hit point in this mirror
        const prevHitPoint = reflection.hitPoints[i-1];
        const prevToMirrorVec = {
          x: prevHitPoint.x - mirror.x1,
          y: prevHitPoint.y - mirror.y1
        };
        const dotProduct = dotProduct(prevToMirrorVec, mirror.normal);
        
        const virtualImage = {
          x: prevHitPoint.x - 2 * dotProduct * mirror.normal.x,
          y: prevHitPoint.y - 2 * dotProduct * mirror.normal.y
        };
        
        virtualPaths.push([
          { x: hitPoint.x, y: hitPoint.y, type: 'solid' },
          { x: virtualImage.x, y: virtualImage.y, type: 'dashed' }
        ]);
      }
    }
  }
  
  return { physical: physicalPath, virtuals: virtualPaths };
}

/**
 * Create a point on a mirror at given parametric position t
 * 
 * @param {Object} mirror - The mirror object
 * @param {number} t - Parametric position (0-1) along the mirror
 * @returns {Object} Point coordinates (x,y) on the mirror
 */
function createPointOnMirror(mirror, t) {
  return {
    x: mirror.x1 + t * (mirror.x2 - mirror.x1),
    y: mirror.y1 + t * (mirror.y2 - mirror.y1)
  };
}

/**
 * Calculate a mirror's normal vector (perpendicular to mirror surface)
 * 
 * @param {Object} mirror - The mirror object
 * @returns {Object} Unit normal vector (x,y)
 */
function mirrorNormal(mirror) {
  const mirrorVec = {
    x: mirror.x2 - mirror.x1,
    y: mirror.y2 - mirror.y1
  };
  const mirrorLength = Math.sqrt(mirrorVec.x * mirrorVec.x + mirrorVec.y * mirrorVec.y);
  
  return {
    x: -mirrorVec.y / mirrorLength,
    y: mirrorVec.x / mirrorLength
  };
}

/**
 * Check if a point lies on a line segment
 * 
 * @param {number} px - Point x-coordinate
 * @param {number} py - Point y-coordinate
 * @param {number} x1 - Line segment start x-coordinate
 * @param {number} y1 - Line segment start y-coordinate
 * @param {number} x2 - Line segment end x-coordinate
 * @param {number} y2 - Line segment end y-coordinate
 * @returns {boolean} True if point is on line segment
 */
function isPointOnLineSegment(px, py, x1, y1, x2, y2) {
  // Calculate the distance from point to line segment
  const lineLength = dist(x1, y1, x2, y2);
  const d1 = dist(px, py, x1, y1);
  const d2 = dist(px, py, x2, y2);
  
  // Point is on segment if the sum of distances to endpoints equals the segment length
  // Add a small epsilon for floating point precision
  const epsilon = 0.001;
  return Math.abs(d1 + d2 - lineLength) < epsilon;
}

/**
 * Check if a reflection is visible from current eye position
 * Implements ray tracing to determine if a reflection can be seen
 * Accounts for mirror orientation, obstacles, and physical laws
 * 
 * @param {Object} reflection - The reflection to check
 * @returns {boolean} True if the reflection is visible
 */
function isReflectionVisible(reflection) {
  // First check if the reflection is within the canvas bounds
  if (reflection.x - reflection.radius < 0 || 
      reflection.x + reflection.radius > width ||
      reflection.y - reflection.radius < 0 || 
      reflection.y + reflection.radius > height) {
    // Reflection is outside or partially outside the canvas
    return false;
  }
  
  // Get the source mirror that created this reflection
  const mirror = reflection.sourceMirror;
  const mirrorNormal = mirror.normal;
  
  // Get the source object (either the original ball or the parent reflection)
  const sourceObject = reflection.parentReflection || ball;
  
  // PART 1: Check if the eye can see the reflection through the mirror
  
  // Create a line from eye to reflection
  const eye = eyePosition;
  
  // Find intersection of eye-to-reflection line with the mirror
  const eyeToMirrorIntersection = lineIntersection(
    eye.x, eye.y,
    reflection.x, reflection.y,
    mirror.x1, mirror.y1,
    mirror.x2, mirror.y2
  );
  
  // If no intersection, the reflection is not visible
  if (!eyeToMirrorIntersection) return false;
  
  // Check if the intersection point is within the mirror segment
  const mirrorLength = dist(mirror.x1, mirror.y1, mirror.x2, mirror.y2);
  const dist1 = dist(eyeToMirrorIntersection.x, eyeToMirrorIntersection.y, mirror.x1, mirror.y1);
  const dist2 = dist(eyeToMirrorIntersection.x, eyeToMirrorIntersection.y, mirror.x2, mirror.y2);
  
  // Allow for a small margin of error due to floating point
  const epsilon = 0.001;
  if (dist1 + dist2 > mirrorLength * (1 + epsilon)) {
    return false;
  }
  
  // Calculate the direction from eye to intersection
  const eyeToIntersection = {
    x: eyeToMirrorIntersection.x - eye.x,
    y: eyeToMirrorIntersection.y - eye.y
  };
  
  // When dot product of normal and eyeToIntersection is negative,
  // the eye is looking at the blue side of the mirror first
  const lookingAtBlueSideFirst = dotProduct(mirrorNormal, eyeToIntersection) < 0;
  
  // If not looking at the blue side first, reflection is not visible
  if (!lookingAtBlueSideFirst) return false;
  
  // Check if the ray passes through the mirror FIRST before reaching the reflection
  // Calculate the distance from eye to intersection and from eye to reflection
  const distToIntersection = Math.sqrt(
    eyeToIntersection.x * eyeToIntersection.x + 
    eyeToIntersection.y * eyeToIntersection.y
  );
  
  const eyeToReflection = {
    x: reflection.x - eye.x,
    y: reflection.y - eye.y
  };
  
  const distToReflection = Math.sqrt(
    eyeToReflection.x * eyeToReflection.x + 
    eyeToReflection.y * eyeToReflection.y
  );
  
  // The ray should hit the mirror first, then the reflection
  const intersectsBeforeReflection = distToIntersection < distToReflection;
  
  if (!intersectsBeforeReflection) return false;
  
  // Check if there are any obstructions between eye and mirror intersection
  for (let otherMirror of mirrors) {
    // Skip the mirror we're testing for
    if (otherMirror === mirror) continue;
    
    // Check if the ray from eye to intersection crosses this other mirror
    const blockingIntersection = lineIntersection(
      eye.x, eye.y,
      eyeToMirrorIntersection.x, eyeToMirrorIntersection.y,
      otherMirror.x1, otherMirror.y1,
      otherMirror.x2, otherMirror.y2
    );
    
    if (blockingIntersection) {
      // Calculate how far along the ray this blocking intersection occurs
      const eyeToBlockingIntersection = {
        x: blockingIntersection.x - eye.x,
        y: blockingIntersection.y - eye.y
      };
      
      const distToBlockingIntersection = Math.sqrt(
        eyeToBlockingIntersection.x * eyeToBlockingIntersection.x + 
        eyeToBlockingIntersection.y * eyeToBlockingIntersection.y
      );
      
      // If the blocking intersection is closer than our mirror intersection,
      // this means another mirror is blocking the view
      if (distToBlockingIntersection < distToIntersection * 0.99) { // Add a small margin for floating point errors
        return false;
      }
    }
  }
  
  // PART 2: Check if the mirror can see the source object (ball or parent reflection)
  
  // For higher-order reflections (depth > 1), we need to check if the path is physically valid
  if (reflection.depth > 1) {
    // Calculate the reflection point on the mirror
    const reflectionPoint = eyeToMirrorIntersection;
    
    // For reflections of reflections, the reflection should be visible from the mirror
    // but only if the source of this reflection (parent) is also visible from the mirror
    const parentReflection = reflection.parentReflection;
    
    // Check if there's a clear path from the parent reflection to the reflection point
    for (let otherMirror of mirrors) {
      // Skip the mirror we're testing for and the parent's mirror
      if (otherMirror === mirror || (parentReflection && otherMirror === parentReflection.sourceMirror)) continue;
      
      // Check if any mirror blocks the path from parent reflection to reflection point
      const blockingIntersection = lineIntersection(
        parentReflection.x, parentReflection.y,
        reflectionPoint.x, reflectionPoint.y,
        otherMirror.x1, otherMirror.y1,
        otherMirror.x2, otherMirror.y2
      );
      
      if (blockingIntersection) {
        // Calculate distances to determine if there's a blockage
        const parentToBlockingDist = dist(parentReflection.x, parentReflection.y, blockingIntersection.x, blockingIntersection.y);
        const parentToReflectionPointDist = dist(parentReflection.x, parentReflection.y, reflectionPoint.x, reflectionPoint.y);
        
        // If there's a mirror between the parent and the reflection point, this reflection isn't possible
        if (parentToBlockingDist < parentToReflectionPointDist * 0.99) { // Small margin for floating point errors
          return false;
        }
      }
    }
  } else {
    // For first-order reflections, check if the original ball is visible from the mirror
    
    // Calculate the reflection point on the mirror
    const reflectionPoint = eyeToMirrorIntersection;
    
    // Check if there's a clear path from the ball to the reflection point
    for (let otherMirror of mirrors) {
      // Skip the mirror we're testing for
      if (otherMirror === mirror) continue;
      
      // Check if any mirror blocks the path from ball to reflection point
      const blockingIntersection = lineIntersection(
        ball.x, ball.y,
        reflectionPoint.x, reflectionPoint.y,
        otherMirror.x1, otherMirror.y1,
        otherMirror.x2, otherMirror.y2
      );
      
      if (blockingIntersection) {
        // Calculate distances to determine if there's a blockage
        const ballToBlockingDist = dist(ball.x, ball.y, blockingIntersection.x, blockingIntersection.y);
        const ballToReflectionPointDist = dist(ball.x, ball.y, reflectionPoint.x, reflectionPoint.y);
        
        // If there's a mirror between the ball and the reflection point, the reflection isn't physically possible
        if (ballToBlockingDist < ballToReflectionPointDist * 0.99) { // Small margin for floating point errors
          return false;
        }
      }
    }
  }
  
  // For a reflection to be visible, all checks must pass
  return true;
}

/**
 * Calculate higher-order reflections (2nd order and above)
 * Creates virtual reflections of reflections
 * 
 * @param {Object} mirror - The mirror creating this reflection
 * @param {Object} object - The object being reflected (ball or another reflection)
 * @param {number} objectRadius - Radius of the reflected object
 * @param {number} depth - Reflection order (depth in the reflection tree)
 * @param {Array} allMirrors - All mirrors in the scene
 */
function calculateHigherOrderReflection(mirror, object, objectRadius, depth, allMirrors) {
  // Don't go beyond max reflection depth
  if (depth > MAX_REFLECTIONS) return;
  
  // Don't calculate reflections that are too small
  if (objectRadius / BALL_RADIUS < MIN_REFLECTION_SIZE_RATIO) return;
  
  // Use the stored normal vector for this mirror
  const mirrorNormal = mirror.normal;
  
  // Calculate reflection of object across mirror line
  // First find distance from object to mirror along normal
  const objectToMirrorVec = {
    x: object.x - mirror.x1,
    y: object.y - mirror.y1
  };
  const normalDistance = dotProduct(objectToMirrorVec, mirrorNormal);
  
  // Only create reflections if object is on the reflective side of the mirror
  if (normalDistance <= 0) return;
  
  // Calculate distance from object to mirror
  const distToMirror = Math.abs(normalDistance);
  
  // Calculate reflection size:
  // For each order of reflection, reduce size by a modest fixed percentage
  let reflectionRadius;
  
  // Size reduction factors by reflection depth:
  // depth 1 = 100% (original size)
  // depth 2 = 85% of original
  // depth 3 = 70% of original
  // depth 4+ = 60% of original
  const sizeFactors = [1, 0.85, 0.7, 0.6, 0.6, 0.6];
  const sizeFactor = sizeFactors[Math.min(depth - 1, sizeFactors.length - 1)];
  
  reflectionRadius = BALL_RADIUS * sizeFactor;
  
  // Don't show reflections that would be too small
  if (reflectionRadius < BALL_RADIUS * MIN_REFLECTION_SIZE_RATIO) return;
  
  // Reflection of object position is on opposite side of mirror, same distance from mirror
  const virtualObject = {
    x: object.x - 2 * normalDistance * mirrorNormal.x,
    y: object.y - 2 * normalDistance * mirrorNormal.y,
    radius: reflectionRadius,
    depth: depth,
    sourceMirror: mirror,
    // For higher-order reflections, parent is the reflection that generated this one
    parentReflection: object,
    // Will hold the hit points for ray path drawing
    hitPoints: []
  };
  
  // Skip reflections that are outside the canvas bounds
  if (virtualObject.x - virtualObject.radius < 0 || 
      virtualObject.x + virtualObject.radius > width ||
      virtualObject.y - virtualObject.radius < 0 || 
      virtualObject.y + virtualObject.radius > height) {
    return;
  }
  
  // Only add if this reflection is actually visible from current eye position
  if (isReflectionVisible(virtualObject)) {
    // Build the reflection chain back to the original ball
    const reflectionChain = buildReflectionChain(virtualObject);
    
    // Create an array of hit points - where the ray hits each mirror
    let hitPoints = calculateRayHitPoints(reflectionChain);
    
    // If we could calculate valid hit points, store them and add the reflection
    if (hitPoints && hitPoints.length === reflectionChain.length) {
      // Store hit points with the reflection for later use
      virtualObject.hitPoints = hitPoints;
      
      reflections.push(virtualObject);
      
      // Recursively calculate next level reflections
      for (let otherMirror of allMirrors) {
        // Skip the mirror that created this reflection
        if (otherMirror === mirror) continue;
        
        calculateHigherOrderReflection(otherMirror, virtualObject, reflectionRadius, depth + 1, allMirrors);
      }
    }
  }
}

/**
 * Calculate hit points for a reflection chain
 * Determines where light rays intersect mirrors in a reflection sequence
 * 
 * @param {Array} reflectionChain - The chain of reflections from ball to eye
 * @returns {Array} Array of hit points or null if invalid
 */
function calculateRayHitPoints(reflectionChain) {
  if (reflectionChain.length <= 1) {
    // First-order reflection - calculate the single hit point directly
    const mirror = reflectionChain[0].sourceMirror;
    
    // Calculate the virtual image of the ball in this mirror
    const ballToMirrorVec = {
      x: ball.x - mirror.x1,
      y: ball.y - mirror.y1
    };
    const normalDistance = dotProduct(ballToMirrorVec, mirror.normal);
    
    const virtualBall = {
      x: ball.x - 2 * normalDistance * mirror.normal.x,
      y: ball.y - 2 * normalDistance * mirror.normal.y
    };
    
    // Find where line from eye to virtual ball intersects the mirror
    const hitPoint = lineIntersection(
      eyePosition.x, eyePosition.y,
      virtualBall.x, virtualBall.y,
      mirror.x1, mirror.y1,
      mirror.x2, mirror.y2
    );
    
    if (hitPoint) {
      // Store the mirror and virtual image with the hit point
      hitPoint.mirror = mirror;
      hitPoint.virtualImage = virtualBall;
      hitPoint.mirrorIndex = mirrors.indexOf(mirror);
      
      return [hitPoint];
    } else {
      return null;
    }
  }
  
  // For higher-order reflections, we need to trace backwards from the eye
  let hitPoints = [];
  let mirrorIndices = [];
  let virtualImages = [];
  
  // Start from the eye, find the first hit point on the last mirror
  const lastMirror = reflectionChain[reflectionChain.length - 1].sourceMirror;
  const lastVirtualImage = reflectionChain[reflectionChain.length - 1];
  
  // Find where line from eye to virtual image hits the mirror
  const firstHitPoint = lineIntersection(
    eyePosition.x, eyePosition.y,
    lastVirtualImage.x, lastVirtualImage.y,
    lastMirror.x1, lastMirror.y1,
    lastMirror.x2, lastMirror.y2
  );
  
  if (!firstHitPoint) return null; // Can't find first hit point
  
  // Add the mirror and virtual image data to the hit point
  firstHitPoint.mirror = lastMirror;
  firstHitPoint.virtualImage = lastVirtualImage;
  firstHitPoint.mirrorIndex = mirrors.indexOf(lastMirror);
  
  // Add the first hit point
  hitPoints.push(firstHitPoint);
  
  // For each previous reflection in the chain
  let previousHitPoint = firstHitPoint;
  
  for (let i = reflectionChain.length - 2; i >= 0; i--) {
    const currentReflection = reflectionChain[i];
    const currentMirror = currentReflection.sourceMirror;
    
    // Find where line from previous hit point to this reflection's virtual image 
    // intersects with this mirror
    const hitPoint = lineIntersection(
      previousHitPoint.x, previousHitPoint.y,
      currentReflection.x, currentReflection.y,
      currentMirror.x1, currentMirror.y1,
      currentMirror.x2, currentMirror.y2
    );
    
    if (!hitPoint) return null; // Can't find hit point
    
    // Add mirror and virtual image data to the hit point
    hitPoint.mirror = currentMirror;
    hitPoint.virtualImage = currentReflection;
    hitPoint.mirrorIndex = mirrors.indexOf(currentMirror);
    
    // Add this hit point
    hitPoints.push(hitPoint);
    
    // Update previous hit point for next iteration
    previousHitPoint = hitPoint;
  }
  
  // Now check if there's a clear path from the last hit point to the ball
  // (no mirrors in between)
  const lastHitPoint = hitPoints[hitPoints.length - 1];
  
  for (let mirror of mirrors) {
    // Skip mirrors that are part of the reflection chain
    let isPartOfChain = false;
    for (let reflection of reflectionChain) {
      if (reflection.sourceMirror === mirror) {
        isPartOfChain = true;
        break;
      }
    }
    if (isPartOfChain) continue;
    
    // Check if this mirror blocks the path from last hit point to ball
    const intersection = lineIntersection(
      lastHitPoint.x, lastHitPoint.y,
      ball.x, ball.y,
      mirror.x1, mirror.y1,
      mirror.x2, mirror.y2
    );
    
    if (intersection) {
      // Calculate distances to determine if there's a blockage
      const hitPointToIntersectionDist = dist(lastHitPoint.x, lastHitPoint.y, intersection.x, intersection.y);
      const hitPointToBallDist = dist(lastHitPoint.x, lastHitPoint.y, ball.x, ball.y);
      
      // If there's a mirror between the hit point and the ball, path is invalid
      if (hitPointToIntersectionDist < hitPointToBallDist * 0.99) { // Small margin for floating point errors
        return null;
      }
    }
  }
  
  // Return the hit points in reverse order (from ball to eye)
  return hitPoints.reverse();
}

/**
 * Calculate all reflections in the scene
 * First calculates first-order reflections, then builds higher orders
 * This is the main physics engine function that computes all virtual images
 */
function calculateReflections() {
  // Clear previous reflections
  reflections = [];

  // For each mirror, check visibility and calculate first-order reflections
  for (let mirror of mirrors) {
    // Calculate reflection of ball across mirror line
    // Use the stored normal vector for this mirror
    const mirrorNormal = mirror.normal;
    
    // First find distance from ball to mirror along normal
    const ballToMirrorVec = {
      x: ball.x - mirror.x1,
      y: ball.y - mirror.y1
    };
    const normalDistance = dotProduct(ballToMirrorVec, mirrorNormal);
    
    // Only create reflections if ball is on the reflective side of the mirror (normal points toward ball)
    if (normalDistance <= 0) continue;
    
    // Calculate distance from ball to mirror
    const distToMirror = Math.abs(normalDistance);
    
    // For first-order reflections, maintain the same size as the original ball
    const reflectionRadius = ball.radius;
    
    // Reflection of ball position is on opposite side of mirror, same distance from mirror
    const virtualBall = {
      x: ball.x - 2 * normalDistance * mirrorNormal.x,
      y: ball.y - 2 * normalDistance * mirrorNormal.y,
      radius: reflectionRadius,
      depth: 1,
      sourceMirror: mirror,
      parentReflection: null, // First-order reflections don't have parent reflections
      hitPoints: [] // Will store hit points
    };
    
    // Skip reflections that are outside the canvas bounds
    if (virtualBall.x - virtualBall.radius < 0 || 
        virtualBall.x + virtualBall.radius > width ||
        virtualBall.y - virtualBall.radius < 0 || 
        virtualBall.y + virtualBall.radius > height) {
      continue;
    }
    
    // Check if this specific reflection is visible from the eye position
    if (isReflectionVisible(virtualBall)) {
      // Calculate the hit point for this first-order reflection
      const hitPoint = lineIntersection(
        eyePosition.x, eyePosition.y,
        virtualBall.x, virtualBall.y,
        mirror.x1, mirror.y1,
        mirror.x2, mirror.y2
      );
      
      if (hitPoint) {
        // Store hit point
        virtualBall.hitPoints = [hitPoint];
        
        // Add to reflections
        reflections.push(virtualBall);
      }
    }
  }

  // Calculate higher-order reflections
  const processedReflections = [...reflections]; // Copy the array of first-order reflections
  for (let reflection of processedReflections) {
    // Calculate reflection of this reflection in other mirrors
    for (let otherMirror of mirrors) {
      // Skip the mirror that created this reflection
      if (otherMirror === reflection.sourceMirror) continue;
      
      calculateHigherOrderReflection(otherMirror, reflection, reflection.radius, 2, mirrors);
    }
  }
}

/**
 * Find the closest reflection intersection for a ray
 * 
 * @param {Object} ray - The ray to trace (start and end points)
 * @returns {Object} The closest intersection and reflection vector
 */
function findClosestReflection(ray) {
  let closestIntersection = null;
  let closestDistance = Infinity;
  
  // Check each mirror for intersection
  for (let mirror of mirrors) {
    // Calculate mirror line segments
    const mirrorLine = {
      x1: mirror.x1, 
      y1: mirror.y1,
      x2: mirror.x2,
      y2: mirror.y2
    };
    
    // Find intersection point between ray and mirror
    const intersection = lineIntersection(
      ray.start.x, ray.start.y, ray.end.x, ray.end.y,
      mirrorLine.x1, mirrorLine.y1, mirrorLine.x2, mirrorLine.y2
    );
    
    // If intersection found
    if (intersection) {
      // Calculate distance from ray start to intersection
      const distance = dist(ray.start.x, ray.start.y, intersection.x, intersection.y);
      
      // If this is closer than previous intersections, save it
      if (distance < closestDistance) {
        // Calculate reflection vector
        const incidentVector = {
          x: ray.end.x - ray.start.x,
          y: ray.end.y - ray.start.y
        };
        const normalizedIncident = normalizeVector(incidentVector);
        
        // Get mirror normal (perpendicular to mirror line)
        const mirrorVector = {
          x: mirror.x2 - mirror.x1,
          y: mirror.y2 - mirror.y1
        };
        const mirrorNormal = {
          x: -mirrorVector.y,
          y: mirrorVector.x
        };
        const normalizedNormal = normalizeVector(mirrorNormal);
        
        // Calculate reflection vector using formula: r = i - 2(i·n)n
        // Where i is incident vector, n is normal vector, and r is reflection vector
        const dot = dotProduct(normalizedIncident, normalizedNormal);
        const reflectionVector = {
          x: normalizedIncident.x - 2 * dot * normalizedNormal.x,
          y: normalizedIncident.y - 2 * dot * normalizedNormal.y
        };
        
        closestIntersection = {
          point: intersection,
          reflection: reflectionVector
        };
        closestDistance = distance;
      }
    }
  }
  
  return closestIntersection;
}

/**
 * Calculate intersection between two line segments
 * Core geometric function for ray-mirror intersections
 * 
 * @param {number} x1 - First line start x-coordinate
 * @param {number} y1 - First line start y-coordinate
 * @param {number} x2 - First line end x-coordinate
 * @param {number} y2 - First line end y-coordinate
 * @param {number} x3 - Second line start x-coordinate
 * @param {number} y3 - Second line start y-coordinate
 * @param {number} x4 - Second line end x-coordinate
 * @param {number} y4 - Second line end y-coordinate
 * @returns {Object} Intersection point or null if no intersection
 */
function lineIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
  // Calculate denominator
  const den = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  
  // If lines are parallel
  if (den === 0) {
    return null;
  }
  
  // Calculate ua and ub
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / den;
  
  // If intersection is within both line segments
  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    const x = x1 + ua * (x2 - x1);
    const y = y1 + ua * (y2 - y1);
    return {x, y};
  }
  
  return null;
}

// ===========================
// VECTOR MATH UTILITIES
// ===========================

/**
 * Normalize a vector to unit length
 * 
 * @param {Object} v - Vector with x,y components
 * @returns {Object} Normalized vector
 */
function normalizeVector(v) {
  const length = Math.sqrt(v.x * v.x + v.y * v.y);
  return {
    x: v.x / length,
    y: v.y / length
  };
}

/**
 * Calculate dot product between two vectors
 * 
 * @param {Object} v1 - First vector with x,y components
 * @param {Object} v2 - Second vector with x,y components
 * @returns {number} Dot product result
 */
function dotProduct(v1, v2) {
  return v1.x * v2.x + v1.y * v2.y;
}

// ===========================
// INTERACTION HANDLERS
// ===========================

/**
 * Handle mouse drag events
 * Moves objects based on mouse position, respecting puzzle constraints
 */
mouseDragged = function() {
  // If not dragging anything, no need to proceed
  if (!isDragging) return;
  
  // Important: Get the movement permission from the puzzle system
  // This ensures path identification and detective modes prohibit movement
  const allowMovement = typeof window.canMoveObjects === 'function' 
                         ? window.canMoveObjects() 
                         : true;
  
  // If movement is not allowed by the puzzle system, exit early
  if (!allowMovement) {
    console.log("Movement prohibited by current puzzle mode");
    return;
  }
  
  // Handle dragging based on object type
  if (draggedObject === 'ball') {
    // Check if the ball is specifically movable
    if (typeof window.isObjectMovable === 'function' && !window.isObjectMovable('ball')) {
      console.log("Ball movement is not allowed in this puzzle");
      return;
    }
    
    // Move the ball to the mouse position
    ball.x = mouseX;
    ball.y = mouseY;
    
    // Keep ball within canvas bounds
    ball.x = constrain(ball.x, ball.radius, width - ball.radius);
    ball.y = constrain(ball.y, ball.radius, height - ball.radius);
    
    // Recalculate reflections
    calculateReflections();
  } 
  else if (draggedObject === 'mirror') {
    // Check if mirrors are specifically movable
    if (typeof window.isObjectMovable === 'function' && !window.isObjectMovable('mirror')) {
      console.log("Mirrors are not movable in this puzzle");
      return;
    }
    
    // Handle mirror movement
    if (draggedMirrorPoint) {
      // Get the mirror being dragged by endpoint
      const mirror = mirrors[draggedMirrorPoint.index];
      
      // Update the appropriate endpoint of the center line
      if (draggedMirrorPoint.point === 1) {
        mirror.x1 = mouseX;
        mirror.y1 = mouseY;
      } else {
        mirror.x2 = mouseX;
        mirror.y2 = mouseY;
      }
      
      // Keep endpoints within canvas bounds
      mirror.x1 = constrain(mirror.x1, 0, width);
      mirror.y1 = constrain(mirror.y1, 0, height);
      mirror.x2 = constrain(mirror.x2, 0, width);
      mirror.y2 = constrain(mirror.y2, 0, height);
        
      // Recalculate the mirror's normal vector
      const mirrorVector = { 
        x: mirror.x2 - mirror.x1, 
        y: mirror.y2 - mirror.y1 
      };
      const mirrorLength = Math.sqrt(mirrorVector.x * mirrorVector.x + mirrorVector.y * mirrorVector.y);
      
      // Get normalized normal vector
      mirror.normal = {
        x: -mirrorVector.y / mirrorLength,
        y: mirrorVector.x / mirrorLength
      };
    }
    else if (draggedMirrorIndex !== null) {
      // Get the mirror being dragged from the middle
      const mirror = mirrors[draggedMirrorIndex];
      
      // Calculate the displacement from last frame
      const dx = mouseX - pmouseX;
      const dy = mouseY - pmouseY;
      
      // Move both endpoints by the same amount to preserve orientation
      mirror.x1 += dx;
      mirror.y1 += dy;
      mirror.x2 += dx;
      mirror.y2 += dy;
      
      // Keep within canvas bounds
      if (mirror.x1 < 0) {
        mirror.x2 += (0 - mirror.x1);
        mirror.x1 = 0;
      } else if (mirror.x1 > width) {
        mirror.x2 -= (mirror.x1 - width);
        mirror.x1 = width;
      }
      
      if (mirror.y1 < 0) {
        mirror.y2 += (0 - mirror.y1);
        mirror.y1 = 0;
      } else if (mirror.y1 > height) {
        mirror.y2 -= (mirror.y1 - height);
        mirror.y1 = height;
      }
      
      if (mirror.x2 < 0) {
        mirror.x1 += (0 - mirror.x2);
        mirror.x2 = 0;
      } else if (mirror.x2 > width) {
        mirror.x1 -= (mirror.x2 - width);
        mirror.x2 = width;
      }
      
      if (mirror.y2 < 0) {
        mirror.y1 += (0 - mirror.y2);
        mirror.y2 = 0;
      } else if (mirror.y2 > height) {
        mirror.y1 -= (mirror.y2 - height);
        mirror.y1 = height;
      }
    }
    
    // For both endpoint and middle dragging, update the mirror sides
    const mirror = draggedMirrorPoint ? mirrors[draggedMirrorPoint.index] : mirrors[draggedMirrorIndex];
    
    // Update both sides' coordinates
    const halfWidth = mirror.width / 2;
    
    // Update blue side coordinates
    mirror.blueX1 = mirror.x1 + mirror.normal.x * halfWidth;
    mirror.blueY1 = mirror.y1 + mirror.normal.y * halfWidth;
    mirror.blueX2 = mirror.x2 + mirror.normal.x * halfWidth;
    mirror.blueY2 = mirror.y2 + mirror.normal.y * halfWidth;
    
    // Update black side coordinates
    mirror.blackX1 = mirror.x1 - mirror.normal.x * halfWidth;
    mirror.blackY1 = mirror.y1 - mirror.normal.y * halfWidth;
    mirror.blackX2 = mirror.x2 - mirror.normal.x * halfWidth;
    mirror.blackY2 = mirror.y2 - mirror.normal.y * halfWidth;
    
    // Recalculate reflections
    calculateReflections();
  }
  else if (draggedObject === 'eye') {
    // Check if the eye is specifically movable
    if (typeof window.isObjectMovable === 'function' && !window.isObjectMovable('eye')) {
      console.log("Eye movement is not allowed in this puzzle");
      return;
    }
    
    // Move the eye to the mouse position
    eyePosition.x = mouseX;
    eyePosition.y = mouseY;
    
    // Keep eye within canvas bounds
    eyePosition.x = constrain(eyePosition.x, EYE_SIZE / 2, width - EYE_SIZE / 2);
    eyePosition.y = constrain(eyePosition.y, EYE_SIZE / 2, height - EYE_SIZE / 2);
    
    // Recalculate reflections
    calculateReflections();
  }
};

/**
 * Handle mouse press events
 * Handles ray selection, object dragging, and puzzle interactions
 */
mousePressed = function() {
  console.log("===== MOUSE PRESSED IN LIGHT-DETECTIVE =====");
  console.log("Mouse position:", mouseX, mouseY);
  console.log("showRayPaths:", showRayPaths);
  console.log("isPuzzleMode:", typeof isPuzzleMode !== 'undefined' ? isPuzzleMode : 'undefined');
  console.log("isPathIdentificationMode:", typeof isPathIdentificationMode !== 'undefined' ? isPathIdentificationMode : 'undefined');
  
  // DETERMINE CURRENT PUZZLE TYPE
  const inPathIdentificationMode = typeof isPathIdentificationMode !== 'undefined' && isPathIdentificationMode;
  const inDetectiveMode = typeof isDetectiveMode !== 'undefined' && isDetectiveMode;
  const inPresentationMode = isPuzzleMode && !inPathIdentificationMode && !inDetectiveMode && 
                            typeof currentPuzzle !== 'undefined' && currentPuzzle && currentPuzzle.type === "presentation";
  const inGenerationMode = isPuzzleMode && !inPathIdentificationMode && !inDetectiveMode && 
                            typeof currentPuzzle !== 'undefined' && currentPuzzle && currentPuzzle.type === "generation";
  
  console.log("Detected puzzle modes:", {
    pathIdentification: inPathIdentificationMode,
    detective: inDetectiveMode,
    presentation: inPresentationMode,
    generation: inGenerationMode
  });
  
  // PATH IDENTIFICATION: Give highest priority
  if (inPathIdentificationMode) {
    console.log("In path identification mode - giving priority to puzzle handler");
    
    // Give puzzle module chance to handle click
    if (window.handlePuzzleMousePressed && window.handlePuzzleMousePressed()) {
      console.log("Click handled by path identification system");
      return;
    }
  }
  
  // Check for reflection clicks in either detective mode or when rayPaths are shown
  // Place this BEFORE the movement check so we can still click reflections in detective mode
  const shouldCheckReflections = inDetectiveMode || showRayPaths; 
  
  if (shouldCheckReflections) {
    console.log("Checking for clicks on reflections");
    // Check each visible reflection
    for (let i = 0; i < reflections.length; i++) {
      const reflection = reflections[i];
      // Only check visible reflections
      if (!isReflectionVisible(reflection)) {
        console.log(`Reflection ${i} not visible, skipping`);
        continue;
      }
      
      // Check if mouse is within the reflection's circle
      const distance = dist(mouseX, mouseY, reflection.x, reflection.y);
      const isWithinRadius = distance < reflection.radius;
      console.log(`Reflection ${i} - distance: ${distance}, radius: ${reflection.radius}, within: ${isWithinRadius}`);
      
      if (isWithinRadius) {
        // Show rays for this reflection
        console.log(`Clicked on visible reflection ${i} - setting currentRayIndex`);
        currentRayIndex = i;
        if (!showRayPaths) {
          // Auto-enable ray paths if they aren't already visible
          showRayPaths = true;
          const toggleBtn = document.getElementById('togglePaths');
          if (toggleBtn) toggleBtn.textContent = "Hide Rays";
        }
        return; // Exit early since we handled the click
      }
    }
  }

  // OTHER PUZZLE MODES
  if (isPuzzleMode && !inPathIdentificationMode) {
    console.log("Checking if handlePuzzleMousePressed exists for other puzzle types:", !!window.handlePuzzleMousePressed);
    if (window.handlePuzzleMousePressed && window.handlePuzzleMousePressed()) {
      console.log("Click handled by puzzle system");
      return;
    }
  }
  
  // OBJECT DRAGGING
  // Check if objects can be moved
  const allowMovement = typeof window.canMoveObjects === 'function'
                         ? window.canMoveObjects()
                         : true;
  
  console.log("Movement allowed:", allowMovement);
  
  // If movement is not allowed, don't start dragging anything
  if (!allowMovement) {
    console.log("Movement not allowed, ignoring drag attempt");
    return;
  }
  
  console.log("Checking for other clickable objects");
  
  // If we didn't click a reflection, handle regular dragging logic
  // Check if clicked on the ball
  if (dist(mouseX, mouseY, ball.x, ball.y) < ball.radius) {
    // Check if the ball is specifically movable
    if (typeof window.isObjectMovable === 'function' && !window.isObjectMovable('ball')) {
      console.log("Ball is not movable in this puzzle");
      return;
    }
    
    console.log("Started dragging ball");
    isDragging = true;
    draggedObject = 'ball';
    return;
  }
  
  // Check if clicked on a mirror endpoint or middle
  for (let i = 0; i < mirrors.length; i++) {
    const mirror = mirrors[i];
    
    // Check first endpoint of either side
    if (dist(mouseX, mouseY, mirror.x1, mirror.y1) < 10 ||
        dist(mouseX, mouseY, mirror.blueX1, mirror.blueY1) < 10 ||
        dist(mouseX, mouseY, mirror.blackX1, mirror.blackY1) < 10) {
      
      // Check if mirrors are specifically movable
      if (typeof window.isObjectMovable === 'function' && !window.isObjectMovable('mirror')) {
        console.log("Mirrors are not movable in this puzzle");
        return;
      }
      
      isDragging = true;
      draggedObject = 'mirror';
      draggedMirrorPoint = {index: i, point: 1};
      draggedMirrorIndex = null;
      return;
    }
    
    // Check second endpoint of either side
    if (dist(mouseX, mouseY, mirror.x2, mirror.y2) < 10 ||
        dist(mouseX, mouseY, mirror.blueX2, mirror.blueY2) < 10 ||
        dist(mouseX, mouseY, mirror.blackX2, mirror.blackY2) < 10) {
      
      // Check if mirrors are specifically movable
      if (typeof window.isObjectMovable === 'function' && !window.isObjectMovable('mirror')) {
        console.log("Mirrors are not movable in this puzzle");
        return;
      }
      
      isDragging = true;
      draggedObject = 'mirror';
      draggedMirrorPoint = {index: i, point: 2};
      draggedMirrorIndex = null;
      return;
    }
    
    // Check if clicked on the middle of a mirror
    // First calculate the midpoint
    const midX = (mirror.x1 + mirror.x2) / 2;
    const midY = (mirror.y1 + mirror.y2) / 2;
    
    // Check if clicked near the midpoint or along the line segment
    if (dist(mouseX, mouseY, midX, midY) < 15 || 
        isPointNearLineSegment(mouseX, mouseY, mirror.x1, mirror.y1, mirror.x2, mirror.y2, 10) ||
        isPointNearLineSegment(mouseX, mouseY, mirror.blueX1, mirror.blueY1, mirror.blueX2, mirror.blueY2, 10) ||
        isPointNearLineSegment(mouseX, mouseY, mirror.blackX1, mirror.blackY1, mirror.blackX2, mirror.blackY2, 10)) {
      
      // Check if mirrors are specifically movable
      if (typeof window.isObjectMovable === 'function' && !window.isObjectMovable('mirror')) {
        console.log("Mirrors are not movable in this puzzle");
        return;
      }
      
      isDragging = true;
      draggedObject = 'mirror';
      draggedMirrorPoint = null;
      draggedMirrorIndex = i;
      return;
    }
  }
  
  // Check if clicked on the eye
  if (dist(mouseX, mouseY, eyePosition.x, eyePosition.y) < EYE_SIZE / 2) {
    // Check if the eye is specifically movable
    if (typeof window.isObjectMovable === 'function' && !window.isObjectMovable('eye')) {
      console.log("Eye is not movable in this puzzle");
      return;
    }
    
    isDragging = true;
    draggedObject = 'eye';
    return;
  }
  
  console.log("Click not handled by any object");
};

/**
 * Check if a point is within a threshold distance of a line segment
 * Used for mirror selection during interaction
 * 
 * @param {number} px - Point x-coordinate
 * @param {number} py - Point y-coordinate
 * @param {number} x1 - Line segment start x-coordinate
 * @param {number} y1 - Line segment start y-coordinate
 * @param {number} x2 - Line segment end x-coordinate
 * @param {number} y2 - Line segment end y-coordinate
 * @param {number} threshold - Maximum distance to be considered "near"
 * @returns {boolean} True if point is near line segment
 */
function isPointNearLineSegment(px, py, x1, y1, x2, y2, threshold) {
  // Vector from line start to point
  const dx = px - x1;
  const dy = py - y1;
  
  // Vector representing the line
  const lineVectorX = x2 - x1;
  const lineVectorY = y2 - y1;
  
  // Calculate squared length of the line vector (to avoid sqrt)
  const lineLengthSquared = lineVectorX * lineVectorX + lineVectorY * lineVectorY;
  
  // If the line is very short, treat it as a point
  if (lineLengthSquared < 0.0001) {
    return dist(px, py, x1, y1) < threshold;
  }
  
  // Calculate dot product of (point - line start) and line vector
  const dotProduct = dx * lineVectorX + dy * lineVectorY;
  
  // Calculate projection ratio (0 = at start point, 1 = at end point)
  const projectionRatio = constrain(dotProduct / lineLengthSquared, 0, 1);
  
  // Find the closest point on the line segment
  const closestX = x1 + projectionRatio * lineVectorX;
  const closestY = y1 + projectionRatio * lineVectorY;
  
  // Check if the point is within the threshold distance
  return dist(px, py, closestX, closestY) < threshold;
}

/**
 * Add a new mirror to the scene
 * Places a horizontal mirror in the bottom left corner
 */
function addNewMirror() {
  console.log("Adding new mirror...");
  
  // Place in bottom left corner
  const bottomLeftX = width * 0.2;
  const bottomLeftY = height * 0.95;
  console.log("Mirror position: bottom left corner at", bottomLeftX, bottomLeftY);
  
  // Fixed horizontal orientation
  const angle = 0; // Horizontal
  
  // Calculate endpoints
  const x1 = bottomLeftX - MIRROR_LENGTH / 2;
  const y1 = bottomLeftY;
  const x2 = bottomLeftX + MIRROR_LENGTH / 2;
  const y2 = bottomLeftY;
  console.log("Mirror endpoints:", x1, y1, "to", x2, y2);
  
  // Calculate the mirror's normal vector (perpendicular to mirror)
  const mirrorVector = { 
    x: x2 - x1, 
    y: y2 - y1 
  };
  const mirrorLength = Math.sqrt(mirrorVector.x * mirrorVector.x + mirrorVector.y * mirrorVector.y);
  
  // Get normalized normal vector
  const normal = {
    x: -mirrorVector.y / mirrorLength,
    y: mirrorVector.x / mirrorLength
  };
  console.log("Mirror normal:", normal.x, normal.y);
  
  // Calculate the actual positions of both sides of the mirror
  const halfWidth = MIRROR_WIDTH / 2;
  
  // Blue side coordinates
  const blueX1 = x1 + normal.x * halfWidth;
  const blueY1 = y1 + normal.y * halfWidth;
  const blueX2 = x2 + normal.x * halfWidth;
  const blueY2 = y2 + normal.y * halfWidth;
  
  // Black side coordinates
  const blackX1 = x1 - normal.x * halfWidth;
  const blackY1 = y1 - normal.y * halfWidth;
  const blackX2 = x2 - normal.x * halfWidth;
  const blackY2 = y2 - normal.y * halfWidth;
  
  // Add the new mirror to the mirrors array
  mirrors.push({
    // Center line (for calculation purposes)
    x1, y1, x2, y2,
    // Blue reflective side
    blueX1, blueY1, blueX2, blueY2,
    // Black non-reflective side
    blackX1, blackY1, blackX2, blackY2,
    // Properties
    thickness: MIRROR_THICKNESS,
    normal: normal,
    width: MIRROR_WIDTH
  });
  console.log("New mirror added at index", mirrors.length - 1);
  console.log("Mirror array now contains", mirrors.length, "mirrors");
  
  // Recalculate reflections with the new mirror
  console.log("Recalculating reflections...");
  calculateReflections();
  console.log("Reflections calculated:", reflections.length, "reflections found");
}

/**
 * Determine which mirrors are directly visible from the eye
 * Used for optimization and game mechanics
 */
function getVisibleMirrors() {
  const visibleMirrors = [];
  
  for (let mirror of mirrors) {
    // To check if a mirror is visible, sample multiple points along the blue side
    const numSamples = 5;
    let anyPointVisible = false;
    
    for (let i = 0; i <= numSamples; i++) {
      // Sample points along the blue side of the mirror
      const t = i / numSamples;
      const sampleX = mirror.blueX1 * (1 - t) + mirror.blueX2 * t;
      const sampleY = mirror.blueY1 * (1 - t) + mirror.blueY2 * t;
      
      // Check if there's a clear line of sight from eye to this sample point
      let hasDirectSight = true;
      
      for (let otherMirror of mirrors) {
        // Skip the mirror we're testing
        if (otherMirror === mirror) continue;
        
        // Check if any other mirror blocks the view
        const intersection = lineIntersection(
          eyePosition.x, eyePosition.y,
          sampleX, sampleY,
          otherMirror.x1, otherMirror.y1,
          otherMirror.x2, otherMirror.y2
        );
        
        if (intersection) {
          // Calculate distance to the intersection and to the sample point
          const distToIntersection = dist(eyePosition.x, eyePosition.y, intersection.x, intersection.y);
          const distToSample = dist(eyePosition.x, eyePosition.y, sampleX, sampleY);
          
          // If the intersection is closer than the sample, view is blocked
          if (distToIntersection < distToSample * 0.99) { // Small margin for floating point errors
            hasDirectSight = false;
            break;
          }
        }
      }
      
      // Check if we're looking at the blue side
      if (hasDirectSight) {
        const eyeToSample = {
          x: sampleX - eyePosition.x,
          y: sampleY - eyePosition.y
        };
        
        // If dot product is negative, we're looking at the blue side
        const lookingAtBlueSide = dotProduct(mirror.normal, eyeToSample) < 0;
        
        if (lookingAtBlueSide) {
          anyPointVisible = true;
          break;
        }
      }
    }
    
    if (anyPointVisible) {
      visibleMirrors.push(mirror);
    }
  }
  
  return visibleMirrors;
}

// UTILITY 

function mouseReleased() {
  // Reset dragging state regardless of puzzle state
  isDragging = false;
  draggedObject = null;
  draggedMirrorPoint = null;
  draggedMirrorIndex = null;
}

function keyPressed() {
  if (key === 'd' || key === 'D') {
    debugMode = !debugMode;
    console.log(`Debug mode ${debugMode ? 'enabled' : 'disabled'}`);
    lastDebuggedReflectionIndex = -1;
  }
}

// Handle double-click events used in detective game
doubleClicked = function() {
  if (window.handlePuzzleDoubleClick && window.handlePuzzleDoubleClick()) {
    return false; // Prevent default browser behavior
  }

  return true;
}; 