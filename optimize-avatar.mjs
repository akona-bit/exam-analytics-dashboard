import { Jimp } from 'jimp';

async function optimizeAvatar() {
  try {
    const image = await Jimp.read('public/avatar.png');
    // Just scale down to 256x256
    image.scaleToFit({ w: 256, h: 256 });
    await image.write('public/avatar.png');
    console.log("Saved optimized avatar.png without removing any colors.");
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

optimizeAvatar();
