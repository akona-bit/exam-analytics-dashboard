import { Jimp } from 'jimp';

async function optimize() {
  try {
    const avatar = await Jimp.read('public/avatar.png');
    // Resize avatar to a max of 256x256 while keeping aspect ratio
    avatar.scaleToFit(256, 256);
    await avatar.writeAsync('public/avatar.png');
    console.log('Avatar optimized successfully!');
    
    // Optimize background if needed, but 350KB for a background isn't terrible. We can lower quality slightly to 80% to save some kb
    const bg = await Jimp.read('public/bg.jpg');
    bg.quality(80);
    await bg.writeAsync('public/bg.jpg');
    console.log('Background optimized successfully!');
    
  } catch (err) {
    console.error(err);
  }
}

optimize();
