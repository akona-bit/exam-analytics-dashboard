import { Jimp } from 'jimp';

async function floodFillTransparent() {
  try {
    console.log("Reading original avatar...");
    const image = await Jimp.read('public/avatar.png');
    
    // We will do a simple BFS (Flood Fill) from the 4 corners.
    // We consider a pixel "background" if it's very dark.
    const w = image.bitmap.width;
    const h = image.bitmap.height;
    
    // Create a visited array
    const visited = new Uint8Array(w * h);
    const queue = [];
    
    const isDark = (x, y) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return false;
      const idx = (w * y + x) << 2; // * 4
      const r = image.bitmap.data[idx];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];
      return r < 40 && g < 40 && b < 40; // strict threshold for edge
    };

    const pushIfValid = (x, y) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return;
      if (visited[y * w + x]) return;
      if (isDark(x, y)) {
        visited[y * w + x] = 1;
        queue.push([x, y]);
      }
    };

    // Start from corners
    pushIfValid(0, 0);
    pushIfValid(w - 1, 0);
    pushIfValid(0, h - 1);
    pushIfValid(w - 1, h - 1);

    let count = 0;
    while (queue.length > 0) {
      const [x, y] = queue.shift();
      count++;
      
      // Set to transparent
      const idx = (w * y + x) << 2;
      image.bitmap.data[idx + 3] = 0; // alpha = 0

      // check neighbors
      pushIfValid(x + 1, y);
      pushIfValid(x - 1, y);
      pushIfValid(x, y + 1);
      pushIfValid(x, y - 1);
    }

    console.log(`Removed \${count} background pixels.`);
    
    // Resize down if it's too big, to save space
    image.scaleToFit({ w: 256, h: 256 });
    
    await image.write('public/avatar.png');
    console.log("Saved processed avatar.png");

  } catch (err) {
    console.error("Error processing image:", err);
  }
}

floodFillTransparent();
