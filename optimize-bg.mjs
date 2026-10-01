import { Jimp } from 'jimp';

async function optimize() {
  try {
    const bg = await Jimp.read('public/bg.jpg');
    // Scale it to max 1920px wide to save space, assuming it might be larger
    if (bg.bitmap.width > 1920) {
      bg.scaleToFit({ w: 1920, h: 1080 });
    }
    await bg.write('public/bg.jpg');
    console.log('Background optimized successfully!');
  } catch (err) {
    console.error(err);
  }
}

optimize();
