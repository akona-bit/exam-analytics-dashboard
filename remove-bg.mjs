import { Jimp } from 'jimp';

async function removeBackground() {
  try {
    const image = await Jimp.read('public/avatar.png');
    
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // If the pixel is dark (close to black)
      if (r < 150 && g < 150 && b < 150) {
        // Calculate an alpha value based on lightness for smooth edges
        const lightness = (r + g + b) / 3;
        const newAlpha = Math.max(0, (lightness - 30) * 2); 
        this.bitmap.data[idx + 3] = newAlpha > 255 ? 255 : newAlpha; // Set alpha
      }
    });
    
    await image.write('public/avatar.png');
    console.log('Background removed successfully!');
  } catch (err) {
    console.error('Error:', err);
  }
}

removeBackground();
