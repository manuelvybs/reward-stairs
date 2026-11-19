// node tools/gen-art.mjs  — sky plates, cloud plates (black) + music. Every call logged by fal.mjs.
import { run, download } from './fal.mjs';
const STYLE = 'Soft painterly gouache illustration with subtle watercolor paper grain, gentle hand-painted brush texture, dreamy storybook mood.';
const NO = 'No text, no letters, no logo, no characters, no people.';
const jobs = [
  ['sky_dusk', 'fal-ai/nano-banana-pro', { prompt: `${STYLE} An empty evening sky background for a game, wide panorama. Smooth vertical gradient: warm peach and soft pink glow along the bottom, lavender and periwinkle in the middle, deep violet blending into indigo at the very top. A few faint tiny stars near the top. No clouds, no moon, no sun, no land, no horizon objects. ${NO}`, aspect_ratio: '21:9', resolution: '2K', num_images: 1, output_format: 'jpeg' }],
  ['sky_night', 'fal-ai/nano-banana-pro', { prompt: `${STYLE} An empty night sky background for a game, wide panorama. Deep indigo (#2A2A8F) at the top blending into rich violet (#5A2E9E) and a soft magenta-lavender glow along the bottom. Many tiny white dots and small white and warm gold four-point sparkle stars scattered across the sky, faint soft nebula wisps. No clouds, no moon, no planets, no land. ${NO}`, aspect_ratio: '21:9', resolution: '2K', num_images: 1, output_format: 'jpeg' }],
  ...[['cloud_bank_a', '16:9', 'a long low wide bank of big fluffy cumulus puffs'], ['cloud_bank_b', '16:9', 'a wide rolling cloud bank with three tall rounded mounds'],
      ['cloud_tower', '3:4', 'a single tall towering cumulus cloud stack'], ['cloud_puff', '4:3', 'one small round fluffy cloud puff']].map(([n, ar, what]) =>
    [n, 'fal-ai/nano-banana-pro', { prompt: `${STYLE} ${what}, stylized like layered soft paper cutouts with rounded scalloped edges. Lit tops in warm cream, soft pink and peach; shadowed undersides in lavender and periwinkle blue; a faint glowing rim. The whole cloud is fully inside the frame, centered, with empty margin all around. Isolated on a flat solid pure black background (#000000). No sky, no stars, no moon. ${NO}`, aspect_ratio: ar, resolution: '2K', num_images: 1, output_format: 'png' }]),
  ['music_climb', 'elevenlabs/music/v2.5', { prompt: 'Dreamy gentle instrumental for a cute night-sky climbing game: soft music box and celesta melody over warm felt piano, airy synth pads and light glockenspiel sparkles, slow and wondrous, about 84 BPM, hopeful and magical, ends so it loops back to its start. Instrumental only, no vocals.', music_length_ms: 110000, force_instrumental: true, output_format: 'mp3_44100_128' }],
  ['music_end', 'elevenlabs/music/v2.5', { prompt: 'A short magical celebratory ending for a cute space adventure game: music box and celesta arpeggios swell with warm strings and twinkling chimes into a joyful bright melody and resolve on a gentle shimmering final chord under the moon. Instrumental only, no vocals.', music_length_ms: 24000, force_instrumental: true, output_format: 'mp3_44100_128' }],
];
const only = process.argv.slice(2);
await Promise.all(jobs.filter(([n]) => !only.length || only.includes(n)).map(async ([name, ep, input]) => {
  try {
    const res = await run(ep, input, name);
    const url = res.images?.[0]?.url || res.audio?.url || res.audio_file?.url || JSON.stringify(res).match(/https:\/\/[^"]+/)?.[0];
    const ext = ep.includes('music') ? 'mp3' : (input.output_format === 'png' ? 'png' : 'jpg');
    await download(url, `art-src/${name}.${ext}`);
    console.log('ok', name, url);
  } catch (e) { console.log('FAIL', name, e.message); }
}));
