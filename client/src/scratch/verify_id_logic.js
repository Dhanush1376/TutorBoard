/**
 * Verification Script: SVG ID Uniqueness Logic
 * 
 * Verifies that our ID generation logic correctly appends unique suffixes
 * and handles potentially problematic characters like colons from useId().
 */

function generateId(base, objId, uid) {
  return `${base}-${objId}-${uid.replace(/:/g, '')}`;
}

const mockIds = [':r0:', ':r1:', ':r2:'];
const objId = 'node-1';

console.log("--- START TEST ---");

const results = mockIds.map(uid => generateId('orb-grad', objId, uid));

results.forEach((id, i) => {
    console.log(`Instance ${i} ID: ${id}`);
});

const uniqueCount = new Set(results).size;

if (uniqueCount === mockIds.length) {
    console.log("\nSUCCESS: All generated IDs are unique.");
} else {
    console.error("\nFAILURE: ID collision detected!");
}

if (results.some(id => id.includes(':'))) {
    console.error("FAILURE: IDs still contain colons!");
} else {
    console.log("SUCCESS: Colons correctly stripped for SVG/CSS safety.");
}

console.log("\n--- TEST COMPLETE ---");
