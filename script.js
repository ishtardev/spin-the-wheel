// Canvas wheel script
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');

/**
 * Prize options that will appear on the wheel
 * Modify this array to customize the prize names
 */
const slices = [
    'Prize 1', 'Prize 2', 'Prize 3', 'Prize 4',
    'Prize 5', 'Prize 6', 'Prize 7', 'Prize 8'
];

/**
 * Color scheme for wheel segments
 * Modify this array to customize the wheel's appearance
 */
const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
    '#9966FF', '#FF9F40', '#C9CBCF', '#FF6F61'
];

const numSlices = slices.length;
const arcSize = (2 * Math.PI) / numSlices; // Size of each wheel segment in radians
let angle = 0;               // Current rotation angle of the wheel
let spinning = false;        // Flag to track if the wheel is currently spinning
let spinVelocity = 0;        // Current rotation speed
let spinAcceleration = 0;    // Rate of change of rotation speed

// Audio variables
let audioCtx = null;
let spinOsc = null;
let spinGain = null;
let spinFilter = null;

/**
 * Creates or ensures AudioContext is initialized
 * Handles browser compatibility for AudioContext
 */
function ensureAudioContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

/**
 * Generates the spinning wheel sound effect
 * Creates and configures audio oscillator with filters for the wheel spinning sound
 */
function startSpinSound() {
    ensureAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (spinOsc) return; // already playing

    // Create and configure oscillator for spinning sound
    spinOsc = audioCtx.createOscillator();
    spinOsc.type = 'sawtooth';  // Sawtooth waveform creates a mechanical whirring sound
    
    // Add low-pass filter to smooth the harsh sawtooth wave
    spinFilter = audioCtx.createBiquadFilter();
    spinFilter.type = 'lowpass';
    spinFilter.frequency.value = 800;
    
    // Control volume with gain node
    spinGain = audioCtx.createGain();
    spinGain.gain.value = 0.0001;  // Start very quiet

    // Connect the audio nodes together
    spinOsc.connect(spinFilter);
    spinFilter.connect(spinGain);
    spinGain.connect(audioCtx.destination);
    spinOsc.start();

    // Fade in the sound gradually
    spinGain.gain.cancelScheduledValues(audioCtx.currentTime);
    spinGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    spinGain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.08);
}

function updateSpinSound() {
    if (!spinOsc || !audioCtx) return;
    // Map spinVelocity to audible frequency/filter values
    const baseFreq = 180 + Math.abs(spinVelocity) * 2000; // Hz
    const filterFreq = 600 + Math.abs(spinVelocity) * 1800;
    spinOsc.frequency.setTargetAtTime(Math.max(80, baseFreq), audioCtx.currentTime, 0.02);
    spinFilter.frequency.setTargetAtTime(Math.min(12000, filterFreq), audioCtx.currentTime, 0.02);
}

function stopSpinSound() {
    if (!spinGain || !spinOsc) return;
    const t = audioCtx.currentTime;
    spinGain.gain.cancelScheduledValues(t);
    spinGain.gain.setValueAtTime(spinGain.gain.value, t);
    spinGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    // stop and clean up after fade
    setTimeout(() => {
        try {
            if (spinOsc) spinOsc.stop();
        } catch (e) {}
        if (spinOsc) { spinOsc.disconnect(); spinOsc = null; }
        if (spinFilter) { spinFilter.disconnect(); spinFilter = null; }
        if (spinGain) { spinGain.disconnect(); spinGain = null; }
    }, 500);
}

/**
 * Plays a celebratory sound when a prize is won
 * Creates a pleasant two-tone chime using layered oscillators
 */
function playWinSound() {
    ensureAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;

    // First chime tone - lower frequency with sine wave
    const o1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    o1.type = 'sine';  // Smooth sine wave for base tone
    o1.frequency.setValueAtTime(880, now);  // A5 note
    g1.gain.setValueAtTime(0.0001, now);    // Start silent
    
    // Connect and start the oscillator
    o1.connect(g1);
    g1.connect(audioCtx.destination);
    o1.start(now);
    
    // Create pitch bend effect and fade out
    g1.gain.exponentialRampToValueAtTime(0.12, now + 0.02);  // Quick fade in
    o1.frequency.exponentialRampToValueAtTime(660, now + 0.35);  // Slide down to E5
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);  // Slow fade out
    o1.stop(now + 1.15);  // Stop after fade out

    // Second chime tone - higher frequency with triangle wave
    const o2 = audioCtx.createOscillator();
    const g2 = audioCtx.createGain();
    o2.type = 'triangle';  // Triangle wave for harmonically rich tone
    o2.frequency.setValueAtTime(1320, now + 0.04);  // E6 note, slightly delayed
    g2.gain.setValueAtTime(0.0001, now + 0.04);
    
    // Connect and start the second oscillator
    o2.connect(g2);
    g2.connect(audioCtx.destination);
    o2.start(now + 0.04);
    
    // Shorter envelope for second tone
    g2.gain.exponentialRampToValueAtTime(0.08, now + 0.08);  // Quick fade in
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);  // Faster fade out
    o2.stop(now + 0.65);  // Stop after fade out
}

// Result tab elements
const resultTab = document.getElementById('resultTab');
const prizeNameEl = document.getElementById('prizeName');
const spinAgainBtn = document.getElementById('spinAgainBtn');
const closeResultBtn = document.getElementById('closeResultBtn');

/**
 * Displays the result panel with the prize name
 * @param {string} prize - The name of the won prize to display
 */
function showResult(prize) {
    prizeNameEl.textContent = prize;  // Set the prize text
    resultTab.classList.add('open');  // Apply CSS class for animation
    resultTab.setAttribute('aria-hidden', 'false');  // Accessibility update
}

/**
 * Hides the result panel
 * Used when starting a new spin or when the user closes the panel
 */
function hideResult() {
    resultTab.classList.remove('open');  // Remove CSS class to animate out
    resultTab.setAttribute('aria-hidden', 'true');  // Hide from screen readers
}

/**
 * Renders the prize wheel on the canvas
 * @param {number} currentAngle - Current rotation angle of the wheel in radians
 */
function drawWheel(currentAngle) {
    // Clear the canvas before redrawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;  // Wheel radius with small margin
    
    // Draw each slice of the wheel
    for (let i = 0; i < numSlices; i++) {
        // Create pie slice path
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);  // Start at center
        ctx.arc(
            centerX,
            centerY,
            radius,
            currentAngle + i * arcSize,
            currentAngle + (i + 1) * arcSize
        );
        ctx.closePath();
        
        // Fill slice with its color
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        
        // Draw prize text
        ctx.save();
        ctx.translate(centerX, centerY);  // Move to center
        ctx.rotate(currentAngle + (i + 0.5) * arcSize);  // Rotate to middle of slice
        ctx.textAlign = 'right';
        ctx.font = '18px Arial';
        ctx.fillStyle = '#222';
        ctx.fillText(slices[i], radius - 20, 10);  // Position text inside slice
        ctx.restore();
    }
    
    // Draw pointer (triangle pointing down into the wheel)
    ctx.save();
    ctx.beginPath();
    // Base sits outside the top of the wheel, apex points down toward the center
    ctx.moveTo(centerX - 20, centerY - radius - 10);
    ctx.lineTo(centerX + 20, centerY - radius - 10);
    ctx.lineTo(centerX, centerY - radius + 20);
    ctx.closePath();
    ctx.fillStyle = '#e53935';  // Red pointer
    ctx.fill();
    ctx.restore();
}

/**
 * Main animation loop for the spinning wheel
 * Handles wheel rotation, physics simulation, and detecting when spinning stops
 */
function animate() {
    if (!spinning) return;
    
    // Update wheel position based on current velocity
    angle += spinVelocity;
    
    // Apply friction to gradually slow the wheel down
    spinVelocity *= 0.985;
    
    // Check if the wheel has slowed enough to stop
    if (spinVelocity < 0.01) {
        spinning = false;
        spinVelocity = 0;
        
        // Wheel stopped — determine which prize was selected
        const selectedIndex = getSelectedSliceIndex();
        const prize = slices[selectedIndex];
        
        // Play sounds and show result
        stopSpinSound();
        playWinSound();
        showResult(prize);
    }
    
    // Update audio effect to match current spin speed
    updateSpinSound();
    
    // Redraw the wheel at its new position
    drawWheel(angle);
    
    // Continue animation loop
    requestAnimationFrame(animate);
}

/**
 * Determines which slice is currently at the pointer position
 * @returns {number} The index of the selected slice/prize
 */
function getSelectedSliceIndex() {
    const twoPI = Math.PI * 2;
    
    // Normalize angle to range [0, 2π)
    const normalized = ((angle % twoPI) + twoPI) % twoPI;
    
    // Calculate which slice is at the pointer (top position at 270° or 3π/2)
    const pointerOnWheel = (3 * Math.PI / 2 - normalized + twoPI) % twoPI;
    
    // Convert the angle to a slice index
    const index = Math.floor(pointerOnWheel / arcSize) % numSlices;
    return index;
}

// Set up the main spin button
spinBtn.addEventListener('click', () => {
    if (spinning) return;  // Prevent multiple spins at once
    hideResult();
    
    // Set random initial velocity for unpredictable results
    spinVelocity = Math.random() * 0.3 + 0.35;
    spinning = true;
    
    // Start sound effects and animation loop
    startSpinSound();
    animate();
});

// Set up the "Spin Again" button in the results panel
spinAgainBtn.addEventListener('click', () => {
    hideResult();
    if (!spinning) {
        // Use same spin logic as the main button
        spinVelocity = Math.random() * 0.3 + 0.35;
        spinning = true;
        startSpinSound();
        animate();
    }
});
closeResultBtn.addEventListener('click', hideResult);

// Initial draw
drawWheel(angle);
