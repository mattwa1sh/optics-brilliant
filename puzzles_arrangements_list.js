/** 
 * This file contains lists of puzzles and arrangements,
 * for use when directory listings aren't available on static servers.
 */

const PUZZLES_LIST = [
  {
    filename: "free-play.json",
    name: "Free Play"
  },
  {
    filename: "create-reflection.json",
    name: "World's Easiest Optics Puzzle"
  },
  {
    filename: "eye-puzzle.json",
    name: "Move The Eye"
  },
  {
    filename: "simple-2-order.json",
    name: "Simple 2nd Order"
  },
  {
    filename: "2-order-eye.json",
    name: "2nd Order By Eye/Ball"
  },
  {
    filename: "two-reflections.json",
    name: "Two Reflections ONLY"
  },
  {
    filename: "15-reflections.json",
    name: "15 Reflections Challenge"
  },
  {
    filename: "11-14-reflections.json",
    name: "11-14 Reflections Challenge"
  },
  {
    filename: "simple-identification.json",
    name: "Simple Identification"
  },
  {
    filename: "random-identification.json",
    name: "Random Identification 1"
  },
  {
    filename: "random-identification-2.json",
    name: "Random Identification 2"
  },
  {
    filename: "random-identification-3.json",
    name: "Random Identification 3"
  },
  {
    filename: "investigator_simple.json",
    name: "Simple Investigator Case"
  },
  {
    filename: "investigator_2.json",
    name: "2nd Investigator Case"
  },
  {
    filename: "investigator_3.json",
    name: "3rd Investigator Case"
  },
];

const ARRANGEMENTS_LIST = [
  "2-order.json",
  "basic-setup.json",
  "circle.json",
  "colorful.json",
  "p3.json",
  "parallel-2.json",
  "parallel-mirrors.json", 
  "perpendiculary-3-mirror.json",
  "perpy-tricky-2.json",
  "perpy-tricky.json",
  "ray-problems-2.json",
  "ray-problems.json",
  "simple-2nd-order.json",
  "weird-face.json",
  "whale.json",
  "wrong-optics-1.json",
  "3-mirrors.json",
  "4-mirrors.json",
  "x.json",
  "x2.json"
];

function populateArrangementsList() {
  const select = document.getElementById('arrangementSelect');
  
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  ARRANGEMENTS_LIST.forEach(filename => {
    const option = document.createElement('option');
    option.value = filename;
    option.textContent = filename;
    select.appendChild(option);
  });
  
  console.log(`Added ${ARRANGEMENTS_LIST.length} arrangements to dropdown`);
}

function populatePuzzlesList() {
  const select = document.getElementById('puzzleSelect');
  
  while (select.options.length > 1) {
    select.remove(1);
  }
  
  PUZZLES_LIST.forEach(puzzle => {
    const option = document.createElement('option');
    option.value = puzzle.filename;
    option.textContent = puzzle.name;
    select.appendChild(option);
  });
  
  console.log(`Added ${PUZZLES_LIST.length} puzzles to dropdown`);
}

/**
 * Get the next puzzle filename after the current one
 * @param {string} currentPuzzleFilename - The filename of the current puzzle
 * @returns {string|null} The filename of the next puzzle, or null if there is no next puzzle
 */
function getNextPuzzleFilename(currentPuzzleFilename) {
  if (!currentPuzzleFilename) return null;
  
  const currentIndex = PUZZLES_LIST.findIndex(puzzle => puzzle.filename === currentPuzzleFilename);
  
  if (currentIndex === -1 || currentIndex >= PUZZLES_LIST.length - 1) {
    return null;
  }
  
  return PUZZLES_LIST[currentIndex + 1].filename;
} 